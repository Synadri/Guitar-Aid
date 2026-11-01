import { beforeEach, describe, expect, it } from 'vitest';
import {
  PRESET_BLUES_ROCK,
  PRESET_POP_DIATONIC,
  loadPresetSongModel,
  type SongModel,
} from '../../song';
import { sandboxStore } from '../sandbox';
import {
  createIndexedDbSongStorage,
  createMemorySongStorage,
  createSongStore,
  resolveActiveHarmony,
  resolveDefaultSongStorage,
  selectActiveBarAnalysis,
  selectActiveFragmentAnalysis,
  selectBarProgression,
  selectInspectedBarNumber,
  selectSongFretboardMarks,
  selectSongKeys,
  selectSongPianoMarks,
  selectTrackMixerState,
  SONG_DB_NAME,
  SONG_DB_VERSION,
  type SongStorage,
  type StoredSong,
} from './index';

describe('Hito C4 — Capa state/song: Storage, Store, Marcas e IndexedDB', () => {
  let memoryStorage: SongStorage;

  beforeEach(() => {
    memoryStorage = createMemorySongStorage();
  });

  describe('1. Repositorio de almacenamiento (storage.ts)', () => {
    it('createMemorySongStorage: permite guardar, obtener, listar y eliminar canciones', async () => {
      expect(SONG_DB_NAME).toBe('guitar-aid-songs-db');
      expect(SONG_DB_VERSION).toBe(1);
      const model = loadPresetSongModel(PRESET_POP_DIATONIC.id);
      const storedSong: StoredSong = {
        id: model.id,
        title: model.title,
        artist: model.artist,
        model,
        importedAt: '2026-11-01T10:00:00.000Z',
        lastOpenedAt: '2026-11-01T12:00:00.000Z',
      };

      await memoryStorage.saveSong(storedSong);
      const fetched = await memoryStorage.getSong(model.id);
      expect(fetched).toBeDefined();
      expect(fetched?.title).toBe(model.title);

      const list = await memoryStorage.listSongs();
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(model.id);

      await memoryStorage.deleteSong(model.id);
      expect(await memoryStorage.getSong(model.id)).toBeUndefined();
      expect(await memoryStorage.listSongs()).toHaveLength(0);
    });

    it('createMemorySongStorage: gestiona anotaciones y limpieza total con clear', async () => {
      await memoryStorage.saveAnnotations({
        songId: 'song-1',
        barOverrides: { 1: { chordId: 'Am' } },
        loopRange: [1, 4],
        updatedAt: '2026-11-01T10:00:00.000Z',
      });

      const ann = await memoryStorage.getAnnotations('song-1');
      expect(ann).toBeDefined();
      expect(ann?.barOverrides[1]?.chordId).toBe('Am');
      expect(ann?.loopRange).toEqual([1, 4]);

      await memoryStorage.clear();
      expect(await memoryStorage.getAnnotations('song-1')).toBeUndefined();
      expect(await memoryStorage.listSongs()).toHaveLength(0);
    });

    it('resolveDefaultSongStorage: proporciona una instancia funcional de SongStorage', async () => {
      const storage = resolveDefaultSongStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.saveSong).toBe('function');
      expect(typeof storage.getSong).toBe('function');
    });

    it('createIndexedDbSongStorage: inicializa la base de datos y almacenes con mock de IDBFactory', async () => {
      // Mock ligero de IDBFactory para verificar la integración con IndexedDB
      const objectStoreMap = new Map<string, Map<string, unknown>>();

      const mockDb = {
        objectStoreNames: {
          contains: (name: string) => objectStoreMap.has(name),
        },
        createObjectStore: (name: string) => {
          const store = new Map<string, unknown>();
          objectStoreMap.set(name, store);
          return store;
        },
        transaction: () => {
          const tx: {
            objectStore: (name: string) => {
              put: (val: { id?: string; songId?: string }) => unknown;
              get: (key: string) => unknown;
              getAll: () => unknown;
              delete: (key: string) => unknown;
              clear: () => void;
            };
            oncomplete: null | (() => void);
            onerror: null | (() => void);
            onabort: null | (() => void);
          } = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: (name: string) => {
              const store = objectStoreMap.get(name) ?? new Map();
              return {
                put: (val: { id?: string; songId?: string }) => {
                  const key = val.id ?? val.songId ?? 'default';
                  store.set(key, val);
                  const req = {
                    result: key,
                    onsuccess: null as (() => void) | null,
                    onerror: null,
                  };
                  setTimeout(() => {
                    req.onsuccess?.();
                    setTimeout(() => tx.oncomplete?.(), 0);
                  }, 0);
                  return req;
                },
                get: (key: string) => {
                  const req = {
                    result: store.get(key),
                    onsuccess: null as (() => void) | null,
                    onerror: null,
                  };
                  setTimeout(() => {
                    req.onsuccess?.();
                    setTimeout(() => tx.oncomplete?.(), 0);
                  }, 0);
                  return req;
                },
                getAll: () => {
                  const req = {
                    result: Array.from(store.values()),
                    onsuccess: null as (() => void) | null,
                    onerror: null,
                  };
                  setTimeout(() => {
                    req.onsuccess?.();
                    setTimeout(() => tx.oncomplete?.(), 0);
                  }, 0);
                  return req;
                },
                delete: (key: string) => {
                  store.delete(key);
                  const req = {
                    result: undefined,
                    onsuccess: null as (() => void) | null,
                    onerror: null,
                  };
                  setTimeout(() => {
                    req.onsuccess?.();
                    setTimeout(() => tx.oncomplete?.(), 0);
                  }, 0);
                  return req;
                },
                clear: () => {
                  store.clear();
                  setTimeout(() => tx.oncomplete?.(), 0);
                },
              };
            },
          };
          return tx;
        },
        close: () => {},
      };

      const mockFactory: IDBFactory = {
        open: () => {
          const req: {
            result: typeof mockDb;
            onupgradeneeded: null | (() => void);
            onsuccess: null | (() => void);
            onerror: null;
          } = {
            result: mockDb,
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => {
            req.onupgradeneeded?.();
            req.onsuccess?.();
          }, 0);
          return req as unknown as IDBOpenDBRequest;
        },
      } as unknown as IDBFactory;

      const idbStorage = createIndexedDbSongStorage(mockFactory);
      const model = loadPresetSongModel(PRESET_BLUES_ROCK.id);

      await idbStorage.saveSong({
        id: model.id,
        title: model.title,
        artist: model.artist,
        model,
        importedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      });

      const fetched = await idbStorage.getSong(model.id);
      expect(fetched?.id).toBe(model.id);

      await idbStorage.saveAnnotations({
        songId: model.id,
        barOverrides: { 1: { chordId: 'E7' } },
        updatedAt: new Date().toISOString(),
      });

      const fetchedAnn = await idbStorage.getAnnotations(model.id);
      expect(fetchedAnn?.barOverrides[1]?.chordId).toBe('E7');

      await idbStorage.deleteSong(model.id);
      expect(await idbStorage.getSong(model.id)).toBeUndefined();
    });
  });

  describe('2. Estado y acciones de Zustand store (store.ts)', () => {
    it('inicializa con la primera canción de ejemplo (Pop Diatónico en C/Am) y estado visual canónico', () => {
      const store = createSongStore({ storage: memoryStorage });
      const state = store.getState();

      expect(state.activeSong).toBeDefined();
      expect(state.activeSong?.id).toBe(PRESET_POP_DIATONIC.id);
      expect(state.activeTrackIndex).toBe(0);
      expect(state.currentBar).toBe(1);
      expect(state.currentBeat).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.playbackSpeed).toBe(1.0);
      expect(state.metronomeEnabled).toBe(false);
      expect(state.countInEnabled).toBe(false);
      expect(state.loopRange).toBeNull();
      expect(state.loopEnabled).toBe(false);
      expect(state.selectedBarRange).toBeNull();
      expect(state.inspectedBar).toBeNull();
      expect(state.degreeReferenceMode).toBe('chord');
      expect(state.scoreViewMode).toBe('tab');
      expect(state.showLyrics).toBe(true);
      expect(state.analysisSource).toBe('active-track');
    });

    it('navegación por compases y pulsos: acota límites y reinicia beat al cambiar de compás', () => {
      const store = createSongStore({ storage: memoryStorage });
      const state = store.getState();
      const totalBars = state.activeSong?.tracks[0]?.bars.length ?? 8;

      store.getState().setCurrentBar(5);
      expect(store.getState().currentBar).toBe(5);
      expect(store.getState().currentBeat).toBe(0);

      // Clamping superior e inferior
      store.getState().setCurrentBar(999);
      expect(store.getState().currentBar).toBe(totalBars);

      store.getState().setCurrentBar(-10);
      expect(store.getState().currentBar).toBe(1);

      // Pulsos
      store.getState().setCurrentBeat(2);
      expect(store.getState().currentBeat).toBe(2);

      // Fijar posición conjunta
      store.getState().setCurrentPosition(3, 1);
      expect(store.getState().currentBar).toBe(3);
      expect(store.getState().currentBeat).toBe(1);
    });

    it('controles de transporte, velocidad y metrónomo', () => {
      const store = createSongStore({ storage: memoryStorage });

      store.getState().setIsPlaying(true);
      expect(store.getState().isPlaying).toBe(true);

      store.getState().setPlaybackSpeed(1.5);
      expect(store.getState().playbackSpeed).toBe(1.5);

      // Clamping de velocidad entre 0.25 y 2.0
      store.getState().setPlaybackSpeed(5.0);
      expect(store.getState().playbackSpeed).toBe(2.0);
      store.getState().setPlaybackSpeed(0.1);
      expect(store.getState().playbackSpeed).toBe(0.25);

      store.getState().toggleMetronome();
      expect(store.getState().metronomeEnabled).toBe(true);

      store.getState().toggleCountIn();
      expect(store.getState().countInEnabled).toBe(true);
    });

    it('selección de rango de compases y bucle inteligente', () => {
      const store = createSongStore({ storage: memoryStorage });

      // Selección normal e invertida
      store.getState().setSelectedBarRange([6, 3]);
      expect(store.getState().selectedBarRange).toEqual([3, 6]);

      // toggleLoop con selección activa convierte la selección en bucle
      store.getState().toggleLoop();
      expect(store.getState().loopEnabled).toBe(true);
      expect(store.getState().loopRange).toEqual([3, 6]);

      // Segundo toggleLoop desactiva el bucle
      store.getState().toggleLoop();
      expect(store.getState().loopEnabled).toBe(false);

      // toggleLoop sin selección previa activa el bucle sobre la sección actual (Intro: compases 1–4)
      store.getState().setSelectedBarRange(null);
      store.getState().setCurrentBar(2); // Sección "Intro" en Pop Diatónico
      store.getState().toggleLoop();
      expect(store.getState().loopEnabled).toBe(true);
      expect(store.getState().loopRange).toEqual([1, 4]);
    });

    it('mezclador multipista: mute, solo, volumen y reset', () => {
      const store = createSongStore({ storage: memoryStorage });

      store.getState().setTrackMute(0, true);
      store.getState().setTrackSolo(1, true);
      store.getState().setTrackVolume(0, 0.75);

      const mixer0 = selectTrackMixerState(store.getState(), 0);
      expect(mixer0.muted).toBe(true);
      expect(mixer0.solo).toBe(false);
      expect(mixer0.volume).toBe(0.75);

      const mixer1 = selectTrackMixerState(store.getState(), 1);
      expect(mixer1.solo).toBe(true);

      store.getState().resetTrackMixer();
      expect(selectTrackMixerState(store.getState(), 0)).toEqual({
        muted: false,
        solo: false,
        volume: 1.0,
      });
    });

    it('modos de vista, letra y referencia de grados', () => {
      const store = createSongStore({ storage: memoryStorage });

      store.getState().setScoreViewMode('score-tab');
      expect(store.getState().scoreViewMode).toBe('score-tab');

      store.getState().toggleLyrics();
      expect(store.getState().showLyrics).toBe(false);

      store.getState().setDegreeReferenceMode('key');
      expect(store.getState().degreeReferenceMode).toBe('key');

      store.getState().setAnalysisSource('all-tracks');
      expect(store.getState().analysisSource).toBe('all-tracks');
    });
  });

  describe('3. Criterio (h) — Sobreescritura manual de acorde o tonalidad (barOverrides)', () => {
    it('recalcula de inmediato las etiquetas de grado del mástil y piano y los numerales romanos', async () => {
      const store = createSongStore({ storage: memoryStorage });
      store.getState().setCurrentBar(1); // Compás 1: normalmente acorde C en tonalidad C mayor

      // 1. Con degreeReferenceMode: 'chord' en C (fundamental C): C = 1, E = 3, G = 5
      store.getState().setDegreeReferenceMode('chord');
      let fretMarks = selectSongFretboardMarks(store.getState(), { labels: 'degree' });
      const cMarks = fretMarks.filter((m) => m.label === '1');
      expect(cMarks.length).toBeGreaterThan(0);
      expect(cMarks[0]?.isRoot).toBe(true);

      // 2. El usuario fija manualmente el acorde a 'Am' para el compás 1
      await store.getState().setBarOverride(1, { chordId: 'Am' });
      expect(store.getState().barOverrides[1]?.chordId).toBe('Am');

      // Las marcas del mástil se recalculan de inmediato respecto a la raíz A (A = 1 con isRoot: true, C = ♭3, E = 5)
      fretMarks = selectSongFretboardMarks(store.getState(), { labels: 'degree' });
      const aRootMarks = fretMarks.filter((m) => m.label === '1');
      expect(aRootMarks.length).toBeGreaterThan(0);
      expect(aRootMarks[0]?.isRoot).toBe(true);

      const pianoMarks = selectSongPianoMarks(store.getState(), { labels: 'degree' });
      const aPianoRoots = pianoMarks.filter((m) => m.label === '1');
      expect(aPianoRoots.length).toBeGreaterThan(0);

      // En el análisis del compás y de la progresión, el compás 1 pasa a ser vi (Am en C mayor)
      const barAnalysis = selectActiveBarAnalysis(store.getState());
      expect(barAnalysis?.primaryChord?.root).toBe(9); // A
      expect(barAnalysis?.hasOverride).toBe(true);

      const progression = selectBarProgression(store.getState());
      expect(progression?.chords[0]?.roman).toBe('vi');

      // 3. Limpiar el override restaura el cálculo automático (acorde C, grado I)
      await store.getState().clearBarOverride(1);
      expect(store.getState().barOverrides[1]).toBeUndefined();

      const restoredAnalysis = selectActiveBarAnalysis(store.getState());
      expect(restoredAnalysis?.primaryChord?.root).toBe(0); // C
      const restoredProg = selectBarProgression(store.getState());
      expect(restoredProg?.chords[0]?.roman).toBe('I');
    });

    it('permite sobreescribir la tonalidad manual (ej. D dórico) y actualiza el fondo de escala', async () => {
      const store = createSongStore({ storage: memoryStorage });
      store.getState().setCurrentBar(1);

      await store.getState().setBarOverride(1, { tonic: 2, scaleId: 'dorian' });

      const harmony = resolveActiveHarmony(store.getState());
      expect(harmony?.scaleTonic).toBe(2); // D
      expect(harmony?.scaleType).toBe('dorian');
      expect(harmony?.hasScaleOverride).toBe(true);

      store.getState().setDegreeReferenceMode('key');
      const marks = selectSongFretboardMarks(store.getState(), { labels: 'degree' });
      const dRoots = marks.filter((m) => m.label === '1' && m.isRoot === true);
      expect(dRoots.length).toBeGreaterThan(0);
    });
  });

  describe('4. Criterio (i) — Sincronización en tiempo real y afinación de pista independiente', () => {
    it('muestra las notas del pulso activo (pinned) superpuestas sobre el fondo de escala (scale-bg)', () => {
      const store = createSongStore({ storage: memoryStorage });
      store.getState().setCurrentPosition(1, 0); // Compás 1, pulso 0

      const fretMarks = selectSongFretboardMarks(store.getState(), { labels: 'note' });
      const pinnedFret = fretMarks.filter((m) => m.role === 'pinned');
      const scaleBgFret = fretMarks.filter((m) => m.role === 'scale-bg');

      expect(pinnedFret.length).toBeGreaterThan(0);
      expect(scaleBgFret.length).toBeGreaterThan(0);

      const pianoMarks = selectSongPianoMarks(store.getState(), { labels: 'note' });
      const pinnedPiano = pianoMarks.filter((m) => m.role === 'pinned');
      const scaleBgPiano = pianoMarks.filter((m) => m.role === 'scale-bg');

      expect(pinnedPiano.length).toBeGreaterThan(0);
      expect(scaleBgPiano.length).toBeGreaterThan(0);
    });

    it('adopta automáticamente la afinación declarada por la pista sin tocar sandboxStore', () => {
      const store = createSongStore({ storage: memoryStorage });

      // Pista 0: Guitarra Rítmica (6 cuerdas, afinación estándar E2..E4)
      const guitarMarks = selectSongFretboardMarks(store.getState());
      const maxGuitarString = Math.max(...guitarMarks.map((m) => m.string));
      expect(maxGuitarString).toBe(6);

      // Pista 1: Bajo Eléctrico (4 cuerdas, afinación E1 A1 D2 G2)
      store.getState().setActiveTrackIndex(1);
      const bassMarks = selectSongFretboardMarks(store.getState());
      const maxBassString = Math.max(...bassMarks.map((m) => m.string));
      expect(maxBassString).toBe(4);

      // Comprobar que el sandboxStore no se ha modificado
      const sandboxTuning = sandboxStore.getState().tuning;
      expect(sandboxTuning.strings.length).toBe(6);
    });
  });

  describe('5. Criterio (j) — Persistencia en Storage («Biblioteca reciente») y validación defensiva', () => {
    it('persiste canciones y anotaciones y las restaura tras simular recarga de página', async () => {
      const store1 = createSongStore({ storage: memoryStorage });
      const customSong: SongModel = {
        ...loadPresetSongModel(PRESET_BLUES_ROCK.id),
        id: 'user-custom-song-1',
        title: 'Mi Canción de Prueba',
      };

      // 1. Importar canción
      await store1.getState().importSong(customSong, {
        fileFormat: 'gp5',
        fileSize: 45000,
      });
      expect(store1.getState().activeSong?.id).toBe('user-custom-song-1');

      // 2. Establecer bucle y sobreescrituras manuales
      store1.getState().setLoopRange([2, 5]);
      await store1.getState().setBarOverride(2, { chordId: 'A7' });
      await store1.getState().setBarOverride(3, { chordId: 'B7' });

      // 3. Simular recarga montando un nuevo store sobre el mismo storage
      const store2 = createSongStore({ storage: memoryStorage, initialSong: null });
      expect(store2.getState().activeSong).toBeNull();

      const loaded = await store2.getState().loadSavedSong('user-custom-song-1');
      expect(loaded).toBe(true);
      expect(store2.getState().activeSong?.id).toBe('user-custom-song-1');
      expect(store2.getState().activeSong?.title).toBe('Mi Canción de Prueba');
      expect(store2.getState().loopRange).toEqual([2, 5]);
      expect(store2.getState().loopEnabled).toBe(true);
      expect(store2.getState().barOverrides[2]?.chordId).toBe('A7');
      expect(store2.getState().barOverrides[3]?.chordId).toBe('B7');

      // 4. La canción aparece en la lista de canciones recientes del almacenamiento
      const list = await memoryStorage.listSongs();
      expect(list.some((s) => s.id === 'user-custom-song-1')).toBe(true);
    });

    it('manejo defensivo: un archivo corrupto o inválido genera error accesible sin romper el estado', async () => {
      const store = createSongStore({ storage: memoryStorage });
      const prevSongId = store.getState().activeSong?.id;

      // Intentar importar un objeto corrupto sin pistas
      await store.getState().importSong({ id: 'bad-song', tracks: [] } as unknown as SongModel);

      expect(store.getState().error).toBeDefined();
      expect(store.getState().error).toContain('Canción no válida');
      // El estado de la canción anterior sigue intacto
      expect(store.getState().activeSong?.id).toBe(prevSongId);
    });

    it('deleteSavedSong: elimina la canción de la biblioteca y restablece la canción por defecto', async () => {
      const store = createSongStore({ storage: memoryStorage });
      const customSong: SongModel = {
        ...loadPresetSongModel(PRESET_BLUES_ROCK.id),
        id: 'song-to-delete',
      };

      await store.getState().importSong(customSong);
      expect(store.getState().activeSong?.id).toBe('song-to-delete');

      await store.getState().deleteSavedSong('song-to-delete');
      expect(store.getState().activeSong?.id).toBe(PRESET_POP_DIATONIC.id);
      expect(await memoryStorage.getSong('song-to-delete')).toBeUndefined();
    });
  });

  describe('6. Selectores de análisis (analysis.ts)', () => {
    it('selectActiveFragmentAnalysis: analiza compás o rango seleccionado y memoriza resultado', () => {
      const store = createSongStore({ storage: memoryStorage });
      store.getState().setCurrentBar(1);

      const analysis1 = selectActiveFragmentAnalysis(store.getState());
      expect(analysis1).toBeDefined();
      expect(analysis1?.range.startBarNumber).toBe(1);
      expect(analysis1?.range.endBarNumber).toBe(1);

      // Misma llamada devuelve la misma referencia en caché
      const analysis1Cached = selectActiveFragmentAnalysis(store.getState());
      expect(analysis1Cached).toBe(analysis1);

      // Al seleccionar un rango, analiza el rango completo
      store.getState().setSelectedBarRange([1, 4]);
      const rangeAnalysis = selectActiveFragmentAnalysis(store.getState());
      expect(rangeAnalysis?.range.startBarNumber).toBe(1);
      expect(rangeAnalysis?.range.endBarNumber).toBe(4);
      expect(rangeAnalysis?.barChords).toHaveLength(4);
    });

    it('selectActiveBarAnalysis y selectInspectedBarNumber: respetan el anclaje de inspección', () => {
      const store = createSongStore({ storage: memoryStorage });
      store.getState().setCurrentBar(1);

      expect(selectInspectedBarNumber(store.getState())).toBe(1);
      const bar1Analysis = selectActiveBarAnalysis(store.getState());
      expect(bar1Analysis?.barNumber).toBe(1);

      // El usuario ancla el compás 3 mientras el reproductor sigue en compás 1
      store.getState().setInspectedBar(3);
      expect(selectInspectedBarNumber(store.getState())).toBe(3);

      const bar3Analysis = selectActiveBarAnalysis(store.getState());
      expect(bar3Analysis?.barNumber).toBe(3);
    });

    it('selectSongKeys: devuelve las tonalidades locales de todos los compases', () => {
      const store = createSongStore({ storage: memoryStorage });
      const keys = selectSongKeys(store.getState());
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]?.key.tonic).toBe(0); // C
    });
  });
});
