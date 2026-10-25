import React, { useState } from 'react';
import { X, Check, Eye, EyeOff, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { WidgetConfig } from '../types';
import { CpaClient } from '../services/api/cpaClient';

interface SettingsModalProps {
  config: WidgetConfig;
  onSave: (updates: Partial<WidgetConfig>) => void;
  onOpacityPreview: (opacity: number) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose, onOpacityPreview }) => {
  const [cpaBaseUrl, setCpaBaseUrl] = useState(config.cpaBaseUrl);
  const [managementKey, setManagementKey] = useState(config.managementKey);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState(config.refreshIntervalMinutes);
  const [alwaysOnTop, setAlwaysOnTop] = useState(config.alwaysOnTop);
  const [opacity, setOpacity] = useState(config.opacity);
  const [maskAccountNames, setMaskAccountNames] = useState(Boolean(config.maskAccountNames));
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new CpaClient({ cpaBaseUrl, managementKey });
      const files = await client.getAuthFiles();
      setTestResult({
        ok: true,
        message: `连接成功！检测到 ${files.length} 个凭证文件`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        ok: false,
        message: `连接失败: ${msg}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      cpaBaseUrl: cpaBaseUrl.trim(),
      managementKey: managementKey.trim(),
      refreshIntervalMinutes,
      alwaysOnTop,
      opacity,
      maskAccountNames,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">连接与小组件设置</span>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* CPA Base URL */}
          <div className="form-group">
            <label className="form-label">CPA 服务端地址</label>
            <input
              type="text"
              className="form-input"
              value={cpaBaseUrl}
              onChange={(e) => setCpaBaseUrl(e.target.value)}
              placeholder="http://localhost:8317"
              required
            />
            <span className="form-hint">CPA (CLIProxyAPI) 服务运行的主机和端口</span>
          </div>

          {/* Management Key */}
          <div className="form-group">
            <label className="form-label">CPA Management Key</label>
            <div className="input-with-button">
              <input
                type={showKey ? 'text' : 'password'}
                className="form-input"
                value={managementKey}
                onChange={(e) => setManagementKey(e.target.value)}
                placeholder="请输入管理密钥"
              />
              <button
                type="button"
                className="toggle-eye-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? '隐藏密钥' : '显示密钥'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <span className="form-hint">CPA 配置文件中的 remote-management.key</span>
          </div>

          {/* Test Connection Button */}
          <div className="form-group test-group">
            <button
              type="button"
              className={`test-conn-btn ${testing ? 'loading' : ''}`}
              onClick={handleTestConnection}
              disabled={testing || !cpaBaseUrl}
            >
              <Activity size={13} /> {testing ? '测试连接中...' : '测试连接连通性'}
            </button>
            {testResult && (
              <div className={`test-result-alert ${testResult.ok ? 'success' : 'error'}`}>
                {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Refresh Interval */}
          <div className="form-group">
            <label className="form-label">自动刷新间隔</label>
            <select
              className="form-select"
              value={refreshIntervalMinutes}
              onChange={(e) => setRefreshIntervalMinutes(Number(e.target.value))}
            >
              <option value={1}>1 分钟</option>
              <option value={3}>3 分钟</option>
              <option value={5}>5 分钟 (推荐)</option>
              <option value={10}>10 分钟</option>
              <option value={15}>15 分钟</option>
              <option value={30}>30 分钟</option>
            </select>
          </div>

          {/* Window Options */}
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={alwaysOnTop}
                onChange={(e) => setAlwaysOnTop(e.target.checked)}
              />
              <span>悬浮窗口置顶显示</span>
            </label>
          </div>
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={maskAccountNames}
                onChange={(e) => setMaskAccountNames(e.target.checked)}
              />
              <span>脱敏显示账号名称 (隐藏敏感邮箱与标识)</span>
            </label>
          </div>

          {/* Opacity slider */}
          <div className="form-group">
            <div className="opacity-label-row">
              <label className="form-label" htmlFor="window-opacity">窗口不透明度</label>
              <span className="opacity-val">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              id="window-opacity"
              type="range"
              min="0.5"
              max="1.0"
              step="0.02"
              value={opacity}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setOpacity(next);
                onOpacityPreview(next);
              }}
              className="range-slider"
            />
            <span className="form-hint">拖动即时预览；只调整窗口底色，文字保持清晰。</span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary">
              <Check size={14} /> 保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
