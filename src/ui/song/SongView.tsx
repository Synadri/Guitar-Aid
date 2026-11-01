import { useEffect } from 'react';
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
  selectSongFretboardMarks,
  selectSongPianoMarks,
  type SandboxStore,
  type SettingsStore,
  type SongStore,
} from '../../state';
import {
  STANDARD_TUNING,
  positionToMidi,
  type FretPosition,
} from '../../theory';
import { calculateTickForBarBeat, calculatePlaybackRangeForBars } from '../../song';
import { Fretboard, Piano } from '../instruments';
import { AlphaTabViewport } from './AlphaTabViewport';
import { SongContextStrip } from './SongContextStrip';
import { SongTopBar } from './SongTopBar';
import styles from './SongView.module.css';

export interface SongViewProps {
  songStore?: StoreApi<SongStore>;
  settingsStore?: StoreApi<SettingsStore>;
  sandboxStore?: StoreApi<SandboxStore>;
  audioEngine?: AudioEngine;
  controller?: AlphaSynthController;
  createApi?: (container: HTMLElement, settings?: unknown) => AlphaSynthLike;
  onOpenLibrary?: () => void;
}

export function SongView({
  songStore = defaultSongStore,
  settingsStore = defaultSettingsStore,
  sandboxStore,
  audioEngine = defaultAudioEngine,
  controller = defaultController,
  createApi,
  onOpenLibrary,
}: SongViewProps) {
  void sandboxStore;
  // Estado reactivo del store de canción
  const songState = useStore(songStore, (s) => s);
  const activeSong = songState.activeSong;
  const activeTrackIndex = songState.activeTrackIndex;

  // Estado de ajustes
  const settings = useStore(settingsStore, (s) => s);
  const { nameMode, labels, leftHanded, soundEnabled } = settings;

  // Pista activa
  const track = activeSong?.tracks[activeTrackIndex] ?? activeSong?.tracks[0];
  const tuning = track?.tuning ?? STANDARD_TUNING;
  const capoFret = track?.capoFret ?? 0;

  // Marcas reactivas en vivo para Fretboard y Piano (pulso + scale-bg + etiquetas)
  const fretboardMarks = selectSongFretboardMarks(songState, { nameMode, labels });
  const pianoMarks = selectSongPianoMarks(songState, { nameMode, labels });

  // Manejo de atajos de teclado específicos del Modo Canción
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          const tick = calculateTickForBarBeat(curTrack?.bars, startBar, startBeat);
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
          const bounds = calculatePlaybackRangeForBars(bars, updated.loopRange);
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
          calculateTickForBarBeat(curTrack?.bars, songStore.getState().currentBar, 0),
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
          calculateTickForBarBeat(curTrack?.bars, songStore.getState().currentBar, 0),
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
        controller.seekToTick(calculateTickForBarBeat(curTrack?.bars, startBar, 0));
        return;
      }

      if (e.key === 'Escape') {
        songStore.getState().setSelectedBarRange(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [songStore, controller]);

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
    <div className={styles.songView} data-testid="song-view">
      {/* 1. Barra superior */}
      <SongTopBar
        songStore={songStore}
        settingsStore={settingsStore}
        controller={controller}
        onOpenLibrary={onOpenLibrary}
      />

      {/* 2. Tarjeta de Instrumentos sincronizados (ContextStrip + Fretboard + Piano) */}
      <section className={styles.instrumentsCard} aria-label="Instrumentos sincronizados">
        <SongContextStrip songStore={songStore} settingsStore={settingsStore} />

        <div className={styles.instrumentsRow}>
          <Fretboard
            tuning={tuning}
            capoFret={capoFret}
            marks={fretboardMarks}
            nameMode={nameMode}
            leftHanded={leftHanded}
            onPositionClick={handleFretboardClick}
          />
          <Piano
            marks={pianoMarks}
            nameMode={nameMode}
            onKeyClick={handlePianoClick}
          />
        </div>
      </section>

      {/* 3. Área inferior (2 columnas: Partitura/Tablatura + Análisis) */}
      <main className={styles.bottomArea}>
        <div className={styles.leftColumn}>
          {/* Tira horizontal de compases / secciones (Hito C8) */}
          <div
            className={styles.timelinePlaceholder}
            data-testid="song-timeline-bar"
            aria-label="Cinta de compases"
          >
            <span>
              Compás {songState.currentBar} · {track?.bars[songState.currentBar - 1]?.sectionMarker ?? 'Sección'}
            </span>
            <small>Cinta armónica (Hito C8)</small>
          </div>

          {/* Visor interactivo de tablatura y partitura (Hito C5) */}
          <AlphaTabViewport
            songStore={songStore}
            controller={controller}
            createApi={createApi}
          />
        </div>

        <div className={styles.rightColumn}>
          {/* Panel de análisis del fragmento (Hito C8 / C9) */}
          <aside
            className={styles.analysisPlaceholder}
            data-testid="song-analysis-panel"
            aria-label="Panel de análisis armónico"
          >
            <div className={styles.analysisHeader}>
              <span className={styles.analysisTitle}>Análisis del fragmento</span>
              <span className={styles.analysisSub}>
                Compás {songState.currentBar}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              El panel de análisis detallado, ranking de escalas y progresiones se completa en el Hito C8.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
