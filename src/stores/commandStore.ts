import { create } from 'zustand';
import { bridge, type UnifiedCommand, type CliAdvertisedCommand } from '../lib/tauri-bridge';
import { useSettingsStore } from './settingsStore';

interface CommandState {
  /** Merged view consumed by the UI */
  commands: UnifiedCommand[];
  /** Locally discovered: hardcoded builtins + scanned project/global commands + skills */
  scanned: UnifiedCommand[];
  /** Advertised by the CLI itself via system/commands_changed */
  cliAdvertised: UnifiedCommand[];
  isLoading: boolean;

  // Prefix mode: when a custom command with $ARGUMENTS is selected
  activePrefixes: UnifiedCommand[];

  // Actions
  fetchCommands: (cwd?: string) => Promise<void>;
  mergeCliCommands: (list: CliAdvertisedCommand[]) => void;
  addPrefix: (cmd: UnifiedCommand) => void;
  removePrefix: (name: string) => void;
  clearPrefixes: () => void;
}

/** Local entries win because they carry execution info; the CLI only adds and enriches. */
function combine(scanned: UnifiedCommand[], cli: UnifiedCommand[]): UnifiedCommand[] {
  const byName = new Map(scanned.map((c) => [c.name, c]));
  const out = [...scanned];
  for (const c of cli) {
    const known = byName.get(c.name);
    if (known) {
      if (!known.has_args && c.has_args) {
        out[out.indexOf(known)] = { ...known, has_args: true };
      }
      continue;
    }
    out.push(c);
  }
  return out;
}

function toUnified(c: CliAdvertisedCommand): UnifiedCommand | null {
  const raw = (c.name || '').trim();
  if (!raw) return null;
  return {
    name: raw.startsWith('/') ? raw : `/${raw}`,
    description: c.description || '',
    source: 'builtin',
    category: 'builtin',
    has_args: Boolean(c.argumentHint && c.argumentHint.trim()),
    immediate: true,
    execution: 'session',
  };
}

export const useCommandStore = create<CommandState>()((set, get) => ({
  commands: [],
  scanned: [],
  cliAdvertised: [],
  isLoading: false,
  activePrefixes: [],

  fetchCommands: async (cwd?: string) => {
    set({ isLoading: true });
    try {
      const scanned = await bridge.listAllCommands(cwd, useSettingsStore.getState().skillDirectories);
      set({ scanned, commands: combine(scanned, get().cliAdvertised), isLoading: false });
    } catch (err) {
      console.error('[commandStore] fetchCommands failed:', err);
      set({ isLoading: false });
    }
  },

  mergeCliCommands: (list) => {
    const cli = list
      .map(toUnified)
      .filter((c): c is UnifiedCommand => c !== null);
    if (cli.length === 0) return;
    const { scanned } = get();
    set({ cliAdvertised: cli, commands: combine(scanned, cli) });
  },

  addPrefix: (cmd) => set((state) => {
    if (cmd.category !== 'skill') return { activePrefixes: [cmd] };
    if (state.activePrefixes.some((item) => item.name === cmd.name)) return state;
    return { activePrefixes: [...state.activePrefixes.filter((item) => item.category === 'skill'), cmd] };
  }),
  removePrefix: (name) => set((state) => ({
    activePrefixes: state.activePrefixes.filter((item) => item.name !== name),
  })),
  clearPrefixes: () => set({ activePrefixes: [] }),
}));
