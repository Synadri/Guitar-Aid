import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  PRESET_POP_DIATONIC,
  loadPresetSongModel,
  type BarOverride,
  type SongModel,
  type UserSongAnnotations,
} from '../../song';
import { resolveDefaultSongStorage } from './storage';
import type {
  SongState,
  SongStorage,
  SongStore,
  StoredSong,
} from './types';

export interface CreateSongStoreOptions {
  storage?: SongStorage;
  initialSong?: SongModel | null;
  initialOverrides?: Partial<SongState>;
}

/** Estado inicial por defecto del Modo Canción. */
export function initialSongState(
  initialSong?: SongModel | null,
  overrides: Partial<SongState> = {},
): SongState {
  const defaultSong =
    initialSong !== undefined ? initialSong : loadPresetSongModel(PRESET_POP_DIATONIC.id);

  return {
    activeSong: defaultSong,
    activeTrackIndex: 0,
    currentBar: 1,
    currentBeat: 0,
    isPlaying: false,
    playbackSpeed: 1.0,
    metronomeEnabled: false,
    metronomeSubdivision: '1/4',
    countInEnabled: false,
    loopRange: null,
    loopEnabled: false,
    selectedBarRange: null,
    inspectedBar: null,
    barOverrides: {},
    degreeReferenceMode: 'chord',
    scoreViewMode: 'tab',
    showLyrics: true,
    analysisSource: 'active-track',
    trackMixer: {},
    previewContext: null,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

/**
 * Crea una nueva instancia de Zustand store para el Modo Canción.
 */
export function createSongStore(options: CreateSongStoreOptions = {}): StoreApi<SongStore> {
  const storage = options.storage ?? resolveDefaultSongStorage();
  const initial = initialSongState(options.initialSong, options.initialOverrides);

  return createStore<SongStore>()((set, get) => {
    async function persistAnnotations(songId: string): Promise<void> {
      const state = get();
      const annotations: UserSongAnnotations = {
        songId,
        barOverrides: state.barOverrides,
        loopRange: state.loopRange ?? undefined,
        updatedAt: new Date().toISOString(),
      };
      try {
        await storage.saveAnnotations(annotations);
      } catch (err) {
        // Fallo no fatal de persistencia
        console.warn('Guitar Aid: no se pudieron persistir las anotaciones en IndexedDB', err);
      }
    }

    return {
      ...initial,

      setActiveSong: async (song) => {
        if (!song) {
          set({
            activeSong: null,
            activeTrackIndex: 0,
            currentBar: 1,
            currentBeat: 0,
            isPlaying: false,
            loopRange: null,
            loopEnabled: false,
            selectedBarRange: null,
            inspectedBar: null,
            barOverrides: {},
            trackMixer: {},
            error: null,
          });
          return;
        }

        let annotations: UserSongAnnotations | undefined;
        try {
          annotations = await storage.getAnnotations(song.id);
        } catch {
          // Continuar con valores por defecto
        }

        set({
          activeSong: song,
          activeTrackIndex: 0,
          currentBar: 1,
          currentBeat: 0,
          isPlaying: false,
          loopRange: annotations?.loopRange ?? null,
          loopEnabled: Boolean(annotations?.loopRange),
          selectedBarRange: null,
          inspectedBar: null,
          barOverrides: annotations?.barOverrides ?? {},
          trackMixer: {},
          error: null,
        });
      },

      setActiveTrackIndex: (index) => {
        const song = get().activeSong;
        if (!song || song.tracks.length === 0) return;
        const clamped = Math.max(0, Math.min(song.tracks.length - 1, index));
        set({ activeTrackIndex: clamped });
      },

      setCurrentBar: (barNumber) => {
        const song = get().activeSong;
        const track = song?.tracks[get().activeTrackIndex] ?? song?.tracks[0];
        const maxBar = track?.bars.length ?? 1;
        const clamped = Math.max(1, Math.min(maxBar, barNumber));
        set({ currentBar: clamped, currentBeat: 0 });
      },

      setCurrentBeat: (beatIndex) => {
        const song = get().activeSong;
        const track = song?.tracks[get().activeTrackIndex] ?? song?.tracks[0];
        const bar =
          track?.bars.find((b) => b.number === get().currentBar) ??
          track?.bars[get().currentBar - 1] ??
          track?.bars[0];
        const maxBeat = Math.max(0, (bar?.beats.length ?? 1) - 1);
        const clamped = Math.max(0, Math.min(maxBeat, beatIndex));
        set({ currentBeat: clamped });
      },

      setCurrentPosition: (barNumber, beatIndex) => {
        const song = get().activeSong;
        const track = song?.tracks[get().activeTrackIndex] ?? song?.tracks[0];
        const maxBar = track?.bars.length ?? 1;
        const clampedBar = Math.max(1, Math.min(maxBar, barNumber));
        const bar =
          track?.bars.find((b) => b.number === clampedBar) ??
          track?.bars[clampedBar - 1] ??
          track?.bars[0];
        const maxBeat = Math.max(0, (bar?.beats.length ?? 1) - 1);
        const clampedBeat = Math.max(0, Math.min(maxBeat, beatIndex));
        set({ currentBar: clampedBar, currentBeat: clampedBeat });
      },

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      setPlaybackSpeed: (speed) => {
        const clamped = Math.max(0.25, Math.min(2.0, speed));
        set({ playbackSpeed: clamped });
      },

      setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),

      toggleMetronome: () => set((s) => ({ metronomeEnabled: !s.metronomeEnabled })),

      setMetronomeSubdivision: (subdivision) => set({ metronomeSubdivision: subdivision }),

      setCountInEnabled: (enabled) => set({ countInEnabled: enabled }),

      toggleCountIn: () => set((s) => ({ countInEnabled: !s.countInEnabled })),

      setLoopRange: (range) => {
        set({ loopRange: range, loopEnabled: range !== null });
        const song = get().activeSong;
        if (song) void persistAnnotations(song.id);
      },

      setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),

      toggleLoop: () => {
        const state = get();
        if (state.loopEnabled) {
          set({ loopEnabled: false });
          return;
        }

        // Si hay una selección de compases, convertirla en bucle; si no, bucle sobre el compás activo
        const range: [number, number] =
          state.selectedBarRange ?? [state.currentBar, state.currentBar];
        set({ loopRange: range, loopEnabled: true });
        const song = state.activeSong;
        if (song) void persistAnnotations(song.id);
      },

      setSelectedBarRange: (range) => {
        if (!range) {
          set({ selectedBarRange: null });
          return;
        }
        const [start, end] = range;
        const song = get().activeSong;
        const track = song?.tracks[get().activeTrackIndex] ?? song?.tracks[0];
        const maxBar = track?.bars.length ?? 1;
        const clampedStart = Math.max(1, Math.min(maxBar, Math.min(start, end)));
        const clampedEnd = Math.max(1, Math.min(maxBar, Math.max(start, end)));
        set({ selectedBarRange: [clampedStart, clampedEnd] });
      },

      setInspectedBar: (barNumber) => set({ inspectedBar: barNumber }),

      setBarOverride: async (barNumber, override) => {
        const current = { ...(get().barOverrides[barNumber] ?? {}) };
        for (const [key, val] of Object.entries(override)) {
          if (val === undefined) {
            delete (current as Record<string, unknown>)[key];
          } else {
            (current as Record<string, unknown>)[key] = val;
          }
        }
        const updatedOverrides: Record<number, BarOverride> = { ...get().barOverrides };
        if (Object.keys(current).length === 0) {
          delete updatedOverrides[barNumber];
        } else {
          updatedOverrides[barNumber] = current;
        }
        set({ barOverrides: updatedOverrides });
        const song = get().activeSong;
        if (song) await persistAnnotations(song.id);
      },

      clearBarOverride: async (barNumber) => {
        const updatedOverrides = { ...get().barOverrides };
        delete updatedOverrides[barNumber];
        set({ barOverrides: updatedOverrides });
        const song = get().activeSong;
        if (song) await persistAnnotations(song.id);
      },

      clearBarScaleOverride: async (barNumber) => {
        const current = get().barOverrides[barNumber];
        if (!current) return;
        const updated = { ...current };
        delete updated.tonic;
        delete updated.scaleId;
        const updatedOverrides = { ...get().barOverrides };
        if (Object.keys(updated).length === 0) {
          delete updatedOverrides[barNumber];
        } else {
          updatedOverrides[barNumber] = updated;
        }
        set({ barOverrides: updatedOverrides });
        const song = get().activeSong;
        if (song) await persistAnnotations(song.id);
      },

      clearBarChordOverride: async (barNumber) => {
        const current = get().barOverrides[barNumber];
        if (!current) return;
        const updated = { ...current };
        delete updated.chordId;
        const updatedOverrides = { ...get().barOverrides };
        if (Object.keys(updated).length === 0) {
          delete updatedOverrides[barNumber];
        } else {
          updatedOverrides[barNumber] = updated;
        }
        set({ barOverrides: updatedOverrides });
        const song = get().activeSong;
        if (song) await persistAnnotations(song.id);
      },

      clearAllBarOverrides: async () => {
        set({ barOverrides: {} });
        const song = get().activeSong;
        if (song) await persistAnnotations(song.id);
      },

      setDegreeReferenceMode: (mode) => set({ degreeReferenceMode: mode }),

      setScoreViewMode: (mode) => set({ scoreViewMode: mode }),

      setShowLyrics: (show) => set({ showLyrics: show }),

      toggleLyrics: () => set((s) => ({ showLyrics: !s.showLyrics })),

      setAnalysisSource: (source) => set({ analysisSource: source }),

      setTrackMixer: (trackIndex, partial) => {
        const current = get().trackMixer[trackIndex] ?? {
          muted: false,
          solo: false,
          volume: 1.0,
        };
        set((s) => ({
          trackMixer: {
            ...s.trackMixer,
            [trackIndex]: { ...current, ...partial },
          },
        }));
      },

      setTrackMute: (trackIndex, muted) => {
        const current = get().trackMixer[trackIndex] ?? {
          muted: false,
          solo: false,
          volume: 1.0,
        };
        set((s) => ({
          trackMixer: {
            ...s.trackMixer,
            [trackIndex]: { ...current, muted },
          },
        }));
      },

      setTrackSolo: (trackIndex, solo) => {
        const current = get().trackMixer[trackIndex] ?? {
          muted: false,
          solo: false,
          volume: 1.0,
        };
        set((s) => ({
          trackMixer: {
            ...s.trackMixer,
            [trackIndex]: { ...current, solo },
          },
        }));
      },

      setTrackVolume: (trackIndex, volume) => {
        const clamped = Math.max(0, Math.min(1.0, volume));
        const current = get().trackMixer[trackIndex] ?? {
          muted: false,
          solo: false,
          volume: 1.0,
        };
        set((s) => ({
          trackMixer: {
            ...s.trackMixer,
            [trackIndex]: { ...current, volume: clamped },
          },
        }));
      },

      resetTrackMixer: () => set({ trackMixer: {} }),

      setPreviewContext: (preview) => set({ previewContext: preview }),

      importSong: async (model, metadata) => {
        try {
          if (!model || !model.id || !model.tracks || model.tracks.length === 0) {
            throw new Error('Canción no válida: el archivo está vacío o el formato es desconocido.');
          }

          const storedSong: StoredSong = {
            id: model.id,
            title: model.title || 'Canción sin título',
            artist: model.artist || 'Artista desconocido',
            model,
            rawData: metadata?.rawData,
            fileFormat: metadata?.fileFormat,
            fileSize: metadata?.fileSize,
            importedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          };

          await storage.saveSong(storedSong);

          let savedAnnotations: UserSongAnnotations | undefined;
          try {
            savedAnnotations = await storage.getAnnotations(model.id);
          } catch {
            // Sin anotaciones previas
          }

          set({
            activeSong: model,
            activeTrackIndex: 0,
            currentBar: 1,
            currentBeat: 0,
            isPlaying: false,
            loopRange: savedAnnotations?.loopRange ?? null,
            loopEnabled: Boolean(savedAnnotations?.loopRange),
            selectedBarRange: null,
            inspectedBar: null,
            barOverrides: savedAnnotations?.barOverrides ?? {},
            trackMixer: {},
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Error al importar la canción en la biblioteca.';
          set({ error: message });
        }
      },

      loadSavedSong: async (songId) => {
        try {
          const stored = await storage.getSong(songId);
          if (!stored) {
            set({ error: `No se encontró la canción con identificador "${songId}".` });
            return false;
          }

          stored.lastOpenedAt = new Date().toISOString();
          try {
            await storage.saveSong(stored);
          } catch {
            // Continuar
          }

          let annotations: UserSongAnnotations | undefined;
          try {
            annotations = await storage.getAnnotations(songId);
          } catch {
            // Sin anotaciones
          }

          set({
            activeSong: stored.model,
            activeTrackIndex: 0,
            currentBar: 1,
            currentBeat: 0,
            isPlaying: false,
            loopRange: annotations?.loopRange ?? null,
            loopEnabled: Boolean(annotations?.loopRange),
            selectedBarRange: null,
            inspectedBar: null,
            barOverrides: annotations?.barOverrides ?? {},
            trackMixer: {},
            error: null,
          });
          return true;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : `Error al cargar la canción "${songId}".`;
          set({ error: message });
          return false;
        }
      },

      deleteSavedSong: async (songId) => {
        try {
          await storage.deleteSong(songId);
          await storage.deleteAnnotations(songId);
        } catch (err) {
          console.warn('Error al eliminar canción de IndexedDB', err);
        }

        if (get().activeSong?.id === songId) {
          const defaultSong = loadPresetSongModel(PRESET_POP_DIATONIC.id);
          await get().setActiveSong(defaultSong);
        }
      },

      setError: (error) => set({ error }),

      resetSongState: () => {
        const defaultSong = loadPresetSongModel(PRESET_POP_DIATONIC.id);
        set(initialSongState(defaultSong));
      },
    };
  });
}

/** Store singleton global del Modo Canción. */
export const songStore = createSongStore();
