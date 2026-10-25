import { invoke } from '@tauri-apps/api/core';
import type { AuthFileItem, AccountQuotaInfo, WidgetConfig } from '../../types';
import {
  parseCodexQuota,
  parseClaudeQuota,
  parseAntigravityQuota,
  parseKimiQuota,
  parseXaiQuota,
  parseGoogleSubscriptionPlan,
  deriveAccountStatus,
} from '../../utils/quotaParsers';

export interface CpaFetchOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface CpaFetchResponse<T = unknown> {
  statusCode: number;
  headers: Record<string, string>;
  body: T;
  bodyText: string;
}

/**
 * Universal fetch that routes via Tauri Rust invoke if available (bypassing CORS),
 * or falls back to browser fetch for browser preview/testing.
 */
export async function universalFetch<T = unknown>(options: CpaFetchOptions): Promise<CpaFetchResponse<T>> {
  const { method = 'GET', url, headers = {}, body, timeoutMs = 15000 } = options;

  // Try Tauri command invoke first
  try {
    const res = await invoke<{ status_code: number; headers: Record<string, string>; body_text: string }>('cpa_fetch', {
      method,
      url,
      headers,
      body: body ?? null,
      timeoutMs,
    });

    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(res.body_text);
    } catch {
      parsedBody = res.body_text;
    }

    return {
      statusCode: res.status_code,
      headers: res.headers || {},
      body: parsedBody as T,
      bodyText: res.body_text,
    };
  } catch (err) {
    console.debug('Tauri invoke not available, falling back to browser fetch', err);
  }

  // Fallback to standard fetch
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? body : undefined,
      signal: controller.signal,
    });
    const bodyText = await resp.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = bodyText;
    }
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    return {
      statusCode: resp.status,
      headers: respHeaders,
      body: parsed as T,
      bodyText,
    };
  } finally {
    clearTimeout(id);
  }
}

type ApiCallRequest = {
  authIndex: string;
  method: 'GET' | 'POST';
  url: string;
  header: Record<string, string>;
  data?: string;
};
type ApiCallEnvelope = {
  status_code?: unknown;
  statusCode?: unknown;
  body?: unknown;
};

type ProviderErrorBody = {
  error?: string | { message?: unknown };
  message?: unknown;
};

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

class ProviderApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export class CpaClient {
  private baseUrl: string;
  private key: string;

  constructor(config: Pick<WidgetConfig, 'cpaBaseUrl' | 'managementKey'>) {
    this.baseUrl = config.cpaBaseUrl.replace(/\/+$/, '').replace(/\/v0\/management\/?$/i, '');
    this.key = config.managementKey.trim();
  }

  private get authHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.key) {
      h['Authorization'] = `Bearer ${this.key}`;
    }
    return h;
  }

  async getAuthFiles(): Promise<AuthFileItem[]> {
    const url = `${this.baseUrl}/v0/management/auth-files`;
    const res = await universalFetch<{ files?: AuthFileItem[] }>({
      url,
      method: 'GET',
      headers: this.authHeaders,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`获取凭证失败: HTTP ${res.statusCode} - ${res.bodyText}`);
    }

    if (Array.isArray(res.body)) {
      return res.body;
    }
    if (Array.isArray(res.body?.files)) {
      return res.body.files;
    }
    return [];
  }

  private async requestProvider(payload: ApiCallRequest): Promise<Record<string, unknown>> {
    const res = await universalFetch<Record<string, unknown>>({
      url: `${this.baseUrl}/v0/management/api-call`,
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(payload),
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`额度代理请求失败: HTTP ${res.statusCode} - ${res.bodyText}`);
    }

    const envelope =
      res.body !== null && typeof res.body === 'object' && !Array.isArray(res.body)
        ? res.body as ApiCallEnvelope
        : {};
    const rawStatusCode = envelope.status_code ?? envelope.statusCode;
    const statusCode = Number(rawStatusCode ?? 0);
    const body = parseMaybeJson(envelope.body);
    if (statusCode < 200 || statusCode >= 300) {
      let message = typeof body === 'string' ? body : '';
      if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
        const errorBody = body as ProviderErrorBody;
        const error = errorBody.error;
        message =
          typeof error === 'object' && error !== null && typeof error.message === 'string'
            ? error.message
            : typeof error === 'string'
              ? error
              : typeof errorBody.message === 'string'
                ? errorBody.message
                : JSON.stringify(body);
      }
      throw new ProviderApiError(`${statusCode || 'HTTP'} ${message || '额度请求失败'}`, statusCode);
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('额度接口返回了无法识别的数据');
    }
    return body as Record<string, unknown>;
  }

  private async fetchGoogleSubscription(authIndex: string): Promise<string | null> {
    const urls = [
      'https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
      'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
    ];
    for (const url of urls) {
      try {
        const body = await this.requestProvider({
          authIndex,
          method: 'POST',
          url,
          header: {
            Authorization: 'Bearer $TOKEN$',
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/hub/2.23.0 darwin/arm64',
          },
          data: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
        });
        return parseGoogleSubscriptionPlan(body);
      } catch (error) {
        // Subscription metadata must not discard successfully fetched quota windows.
        if (error instanceof ProviderApiError && error.statusCode === 429) return null;
      }
    }
    return null;
  }

  async fetchProviderQuota(file: AuthFileItem): Promise<Partial<AccountQuotaInfo>> {
    const rawAuthIndex = file.auth_index ?? file.authIndex;
    if (rawAuthIndex === undefined || rawAuthIndex === null || rawAuthIndex === '') {
      return {
        status: 'unknown',
        statusMessage: '未分配 auth_index',
        windows: [],
      };
    }

    const authIndex = String(rawAuthIndex);
    const provider = String(file.provider || '').toLowerCase();
    const tokenHeader = { Authorization: 'Bearer $TOKEN$' };

    if (provider.includes('codex') || provider.includes('openai') || provider.includes('chatgpt')) {
      const header: Record<string, string> = {
        ...tokenHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'codex-tui/0.149.1 (Mac OS 26.5.2; arm64) iTerm.app/3.6.11 (codex-tui; 0.149.1)',
      };
      const accountId = String(file.chatgpt_account_id ?? file.account_id ?? '').trim();
      if (accountId) header['Chatgpt-Account-Id'] = accountId;
      const body = await this.requestProvider({
        authIndex,
        method: 'GET',
        url: 'https://chatgpt.com/backend-api/wham/usage',
        header,
      });
      const parsed = parseCodexQuota(body);
      return {
        planType: parsed.planType,
        windows: parsed.windows,
        resetCreditsCount: parsed.resetCreditsCount,
      };
    }

    if (provider.includes('claude') || provider.includes('anthropic')) {
      const body = await this.requestProvider({
        authIndex,
        method: 'GET',
        url: 'https://api.anthropic.com/api/oauth/usage',
        header: {
          ...tokenHeader,
          'Content-Type': 'application/json',
          'anthropic-beta': 'oauth-2025-04-20',
        },
      });
      return { windows: parseClaudeQuota(body).windows };
    }

    if (provider.includes('antigravity') || provider.includes('gemini') || provider.includes('google')) {
      const projectId = String(file.project_id ?? file.projectId ?? 'aicode-consumers').trim();
      const urls = [
        'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
        'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary',
        'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
      ];
      let lastError: unknown = null;
      for (const url of urls) {
        try {
          const body = await this.requestProvider({
            authIndex,
            method: 'POST',
            url,
            header: {
              ...tokenHeader,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/hub/2.23.0 darwin/arm64',
            },
            data: JSON.stringify({ project: projectId || 'aicode-consumers' }),
          });
          const parsed = parseAntigravityQuota(body);
          if (parsed.windows.length > 0) {
            return {
              windows: parsed.windows,
              planType: await this.fetchGoogleSubscription(authIndex),
            };
          }
          lastError = new Error('额度接口未返回可用窗口');
        } catch (error) {
          lastError = error;
          if (error instanceof ProviderApiError && error.statusCode === 429) throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Antigravity 额度查询失败');
    }

    if (provider.includes('kimi')) {
      const body = await this.requestProvider({
        authIndex,
        method: 'GET',
        url: 'https://api.kimi.com/coding/v1/usages',
        header: tokenHeader,
      });
      return { windows: parseKimiQuota(body).windows };
    }

    if (provider.includes('xai') || provider.includes('grok')) {
      const header: Record<string, string> = {
        ...tokenHeader,
        'x-xai-token-auth': 'xai-grok-cli',
        'x-grok-client-version': '1.0.44',
        accept: '*/*',
        'user-agent': 'grok-pager/1.0.44 grok-shell/1.0.44 (macos; aarch64)',
      };
      const userId = String(file.user_id ?? file.userId ?? '').trim();
      if (userId) header['x-userid'] = userId;

      const weeklyBody = await this.requestProvider({
        authIndex,
        method: 'GET',
        url: 'https://cli-chat-proxy.grok.com/v1/billing?format=credits',
        header,
      });
      const weekly = parseXaiQuota(weeklyBody);
      if (weekly.windows.some((window) => window.remainingPercent !== null)) {
        return { windows: weekly.windows };
      }

      const monthlyBody = await this.requestProvider({
        authIndex,
        method: 'GET',
        url: 'https://cli-chat-proxy.grok.com/v1/billing',
        header,
      });
      const monthly = parseXaiQuota(monthlyBody);
      return {
        windows: monthly.windows.some((window) => window.remainingPercent !== null)
          ? monthly.windows
          : weekly.windows,
      };
    }

    return {
      status: 'unknown',
      statusMessage: `暂不支持 ${file.provider || '未知'} 凭证的额度查询`,
      windows: [],
    };
  }

  async loadAllAccountsWithQuota(): Promise<AccountQuotaInfo[]> {
    const files = await this.getAuthFiles();
    const results: AccountQuotaInfo[] = [];

    for (const file of files) {
      const rawAuthIndex = file.auth_index ?? file.authIndex ?? '';
      const authIndex = String(rawAuthIndex);
      const provider = String(file.provider || 'unknown').toLowerCase();
      const priority = Number(file.priority || 0);
      const disabled = Boolean(file.disabled) || file.status === 'disabled';
      const note = typeof file.note === 'string' ? file.note : undefined;

      // 如果 CPA 中禁用了，面板上不做显示
      if (disabled) {
        continue;
      }

      try {
        const quotaData = await this.fetchProviderQuota(file);
        const windows = quotaData.windows || [];
        const statusMeta = deriveAccountStatus(file, windows);

        results.push({
          fileName: file.name,
          authIndex,
          provider,
          planType: quotaData.planType || null,
          disabled: false,
          priority,
          note,
          status: statusMeta.status,
          statusMessage: statusMeta.resetLabel,
          remainingPercent: statusMeta.remainingPercent,
          resetLabel: statusMeta.resetLabel,
          resetAtMs: statusMeta.resetAtMs,
          windows,
          resetCreditsCount: quotaData.resetCreditsCount,
          fetchedAtMs: Date.now(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          fileName: file.name,
          authIndex,
          provider,
          planType: null,
          disabled: false,
          priority,
          note,
          status: 'error',
          statusMessage: msg,
          remainingPercent: null,
          resetLabel: '请求错误',
          resetAtMs: null,
          windows: [],
          error: msg,
          fetchedAtMs: Date.now(),
        });
      }
    }

    return results;
  }
}
