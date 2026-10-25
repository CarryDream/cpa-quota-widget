import { useEffect, useState, type CSSProperties } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCpaQuota, handleWindowDrag } from './hooks/useCpaQuota';
import { MiniCapsule } from './components/MiniCapsule';
import { ExpandedCard } from './components/ExpandedCard';
import { SettingsModal } from './components/SettingsModal';
import lightLogo from '../src-tauri/icons/logo-light.png';
import darkLogo from '../src-tauri/icons/logo-dark.png';
import './App.css';

export function App() {
  const {
    config,
    accounts,
    loading,
    refreshing,
    error,
    lastRefreshedAt,
    settingsOpen,
    setSettingsOpen,
    updateConfig,
    refresh,
    toggleDisplayMode,
  } = useCpaQuota();
  const [previewOpacity, setPreviewOpacity] = useState<number | null>(null);
  const closeSettings = () => {
    setPreviewOpacity(null);
    setSettingsOpen(false);
  };

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = config.theme === 'dark' ? darkLogo : lightLogo;
    if (isTauri()) {
      void invoke('set_widget_theme', { dark: config.theme === 'dark' })
        .catch((error) => console.error('无法同步窗口和托盘 Logo', error));
    }
  }, [config.theme]);

  // Listen for Tray events
  useEffect(() => {
    if (!isTauri()) return;
    const unlistenSettings = listen('open-settings', () => {
      setSettingsOpen(true);
    });

    const unlistenRefresh = listen('trigger-refresh', () => {
      refresh();
    });

    const unlistenPin = listen('toggle-pin', () => {
      updateConfig({ alwaysOnTop: !config.alwaysOnTop });
    });

    return () => {
      void unlistenSettings.then((fn) => fn());
      void unlistenRefresh.then((fn) => fn());
      void unlistenPin.then((fn) => fn());
    };
  }, [refresh, updateConfig, config.alwaysOnTop, setSettingsOpen]);

  return (
    <div
      className={`widget-root mode-${config.displayMode} theme-${config.theme} ${settingsOpen ? 'in-settings' : ''}`}
      style={{ '--window-opacity': previewOpacity ?? config.opacity } as CSSProperties}
      onMouseDown={handleWindowDrag}
      onContextMenu={(event) => event.preventDefault()}
    >
      {config.displayMode === 'mini' ? (
        <MiniCapsule
          accounts={accounts}
          onExpand={toggleDisplayMode}
          loading={loading}
          refreshing={refreshing}
          error={error}
          configured={Boolean(config.cpaBaseUrl && config.managementKey)}
          maskAccountNames={config.maskAccountNames}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <ExpandedCard
          accounts={accounts}
          config={config}
          loading={loading}
          refreshing={refreshing}
          error={error}
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={refresh}
          onToggleMini={toggleDisplayMode}
          onTogglePin={() => updateConfig({ alwaysOnTop: !config.alwaysOnTop })}
          onToggleTheme={() => updateConfig({ theme: config.theme === 'dark' ? 'light' : 'dark' })}
          onToggleMask={() => updateConfig({ maskAccountNames: !config.maskAccountNames })}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          config={config}
          onSave={updateConfig}
          onOpacityPreview={setPreviewOpacity}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}

export default App;
