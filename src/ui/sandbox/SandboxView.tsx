import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { DEFAULT_FRETS, TUNINGS, type NameMode } from '../../theory';
import {
  DEFAULT_PIANO_RANGE,
  bindSettingsToSandbox,
  fretboardMarks,
  pianoMarks,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type LabelMode,
  type SandboxStore,
  type SettingsStore,
} from '../../state';
import { Fretboard, Piano } from '../instruments';
import { SandboxInfoPanel } from '../panels';
import styles from './SandboxView.module.css';

export interface SandboxViewProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
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
  const setTuning = useStore(settingsStore, (s) => s.setTuning);
  const setShowAllPositions = useStore(settingsStore, (s) => s.setShowAllPositions);
  const setLabels = useStore(settingsStore, (s) => s.setLabels);
  const setNameMode = useStore(settingsStore, (s) => s.setNameMode);

  // Estado y acciones de la selección en el Sandbox
  const notes = useStore(sandboxStore, (s) => s.notes);
  const context = useStore(sandboxStore, (s) => s.context);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const preview = useStore(sandboxStore, (s) => s.preview);
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
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

        <button type="button" className={styles.clearButton} onClick={clear}>
          Limpiar
        </button>
      </header>

      <div className={styles.workspace}>
        <div className={styles.instruments}>
          <Fretboard
            tuning={tuning}
            frets={DEFAULT_FRETS}
            leftHanded={leftHanded}
            marks={fretMarks}
            nameMode={nameMode}
            onPositionClick={toggleFretPosition}
          />

          <Piano
            range={DEFAULT_PIANO_RANGE}
            marks={keyMarks}
            nameMode={nameMode}
            onKeyClick={togglePianoKey}
          />
        </div>

        <aside className={styles.sidePanel}>
          <SandboxInfoPanel sandboxStore={sandboxStore} settingsStore={settingsStore} />
        </aside>
      </div>
    </div>
  );
}
