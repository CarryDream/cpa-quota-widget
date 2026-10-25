import React, { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import lightLogo from '../../src-tauri/icons/logo-light.png';
import darkLogo from '../../src-tauri/icons/logo-dark.png';
import {
  RefreshCw,
  Settings,
  Minimize2,
  X,
  Pin,
  PinOff,
  Sun,
  Moon,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  Search,
} from 'lucide-react';
import type { AccountQuotaInfo, WidgetConfig } from '../types';
import { AccountCard } from './AccountCard';
import {
  getAvailableProviderGroups,
  getProviderGroup,
  getProviderLabel,
  type ProviderGroup,
} from '../utils/providerGroups';

interface ExpandedCardProps {
  accounts: AccountQuotaInfo[];
  config: WidgetConfig;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastRefreshedAt: number | null;
  onRefresh: () => void;
  onToggleMini: () => void;
  onTogglePin: () => void;
  onToggleTheme: () => void;
  onToggleMask?: () => void;
  onOpenSettings: () => void;
}

export const ExpandedCard: React.FC<ExpandedCardProps> = ({
  accounts,
  config,
  loading,
  refreshing,
  error,
  lastRefreshedAt,
  onRefresh,
  onToggleMini,
  onTogglePin,
  onToggleTheme,
  onToggleMask,
  onOpenSettings,
}) => {
  const activeAccounts = accounts.filter((acc) => !acc.disabled && acc.status !== 'disabled');
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<ProviderGroup>('all');
  const providerGroups = getAvailableProviderGroups(activeAccounts);
  const effectiveProviderFilter = providerGroups.includes(providerFilter) ? providerFilter : 'all';

  const filteredAccounts = activeAccounts.filter((acc) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchSearch =
      !normalizedSearch ||
      acc.fileName.toLowerCase().includes(normalizedSearch) ||
      (acc.note && acc.note.toLowerCase().includes(normalizedSearch)) ||
      acc.provider.toLowerCase().includes(normalizedSearch);
    const matchProvider =
      effectiveProviderFilter === 'all' ||
      getProviderGroup(acc.provider) === effectiveProviderFilter;
    return matchSearch && matchProvider;
  });

  const platformAccounts = activeAccounts.filter((account) =>
    effectiveProviderFilter === 'all' || getProviderGroup(account.provider) === effectiveProviderFilter
  );
  const okCount = platformAccounts.filter((a) => a.status === 'ok').length;
  const warnCount = platformAccounts.filter((a) => a.status === 'warn').length;
  const exhaustedCount = platformAccounts.filter((a) => a.status === 'exhausted').length;
  const errorCount = platformAccounts.filter((a) => a.status === 'error').length;
  const hasConnection = Boolean(config.cpaBaseUrl && config.managementKey);

  const formatRefreshTime = (ts: number | null) => {
    if (!ts) return '未刷新';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    if (isTauri()) await getCurrentWindow().hide();
  };

  return (
    <div
      className="expanded-card-container"
    >
      {/* Top Drag Handle Header */}
      <div className="card-top-header">
        <div className="header-brand">
          <img className="header-brand-logo" src={config.theme === 'dark' ? darkLogo : lightLogo} alt="" />
          <span className="brand-title">CPA 凭证额度</span>
        </div>

        <div className="header-window-actions">
          <button
            type="button"
            className={`action-btn ${config.alwaysOnTop ? 'active-pinned' : ''}`}
            onClick={onTogglePin}
            aria-pressed={config.alwaysOnTop}
            title={config.alwaysOnTop ? '已置顶 (点击取消)' : '未置顶 (点击置顶)'}
          >
            {config.alwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button
            type="button"
            className={`action-btn theme-toggle ${config.theme === 'dark' ? 'to-light' : 'to-dark'}`}
            onClick={onToggleTheme}
            title={config.theme === 'dark' ? '切换到白天模式' : '切换到夜间模式'}
          >
            {config.theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          {onToggleMask && (
            <button
              type="button"
              className={`action-btn ${config.maskAccountNames ? 'active-masked' : ''}`}
              onClick={onToggleMask}
              aria-pressed={config.maskAccountNames}
              title={config.maskAccountNames ? '已开启脱敏 (点击显示完整名称)' : '脱敏显示名称 (点击隐藏敏感信息)'}
            >
              {config.maskAccountNames ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <button
            type="button"
            className="action-btn"
            onClick={onOpenSettings}
            title="设置 CPA 连接与偏好"
          >
            <Settings size={13} />
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onToggleMini}
            title="缩小为迷你悬浮胶囊"
          >
            <Minimize2 size={13} />
          </button>
          <button
            type="button"
            className="action-btn btn-close"
            onClick={handleClose}
            title="隐藏到系统托盘"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="metrics-strip" aria-label={`${getProviderLabel(effectiveProviderFilter)}账号状态`}>
        <span className="metric-chip ok"><i /><b>{okCount}</b> 可用</span>
        <span className="metric-chip warn"><i /><b>{warnCount}</b> 低额度</span>
        <span className="metric-chip danger"><i /><b>{exhaustedCount}</b> 耗尽</span>
        <span className="metric-chip error"><i /><b>{errorCount}</b> 异常</span>
      </div>

      <nav className="expanded-provider-tabs" aria-label="平台筛选">
        {providerGroups.map((group) => (
          <button
            key={group}
            type="button"
            className={group === effectiveProviderFilter ? 'active' : ''}
            aria-pressed={group === effectiveProviderFilter}
            onClick={() => setProviderFilter(group)}
          >
            {getProviderLabel(group)}
            <span className="tab-count">
              {group === 'all' ? activeAccounts.length : activeAccounts.filter((a) => getProviderGroup(a.provider) === group).length}
            </span>
          </button>
        ))}
      </nav>
      <div className="search-filter-bar">
        <div className="search-input-box">
          <Search size={12} className="search-icon" />
          <input
            type="text"
            placeholder="搜索凭证或备注..."
            aria-label="搜索凭证或备注"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-field"
          />
        </div>
        <button
          type="button"
          className="refresh-data-btn"
          onClick={onRefresh}
          disabled={loading || refreshing}
          title="刷新额度数据"
          aria-label="刷新额度数据"
        >
          <RefreshCw size={13} className={loading || refreshing ? 'spinning' : ''} />
        </button>
      </div>
      {/* Error Alert */}
      {error && (
        <div className="global-error-banner" role="alert">
          <AlertCircle size={14} />
          <div className="error-text-wrap">
            <span title={error}>{error}</span>
          </div>
          <button type="button" className="retry-btn" onClick={onRefresh}>
            重试
          </button>
        </div>
      )}

      <div className="list-section-heading">
        <span>账号额度 <b>{filteredAccounts.length}</b></span>
        <span>剩余 · 重置时间</span>
      </div>
      <div className="accounts-scroll-area" aria-busy={loading || refreshing}>
        {loading && activeAccounts.length === 0 ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spinning text-muted" />
            <span>正在拉取 CPA 凭证与额度数据...</span>
          </div>
        ) : filteredAccounts.length > 0 ? (
          filteredAccounts.map((acc) => (
            <AccountCard key={acc.authIndex || acc.fileName} account={acc} maskAccountNames={config.maskAccountNames} />
          ))
        ) : (
          <div className="empty-state">
            <Database size={28} className="text-muted" />
            <span className="empty-title">
              {!hasConnection ? '连接你的 CPA 服务' : activeAccounts.length === 0 ? '暂无凭证' : '没有找到匹配的账号'}
            </span>
            <span className="empty-sub">
              {!hasConnection
                ? '配置服务地址与管理密钥，集中查看各平台额度'
                : activeAccounts.length === 0
                  ? '请检查服务连接，或在 CPA 中添加凭证'
                  : '试试其他平台，或调整搜索关键词'}
            </span>
            {activeAccounts.length === 0 && (
              <button type="button" className="btn-setup" onClick={onOpenSettings}>
                配置 CPA 连接
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="card-footer-bar">
        <span className={`footer-status-text ${error ? 'has-error' : ''}`} role="status">
          <i />
          {loading || refreshing ? '正在更新额度' : error ? '更新失败 · 保留上次数据' : `更新于 ${formatRefreshTime(lastRefreshedAt)}`}
        </span>
        <span className="footer-source-hint" title={config.cpaBaseUrl}>
          {config.cpaBaseUrl.replace(/^https?:\/\//i, '')}
        </span>
      </div>
    </div>
  );
};
