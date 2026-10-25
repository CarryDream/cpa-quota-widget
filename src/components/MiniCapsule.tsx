import { useState, type MouseEvent } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { AccountQuotaInfo, QuotaWindow } from '../types';
import { getAccountLabel, getQuotaColor, getCompactWindowLabel, formatCompactReset, maskAccountName } from '../utils/quotaPresentation';
import {
  getAvailableProviderGroups,
  getProviderGroup,
  getProviderLabel,
  type ProviderGroup,
} from '../utils/providerGroups';

interface MiniCapsuleProps {
  accounts: AccountQuotaInfo[];
  onExpand: () => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  configured: boolean;
  maskAccountNames?: boolean;
  onOpenSettings: () => void;
}


function getCompactWindows(account: AccountQuotaInfo): QuotaWindow[] {
  const measurable = account.windows.filter((quotaWindow) => quotaWindow.remainingPercent !== null);
  const source = measurable.length > 0 ? measurable : account.windows;
  const priority = (quotaWindow: QuotaWindow) => {
    if (getProviderGroup(account.provider) !== 'codex') return 2;
    const identity = `${quotaWindow.id} ${quotaWindow.label}`.toLowerCase();
    if (identity.includes('5h') || identity.includes('5小时') || identity.includes('five')) return 0;
    if (identity.includes('week') || identity.includes('周') || identity.includes('7天')) return 1;
    return 2;
  };
  return [...source]
    .sort((left, right) =>
      priority(left) - priority(right) ||
      (left.remainingPercent ?? 101) - (right.remainingPercent ?? 101)
    )
    .slice(0, 2);
}


function CompactAccountQuota({ account, maskAccountNames = false }: { account: AccountQuotaInfo; maskAccountNames?: boolean }) {
  const windows = getCompactWindows(account);
  return (
    <>
      <div className="mini-account-summary">
        <span className="mini-acc-label" title={maskAccountNames ? maskAccountName(account.fileName) : account.fileName}>
          {getAccountLabel(account, maskAccountNames)}
        </span>
        {windows.length > 0 ? (
          <span className="mini-window-stats">
            {windows.map((quotaWindow, index) => (
              <span
                key={quotaWindow.id}
                className={`mini-window-stat tone-${index + 1}`}
                title={`${quotaWindow.label}：剩余 ${quotaWindow.remainingPercent ?? '未知'}%，${quotaWindow.resetLabel}后重置`}
              >
                <b>{getCompactWindowLabel(quotaWindow)}</b>
                <strong style={{ color: quotaWindow.remainingPercent !== null && quotaWindow.remainingPercent <= 20 ? getQuotaColor(quotaWindow.remainingPercent) : undefined }}>
                  {quotaWindow.remainingPercent === null ? '—' : `${quotaWindow.remainingPercent}%`}
                </strong>
                <time>{formatCompactReset(quotaWindow)}</time>
              </span>
            ))}
          </span>
        ) : (
          <span className="mini-unavailable-text" title={account.error || account.statusMessage}>
            {account.error ? '获取失败' : account.statusMessage && account.statusMessage !== '-' ? account.statusMessage : '暂无额度'}
          </span>
        )}
      </div>
      {windows.length > 0 ? (
        <div
          className="mini-combined-track"
          title={windows.map((quotaWindow) => `${quotaWindow.label}：剩余 ${quotaWindow.remainingPercent ?? '未知'}%`).join(' · ')}
        >
          {windows.map((quotaWindow, index) => (
            <span
              key={quotaWindow.id}
              className={`mini-combined-fill tone-${index + 1}`}
              style={{
                width: `${Math.min(100, Math.max(0, quotaWindow.remainingPercent ?? 0))}%`,
                zIndex: Math.round(100 - (quotaWindow.remainingPercent ?? 0)),
              }}
              role="progressbar"
              aria-label={`${quotaWindow.label}剩余额度`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={quotaWindow.remainingPercent ?? undefined}
              aria-valuetext={quotaWindow.remainingPercent === null ? '未提供额度数据' : `剩余 ${quotaWindow.remainingPercent}%`}
            />
          ))}
        </div>
      ) : (
        <span className="mini-unavailable-rail" />
      )}
    </>
  );
}

export function MiniCapsule({ accounts, onExpand, loading, refreshing, error, configured, maskAccountNames = false, onOpenSettings }: MiniCapsuleProps) {
  const [providerFilter, setProviderFilter] = useState<ProviderGroup>('all');
  const activeAccounts = accounts.filter((account) => !account.disabled && account.status !== 'disabled');
  const providerGroups = getAvailableProviderGroups(activeAccounts);
  const effectiveFilter = providerGroups.includes(providerFilter) ? providerFilter : 'all';
  const visibleAccounts = activeAccounts.filter((account) =>
    effectiveFilter === 'all' || getProviderGroup(account.provider) === effectiveFilter
  );

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    onExpand();
  };

  return (
    <div
      className="mini-widget-box"
      onDoubleClick={handleDoubleClick}
      title="拖动空白区域移动；双击展开；配置与刷新请使用系统托盘菜单"
    >
      {providerGroups.length > 2 && (
        <nav className="mini-provider-switch" data-no-drag aria-label="平台筛选">
          {providerGroups.map((group) => (
            <button
              key={group}
              type="button"
              data-no-drag
              className={group === effectiveFilter ? 'active' : ''}
              aria-pressed={group === effectiveFilter}
              onClick={() => setProviderFilter(group)}
            >
              {getProviderLabel(group)}
            </button>
          ))}
        </nav>
      )}
      {/* Top-right floating status indicator: zero layout impact on account rows */}
      {(loading || refreshing || error) && (
        <div
          className={`mini-indicator-badge ${error ? 'has-error' : 'is-loading'}`}
          role="status"
          title={error ? `更新失败: ${error}` : '正在更新额度…'}
        >
          {error ? <AlertCircle size={10} /> : <RefreshCw size={9} className="spinning" />}
        </div>
      )}

      <div className="mini-accounts-list">
        {visibleAccounts.length > 0 ? visibleAccounts.map((account) => (
          <section
            key={account.authIndex || account.fileName}
            className="mini-account-row"
          >
            <CompactAccountQuota account={account} maskAccountNames={maskAccountNames} />
          </section>
        )) : (
          <div className="mini-empty-hint">
            <span>{loading
              ? '正在读取账号与额度…'
              : !configured ? '连接 CPA，查看账号额度'
                : error ? '无法读取账号，请检查连接'
                  : accounts.length === 0 ? 'CPA 中暂无凭证'
                    : '当前平台没有启用的凭证'}</span>
            {!loading && !configured && (
              <button type="button" onClick={onOpenSettings}>配置连接</button>
            )}
            <span className="mini-empty-help">双击展开 · 拖动移动</span>
          </div>
        )}
      </div>
    </div>
  );
}
