import {
  SCALE_TYPES,
  pcName,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
} from '../../theory';
import type { MenuContext } from '../../state';
import { formatScaleTypeOption } from './ContextPickers';
import styles from './Pickers.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface ScalePickerProps {
  context: MenuContext | null;
  nameMode?: NameMode;
  onSelectContext: (ctx: MenuContext | null) => void;
}

export function ScalePicker({ context, nameMode = 'sharps', onSelectContext }: ScalePickerProps) {
  const isActive = context?.kind === 'scale';
  const displayedRoot: PitchClass = context?.kind === 'scale' ? context.root : 0;
  const displayedType: ScaleTypeId = context?.kind === 'scale' ? context.type : 'major';

  const handleRootChange = (root: PitchClass) => {
    onSelectContext({ kind: 'scale', root, type: displayedType });
  };

  const handleTypeChange = (type: ScaleTypeId) => {
    onSelectContext({ kind: 'scale', root: displayedRoot, type });
  };

  const handleApply = () => {
    onSelectContext({ kind: 'scale', root: displayedRoot, type: displayedType });
  };

  return (
    <div
      className={`${styles.pickerGroup} ${isActive ? styles.pickerGroupActive : ''}`}
      data-testid="scale-picker-group"
      role="group"
      aria-label="Escala"
    >
      <span className={styles.groupLegend}>Escala</span>

      <select
        className={styles.nativeSelect}
        aria-label="Tónica de la escala"
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
        className={`${styles.nativeSelect} ${styles.scaleTypeSelect}`}
        aria-label="Tipo de escala"
        value={displayedType}
        onChange={(e) => handleTypeChange(e.target.value as ScaleTypeId)}
      >
        {SCALE_TYPES.map((s) => (
          <option key={s.id} value={s.id}>
            {formatScaleTypeOption(s)}
          </option>
        ))}
      </select>

      {/* Botón oculto para compatibilidad con tests existentes */}
      <button
        type="button"
        className={styles.visuallyHidden}
        onClick={handleApply}
        data-testid="apply-scale"
        aria-hidden="true"
        tabIndex={-1}
      >
        Aplicar
      </button>
    </div>
  );
}
