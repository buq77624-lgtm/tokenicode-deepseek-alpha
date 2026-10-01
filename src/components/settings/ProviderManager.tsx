import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useProviderStore } from '../../stores/providerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { bridge, type ClaudeSettingsStatus } from '../../lib/tauri-bridge';
import { useT } from '../../lib/i18n';
import { type PresetProvider } from '../../lib/provider-presets';
import { parseAndValidate, importAsProvider, exportProvider } from '../../lib/api-config';
import { AddProviderMenu } from './AddProviderMenu';
import { ProviderCard, type CardTestStatus } from './ProviderCard';
import { ProviderForm, type TestStatus } from './ProviderForm';
import { normalizeProviderModelName } from '../../lib/deepseek-models';

export function ProviderManager({ alwaysExpanded = false }: { alwaysExpanded?: boolean } = {}) {
  const t = useT();
  const providers = useProviderStore((s) => s.providers);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const loaded = useProviderStore((s) => s.loaded);
  const setActive = useProviderStore((s) => s.setActive);
  const deleteProvider = useProviderStore((s) => s.deleteProvider);
  const addProvider = useProviderStore((s) => s.addProvider);

  const [collapsed, setCollapsed] = useState(alwaysExpanded ? false : true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoTestId, setAutoTestId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success'>('idle');
  const [importError, setImportError] = useState('');
  const [cardTestStatuses, setCardTestStatuses] = useState<Record<string, CardTestStatus>>({});
  const [cardTestTimes, setCardTestTimes] = useState<Record<string, number>>({});

  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!loaded) {
      useProviderStore.getState().load();
    }
  }, [loaded]);

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const activeLabel = activeProvider ? activeProvider.name : t('provider.inherit');

  // --- Claude Code global settings sync ---
  const syncClaudeOn = useSettingsStore((s) => s.syncClaudeSettings);
  const setSyncClaudeOn = useSettingsStore((s) => s.setSyncClaudeSettings);
  const [claudeStatus, setClaudeStatus] = useState<ClaudeSettingsStatus | null>(null);
  const [claudeBusy, setClaudeBusy] = useState(false);
  const [claudeNote, setClaudeNote] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshClaudeStatus = useCallback(() => {
    bridge.readClaudeSettings(activeProviderId)
      .then(setClaudeStatus)
      .catch(() => setClaudeStatus(null));
  }, [activeProviderId]);

  useEffect(() => {
    if (collapsed && !alwaysExpanded) return;
    refreshClaudeStatus();
  }, [collapsed, alwaysExpanded, refreshClaudeStatus]);

  const writeClaudeSettings = useCallback((id: string | null) => {
    setClaudeBusy(true);
    setClaudeNote(null);
    bridge.syncClaudeSettings(id)
      .then((r) => {
        if (r.skipped) {
          setClaudeNote({ ok: true, text: t('provider.syncInheritSkip') });
        } else if (!r.changed) {
          setClaudeNote({ ok: true, text: t('provider.syncAlready') });
        } else {
          setClaudeNote({ ok: true, text: t('provider.syncDone').replace('{name}', r.providerName) });
        }
      })
      .catch((e) => setClaudeNote({ ok: false, text: String(e) }))
      .finally(() => { setClaudeBusy(false); refreshClaudeStatus(); });
  }, [refreshClaudeStatus, t]);

  /** Single entry point for changing the active provider. */
  const activate = useCallback((id: string | null) => {
    setActive(id);
    setClaudeNote(null);
    if (id && useSettingsStore.getState().syncClaudeSettings) {
      // The store update is synchronous, but readClaudeSettings wants the new id.
      setTimeout(() => writeClaudeSettings(id), 0);
    }
  }, [setActive, writeClaudeSettings]);

  const handleAddFromPreset = useCallback((preset: PresetProvider) => {
    const existingCount = providers.filter((p) => p.preset === preset.id).length;

    addProvider({
      name: existingCount > 0 ? `${preset.name} (${existingCount + 1})` : preset.name,
      baseUrl: preset.baseUrl,
      apiFormat: preset.apiFormat,
      modelMappings: [
        { tier: 'opus', providerModel: preset.defaultModels?.opus || preset.defaultModel || 'claude-opus-4-6' },
        { tier: 'sonnet', providerModel: preset.defaultModels?.sonnet || preset.defaultModel || 'claude-sonnet-4-6' },
        { tier: 'haiku', providerModel: preset.defaultModels?.haiku || preset.defaultModel || 'claude-haiku-4-5-20251001' },
      ],
      extra_env: { ...preset.extra_env },
      preset: preset.id,
    });
    const { providers: updated } = useProviderStore.getState();
    const last = updated[updated.length - 1];
    if (last) {
      activate(last.id);
      setEditingId(last.id);
    }
  }, [addProvider, providers, activate]);

  const handleAddCustom = useCallback(() => {
    addProvider({
      name: '',
      baseUrl: '',
      apiFormat: 'openai',
      modelMappings: [
        { tier: 'opus', providerModel: 'claude-opus-4-6' },
        { tier: 'sonnet', providerModel: 'claude-sonnet-4-6' },
        { tier: 'haiku', providerModel: 'claude-haiku-4-5-20251001' },
      ],
      extra_env: {},
    });
    const { providers: updated } = useProviderStore.getState();
    const last = updated[updated.length - 1];
    if (last) {
      activate(last.id);
      setEditingId(last.id);
    }
  }, [addProvider, activate]);

  const handleImport = useCallback(async () => {
    const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
    const result = await openDialog({
      title: t('provider.importTitle'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    });
    const filePath = Array.isArray(result) ? result[0] : result;
    if (!filePath) return;

    setImportError('');
    setImportStatus('idle');

    try {
      const content = await bridge.readFileContent(filePath);
      const parsed = parseAndValidate(content);
      if (!parsed.ok) {
        setImportError(parsed.error);
        setTimeout(() => setImportError(''), 5000);
        return;
      }
      importAsProvider(parsed.provider);
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
      const { providers: updated } = useProviderStore.getState();
      const last = updated[updated.length - 1];
      if (last) {
        activate(last.id);
        setEditingId(last.id);
      }
    } catch (e) {
      setImportError(String(e));
      setTimeout(() => setImportError(''), 5000);
    }
  }, [t, activate]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (editingId === deleteTarget) setEditingId(null);
    deleteProvider(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, editingId, deleteProvider]);

  /** Card test button: quick independent test without opening form */
  const handleCardTest = useCallback(async (providerId: string) => {
    const p = useProviderStore.getState().providers.find((pr) => pr.id === providerId);
    if (!p) return;

    setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'testing' }));
    setCardTestTimes((prev) => { const next = { ...prev }; delete next[providerId]; return next; });

    const testModel = normalizeProviderModelName(p.modelMappings.find((m) => m.providerModel)?.providerModel || '');
    if (!testModel || !p.apiKey) {
      setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'failed' }));
      return;
    }

    try {
      const start = Date.now();
      const result = await bridge.testProviderConnection(p.baseUrl, p.apiFormat, p.apiKey, testModel);
      const elapsed = Date.now() - start;

      if (result.connectivity.ok && result.auth.ok && result.model.ok) {
        setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'success' }));
        setCardTestTimes((prev) => ({ ...prev, [providerId]: elapsed }));
      } else if (!result.auth.ok && result.connectivity.ok) {
        setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'auth_error' }));
      } else {
        setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'failed' }));
      }
    } catch (e) {
      setCardTestStatuses((prev) => ({ ...prev, [providerId]: 'failed' }));
    }
  }, []);


  /** Export from card */
  const handleCardExport = useCallback(async (providerId: string) => {
    const p = useProviderStore.getState().providers.find((pr) => pr.id === providerId);
    if (!p) return;
    try {
      const json = exportProvider(p);
      const { save: saveDialog } = await import('@tauri-apps/plugin-dialog');
      const filePath = await saveDialog({
        title: t('provider.exportTitle'),
        defaultPath: `${p.name || 'provider'}-config.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath) return;
      await bridge.writeFileContent(filePath, json);
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, [t]);

  const isExpanded = alwaysExpanded || !collapsed;

  return (
    <div className={alwaysExpanded ? '' : 'pt-2 border-t border-border-subtle'}>
      {/* Header */}
      {!alwaysExpanded && (
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1.5"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.5"
              className={`text-text-tertiary transition-transform ${collapsed ? '' : 'rotate-90'}`}>
              <path d="M3 1l4 4-4 4" />
            </svg>
            <h3 className="text-[13px] font-medium text-text-primary">
              {t('provider.title')}
            </h3>
            <span className="text-xs text-text-tertiary">
              {activeLabel}
            </span>
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3 ml-0">
          {/* Inherit system config option */}
          <div className={`rounded-lg text-[13px] transition-smooth border
            ${!activeProviderId
              ? 'bg-accent/10 border-accent/30'
              : 'border-border-subtle hover:bg-bg-secondary'
            }`}
          >
            <button
              onClick={() => activate(null)}
              className={`text-left w-full px-3 py-2 ${!activeProviderId ? 'text-accent' : 'text-text-muted'}`}
            >
              {t('provider.inherit')}
              <span className="text-xs text-text-tertiary ml-2">{t('provider.inheritDesc')}</span>
            </button>
          </div>

          {/* Provider cards + inline forms */}
          <div className="space-y-1.5">
            {providers.map((p) => (
              <Fragment key={p.id}>
                <ProviderCard
                  provider={p}
                  isActive={activeProviderId === p.id}
                  isEditing={editingId === p.id}
                  testStatus={cardTestStatuses[p.id] || 'idle'}
                  testTimeMs={cardTestTimes[p.id]}
                  onActivate={() => activate(p.id)}
                  onToggleEdit={() => { setEditingId(editingId === p.id ? null : p.id); setAutoTestId(null); }}
                  onRequestDelete={() => setDeleteTarget(p.id)}
                  onExport={() => handleCardExport(p.id)}
                  onTest={() => handleCardTest(p.id)}
                />

                {/* Delete confirmation inline */}
                {deleteTarget === p.id && (
                  <div className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded-lg text-xs ml-5">
                    <span className="text-red-400 flex-1">
                      {t('provider.deleteConfirm').replace('{name}', p.name || t('provider.unnamed'))}
                    </span>
                    <button
                      onClick={handleConfirmDelete}
                      className="text-red-400 font-medium hover:text-red-300 transition-smooth px-2 py-0.5"
                    >
                      {t('provider.deleteProvider')}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="text-text-tertiary hover:text-text-muted transition-smooth px-2 py-0.5"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Inline edit form */}
                {editingId === p.id && (
                  <ProviderForm
                    provider={p}
                    onClose={() => { setEditingId(null); setAutoTestId(null); }}
                    onDelete={() => setDeleteTarget(p.id)}
                    autoTest={autoTestId === p.id}
                    onTestStatusChange={(status: TestStatus) =>
                      setCardTestStatuses((prev) => ({ ...prev, [p.id]: status as CardTestStatus }))
                    }
                  />
                )}
              </Fragment>
            ))}
          </div>

          {/* Add button */}
          <div className="flex items-center gap-2">
            <button
              ref={addBtnRef}
              onClick={() => setMenuOpen(!menuOpen)}
              className="px-3 py-2 rounded-lg text-[13px] font-medium transition-smooth
                border border-border-subtle text-text-muted hover:bg-bg-secondary
                flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              {t('provider.addProvider')}
            </button>

            {importStatus === 'success' && (
              <span className="text-xs text-green-500">{t('provider.importSuccess')}</span>
            )}
            {importError && (
              <span className="text-xs text-red-400 truncate flex-1" title={importError}>
                {importError}
              </span>
            )}
          </div>

          <AddProviderMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={addBtnRef}
            providers={providers}
            onAddFromPreset={handleAddFromPreset}
            onAddCustom={handleAddCustom}
            onImport={handleImport}
          />

          {/* Claude Code global settings sync */}
          <div className="rounded-lg border border-border-subtle bg-bg-secondary/30 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="pr-2">
                <span className="text-xs font-medium text-text-primary block">{t('provider.claudeSyncTitle')}</span>
                <span className="text-[11px] text-text-tertiary leading-tight block">
                  {t('provider.claudeSyncDesc')}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={syncClaudeOn}
                onClick={() => setSyncClaudeOn(!syncClaudeOn)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  syncClaudeOn ? 'bg-accent' : 'bg-bg-tertiary border-border-subtle'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    syncClaudeOn ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {claudeStatus && (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-text-tertiary shrink-0">{t('provider.claudeNow')}</span>
                  <code className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-primary break-all max-w-full">
                    {claudeStatus.baseUrl || t('provider.claudeUnset')}
                  </code>
                  {claudeStatus.inSync
                    ? <span className="text-green-500 shrink-0">{t('provider.claudeInSync')}</span>
                    : <span className="text-amber-500 shrink-0">{t('provider.claudeOutOfSync')}</span>}
                </div>

                {claudeStatus.foreignAuthToken && (
                  <div className="text-red-400 leading-tight">{t('provider.claudeConflict')}</div>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => writeClaudeSettings(activeProviderId)}
                    disabled={claudeBusy || !activeProviderId}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border-subtle
                      text-text-muted hover:bg-bg-secondary transition-smooth disabled:opacity-40 disabled:cursor-not-allowed"
                    title={activeProviderId ? t('provider.claudeWriteHint') : t('provider.claudeWriteNeedProvider')}
                  >
                    {t('provider.claudeWrite')}
                  </button>
                  <button
                    onClick={() => {
                      setClaudeBusy(true);
                      setClaudeNote(null);
                      bridge.clearClaudeSettings()
                        .then(() => setClaudeNote({ ok: true, text: t('provider.claudeCleared') }))
                        .catch((e) => setClaudeNote({ ok: false, text: String(e) }))
                        .finally(() => { setClaudeBusy(false); refreshClaudeStatus(); });
                    }}
                    disabled={claudeBusy}
                    className="px-2.5 py-1 rounded-md text-[11px] border border-border-subtle
                      text-text-tertiary hover:bg-bg-secondary transition-smooth disabled:opacity-40"
                  >
                    {t('provider.claudeClear')}
                  </button>
                </div>

                {claudeNote && (
                  <div className={`leading-tight ${claudeNote.ok ? 'text-green-500' : 'text-red-400'}`}>
                    {claudeNote.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
