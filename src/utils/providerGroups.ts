import type { AccountQuotaInfo } from '../types';

export type ProviderGroup = 'all' | 'google' | 'codex' | 'xai' | 'claude' | 'kimi' | 'other';

const PROVIDER_LABELS: Record<ProviderGroup, string> = {
  all: '全部',
  google: 'Google',
  codex: 'Codex',
  xai: 'xAI',
  claude: 'Claude',
  kimi: 'Kimi',
  other: '其他',
};

const PROVIDER_ORDER: Exclude<ProviderGroup, 'all'>[] = [
  'google',
  'codex',
  'xai',
  'claude',
  'kimi',
  'other',
];

export function getProviderGroup(provider: string): Exclude<ProviderGroup, 'all'> {
  const normalized = provider.trim().toLowerCase();
  if (['antigravity', 'gemini', 'google'].some((name) => normalized.includes(name))) return 'google';
  if (['codex', 'openai', 'chatgpt'].some((name) => normalized.includes(name))) return 'codex';
  if (['xai', 'grok'].some((name) => normalized.includes(name))) return 'xai';
  if (['claude', 'anthropic'].some((name) => normalized.includes(name))) return 'claude';
  if (normalized.includes('kimi')) return 'kimi';
  return 'other';
}

export function getProviderLabel(group: ProviderGroup): string {
  return PROVIDER_LABELS[group];
}

export function getAvailableProviderGroups(accounts: AccountQuotaInfo[]): ProviderGroup[] {
  const available = new Set(accounts.map((account) => getProviderGroup(account.provider)));
  return ['all', ...PROVIDER_ORDER.filter((group) => available.has(group))];
}
