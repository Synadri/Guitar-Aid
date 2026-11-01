import { useState, useRef } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  alphaSynthController as defaultController,
  type AlphaSynthController,
} from '../../audio';
import {
  settingsStore as defaultSettingsStore,
  songStore as defaultSongStore,
  type SettingsStore,
  type SongStore,
} from '../../state';
import { SettingsPopover } from '../toolbar/SettingsPopover';
import { TrackMixerPopover } from './TrackMixerPopover';
import { calculateTickForBarBeat, calculatePlaybackRangeForBars } from '../../song';
import styles from './SongTopBar.module.css';

export interface SongTopBarProps {
  songStore?: StoreApi<SongStore>;
  settingsStore?: StoreApi<SettingsStore>;
  controller?: AlphaSynthController;
  onOpenLibrary?: () => void;
}

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function SongTopBar({
  songStore = defaultSongStore,
  settingsStore = defaultSettingsStore,
  controller = defaultController,
  onOpenLibrary,
}: SongTopBarProps) {
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const mixerBtnRef = useRef<HTMLButtonElement>(null);

  // Estado del store de canción
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const activeTrackIndex = useStore(songStore, (s) => s.activeTrackIndex);
  const isPlaying = useStore(songStore, (s) => s.isPlaying);
  const playbackSpeed = useStore(songStore, (s) => s.playbackSpeed);
  const metronomeEnabled = useStore(songStore, (s) => s.metronomeEnabled);
  const metronomeSubdivision = useStore(songStore, (s) => s.metronomeSubdivision ?? '1/4');
  const metronomeVolume = useStore(songStore, (s) => s.metronomeVolume ?? 0.8);
  const countInEnabled = useStore(songStore, (s) => s.countInEnabled);
  const loopRange = useStore(songStore, (s) => s.loopRange);
  const loopEnabled = useStore(songStore, (s) => s.loopEnabled);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);
  const scoreViewMode = useStore(songStore, (s) => s.scoreViewMode);
  const showLyrics = useStore(songStore, (s) => s.showLyrics);
  const trackMixer = useStore(songStore, (s) => s.trackMixer);

  // Estado de ajustes
  const soundEnabled = useStore(settingsStore, (s) => s.soundEnabled);
  const volume = useStore(settingsStore, (s) => s.volume);
  const tuning = useStore(settingsStore, (s) => s.tuning);
  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const labels = useStore(settingsStore, (s) => s.labels);
  const showAllPositions = useStore(settingsStore, (s) => s.showAllPositions);
  const leftHanded = useStore(settingsStore, (s) => s.leftHanded);
  const visibleInstruments = useStore(settingsStore, (s) => s.visibleInstruments);

  const tracks = activeSong?.tracks ?? [];
  const currentTrack = tracks[activeTrackIndex] ?? tracks[0];

  // Metadatos
  const title = activeSong?.title ?? 'Sin canción activa';
  const artist = activeSong?.artist ?? 'Guitar Aid';
  const initialTempo = activeSong?.initialTempoBpm ?? 120;
  const activeBar = currentTrack?.bars[0];
  const timeSig = activeBar?.timeSignature
    ? `${activeBar.timeSignature.numerator}/${activeBar.timeSignature.denominator}`
    : '4/4';
  const subtitle = `${artist} · ${timeSig} · ${initialTempo} BPM`;

  // Handlers de velocidad
  const handleSpeedDown = () => {
    const curIdx = SPEED_STEPS.findIndex((s) => s >= playbackSpeed);
    const prevIdx = Math.max(0, (curIdx === -1 ? SPEED_STEPS.length - 1 : curIdx) - 1);
    const nextSpeed = SPEED_STEPS[prevIdx]!;
    songStore.getState().setPlaybackSpeed(nextSpeed);
    controller.setPlaybackSpeed(nextSpeed);
  };

  const handleSpeedUp = () => {
    const curIdx = SPEED_STEPS.findIndex((s) => s > playbackSpeed);
    const nextIdx = curIdx === -1 ? SPEED_STEPS.length - 1 : curIdx;
    const nextSpeed = SPEED_STEPS[nextIdx]!;
    songStore.getState().setPlaybackSpeed(nextSpeed);
    controller.setPlaybackSpeed(nextSpeed);
  };

  // Reproducir / Pausa
  const handlePlayPause = async () => {
    if (!controller.isPlaying()) {
      const state = songStore.getState();
      let startBar = state.currentBar;
      let startBeat = state.currentBeat;
      if (state.loopEnabled && state.loopRange) {
        if (startBar < state.loopRange[0] || startBar > state.loopRange[1]) {
          startBar = state.loopRange[0];
          startBeat = 0;
          songStore.getState().setCurrentPosition(startBar, 0);
        }
      }
      const tick = calculateTickForBarBeat(currentTrack?.bars, startBar, startBeat);
      controller.seekToTick(tick);
    }
    await controller.playPause();
    songStore.getState().setIsPlaying(controller.isPlaying());
  };

  // Ir al inicio (compás 1 o inicio de bucle)
  const handleGoToStart = () => {
    const startBar = loopEnabled && loopRange ? loopRange[0] : 1;
    songStore.getState().setCurrentPosition(startBar, 0);
    controller.seekToTick(calculateTickForBarBeat(currentTrack?.bars, startBar, 0));
  };

  // Conmutar bucle
  const handleToggleLoop = () => {
    songStore.getState().toggleLoop();
    const updated = songStore.getState();
    const bars = currentTrack?.bars;
    if (updated.loopEnabled && updated.loopRange && bars) {
      const bounds = calculatePlaybackRangeForBars(bars, updated.loopRange);
      controller.setPlaybackRange(bounds);
      controller.setLoopEnabled(Boolean(bounds));
    } else {
      controller.setPlaybackRange(null);
      controller.setLoopEnabled(false);
    }
  };

  // Conmutar metrónomo
  const handleToggleMetronome = () => {
    songStore.getState().toggleMetronome();
    controller.setMetronomeEnabled(songStore.getState().metronomeEnabled);
  };

  // Conmutar sonido global
  const handleToggleSound = () => {
    const next = !soundEnabled;
    settingsStore.getState().setSoundEnabled(next);
    controller.setSoundEnabled(next);
  };

  // Mezclador
  const handleSetMute = (trackIdx: number, muted: boolean) => {
    songStore.getState().setTrackMute(trackIdx, muted);
    controller.setTrackMute(trackIdx, muted);
  };

  const handleSetSolo = (trackIdx: number, solo: boolean) => {
    songStore.getState().setTrackSolo(trackIdx, solo);
    controller.setTrackSolo(trackIdx, solo);
  };

  const handleSetVolume = (trackIdx: number, vol: number) => {
    songStore.getState().setTrackVolume(trackIdx, vol);
    controller.setTrackVolume(trackIdx, vol);
  };

  const handleToggleCountIn = () => {
    songStore.getState().toggleCountIn();
    controller.setCountInEnabled(songStore.getState().countInEnabled);
  };

  const handleResetMixer = () => {
    songStore.getState().resetTrackMixer();
    controller.resetTrackMixer();
    songStore.getState().setMetronomeSubdivision('1/4');
    controller.setMetronomeSubdivision('1/4');
    songStore.getState().setMetronomeVolume(0.8);
    controller.setMetronomeVolume(0.8);
  };

  const handleSetMasterVolume = (vol: number) => {
    settingsStore.getState().setVolume(vol);
    controller.setVolume(vol);
  };

  const handleSetMetronomeVolume = (vol: number) => {
    songStore.getState().setMetronomeVolume(vol);
    controller.setMetronomeVolume(vol);
  };

  const handleSelectTrack = (trackIdx: number) => {
    songStore.getState().setActiveTrackIndex(trackIdx);
  };

  return (
    <header className={styles.topBar} data-testid="song-top-bar">
      {/* 1. Canción y Biblioteca */}
      <button
        type="button"
        className={styles.libraryBtn}
        onClick={onOpenLibrary}
        aria-label="Biblioteca de canciones"
        title="Biblioteca de canciones"
      >
        <svg
          width="16"
          height="16"
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
        <span>Canciones</span>
      </button>

      <div className={styles.songMeta}>
        <span className={styles.songTitle} title={title}>
          {title}
        </span>
        <span className={styles.songSub} title={subtitle}>
          {subtitle}
        </span>
      </div>

      {/* 2. Grupo PISTA y Mezclador */}
      <div className={styles.group} role="group" aria-label="Pista activa y mezclador">
        <span className={styles.groupLabel}>PISTA</span>
        <select
          className={styles.trackSelect}
          value={activeTrackIndex}
          onChange={(e) => songStore.getState().setActiveTrackIndex(Number(e.target.value))}
          aria-label="Seleccionar pista activa"
        >
          {tracks.map((t) => (
            <option key={`opt-track-${t.index}`} value={t.index}>
              {t.name} {t.isPercussion ? '· Batería' : `· ${t.tuning.name}`}
            </option>
          ))}
        </select>

        <div className={styles.mixerWrapper}>
          <button
            ref={mixerBtnRef}
            type="button"
            className={styles.btn}
            data-active={isMixerOpen ? 'true' : 'false'}
            aria-haspopup="dialog"
            aria-expanded={isMixerOpen}
            aria-label="Mezclador multipista"
            onClick={() => setIsMixerOpen((prev) => !prev)}
          >
            <span>Mezclador</span>
          </button>

          <TrackMixerPopover
            open={isMixerOpen}
            onClose={() => setIsMixerOpen(false)}
            triggerRef={mixerBtnRef}
            tracks={tracks}
            activeTrackIndex={activeTrackIndex}
            onSelectTrack={handleSelectTrack}
            trackMixer={trackMixer}
            onSetMute={handleSetMute}
            onSetSolo={handleSetSolo}
            onSetVolume={handleSetVolume}
            masterVolume={volume}
            onSetMasterVolume={handleSetMasterVolume}
            countInEnabled={countInEnabled}
            onToggleCountIn={handleToggleCountIn}
            metronomeSubdivision={metronomeSubdivision}
            onSetMetronomeSubdivision={(sub) => {
              songStore.getState().setMetronomeSubdivision(sub);
              controller.setMetronomeSubdivision(sub);
            }}
            metronomeVolume={metronomeVolume}
            onSetMetronomeVolume={handleSetMetronomeVolume}
            onResetMixer={handleResetMixer}
          />
        </div>
      </div>

      {/* 3. Grupo de Transporte */}
      <div className={styles.group} role="group" aria-label="Transporte y reproducción">
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleGoToStart}
          aria-label="Ir al inicio"
        >
          ⏮
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimaryPlay}`}
          data-playing={isPlaying ? 'true' : 'false'}
          onClick={handlePlayPause}
          aria-label={isPlaying ? 'Pausa' : 'Reproducir'}
          title={isPlaying ? 'Pausa' : 'Reproducir'}
        >
          <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
        </button>

        <button
          type="button"
          className={styles.btn}
          aria-pressed={loopEnabled}
          onClick={handleToggleLoop}
          aria-label={loopEnabled && loopRange ? `Bucle ${loopRange[0]}–${loopRange[1]}` : 'Alternar bucle'}
          title={
            loopEnabled && loopRange
              ? `Bucle activo: compases ${loopRange[0]}–${loopRange[1]}`
              : selectedBarRange
                ? `Activar bucle en compases seleccionados (${selectedBarRange[0]}–${selectedBarRange[1]})`
                : 'Alternar bucle'
          }
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </button>

        <div className={styles.speedControls} aria-label="Control de velocidad">
          <span className={styles.groupLabel}>VEL.</span>
          <button
            type="button"
            className={styles.speedStepBtn}
            onClick={handleSpeedDown}
            aria-label="Reducir velocidad"
          >
            −
          </button>
          <span className={styles.speedText}>
            {playbackSpeed.toFixed(playbackSpeed % 1 === 0 ? 1 : 2)}×
          </span>
          <button
            type="button"
            className={styles.speedStepBtn}
            onClick={handleSpeedUp}
            aria-label="Aumentar velocidad"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={styles.btn}
          aria-pressed={metronomeEnabled}
          onClick={handleToggleMetronome}
          aria-label="Metrónomo"
          title="Metrónomo"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2v20" />
            <path d="m17 7-5 5" />
            <path d="m4.5 22 5.5-18h4l5.5 18H4.5Z" />
          </svg>
        </button>
      </div>

      {/* 4. Grupo VISTA */}
      <div className={styles.group} role="group" aria-label="Vistas de partitura">
        <span className={styles.groupLabel}>VISTA</span>
        <div className={styles.segmented} role="radiogroup" aria-label="Tipo de vista">
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={scoreViewMode === 'tab'}
            onClick={() => songStore.getState().setScoreViewMode('tab')}
            aria-label="Vista Tablatura"
          >
            Tab
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={scoreViewMode === 'score-tab'}
            onClick={() => songStore.getState().setScoreViewMode('score-tab')}
            aria-label="Vista Partitura y Tablatura"
          >
            Partitura + Tab
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={scoreViewMode === 'score'}
            onClick={() => songStore.getState().setScoreViewMode('score')}
            aria-label="Vista Partitura"
          >
            Partitura
          </button>
        </div>

        <button
          type="button"
          className={styles.btn}
          aria-pressed={showLyrics}
          onClick={() => songStore.getState().toggleLyrics()}
          aria-label="Mostrar u ocultar letra"
        >
          <span>Letra</span>
        </button>
      </div>

      {/* 5. Acciones globales */}
      <div className={styles.globalActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.iconBtn}`}
          aria-pressed={soundEnabled}
          onClick={handleToggleSound}
          aria-label="Alternar sonido"
          title="Alternar sonido"
        >
          {soundEnabled ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="22" x2="16" y1="9" y2="15" />
              <line x1="16" x2="22" y1="9" y2="15" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.iconBtn}`}
          aria-haspopup="dialog"
          aria-expanded={isSettingsOpen}
          aria-label="Ajustes"
          title="Ajustes"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        >
          <span aria-hidden="true">⚙</span>
        </button>

        <SettingsPopover
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          tuning={tuning}
          onTuningChange={(tid) => settingsStore.getState().setTuning(tid)}
          nameMode={nameMode}
          onNameModeChange={(m) => settingsStore.getState().setNameMode(m)}
          labels={labels}
          onLabelsChange={(l) => settingsStore.getState().setLabels(l)}
          showAllPositions={showAllPositions}
          onShowAllPositionsChange={(s) => settingsStore.getState().setShowAllPositions(s)}
          leftHanded={leftHanded}
          onLeftHandedChange={(lh) => settingsStore.getState().setLeftHanded(lh)}
          visibleInstruments={visibleInstruments}
          onToggleInstrument={(inst) => settingsStore.getState().toggleInstrument(inst)}
          volume={volume}
          onVolumeChange={(v) => {
            settingsStore.getState().setVolume(v);
            controller.setVolume(v);
          }}
        />
      </div>
    </header>
  );
}
