import { useState, useEffect } from 'react';
import { useImageStore, type ImageApiConfig } from '../../stores/imageStore';
import { bridge, type ConnectionTestResult } from '../../lib/tauri-bridge';

export function ImageConfigModal() {
  const isOpen = useImageStore((s) => s.isConfigModalOpen);
  const setIsOpen = useImageStore((s) => s.setConfigModalOpen);
  const configs = useImageStore((s) => s.configs);
  const activeConfigId = useImageStore((s) => s.activeConfigId);
  const setActiveConfigId = useImageStore((s) => s.setActiveConfigId);
  const updateConfig = useImageStore((s) => s.updateConfig);
  const addConfig = useImageStore((s) => s.addConfig);
  const deleteConfig = useImageStore((s) => s.deleteConfig);
  const addModelToConfig = useImageStore((s) => s.addModelToConfig);
  const removeModelFromConfig = useImageStore((s) => s.removeModelFromConfig);

  const [selectedId, setSelectedId] = useState<string>(activeConfigId);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [customModelInput, setCustomModelInput] = useState('');

  // 当前正在编辑的配置
  const currentConfig: ImageApiConfig =
    configs.find((c) => c.id === selectedId) || configs[0] || {
      id: 'custom_default',
      name: '自定义 API',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'dall-e-3',
      availableModels: ['dall-e-3'],
      defaultAspectRatio: '1:1',
      defaultQuality: 'standard',
    };

  useEffect(() => {
    if (isOpen) {
      setSelectedId(activeConfigId);
      setTestResult(null);
    }
  }, [isOpen, activeConfigId]);

  // Escape 键防护：如果在输入框内输入拼音按 Esc，绝不关闭弹窗！
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.isComposing) return;
        const active = document.activeElement;
        if (active) {
          const tag = active.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'select') {
            (active as HTMLElement).blur();
            return;
          }
        }
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen || !currentConfig) return null;

  // 添加自定义模型
  const handleAddCustomModel = (e?: React.FormEvent) => {
    e?.preventDefault();
    const m = customModelInput.trim();
    if (!m) return;
    addModelToConfig(currentConfig.id, m);
    setCustomModelInput('');
  };

  // 测试接口连通性
  const handleTestConnection = async () => {
    if (!currentConfig.baseUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await bridge.testImageConnection({
        base_url: currentConfig.baseUrl,
        api_key: currentConfig.apiKey,
        model: currentConfig.model,
        proxy_url: currentConfig.proxyUrl || undefined,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        connectivity: { ok: false, message: e?.message || String(e) },
        auth: { ok: false, message: '未执行' },
        model: { ok: false, message: '未执行' },
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      {/* 弹窗主体（不监听遮罩点击自动关闭，防止选中文本松手误触关闭） */}
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-bg-card border border-border-subtle shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <circle cx="5.5" cy="5.5" r="1.5" />
                <path d="M14 10l-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">自定义 AI 生图设置</h3>
              <p className="text-[11px] text-text-tertiary">配置自定义生图 API 接口与可调用模型</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-smooth"
            title="关闭窗口"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* 主体表单 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 端点选择与新建 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">当前端点：</span>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setActiveConfigId(e.target.value);
                  setTestResult(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-bg-secondary border border-border-subtle text-xs text-text-primary font-medium focus:outline-none focus:border-accent"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || '自定义接口'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newId = addConfig({
                    name: `自定义接口 ${configs.length + 1}`,
                    baseUrl: 'https://api.openai.com/v1',
                    apiKey: '',
                    model: 'dall-e-3',
                    availableModels: ['dall-e-3'],
                    defaultAspectRatio: '1:1',
                    defaultQuality: 'standard',
                  });
                  setSelectedId(newId);
                  setActiveConfigId(newId);
                }}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                + 新增端点
              </button>
              {configs.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteConfig(currentConfig.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  删除
                </button>
              )}
            </div>
          </div>

          {/* 接口名称 */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">接口别名</label>
            <input
              type="text"
              value={currentConfig.name}
              onChange={(e) => updateConfig(currentConfig.id, { name: e.target.value })}
              placeholder="自定义接口名称"
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary/70 border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">Base URL（API 地址）</label>
            <input
              type="text"
              value={currentConfig.baseUrl}
              onChange={(e) => updateConfig(currentConfig.id, { baseUrl: e.target.value.trim() })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary/70 border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentConfig.apiKey}
                onChange={(e) => updateConfig(currentConfig.id, { apiKey: e.target.value.trim() })}
                placeholder="sk-..."
                className="w-full pl-3 pr-12 py-1.5 rounded-lg bg-bg-secondary/70 border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary text-[11px]"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {/* 多模型管理 */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">支持调用的模型（支持多个）</label>
              <span className="text-[11px] text-text-muted">
                当前调用: <span className="text-accent font-mono font-semibold">{currentConfig.model}</span>
              </span>
            </div>

            {/* 模型药丸列表 */}
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-bg-secondary/40 border border-border-subtle min-h-[36px]">
              {currentConfig.availableModels && currentConfig.availableModels.length > 0 ? (
                currentConfig.availableModels.map((m) => {
                  const isCur = currentConfig.model === m;
                  return (
                    <div
                      key={m}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                        isCur
                          ? 'border-accent bg-accent/15 text-accent font-semibold'
                          : 'border-border-subtle bg-bg-card text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => updateConfig(currentConfig.id, { model: m })}
                        className="cursor-pointer"
                        title="点击选择为默认生图模型"
                      >
                        {isCur && <span className="mr-1">●</span>}
                        {m}
                      </button>
                      {currentConfig.availableModels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeModelFromConfig(currentConfig.id, m)}
                          className="ml-1 opacity-50 hover:opacity-100 hover:text-red-500"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-text-muted">暂无模型，请在下方输入并添加</span>
              )}
            </div>

            {/* 输入添加模型 */}
            <form onSubmit={handleAddCustomModel} className="flex gap-2">
              <input
                type="text"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                placeholder="输入要添加的模型名称（如 FLUX.1-schnell、dall-e-3 等）"
                className="flex-1 px-3 py-1.5 rounded-lg bg-bg-secondary/70 border border-border-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!customModelInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-accent text-text-inverse hover:bg-accent-hover text-xs font-medium transition-smooth disabled:opacity-40"
              >
                添加
              </button>
            </form>
          </div>

          {/* 连通性测试报告 */}
          {testResult && (
            <div className="p-3 rounded-lg bg-bg-secondary/50 border border-border-subtle space-y-1.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">网络连通性:</span>
                <span className={testResult.connectivity.ok ? 'text-emerald-500 font-medium' : 'text-red-500'}>
                  {testResult.connectivity.message}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">接口鉴权:</span>
                <span className={testResult.auth.ok ? 'text-emerald-500 font-medium' : 'text-red-500'}>
                  {testResult.auth.message}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-bg-secondary/20">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !currentConfig.baseUrl}
            className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/80 text-xs text-text-primary font-medium transition-smooth disabled:opacity-50"
          >
            {isTesting ? '正在探测...' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-text-inverse text-xs font-medium transition-smooth shadow-xs"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
