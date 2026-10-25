import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AccountQuotaInfo, WidgetConfig } from '../types';
import { loadConfig, saveConfig } from '../services/configStorage';
import { CpaClient } from '../services/api/cpaClient';

const RESIZE_PERSIST_DELAY_MS = 180;
const PROGRAMMATIC_RESIZE_GUARD_MS = 500;

export function handleWindowDrag(event: React.MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('.mini-widget-box, .card-top-header')) return;
  if (target.closest('button, input, select, textarea, [data-no-drag]')) return;
  if (event.button !== 0 || event.detail > 1 || !isTauri()) return;

  const { clientX, clientY } = event;
  const cleanup = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', cleanup);
    window.removeEventListener('blur', cleanup);
  };
  const move = (pointer: MouseEvent) => {
    if (!(pointer.buttons & 1)) return cleanup();
    if (Math.hypot(pointer.clientX - clientX, pointer.clientY - clientY) < 4) return;
    cleanup();
    void getCurrentWindow().startDragging().catch((error) => {
      console.debug('Failed to start dragging window', error);
    });
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', cleanup, { once: true });
  window.addEventListener('blur', cleanup, { once: true });
}

export function useCpaQuota() {
  const [config, setConfig] = useState<WidgetConfig>(() => loadConfig());
  const [accounts, setAccounts] = useState<AccountQuotaInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const configRef = useRef(config);
  const ignoreResizeUntilRef = useRef(0);
  const resizeTimerRef = useRef<number | null>(null);
  const resizeEpochRef = useRef(0);

  configRef.current = config;

  const resizeWindow = useCallback(async (mode: WidgetConfig['displayMode']) => {
    if (!isTauri()) return;
    resizeEpochRef.current += 1;
    if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
    const size = configRef.current.windowSizes[mode];
    ignoreResizeUntilRef.current = Date.now() + PROGRAMMATIC_RESIZE_GUARD_MS;
    try {
      await invoke('resize_window', { width: size.width, height: size.height });
    } catch (err) {
      console.debug('Failed to resize window via Tauri', err);
    } finally {
      ignoreResizeUntilRef.current = Date.now() + PROGRAMMATIC_RESIZE_GUARD_MS;
    }
  }, []);

  const syncAlwaysOnTop = useCallback(async (alwaysOnTop: boolean) => {
    if (!isTauri()) return;
    try {
      await invoke('set_always_on_top', { alwaysOnTop });
    } catch (err) {
      console.debug('Failed to set always on top via Tauri', err);
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<WidgetConfig>) => {
    const next = saveConfig(updates);
    configRef.current = next;
    setConfig(next);

    if (updates.displayMode !== undefined) {
      void resizeWindow(next.displayMode);
    }
    if (updates.alwaysOnTop !== undefined) {
      void syncAlwaysOnTop(next.alwaysOnTop);
    }
  }, [resizeWindow, syncAlwaysOnTop]);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (!config.cpaBaseUrl || !config.managementKey) {
      setAccounts([]);
      setError(null);
      return;
    }

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const client = new CpaClient(config);
      const data = await client.loadAllAccountsWithQuota();
      data.sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        if (a.remainingPercent !== null && b.remainingPercent !== null) {
          return a.remainingPercent - b.remainingPercent;
        }
        return (a.remainingPercent === null ? 1 : 0) - (b.remainingPercent === null ? 1 : 0);
      });
      setAccounts(data);
      setLastRefreshedAt(Date.now());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.cpaBaseUrl, config.managementKey]);

  useEffect(() => {
    void resizeWindow(config.displayMode);
    void syncAlwaysOnTop(config.alwaysOnTop);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);


  useEffect(() => {
    if (!isTauri()) return;
    const nativeWindow = getCurrentWindow();
    const unlistenPromise = nativeWindow.onResized(({ payload }) => {
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      if (Date.now() < ignoreResizeUntilRef.current) return;
      const mode = configRef.current.displayMode;
      const epoch = resizeEpochRef.current;
      resizeTimerRef.current = window.setTimeout(async () => {
        const scaleFactor = await nativeWindow.scaleFactor();
        if (epoch !== resizeEpochRef.current || mode !== configRef.current.displayMode) return;
        if (await nativeWindow.isMaximized()) return;
        if (epoch !== resizeEpochRef.current) return;
        const logicalSize = payload.toLogical(scaleFactor);
        const current = loadConfig();
        const next = saveConfig({
          windowSizes: {
            ...current.windowSizes,
            [mode]: {
              width: Math.max(260, Math.round(logicalSize.width)),
              height: Math.max(100, Math.round(logicalSize.height)),
            },
          },
        });
        configRef.current = next;
        setConfig(next);
      }, RESIZE_PERSIST_DELAY_MS);
    });

    return () => {
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const refreshTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (refreshTimerRef.current !== null) window.clearInterval(refreshTimerRef.current);
    const intervalMs = Math.max(1, config.refreshIntervalMinutes) * 60 * 1000;
    refreshTimerRef.current = window.setInterval(() => {
      void loadData(true);
    }, intervalMs);

    return () => {
      if (refreshTimerRef.current !== null) window.clearInterval(refreshTimerRef.current);
    };
  }, [config.refreshIntervalMinutes, loadData]);

  const toggleDisplayMode = useCallback(() => {
    updateConfig({ displayMode: config.displayMode === 'mini' ? 'expanded' : 'mini' });
  }, [config.displayMode, updateConfig]);

  return {
    config,
    accounts,
    loading,
    refreshing,
    error,
    lastRefreshedAt,
    settingsOpen,
    setSettingsOpen,
    updateConfig,
    refresh: () => loadData(true),
    toggleDisplayMode,
  };
}
