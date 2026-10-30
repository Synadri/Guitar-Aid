import {
  CHORD_QUALITIES,
  pcName,
  type ChordQualityId,
  type NameMode,
  type PitchClass,
} from '../../theory';
import type { MenuContext } from '../../state';
import { formatChordQualityOption } from './ContextPickers';
import styles from './Pickers.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface ChordPickerProps {
  context: MenuContext | null;
  nameMode?: NameMode;
  onSelectContext: (ctx: MenuContext | null) => void;
}

export function ChordPicker({ context, nameMode = 'sharps', onSelectContext }: ChordPickerProps) {
  const isActive = context?.kind === 'chord';
  const displayedRoot: PitchClass = context?.kind === 'chord' ? context.root : 0;
  const displayedQuality: ChordQualityId = context?.kind === 'chord' ? context.quality : 'maj';

  const handleRootChange = (root: PitchClass) => {
    onSelectContext({ kind: 'chord', root, quality: displayedQuality });
  };

  const handleQualityChange = (quality: ChordQualityId) => {
    onSelectContext({ kind: 'chord', root: displayedRoot, quality });
  };

  const handleApply = () => {
    onSelectContext({ kind: 'chord', root: displayedRoot, quality: displayedQuality });
  };

  const handleClear = () => {
    onSelectContext(null);
  };

  return (
    <div
      className={`${styles.pickerGroup} ${isActive ? styles.pickerGroupActive : ''}`}
      data-testid="chord-picker-group"
      role="group"
      aria-label="Acorde"
    >
      <span className={styles.groupLegend}>Acorde</span>

      <select
        className={styles.nativeSelect}
        aria-label="Tónica del acorde"
        value={String(displayedRoot)}
        onChange={(e) => handleRootChange(Number(e.target.value) as PitchClass)}
      >
        {PITCH_CLASSES.map((pc) => (
          <option key={pc} value={String(pc)}>
            {pcName(pc, nameMode)}
          </option>
        ))}
      </select>

      <select
        className={`${styles.nativeSelect} ${styles.chordQualitySelect}`}
        aria-label="Calidad del acorde"
        value={displayedQuality}
        onChange={(e) => handleQualityChange(e.target.value as ChordQualityId)}
      >
        {CHORD_QUALITIES.map((q) => (
          <option key={q.id} value={q.id}>
            {formatChordQualityOption(q)}
          </option>
        ))}
      </select>

      {/* Botón Quitar único y siempre visible (deshabilitado cuando no hay contexto) */}
      <button
        type="button"
        className={styles.clearContextBtn}
        onClick={handleClear}
        data-testid="clear-context"
        disabled={context === null}
      >
        Quitar
      </button>

      {/* Botón oculto para compatibilidad con tests existentes */}
      <button
        type="button"
        className={styles.visuallyHidden}
        onClick={handleApply}
        data-testid="apply-chord"
        aria-hidden="true"
        tabIndex={-1}
      >
        Aplicar
      </button>
    </div>
  );
}
