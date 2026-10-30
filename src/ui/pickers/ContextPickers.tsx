import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  CHORD_QUALITIES,
  SCALE_TYPES,
  pcName,
  type ChordQuality,
  type ChordQualityId,
  type NameMode,
  type PitchClass,
  type ScaleType,
  type ScaleTypeId,
} from '../../theory';
import {
  contextVoicings,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type MenuContext,
  type SandboxStore,
  type SettingsStore,
} from '../../state';
import { VoicingNavigator } from './VoicingNavigator';
import styles from './ContextPickers.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Etiqueta de opción para cada calidad del catálogo de acordes. */
export function formatChordQualityOption(quality: ChordQuality): string {
  if (quality.symbol && quality.symbol !== quality.name) {
    return `${quality.name} (${quality.symbol})`;
  }
  return quality.name;
}

/** Etiqueta concisa de opción para cada escala del catálogo. */
export function formatScaleTypeOption(scale: ScaleType): string {
  if (scale.aliases.length > 0) {
    return [scale.name, ...scale.aliases].join(' / ');
  }
  return scale.name;
}

export interface ContextPickersProps {
  context: MenuContext | null;
  nameMode?: NameMode;
  onSelectContext: (context: MenuContext | null) => void;
}

/**
 * Fila de selectores de acorde y escala de menú (Hito U4).
 * Cambiar cualquiera de los desplegables de un grupo (o pulsar su botón "Aplicar")
 * establece inmediatamente el `context` correspondiente en el store.
 */
export function ContextPickers({
  context,
  nameMode = 'sharps',
  onSelectContext,
}: ContextPickersProps) {
  const displayedChordRoot: PitchClass = context?.kind === 'chord' ? context.root : 0;
  const displayedChordQuality: ChordQualityId = context?.kind === 'chord' ? context.quality : 'maj';
  const displayedScaleRoot: PitchClass = context?.kind === 'scale' ? context.root : 0;
  const displayedScaleType: ScaleTypeId = context?.kind === 'scale' ? context.type : 'major';

  const handleChordRootChange = (root: PitchClass) => {
    onSelectContext({ kind: 'chord', root, quality: displayedChordQuality });
  };

  const handleChordQualityChange = (quality: ChordQualityId) => {
    onSelectContext({ kind: 'chord', root: displayedChordRoot, quality });
  };

  const handleApplyChord = () => {
    onSelectContext({ kind: 'chord', root: displayedChordRoot, quality: displayedChordQuality });
  };

  const handleScaleRootChange = (root: PitchClass) => {
    onSelectContext({ kind: 'scale', root, type: displayedScaleType });
  };

  const handleScaleTypeChange = (type: ScaleTypeId) => {
    onSelectContext({ kind: 'scale', root: displayedScaleRoot, type });
  };

  const handleApplyScale = () => {
    onSelectContext({ kind: 'scale', root: displayedScaleRoot, type: displayedScaleType });
  };

  return (
    <div
      className={styles.pickersRow}
      role="region"
      aria-label="Selectores de acorde y escala"
      data-testid="context-pickers"
    >
      <fieldset
        className={`${styles.group} ${context?.kind === 'scale' ? styles.groupActive : ''}`}
        data-testid="scale-picker-group"
      >
        <legend className={styles.groupLegend}>Escala</legend>

        <label className={styles.controlLabel}>
          Tónica
          <select
            className={styles.select}
            aria-label="Tónica de la escala"
            value={String(displayedScaleRoot)}
            onChange={(e) => handleScaleRootChange(Number(e.target.value) as PitchClass)}
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={String(pc)}>
                {pcName(pc, nameMode)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.controlLabel}>
          Tipo
          <select
            className={styles.select}
            aria-label="Tipo de escala"
            value={displayedScaleType}
            onChange={(e) => handleScaleTypeChange(e.target.value as ScaleTypeId)}
          >
            {SCALE_TYPES.map((s) => (
              <option key={s.id} value={s.id}>
                {formatScaleTypeOption(s)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.applyButton}
          onClick={handleApplyScale}
          data-testid="apply-scale"
        >
          Aplicar
        </button>
      </fieldset>

      <fieldset
        className={`${styles.group} ${context?.kind === 'chord' ? styles.groupActive : ''}`}
        data-testid="chord-picker-group"
      >
        <legend className={styles.groupLegend}>Acorde</legend>

        <label className={styles.controlLabel}>
          Tónica
          <select
            className={styles.select}
            aria-label="Tónica del acorde"
            value={String(displayedChordRoot)}
            onChange={(e) => handleChordRootChange(Number(e.target.value) as PitchClass)}
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={String(pc)}>
                {pcName(pc, nameMode)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.controlLabel}>
          Calidad
          <select
            className={styles.select}
            aria-label="Calidad del acorde"
            value={displayedChordQuality}
            onChange={(e) => handleChordQualityChange(e.target.value as ChordQualityId)}
          >
            {CHORD_QUALITIES.map((q) => (
              <option key={q.id} value={q.id}>
                {formatChordQualityOption(q)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.applyButton}
          onClick={handleApplyChord}
          data-testid="apply-chord"
        >
          Aplicar
        </button>
      </fieldset>

      <button
        type="button"
        className={styles.removeButton}
        onClick={() => onSelectContext(null)}
        disabled={context === null}
        data-testid="clear-context"
      >
        Quitar
      </button>
    </div>
  );
}

export interface SandboxContextPickersProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
}

/**
 * Contenedor que conecta `ContextPickers` y `VoicingNavigator` con `sandboxStore` y `settingsStore`.
 */
export function SandboxContextPickers({
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
}: SandboxContextPickersProps = {}) {
  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const tuning = useStore(sandboxStore, (s) => s.tuning);
  const context = useStore(sandboxStore, (s) => s.context);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const setContext = useStore(sandboxStore, (s) => s.setContext);
  const setVoicingIndex = useStore(sandboxStore, (s) => s.setVoicingIndex);

  const voicings = contextVoicings({ context, tuning });

  return (
    <>
      <ContextPickers context={context} nameMode={nameMode} onSelectContext={setContext} />
      <VoicingNavigator
        context={context}
        voicings={voicings}
        voicingIndex={voicingIndex}
        nameMode={nameMode}
        onVoicingIndexChange={setVoicingIndex}
      />
    </>
  );
}
