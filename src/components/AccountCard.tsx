import React from 'react';
import { Clock, RotateCcw, AlertTriangle, Ban, ChevronDown } from 'lucide-react';
import type { AccountQuotaInfo, QuotaWindow } from '../types';
import { getAccountLabel, getQuotaColor, maskAccountName } from '../utils/quotaPresentation';
import { getProviderGroup, getProviderLabel } from '../utils/providerGroups';

interface AccountCardProps {
  account: AccountQuotaInfo;
  maskAccountNames?: boolean;
}

function QuotaRow({ quotaWindow }: { quotaWindow: QuotaWindow }) {
  const color = getQuotaColor(quotaWindow.remainingPercent);
  const remaining = quotaWindow.remainingPercent;
  return (
    <div className="window-row">
      <div className="window-header">
        <span className="window-label" title={quotaWindow.label}>{quotaWindow.label}</span>
        <div className="window-values">
          <span className="window-remaining" style={{ color }}>
            {remaining === null ? '—' : `${remaining}%`}
          </span>
          <span className="window-reset" title="距离额度重置的时间">
            <Clock size={10} />
            {quotaWindow.resetLabel === '-' ? '重置时间未知' : quotaWindow.resetLabel}
          </span>
        </div>
      </div>
      <div
        className="window-progress-track"
        role="progressbar"
        aria-label={`${quotaWindow.label}剩余额度`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remaining === null ? undefined : remaining}
        aria-valuetext={remaining === null ? '未提供额度数据' : `剩余 ${remaining}%`}
      >
        <div
          className="window-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, remaining ?? 0))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, maskAccountNames = false }) => {
  const status = account.disabled ? 'disabled' : account.status;
  const statusLabels = {
    ok: '可用', warn: '低额度', exhausted: '已耗尽', error: '获取失败',
    disabled: '已禁用', loading: '更新中', unknown: '待确认',
  };
  const provider = getProviderGroup(account.provider);
  const planLabel = account.planType || (provider === 'google' ? '订阅未知' : null);
  const windows = account.windows.length > 2
    ? [...account.windows].sort((left, right) =>
      (left.remainingPercent ?? 101) - (right.remainingPercent ?? 101))
    : account.windows;

  return (
    <article className={`account-card status-${status}`}>
      <header className="account-card-header">
        <div className="account-identity">
          <span className="account-name" title={maskAccountNames ? maskAccountName(account.fileName) : account.fileName}>
            {getAccountLabel(account, maskAccountNames)}
          </span>
          <div className="account-tags">
            <span className={`account-provider-badge provider-${provider}`}>
              {getProviderLabel(provider)}
            </span>
            {planLabel && <span className="account-plan-badge" title={account.planType || 'Google 未返回可确认的订阅档位'}>{planLabel}</span>}
            {account.priority !== 0 && <span className="account-priority-badge" title="凭证优先级">P{account.priority}</span>}
          </div>
        </div>
        <span className={`status-badge badge-${status}`}>
          <span className="status-dot" />
          {statusLabels[status]}
        </span>
      </header>

      {windows.length > 0 ? (
        <>
          <div className="account-windows-list">
            {windows.slice(0, 2).map((quotaWindow) => (
              <QuotaRow key={quotaWindow.id} quotaWindow={quotaWindow} />
            ))}
          </div>
          {windows.length > 2 && (
            <details className="account-more-windows">
              <summary>更多额度 <span>{windows.length - 2}</span><ChevronDown size={12} /></summary>
              <div className="account-windows-list">
                {windows.slice(2).map((quotaWindow) => (
                  <QuotaRow key={quotaWindow.id} quotaWindow={quotaWindow} />
                ))}
              </div>
            </details>
          )}
        </>
      ) : !account.error && (
        <div className="window-empty-note">
          {account.disabled && <Ban size={12} />}
          {account.statusMessage && account.statusMessage !== '-'
            ? account.statusMessage
            : account.disabled ? '此凭证已停用，不查询额度' : '平台暂未提供可用的额度数据'}
        </div>
      )}

      {account.resetCreditsCount != null && account.resetCreditsCount > 0 && (
        <div className="account-card-footer">
          <RotateCcw size={11} /> 可重置 {account.resetCreditsCount} 次
        </div>
      )}
      {account.error && (
        <div className="account-card-error">
          <AlertTriangle size={12} />
          <span>{account.error}</span>
        </div>
      )}
    </article>
  );
};
