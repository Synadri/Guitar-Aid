import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  alphaSynthController as defaultController,
  audioEngine as defaultAudioEngine,
  type AlphaSynthController,
  type AlphaSynthLike,
  type AudioEngine,
} from '../../audio';
import {
  settingsStore as defaultSettingsStore,
  songStore as defaultSongStore,
  selectActiveFragmentAnalysis,
  selectSongFretboardMarks,
  selectSongPianoMarks,
  type DecksStore,
  type DrillsStore,
  type SandboxStore,
  type SettingsStore,
  type SongStorage,
  type SongStore,
} from '../../state';
import {
  STANDARD_TUNING,
  positionToMidi,
  type FretPosition,
} from '../../theory';
import {
  fragmentToDrillConfig,
  resolvePlaybackRangeForBars,
  resolvePlaybackTickForBarBeat,
  importSong,
  type SongMenuContext,
  type SongModel,
} from '../../song';
import { Fretboard, Piano } from '../instruments';
import { AlphaTabViewport } from './AlphaTabViewport';
import { SongAnalysisPanel } from './SongAnalysisPanel';
import { SongContextStrip } from './SongContextStrip';
import { SongExportDeckModal } from './SongExportDeckModal';
import { SongLibraryModal } from './SongLibraryModal';
import { SongTimelineBar } from './SongTimelineBar';
import { SongTopBar } from './SongTopBar';
import styles from './SongView.module.css';

export interface SongViewProps {
  songStore?: StoreApi<SongStore>;
  settingsStore?: StoreApi<SettingsStore>;
  sandboxStore?: StoreApi<SandboxStore>;
  drillsStore?: StoreApi<DrillsStore>;
  decksStore?: StoreApi<DecksStore>;
  audioEngine?: AudioEngine;
  controller?: AlphaSynthController;
  createApi?: (container: HTMLElement, settings?: unknown) => AlphaSynthLike;
  onOpenLibrary?: () => void;
  storage?: SongStorage;
  isLibraryOpen?: boolean;
  onCloseLibrary?: () => void;
  onOpenInSandbox?: (context: SongMenuContext) => void;
  onCreateSrsDeck?: () => void;
  onPracticeInDrills?: () => void;
  onNavigateToSandbox?: () => void;
  onNavigateToLearn?: (tab?: 'drills' | 'cards') => void;
}

export function SongView({
  songStore = defaultSongStore,
  settingsStore = defaultSettingsStore,
  sandboxStore,
  drillsStore,
  decksStore,
  audioEngine = defaultAudioEngine,
  controller = defaultController,
  createApi,
  onOpenLibrary,
  storage,
  isLibraryOpen: propsIsLibraryOpen,
  onCloseLibrary,
  onOpenInSandbox,
  onCreateSrsDeck,
  onPracticeInDrills,
  onNavigateToSandbox,
  onNavigateToLearn,
}: SongViewProps) {

  const [internalLibraryOpen, setInternalLibraryOpen] = useState(false);
  const isLibraryOpen =
    propsIsLibraryOpen !== undefined ? propsIsLibraryOpen : internalLibraryOpen;

  const handleOpenLibrary = () => {
    setInternalLibraryOpen(true);
    onOpenLibrary?.();
  };

  const handleCloseLibrary = () => {
    setInternalLibraryOpen(false);
    onCloseLibrary?.();
  };

  // Drag & Drop a nivel de vista principal
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (isLibraryOpen) {
      setIsWindowDragging(false);
      dragCounter.current = 0;
    }
  }, [isLibraryOpen]);

  const handleDragEnter = (e: React.DragEvent) => {
    if (isLibraryOpen) return;
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsWindowDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isLibraryOpen) return;
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsWindowDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isLibraryOpen) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isLibraryOpen) return;
    e.preventDefault();
    dragCounter.current = 0;
    setIsWindowDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (bytes.byteLength === 0) {
        throw new Error('El archivo está vacío o dañado.');
      }

      let songModel: SongModel;
      if (ext === '.tex' || ext === '.alphatex') {
        const text = new TextDecoder('utf-8').decode(bytes);
        songModel = importSong(text, { fileName: file.name });
      } else {
        songModel = importSong(bytes, { fileName: file.name });
      }

      await songStore.getState().importSong(songModel, {
        rawData: bytes,
        fileFormat: ext || '.gp',
        fileSize: file.size,
      });

      songStore.getState().setError(null);
    } catch {
      const failMsg = `No se pudo importar «${file.name}»: el archivo está vacío o dañado. Tu biblioteca no ha cambiado.`;
      songStore.getState().setError(failMsg);
      setInternalLibraryOpen(true);
    }
  };

  // Estado reactivo del store de canción
  const songState = useStore(songStore, (s) => s);
  const activeSong = songState.activeSong;
  const activeTrackIndex = songState.activeTrackIndex;

  // Estado de ajustes
  const settings = useStore(settingsStore, (s) => s);
  const { nameMode, labels, leftHanded, soundEnabled, visibleInstruments } = settings;

  // Sincronizar ajustes de sonido y volumen con AlphaSynthController
  useEffect(() => {
    if (!controller || !settingsStore) return;
    return controller.bindSettings(settingsStore);
  }, [controller, settingsStore]);

  // Modal para exportar a mazo SRS
  const [internalExportDeckOpen, setInternalExportDeckOpen] = useState(false);

  // Pista activa
  const track = activeSong?.tracks[activeTrackIndex] ?? activeSong?.tracks[0];
  const tuning = track?.tuning ?? STANDARD_TUNING;
  const capoFret = track?.capoFret ?? 0;

  // Análisis del fragmento activo para puentes
  const fragmentAnalysis = selectActiveFragmentAnalysis(songState, { mode: nameMode });

  // Manejadores de puentes
  const handleOpenInSandbox = (context: SongMenuContext) => {
    if (sandboxStore) {
      sandboxStore.getState().setContext(context);
    }
    onOpenInSandbox?.(context);
    onNavigateToSandbox?.();
  };

  const handleCreateSrsDeck = () => {
    onCreateSrsDeck?.();
    setInternalExportDeckOpen(true);
  };

  const handlePracticeInDrills = () => {
    if (fragmentAnalysis) {
      const drillConfig = fragmentToDrillConfig(
        fragmentAnalysis,
        activeSong ?? undefined,
        activeTrackIndex,
      );
      drillsStore?.getState().updateConfig(drillConfig);
    }
    onPracticeInDrills?.();
    onNavigateToLearn?.('drills');
  };

  // Marcas reactivas en vivo para Fretboard y Piano (pulso + scale-bg + etiquetas)
  const fretboardMarks = selectSongFretboardMarks(songState, { nameMode, labels });
  const pianoMarks = selectSongPianoMarks(songState, { nameMode, labels });

  // Manejo de atajos de teclado específicos del Modo Canción
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLibraryOpen || internalExportDeckOpen) {
        // Los atajos de transporte e instrumentos quedan inactivos mientras un modal esté abierto
        if (e.key === 'Escape') {
          if (internalExportDeckOpen) {
            setInternalExportDeckOpen(false);
          } else if (isLibraryOpen) {
            handleCloseLibrary();
          }
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!controller.isPlaying()) {
          const state = songStore.getState();
          const curTrack =
            state.activeSong?.tracks[state.activeTrackIndex] ?? state.activeSong?.tracks[0];
          let startBar = state.currentBar;
          let startBeat = state.currentBeat;
          if (state.loopEnabled && state.loopRange) {
            if (startBar < state.loopRange[0] || startBar > state.loopRange[1]) {
              startBar = state.loopRange[0];
              startBeat = 0;
              songStore.getState().setCurrentPosition(startBar, 0);
            }
          }
          const tick = resolvePlaybackTickForBarBeat(
            curTrack?.bars,
            startBar,
            startBeat,
            controller.getPlayer(),
          );
          controller.seekToTick(tick);
        }
        void controller.playPause().then(() => {
          songStore.getState().setIsPlaying(controller.isPlaying());
        });
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        songStore.getState().toggleLoop();
        const updated = songStore.getState();
        const curTrack =
          updated.activeSong?.tracks[updated.activeTrackIndex] ?? updated.activeSong?.tracks[0];
        const bars = curTrack?.bars;
        if (updated.loopEnabled && updated.loopRange && bars) {
          const bounds = resolvePlaybackRangeForBars(bars, updated.loopRange, controller.getPlayer());
          controller.setPlaybackRange(bounds);
          controller.setLoopEnabled(Boolean(bounds));
        } else {
          controller.setPlaybackRange(null);
          controller.setLoopEnabled(false);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevBar = songStore.getState().currentBar;
        const nextBar = Math.max(1, prevBar - 1);
        if (e.shiftKey) {
          const existing = songStore.getState().selectedBarRange ?? [prevBar, prevBar];
          const newMin = Math.min(existing[0], nextBar);
          const newMax = Math.max(existing[1], nextBar);
          songStore.getState().setSelectedBarRange([newMin, newMax]);
        }
        songStore.getState().setCurrentBar(nextBar);
        const curTrack =
          songStore.getState().activeSong?.tracks[songStore.getState().activeTrackIndex];
        controller.seekToTick(
          resolvePlaybackTickForBarBeat(curTrack?.bars, nextBar, 0, controller.getPlayer()),
        );
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const prevBar = songStore.getState().currentBar;
        const curTrack =
          songStore.getState().activeSong?.tracks[songStore.getState().activeTrackIndex];
        const maxBars = curTrack?.bars.length ?? 999;
        const nextBar = Math.min(maxBars, prevBar + 1);
        if (e.shiftKey) {
          const existing = songStore.getState().selectedBarRange ?? [prevBar, prevBar];
          const newMin = Math.min(existing[0], nextBar);
          const newMax = Math.max(existing[1], nextBar);
          songStore.getState().setSelectedBarRange([newMin, newMax]);
        }
        songStore.getState().setCurrentBar(nextBar);
        controller.seekToTick(
          resolvePlaybackTickForBarBeat(curTrack?.bars, nextBar, 0, controller.getPlayer()),
        );
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        const startBar =
          songStore.getState().loopEnabled && songStore.getState().loopRange
            ? songStore.getState().loopRange![0]
            : 1;
        songStore.getState().setCurrentPosition(startBar, 0);
        const curTrack =
          songStore.getState().activeSong?.tracks[songStore.getState().activeTrackIndex];
        controller.seekToTick(
          resolvePlaybackTickForBarBeat(curTrack?.bars, startBar, 0, controller.getPlayer()),
        );
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const nextSound = !settingsStore.getState().soundEnabled;
        settingsStore.getState().setSoundEnabled(nextSound);
        audioEngine?.setSoundEnabled?.(nextSound);
        controller.setSoundEnabled(nextSound);
        return;
      }

      if (e.key === 'Escape') {
        songStore.getState().setSelectedBarRange(null);
        songStore.getState().setInspectedBar(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [songStore, controller, settingsStore, audioEngine, isLibraryOpen, internalExportDeckOpen]);

  // Pluck manual al pulsar en el mástil o piano
  const handleFretboardClick = (pos: FretPosition) => {
    if (soundEnabled && audioEngine?.playNote) {
      const midi = positionToMidi(tuning, pos);
      audioEngine.playNote(midi);
    }
  };

  const handlePianoClick = (midi: number) => {
    if (soundEnabled && audioEngine?.playNote) {
      audioEngine.playNote(midi);
    }
  };

  return (
    <div
      className={styles.songView}
      data-testid="song-view"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 1. Barra superior */}
      <SongTopBar
        songStore={songStore}
        settingsStore={settingsStore}
        controller={controller}
        onOpenLibrary={handleOpenLibrary}
      />

      {/* 2. Tarjeta de Instrumentos sincronizados (ContextStrip + Fretboard + Piano) */}
      <section className={styles.instrumentsCard} aria-label="Instrumentos sincronizados">
        <SongContextStrip
          songStore={songStore}
          settingsStore={settingsStore}
          sandboxStore={sandboxStore}
          onOpenInSandbox={handleOpenInSandbox}
          onNavigateToSandbox={onNavigateToSandbox}
        />

        {(!visibleInstruments || visibleInstruments.fretboard || visibleInstruments.piano) && (
          <div className={styles.instrumentsRow}>
            {(!visibleInstruments || visibleInstruments.fretboard) && (
              <Fretboard
                tuning={tuning}
                capoFret={capoFret}
                marks={fretboardMarks}
                nameMode={nameMode}
                leftHanded={leftHanded}
                onPositionClick={handleFretboardClick}
              />
            )}
            {(!visibleInstruments || visibleInstruments.piano) && (
              <div className={styles.songPianoWrapper}>
                <Piano
                  compact={true}
                  marks={pianoMarks}
                  nameMode={nameMode}
                  onKeyClick={handlePianoClick}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Área inferior (2 columnas: Partitura/Tablatura + Análisis) */}
      <main className={styles.bottomArea}>
        <div className={styles.leftColumn}>
          {/* Tira horizontal armónica de compases y secciones (Hito C8 Parte 1) */}
          <SongTimelineBar songStore={songStore} controller={controller} />

          {/* Visor interactivo de tablatura y partitura (Hito C5) */}
          <AlphaTabViewport
            songStore={songStore}
            controller={controller}
            createApi={createApi}
          />
        </div>

        <div className={styles.rightColumn}>
          {/* Panel de análisis del fragmento (Hito C8 Parte 2) */}
          <SongAnalysisPanel
            songStore={songStore}
            settingsStore={settingsStore}
            sandboxStore={sandboxStore}
            audioEngine={audioEngine}
            onOpenInSandbox={handleOpenInSandbox}
            onNavigateToSandbox={onNavigateToSandbox}
            onCreateSrsDeck={handleCreateSrsDeck}
            onPracticeInDrills={handlePracticeInDrills}
          />
        </div>
      </main>

      {/* Overlay al arrastrar archivo sobre la vista */}
      {isWindowDragging && (
        <div className={styles.dragOverlay} data-testid="song-view-drag-overlay">
          <div className={styles.dragOverlayCard}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <span className={styles.dragOverlayText}>
              Suelta tu archivo de Guitar Pro aquí para importarlo
            </span>
            <span className={styles.dragOverlaySub}>
              .gp · .gp3–.gp5 · .gpx · .tg · .xml
            </span>
          </div>
        </div>
      )}

      {/* Modal de Exportación a mazo SRS (Hito C9) */}
      <SongExportDeckModal
        isOpen={internalExportDeckOpen}
        onClose={() => setInternalExportDeckOpen(false)}
        fragment={fragmentAnalysis}
        song={activeSong}
        decksStore={decksStore}
      />

      {/* Modal de Biblioteca de Canciones (Hito C7) */}
      <SongLibraryModal
        isOpen={isLibraryOpen}
        onClose={handleCloseLibrary}
        songStore={songStore}
        storage={storage}
      />
    </div>
  );
}
