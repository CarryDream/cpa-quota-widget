import type { AuthFileItem, QuotaWindow, QuotaStatus } from '../types';

export function formatTimeRemaining(targetMs: number | null): string {
  if (!targetMs || targetMs <= 0) return '-';
  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return '已重置';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}天${hours > 0 ? ` ${hours}小时` : ''}`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? ` ${minutes}分` : ''}`;
  }
  return `${Math.max(1, minutes)}分钟`;
}

export function parseResetTimestamp(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === 'number') {
    // If in seconds (10 digits), convert to ms
    return val < 10000000000 ? val * 1000 : val;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
    const num = Number(val);
    if (!Number.isNaN(num) && num > 0) {
      return num < 10000000000 ? num * 1000 : num;
    }
  }
  return null;
}

export function parseCodexQuota(payload: Record<string, unknown>): {
  planType: string | null;
  windows: QuotaWindow[];
  resetCreditsCount: number | null;
} {
  const planType = (payload.plan_type ?? payload.planType ?? null) as string | null;
  const windows: QuotaWindow[] = [];

  const rateLimit = (payload.rate_limit ?? payload.rateLimit) as Record<string, unknown> | undefined;
  if (rateLimit && typeof rateLimit === 'object') {
    // Primary window (usually 5-hour)
    const primary = (rateLimit.primary_window ?? rateLimit.primaryWindow) as Record<string, unknown> | undefined;
    if (primary && typeof primary === 'object') {
      const used = Number(primary.used_percent ?? primary.usedPercent ?? 0);
      const remaining = Math.max(0, 100 - used);
      const resetAt = parseResetTimestamp(primary.resets_at ?? primary.resetsAt);
      windows.push({
        id: '5h',
        label: '5小时限制',
        usedPercent: used,
        remainingPercent: remaining,
        resetAtMs: resetAt,
        resetLabel: formatTimeRemaining(resetAt),
      });
    }

    // Secondary window (usually weekly)
    const secondary = (rateLimit.secondary_window ?? rateLimit.secondaryWindow) as Record<string, unknown> | undefined;
    if (secondary && typeof secondary === 'object') {
      const used = Number(secondary.used_percent ?? secondary.usedPercent ?? 0);
      const remaining = Math.max(0, 100 - used);
      const resetAt = parseResetTimestamp(secondary.resets_at ?? secondary.resetsAt);
      windows.push({
        id: 'weekly',
        label: '周限额',
        usedPercent: used,
        remainingPercent: remaining,
        resetAtMs: resetAt,
        resetLabel: formatTimeRemaining(resetAt),
      });
    }
  }

  // Rate limit reset credits
  let resetCreditsCount: number | null = null;
  const resetCredits = (payload.rate_limit_reset_credits ?? payload.rateLimitResetCredits) as Record<string, unknown> | undefined;
  if (resetCredits && typeof resetCredits === 'object') {
    const count = Number(resetCredits.available_count ?? resetCredits.availableCount ?? 0);
    resetCreditsCount = Number.isFinite(count) ? count : 0;
  }

  return { planType, windows, resetCreditsCount };
}

export function parseClaudeQuota(payload: Record<string, unknown>): {
  windows: QuotaWindow[];
} {
  const windows: QuotaWindow[] = [];

  const fiveHour = payload.five_hour as Record<string, unknown> | undefined;
  if (fiveHour && typeof fiveHour === 'object') {
    const used = Number(fiveHour.used_percent ?? fiveHour.usedPercent ?? 0);
    const resetAt = parseResetTimestamp(fiveHour.resets_at ?? fiveHour.resetsAt);
    windows.push({
      id: 'five_hour',
      label: '5小时窗口',
      usedPercent: used,
      remainingPercent: Math.max(0, 100 - used),
      resetAtMs: resetAt,
      resetLabel: formatTimeRemaining(resetAt),
    });
  }

  const sevenDay = payload.seven_day as Record<string, unknown> | undefined;
  if (sevenDay && typeof sevenDay === 'object') {
    const used = Number(sevenDay.used_percent ?? sevenDay.usedPercent ?? 0);
    const resetAt = parseResetTimestamp(sevenDay.resets_at ?? sevenDay.resetsAt);
    windows.push({
      id: 'seven_day',
      label: '7天窗口',
      usedPercent: used,
      remainingPercent: Math.max(0, 100 - used),
      resetAtMs: resetAt,
      resetLabel: formatTimeRemaining(resetAt),
    });
  }

  return { windows };
}

export function parseAntigravityQuota(payload: Record<string, unknown>): {
  windows: QuotaWindow[];
} {
  const windows: QuotaWindow[] = [];
  const summary = (payload.userQuotaSummary ?? payload) as Record<string, unknown>;
  const groups = Array.isArray(summary.groups) ? summary.groups : [];

  for (const rawGroup of groups) {
    if (typeof rawGroup !== 'object' || rawGroup === null) continue;
    const group = rawGroup as Record<string, unknown>;
    const groupLabel = String(group.displayName ?? group.name ?? group.label ?? '模型配额');
    const buckets = Array.isArray(group.buckets) ? group.buckets : [group];

    for (const rawBucket of buckets) {
      if (typeof rawBucket !== 'object' || rawBucket === null) continue;
      const bucket = rawBucket as Record<string, unknown>;
      const rawFraction = Number(bucket.remainingFraction ?? bucket.remaining_fraction);
      if (!Number.isFinite(rawFraction)) continue;

      const remainingPercent = Math.round(Math.min(1, Math.max(0, rawFraction)) * 100);
      const resetAt = parseResetTimestamp(bucket.resetTime ?? bucket.reset_time);
      const bucketLabel = String(bucket.window ?? bucket.displayName ?? bucket.name ?? '');
      windows.push({
        id: String(bucket.bucketId ?? bucket.id ?? `${groupLabel}-${bucketLabel}`),
        label: bucketLabel ? `${groupLabel} · ${bucketLabel}` : groupLabel,
        usedPercent: 100 - remainingPercent,
        remainingPercent,
        resetAtMs: resetAt,
        resetLabel: formatTimeRemaining(resetAt),
      });
    }
  }

  return { windows };
}

/** Keep paid/current tier precedence aligned with the management page's loadCodeAssist parser. */
export function parseGoogleSubscriptionPlan(payload: Record<string, unknown>): string | null {
  type Tier = { id: string | null; name: string | null };
  const normalizeTier = (value: unknown): Tier => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return { id: null, name: null };
    const tier = value as { id?: unknown; name?: unknown };
    return {
      id: typeof tier.id === 'string' ? tier.id.trim() || null : null,
      name: typeof tier.name === 'string' ? tier.name.trim() || null : null,
    };
  };
  const paid = normalizeTier(payload.paidTier ?? payload.paid_tier);
  const current = normalizeTier(payload.currentTier ?? payload.current_tier);
  const effective = paid.id ? paid : current;
  switch (effective.id) {
    case 'free-tier': return 'Free';
    case 'g1-pro-tier': return 'Pro';
    case 'g1-ultra-tier': return 'Ultra';
    case 'g1-ultra-lite-tier': return 'Ultra Lite';
    default: return effective.name ?? effective.id;
  }
}


export function parseKimiQuota(payload: Record<string, unknown>): {
  windows: QuotaWindow[];
} {
  const windows: QuotaWindow[] = [];
  const usages = Array.isArray(payload.usages) ? payload.usages : [];

  for (const item of usages) {
    if (typeof item !== 'object' || !item) continue;
    const label = String(item.name || item.model || 'Kimi 用量');
    const limit = Number(item.limit || 1);
    const used = Number(item.used || 0);
    const remaining = Math.max(0, Math.round(((limit - used) / limit) * 100));
    const resetAt = parseResetTimestamp(item.reset_at || item.resets_at);
    windows.push({
      id: String(item.id || label),
      label,
      usedPercent: 100 - remaining,
      remainingPercent: remaining,
      resetAtMs: resetAt,
      resetLabel: formatTimeRemaining(resetAt),
    });
  }

  return { windows };
}

const readCentValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return readCentValue(record.val ?? record.value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseXaiQuota(payload: Record<string, unknown>): {
  windows: QuotaWindow[];
} {
  const config =
    payload.config && typeof payload.config === 'object'
      ? payload.config as Record<string, unknown>
      : payload;
  const period =
    config.currentPeriod && typeof config.currentPeriod === 'object'
      ? config.currentPeriod as Record<string, unknown>
      : config.current_period && typeof config.current_period === 'object'
        ? config.current_period as Record<string, unknown>
        : null;
  const rawUsagePercent = Number(config.creditUsagePercent ?? config.credit_usage_percent);
  const monthlyLimit = readCentValue(config.monthlyLimit ?? config.monthly_limit);
  const monthlyUsed = readCentValue(config.used);

  let usedPercent: number | null = Number.isFinite(rawUsagePercent) ? rawUsagePercent : null;
  let label = '周额度';
  if (usedPercent === null && monthlyLimit !== null && monthlyLimit > 0 && monthlyUsed !== null) {
    usedPercent = (monthlyUsed / monthlyLimit) * 100;
    label = '月额度';
  } else {
    const periodType = String(period?.type ?? '').toLowerCase();
    if (periodType.includes('month')) label = '月额度';
  }

  const resetAt = parseResetTimestamp(
    period?.end ?? config.billingPeriodEnd ?? config.billing_period_end
  );
  const normalizedUsed = usedPercent === null
    ? null
    : Math.min(100, Math.max(0, Math.round(usedPercent)));
  return {
    windows: [{
      id: label === '周额度' ? 'weekly' : 'monthly',
      label,
      usedPercent: normalizedUsed,
      remainingPercent: normalizedUsed === null ? null : 100 - normalizedUsed,
      resetAtMs: resetAt,
      resetLabel: formatTimeRemaining(resetAt),
    }],
  };
}

export function deriveAccountStatus(
  file: AuthFileItem,
  windows: QuotaWindow[],
  error?: string
): { status: QuotaStatus; remainingPercent: number | null; resetLabel: string; resetAtMs: number | null } {
  if (file.disabled) {
    return { status: 'disabled', remainingPercent: null, resetLabel: '已禁用', resetAtMs: null };
  }
  if (error) {
    return { status: 'error', remainingPercent: null, resetLabel: '刷新异常', resetAtMs: null };
  }
  const measurableWindows = windows.filter((window) => window.remainingPercent !== null);
  if (measurableWindows.length === 0) {
    const firstReset = windows.find((window) => window.resetAtMs !== null);
    return {
      status: 'unknown',
      remainingPercent: null,
      resetLabel: firstReset?.resetLabel ?? '-',
      resetAtMs: firstReset?.resetAtMs ?? null,
    };
  }

  // Find lowest remaining percentage
  let minRemaining = 100;
  let primaryResetLabel = '-';
  let primaryResetAtMs: number | null = null;

  for (const w of windows) {
    if (w.remainingPercent !== null) {
      if (w.remainingPercent < minRemaining) {
        minRemaining = w.remainingPercent;
        primaryResetLabel = w.resetLabel;
        primaryResetAtMs = w.resetAtMs;
      }
    }
  }

  let status: QuotaStatus = 'ok';
  if (minRemaining <= 0) {
    status = 'exhausted';
  } else if (minRemaining <= 20) {
    status = 'warn';
  }

  return {
    status,
    remainingPercent: minRemaining,
    resetLabel: primaryResetLabel,
    resetAtMs: primaryResetAtMs,
  };
}
