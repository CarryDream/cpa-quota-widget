import type { WidgetConfig } from '../types';

const STORAGE_KEY = 'cpa_widget_config';

const DEFAULT_WINDOW_SIZES = {
  mini: { width: 320, height: 280 },
  expanded: { width: 380, height: 580 },
};

export const DEFAULT_CONFIG: WidgetConfig = {
  cpaBaseUrl: 'http://localhost:8317',
  managementKey: '',
  refreshIntervalMinutes: 5,
  displayMode: 'mini',
  alwaysOnTop: true,
  opacity: 0.96,
  theme: 'dark',
  maskAccountNames: false,
  windowSizes: DEFAULT_WINDOW_SIZES,
};

const normalizeWindowSize = (
  value: { width?: unknown; height?: unknown } | undefined,
  fallback: { width: number; height: number }
) => {
  const width = Number(value?.width);
  const height = Number(value?.height);
  return {
    width: Number.isFinite(width) ? Math.max(260, Math.round(width)) : fallback.width,
    height: Number.isFinite(height) ? Math.max(100, Math.round(height)) : fallback.height,
  };
};

export function loadConfig(): WidgetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<WidgetConfig>;
    return {
      cpaBaseUrl: parsed.cpaBaseUrl?.trim() || DEFAULT_CONFIG.cpaBaseUrl,
      managementKey: parsed.managementKey?.trim() || '',
      refreshIntervalMinutes: Math.max(1, Number(parsed.refreshIntervalMinutes) || DEFAULT_CONFIG.refreshIntervalMinutes),
      displayMode: parsed.displayMode === 'expanded' ? 'expanded' : 'mini',
      alwaysOnTop: parsed.alwaysOnTop !== false,
      opacity: typeof parsed.opacity === 'number' ? Math.min(1, Math.max(0.5, parsed.opacity)) : DEFAULT_CONFIG.opacity,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      maskAccountNames: Boolean(parsed.maskAccountNames),
      windowSizes: {
        mini: normalizeWindowSize(parsed.windowSizes?.mini, DEFAULT_WINDOW_SIZES.mini),
        expanded: normalizeWindowSize(parsed.windowSizes?.expanded, DEFAULT_WINDOW_SIZES.expanded),
      },
    };
  } catch (err) {
    console.error('Failed to load widget config from storage', err);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(updates: Partial<WidgetConfig>): WidgetConfig {
  const current = loadConfig();
  const next: WidgetConfig = {
    ...current,
    ...updates,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save widget config to storage', err);
  }
  return next;
}
