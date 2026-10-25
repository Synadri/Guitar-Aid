import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { STANDARD_TUNING, getTuning, type NameMode, type Tuning } from '../../theory';
import { type LabelMode, type SandboxStore, sandboxStore } from '../sandbox';

export type InstrumentId = 'fretboard' | 'piano';

export interface VisibleInstruments {
  fretboard: boolean;
  piano: boolean;
}

export type Orientation = 'horizontal' | 'vertical';
export type SuggestionsMode = 'chords' | 'scales';

export interface SettingsState {
  /** Afinación seleccionada (la fuente de verdad de la preferencia del usuario). */
  tuning: Tuning;
  /** Disposición de los instrumentos: horizontal (guitarra arriba, piano abajo) o vertical. */
  orientation: Orientation;
  /** Visibilidad independiente de la guitarra y del piano (al menos uno siempre visible). */
  visibleInstruments: VisibleInstruments;
  /** Mástil invertido para zurdos. */
  leftHanded: boolean;
  /** Preferencia de enarmonía por defecto: sostenidos (♯) o bemoles (♭). */
  nameMode: NameMode;
  /** Etiqueta que muestran las marcas: nombre de nota, intervalo, grado o nada. */
  labels: LabelMode;
  /** Modo del panel de sugerencias: acordes o escalas. */
  suggestionsMode: SuggestionsMode;
  /** Volumen maestro (0..1). */
  volume: number;
  /** Interruptor global de sonido. */
  soundEnabled: boolean;
  /** Mostrar posiciones equivalentes en todo el mástil (activado por defecto). */
  showAllPositions: boolean;
}

export interface SettingsActions {
  setTuning: (tuning: Tuning | string) => void;
  setOrientation: (orientation: Orientation) => void;
  setVisibleInstruments: (visible: Partial<VisibleInstruments>) => void;
  toggleInstrument: (instrument: InstrumentId) => void;
  setLeftHanded: (leftHanded: boolean) => void;
  setNameMode: (mode: NameMode) => void;
  setLabels: (labels: LabelMode) => void;
  setSuggestionsMode: (mode: SuggestionsMode) => void;
  setVolume: (volume: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setShowAllPositions: (show: boolean) => void;
  /** Restablece todos los ajustes a los valores iniciales. */
  resetSettings: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/** Datos persistidos en el almacenamiento local (Requisitos §6.7). Solo ajustes, sin selección. */
export interface PersistedSettings {
  tuningId: string;
  orientation: Orientation;
  visibleInstruments: VisibleInstruments;
  leftHanded: boolean;
  nameMode: NameMode;
  labels: LabelMode;
  suggestionsMode: SuggestionsMode;
  volume: number;
  soundEnabled: boolean;
  showAllPositions: boolean;
}

export const SETTINGS_STORAGE_KEY = 'guitar-aid:settings';

export function initialSettingsState(overrides: Partial<SettingsState> = {}): SettingsState {
  return {
    tuning: STANDARD_TUNING,
    orientation: 'horizontal',
    visibleInstruments: { fretboard: true, piano: true },
    leftHanded: false,
    nameMode: 'sharps',
    labels: 'note',
    suggestionsMode: 'chords',
    volume: 0.8,
    soundEnabled: true,
    showAllPositions: true,
    ...overrides,
  };
}

export interface MemoryStorage extends StateStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** Almacenamiento en memoria para entornos sin DOM / Node / tests aislados. */
export function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function resolveDefaultStorage(): StateStorage {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return createMemoryStorage();
}

/**
 * Conecta bidireccionalmente el store de ajustes (fuente de verdad persistida)
 * con el store del sandbox (estado de selección en memoria).
 *
 * Garantiza que:
 * 1. La afinación y el modo de posiciones en ambos stores sean siempre idénticos.
 * 2. Al cambiar la afinación en ajustes, el sandbox recoloca sus notas automáticamente.
 * 3. Al cambiar la afinación en el sandbox (tests o acciones directas), ajustes persiste el cambio.
 * 4. La UI interactúa con una sola fuente de verdad sin tener que coordinar dos llamadas.
 */
export function bindSettingsToSandbox(
  settings: StoreApi<SettingsStore>,
  sandbox: StoreApi<SandboxStore>,
): () => void {
  // Sincronización inicial
  const currentSettings = settings.getState();
  if (sandbox.getState().tuning.id !== currentSettings.tuning.id) {
    sandbox.getState().setTuning(currentSettings.tuning);
  }
  if (sandbox.getState().showAllPositions !== currentSettings.showAllPositions) {
    sandbox.getState().setShowAllPositions(currentSettings.showAllPositions);
  }

  let lastSettingsTuningId = settings.getState().tuning.id;
  let lastSandboxTuningId = sandbox.getState().tuning.id;
  let lastSettingsShowAll = settings.getState().showAllPositions;
  let lastSandboxShowAll = sandbox.getState().showAllPositions;

  // settings -> sandbox
  const unsubSettings = settings.subscribe((state) => {
    if (state.tuning.id !== lastSettingsTuningId) {
      lastSettingsTuningId = state.tuning.id;
      if (sandbox.getState().tuning.id !== state.tuning.id) {
        lastSandboxTuningId = state.tuning.id;
        sandbox.getState().setTuning(state.tuning);
      }
    }
    if (state.showAllPositions !== lastSettingsShowAll) {
      lastSettingsShowAll = state.showAllPositions;
      if (sandbox.getState().showAllPositions !== state.showAllPositions) {
        lastSandboxShowAll = state.showAllPositions;
        sandbox.getState().setShowAllPositions(state.showAllPositions);
      }
    }
  });

  // sandbox -> settings
  const unsubSandbox = sandbox.subscribe((state) => {
    if (state.tuning.id !== lastSandboxTuningId) {
      lastSandboxTuningId = state.tuning.id;
      if (settings.getState().tuning.id !== state.tuning.id) {
        lastSettingsTuningId = state.tuning.id;
        settings.getState().setTuning(state.tuning);
      }
    }
    if (state.showAllPositions !== lastSandboxShowAll) {
      lastSandboxShowAll = state.showAllPositions;
      if (settings.getState().showAllPositions !== state.showAllPositions) {
        lastSettingsShowAll = state.showAllPositions;
        settings.getState().setShowAllPositions(state.showAllPositions);
      }
    }
  });

  return () => {
    unsubSettings();
    unsubSandbox();
  };
}

export interface CreateSettingsStoreOptions {
  storage?: StateStorage;
  storageName?: string;
  initialOverrides?: Partial<SettingsState>;
  syncWithSandbox?: StoreApi<SandboxStore>;
}

export function createSettingsStore(
  options: CreateSettingsStoreOptions = {},
): StoreApi<SettingsStore> {
  const {
    storage = resolveDefaultStorage(),
    storageName = SETTINGS_STORAGE_KEY,
    initialOverrides = {},
    syncWithSandbox,
  } = options;

  const store = createStore<SettingsStore>()(
    persist(
      (set) => ({
        ...initialSettingsState(initialOverrides),

        setTuning: (tuningOrId) =>
          set((s) => {
            const resolved = typeof tuningOrId === 'string' ? getTuning(tuningOrId) : tuningOrId;
            if (!resolved || resolved.id === s.tuning.id) return s;
            return { tuning: resolved };
          }),

        setOrientation: (orientation) => set({ orientation }),

        setVisibleInstruments: (partial) =>
          set((s) => {
            const next = { ...s.visibleInstruments, ...partial };
            if (!next.fretboard && !next.piano) return s; // al menos uno visible
            return { visibleInstruments: next };
          }),

        toggleInstrument: (instrument) =>
          set((s) => {
            const current = s.visibleInstruments[instrument];
            const other: InstrumentId = instrument === 'fretboard' ? 'piano' : 'fretboard';
            if (current && !s.visibleInstruments[other]) return s; // no ocultar ambos
            return {
              visibleInstruments: {
                ...s.visibleInstruments,
                [instrument]: !current,
              },
            };
          }),

        setLeftHanded: (leftHanded) => set({ leftHanded }),

        setNameMode: (nameMode) => set({ nameMode }),

        setLabels: (labels) => set({ labels }),

        setSuggestionsMode: (suggestionsMode) => set({ suggestionsMode }),

        setVolume: (volume) =>
          set({
            volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.8,
          }),

        setSoundEnabled: (soundEnabled) => set({ soundEnabled }),

        setShowAllPositions: (showAllPositions) => set({ showAllPositions }),

        resetSettings: () => set(initialSettingsState()),
      }),
      {
        name: storageName,
        version: 0,
        storage: createJSONStorage(() => storage),
        partialize: (state): PersistedSettings => ({
          tuningId: state.tuning.id,
          orientation: state.orientation,
          visibleInstruments: state.visibleInstruments,
          leftHanded: state.leftHanded,
          nameMode: state.nameMode,
          labels: state.labels,
          suggestionsMode: state.suggestionsMode,
          volume: state.volume,
          soundEnabled: state.soundEnabled,
          showAllPositions: state.showAllPositions,
        }),
        merge: (persistedState, currentState): SettingsStore => {
          const p = (persistedState ?? {}) as Partial<PersistedSettings>;
          const tuning = p.tuningId
            ? (getTuning(p.tuningId) ?? currentState.tuning)
            : currentState.tuning;
          const orientation: Orientation =
            p.orientation === 'vertical' ? 'vertical' : currentState.orientation;
          const fretboard =
            p.visibleInstruments?.fretboard ?? currentState.visibleInstruments.fretboard;
          const piano = p.visibleInstruments?.piano ?? currentState.visibleInstruments.piano;
          const visibleInstruments =
            !fretboard && !piano ? currentState.visibleInstruments : { fretboard, piano };
          const leftHanded =
            typeof p.leftHanded === 'boolean' ? p.leftHanded : currentState.leftHanded;
          const nameMode: NameMode =
            p.nameMode === 'flats' || p.nameMode === 'sharps' ? p.nameMode : currentState.nameMode;
          const validLabels: LabelMode[] = ['note', 'interval', 'degree', 'none'];
          const labels: LabelMode =
            p.labels && validLabels.includes(p.labels) ? p.labels : currentState.labels;
          const suggestionsMode: SuggestionsMode =
            p.suggestionsMode === 'scales' || p.suggestionsMode === 'chords'
              ? p.suggestionsMode
              : currentState.suggestionsMode;
          const volume =
            typeof p.volume === 'number' && Number.isFinite(p.volume)
              ? Math.max(0, Math.min(1, p.volume))
              : currentState.volume;
          const soundEnabled =
            typeof p.soundEnabled === 'boolean' ? p.soundEnabled : currentState.soundEnabled;
          const showAllPositions =
            typeof p.showAllPositions === 'boolean'
              ? p.showAllPositions
              : currentState.showAllPositions;

          return {
            ...currentState,
            tuning,
            orientation,
            visibleInstruments,
            leftHanded,
            nameMode,
            labels,
            suggestionsMode,
            volume,
            soundEnabled,
            showAllPositions,
          };
        },
      },
    ),
  );

  if (syncWithSandbox) {
    bindSettingsToSandbox(store, syncWithSandbox);
  }

  return store;
}

/** Store singleton de ajustes. Conectado automáticamente con sandboxStore como única fuente de verdad. */
export const settingsStore = createSettingsStore({ syncWithSandbox: sandboxStore });
