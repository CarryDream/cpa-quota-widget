import type { AccountQuotaInfo, QuotaWindow } from '../types';

export function maskAccountName(raw: string): string {
  const name = raw.trim();
  if (!name) return name;

  // 1. Email address
  if (name.includes('@') && !name.startsWith('@') && !name.endsWith('@')) {
    const atIndex = name.indexOf('@');
    const user = name.slice(0, atIndex);
    const domain = name.slice(atIndex);
    let maskedUser = '*';
    if (user.length === 2) {
      maskedUser = `${user[0]}*`;
    } else if (user.length === 3) {
      maskedUser = `${user[0]}*${user[2]}`;
    } else if (user.length > 3) {
      maskedUser = `${user.slice(0, 2)}***${user.slice(-1)}`;
    }
    return `${maskedUser}${domain}`;
  }

  // 2. Phone number (11-digit mobile)
  const digitsOnly = name.replace(/\D/g, '');
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1') && name.length <= 15) {
    return `${name.slice(0, 3)}****${name.slice(-4)}`;
  }

  // 3. General identifier / note
  if (name.length <= 1) return '*';
  if (name.length === 2) return `${name[0]}*`;
  if (name.length === 3) return `${name[0]}*${name[2]}`;
  if (name.length <= 6) return `${name[0]}***${name.slice(-1)}`;
  return `${name.slice(0, 2)}***${name.slice(-2)}`;
}

export function getAccountLabel(account: AccountQuotaInfo, mask = false): string {
  let label = '';
  if (account.note?.trim()) {
    label = account.note.trim();
  } else {
    const name = account.fileName.replace(/\.json$/i, '');
    const prefix = `${account.provider}-`;
    label = name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
  }
  return mask ? maskAccountName(label) : label;
}

export function getQuotaColor(remaining: number | null): string {
  if (remaining === null) return 'var(--text-dim)';
  if (remaining <= 0) return 'var(--color-red)';
  if (remaining <= 20) return 'var(--color-amber)';
  return 'var(--color-green)';
}

export function getCompactWindowLabel(window: QuotaWindow): string {
  const identity = `${window.id} ${window.label}`.toLowerCase();
  if (identity.includes('5h') || identity.includes('5小时') || identity.includes('five')) return '5h';
  if (identity.includes('week') || identity.includes('周') || identity.includes('7天')) return '周';
  if (identity.includes('month') || identity.includes('月')) return '月';
  if (identity.includes('flash')) return 'Flash';
  if (identity.includes('pro')) return 'Pro';
  if (identity.includes('claude')) return 'Claude';
  return window.label.replace(/gemini[\s-]*/i, '').split(/\s*·\s*/)[0].slice(0, 6) || '额度';
}

export function formatCompactReset(window: QuotaWindow): string {
  if (window.resetAtMs === null) return '—';
  const minutes = Math.ceil((window.resetAtMs - Date.now()) / 60000);
  if (minutes <= 0) return '待重置';
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}天`;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h${remainder}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
