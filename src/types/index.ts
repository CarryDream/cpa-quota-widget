export interface AuthFileItem {
  name: string;
  provider?: string;
  auth_index?: string | number;
  authIndex?: string | number;
  priority?: number;
  weight?: number;
  note?: string;
  disabled?: boolean;
  runtime_only?: boolean;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
}

export type QuotaStatus = 'ok' | 'warn' | 'exhausted' | 'disabled' | 'loading' | 'error' | 'unknown';

export interface QuotaWindow {
  id: string;
  label: string;
  usedPercent: number | null;
  remainingPercent: number | null;
  resetAtMs: number | null;
  resetLabel: string;
}

export interface AccountQuotaInfo {
  fileName: string;
  authIndex: string;
  provider: string;
  planType: string | null;
  disabled: boolean;
  priority: number;
  note?: string;
  status: QuotaStatus;
  statusMessage?: string;
  remainingPercent: number | null;
  resetLabel: string;
  resetAtMs: number | null;
  windows: QuotaWindow[];
  resetCreditsCount?: number | null;
  fetchedAtMs?: number;
  error?: string;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WidgetConfig {
  cpaBaseUrl: string;
  managementKey: string;
  refreshIntervalMinutes: number;
  displayMode: 'mini' | 'expanded';
  alwaysOnTop: boolean;
  opacity: number;
  theme: 'dark' | 'light';
  maskAccountNames?: boolean;
  windowSizes: {
    mini: WindowSize;
    expanded: WindowSize;
  };
}
