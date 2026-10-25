import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  DEFAULT_FRETS,
  TUNINGS,
  getScaleType,
  positionToMidi,
  type FretPosition,
  type NameMode,
} from '../../theory';
import {
  DEFAULT_PIANO_RANGE,
  bindSettingsToSandbox,
  fretboardMarks,
  pianoMarks,
  resolveFocus,
  sandboxStore as defaultSandboxStore,
  selectedVoicing,
  settingsStore as defaultSettingsStore,
  type LabelMode,
  type SandboxStore,
  type SettingsStore,
} from '../../state';
import {
  arpeggioEvents,
  audioEngine as defaultAudioEngine,
  chordEvents,
  chordFallbackMidis,
  playEvents,
  scaleEvents,
  type AudioEngine,
} from '../../audio';
import { Fretboard, Piano } from '../instruments';
import { SandboxInfoPanel, SandboxSuggestionsPanel } from '../panels';
import { SandboxContextPickers } from '../pickers';
import styles from './SandboxView.module.css';

export interface SandboxViewProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  audioEngine?: AudioEngine;
}

const LABEL_OPTIONS: readonly { value: LabelMode; label: string }[] = [
  { value: 'note', label: 'Nota' },
  { value: 'interval', label: 'Intervalo' },
  { value: 'degree', label: 'Grado' },
  { value: 'none', label: 'Ninguna' },
];

const NAME_MODE_OPTIONS: readonly { value: NameMode; label: string }[] = [
  { value: 'sharps', label: 'Sostenidos' },
  { value: 'flats', label: 'Bemoles' },
];

export function SandboxView({
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  audioEngine = defaultAudioEngine,
}: SandboxViewProps = {}) {
  useEffect(() => {
    return bindSettingsToSandbox(settingsStore, sandboxStore);
  }, [settingsStore, sandboxStore]);

  // Ajustes (fuente de verdad de preferencias)
  const tuning = useStore(settingsStore, (s) => s.tuning);
  const showAllPositions = useStore(settingsStore, (s) => s.showAllPositions);
  const leftHanded = useStore(settingsStore, (s) => s.leftHanded);
  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const labels = useStore(settingsStore, (s) => s.labels);
  const soundEnabled = useStore(settingsStore, (s) => s.soundEnabled);
  const volume = useStore(settingsStore, (s) => s.volume);
  const setTuning = useStore(settingsStore, (s) => s.setTuning);
  const setShowAllPositions = useStore(settingsStore, (s) => s.setShowAllPositions);
  const setLabels = useStore(settingsStore, (s) => s.setLabels);
  const setNameMode = useStore(settingsStore, (s) => s.setNameMode);
  const setSoundEnabled = useStore(settingsStore, (s) => s.setSoundEnabled);
  const setVolume = useStore(settingsStore, (s) => s.setVolume);

  useEffect(() => {
    audioEngine.setSoundEnabled(soundEnabled);
    audioEngine.setVolume(volume);
  }, [audioEngine, soundEnabled, volume]);

  // Estado y acciones de la selección en el Sandbox
  const notes = useStore(sandboxStore, (s) => s.notes);
  const context = useStore(sandboxStore, (s) => s.context);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const preview = useStore(sandboxStore, (s) => s.preview);
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
  const focus = useStore(sandboxStore, (s) => s.focus);
  const toggleFretPosition = useStore(sandboxStore, (s) => s.toggleFretPosition);
  const togglePianoKey = useStore(sandboxStore, (s) => s.togglePianoKey);
  const clear = useStore(sandboxStore, (s) => s.clear);

  const markState = {
    tuning,
    showAllPositions,
    notes,
    context,
    voicingIndex,
    preview,
    rootOverride,
  };

  const fretMarks = fretboardMarks(markState, { nameMode, labels });
  const keyMarks = pianoMarks(markState, { nameMode, labels });

  const activeLayer = resolveFocus({ notes, context, focus });
  const canPlayChordAndArpeggio =
    activeLayer === 'notes' || (activeLayer === 'context' && context?.kind === 'chord');
  const canPlayScale = activeLayer === 'context' && context?.kind === 'scale';

  const resolveActiveChordOrNoteMidis = (): number[] => {
    if (activeLayer === 'notes') {
      return notes.map((n) => n.midi);
    }
    if (activeLayer === 'context' && context?.kind === 'chord') {
      const voicing = selectedVoicing({ context, tuning, voicingIndex });
      return voicing ? [...voicing.midis] : chordFallbackMidis(context.root, context.quality);
    }
    return [];
  };

  const syncEngineSettings = () => {
    const currentSettings = settingsStore.getState();
    audioEngine.setSoundEnabled(currentSettings.soundEnabled);
    audioEngine.setVolume(currentSettings.volume);
    return currentSettings;
  };

  const handlePositionClick = (pos: FretPosition) => {
    const currentState = sandboxStore.getState();
    const midi = positionToMidi(currentState.tuning, pos);
    const existing = currentState.notes.find((n) => n.midi === midi);
    const wasPinned =
      existing?.pinned.some((p) => p.string === pos.string && p.fret === pos.fret) ?? false;

    toggleFretPosition(pos);

    if (!wasPinned) {
      const currentSettings = syncEngineSettings();
      if (currentSettings.soundEnabled) {
        audioEngine.playNote(midi);
      }
    }
  };

  const handleKeyClick = (midi: number) => {
    const currentState = sandboxStore.getState();
    const wasActive = currentState.notes.some((n) => n.midi === midi);

    togglePianoKey(midi);

    if (!wasActive) {
      const currentSettings = syncEngineSettings();
      if (currentSettings.soundEnabled) {
        audioEngine.playNote(midi);
      }
    }
  };

  const handlePlayChord = () => {
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const midis = resolveActiveChordOrNoteMidis();
    playEvents(chordEvents(midis), audioEngine);
  };

  const handlePlayArpeggio = () => {
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const midis = resolveActiveChordOrNoteMidis();
    playEvents(arpeggioEvents(midis), audioEngine);
  };

  const handlePlayScale = () => {
    if (activeLayer !== 'context' || context?.kind !== 'scale') return;
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const scaleType = getScaleType(context.type);
    playEvents(scaleEvents(context.root, scaleType.intervals), audioEngine);
  };

  return (
    <div className={styles.sandbox}>
      <header className={styles.toolbar}>
        <label className={styles.controlLabel}>
          Afinación
          <select
            className={styles.select}
            aria-label="Afinación"
            value={tuning.id}
            onChange={(e) => setTuning(e.target.value)}
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.controlLabel}>
          Etiquetas
          <select
            className={styles.select}
            aria-label="Etiquetas"
            value={labels}
            onChange={(e) => setLabels(e.target.value as LabelMode)}
          >
            {LABEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.controlLabel}>
          Nombres
          <select
            className={styles.select}
            aria-label="Nombres"
            value={nameMode}
            onChange={(e) => setNameMode(e.target.value as NameMode)}
          >
            {NAME_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.controlLabel}>
          <input
            type="checkbox"
            checked={showAllPositions}
            onChange={(e) => setShowAllPositions(e.target.checked)}
          />
          Mostrar todas las posiciones
        </label>

        <label className={styles.controlLabel}>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              setSoundEnabled(enabled);
              audioEngine.setSoundEnabled(enabled);
            }}
          />
          Sonido
        </label>

        <label className={styles.controlLabel}>
          Volumen
          <input
            type="range"
            className={styles.volumeSlider}
            aria-label="Volumen"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const nextVol = Number(e.target.value);
              setVolume(nextVol);
              audioEngine.setVolume(nextVol);
            }}
          />
        </label>

        <div
          className={styles.playbackGroup}
          role="group"
          aria-label="Reproducir"
          data-testid="playback-group"
        >
          <span className={styles.playbackLabel}>Reproducir</span>
          {canPlayChordAndArpeggio && (
            <>
              <button
                type="button"
                className={styles.playbackButton}
                onClick={handlePlayChord}
                data-testid="play-chord"
              >
                Acorde
              </button>
              <button
                type="button"
                className={styles.playbackButton}
                onClick={handlePlayArpeggio}
                data-testid="play-arpeggio"
              >
                Arpegio
              </button>
            </>
          )}
          {canPlayScale && (
            <button
              type="button"
              className={styles.playbackButton}
              onClick={handlePlayScale}
              data-testid="play-scale"
            >
              Escala
            </button>
          )}
        </div>

        <button type="button" className={styles.clearButton} onClick={clear}>
          Limpiar
        </button>
      </header>

      <SandboxContextPickers sandboxStore={sandboxStore} settingsStore={settingsStore} />

      <div className={styles.workspace}>
        <div className={styles.instruments}>
          <Fretboard
            tuning={tuning}
            frets={DEFAULT_FRETS}
            leftHanded={leftHanded}
            marks={fretMarks}
            nameMode={nameMode}
            onPositionClick={handlePositionClick}
          />

          <Piano
            range={DEFAULT_PIANO_RANGE}
            marks={keyMarks}
            nameMode={nameMode}
            onKeyClick={handleKeyClick}
          />
        </div>

        <aside className={styles.sidePanel}>
          <SandboxInfoPanel sandboxStore={sandboxStore} settingsStore={settingsStore} />
          <SandboxSuggestionsPanel sandboxStore={sandboxStore} settingsStore={settingsStore} />
        </aside>
      </div>
    </div>
  );
}
