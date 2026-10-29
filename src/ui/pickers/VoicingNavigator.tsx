import type { KeyboardEvent } from 'react';
import {
  chordName,
  formatCompactFrets,
  type NameMode,
  type Voicing,
  type VoicingFamily,
  type VoicingInversion,
} from '../../theory';
import type { MenuContext } from '../../state';
import styles from './ContextPickers.module.css';

export const VOICING_FAMILY_LABELS: Readonly<Record<VoicingFamily, string>> = {
  open: 'abierta',
  'barre-E': 'cejilla en 6ª',
  'barre-A': 'cejilla en 5ª',
  'strings-1-4': '4 cuerdas (1–4)',
  'strings-1-3': '3 cuerdas (1–3)',
};

export const VOICING_INVERSION_LABELS: Readonly<Record<VoicingInversion, string>> = {
  root: 'fundamental',
  '1st': '1ª inversión',
  '2nd': '2ª inversión',
  '3rd': '3ª inversión',
};

export const EMPTY_VOICINGS_MESSAGE =
  'No hay digitaciones para esta afinación: se muestran las notas del acorde en todo el mástil';

export function formatVoicingFamily(family: VoicingFamily): string {
  return VOICING_FAMILY_LABELS[family];
}

export function formatVoicingInversion(inversion: VoicingInversion): string {
  return VOICING_INVERSION_LABELS[inversion];
}

export interface VoicingNavigatorProps {
  context: MenuContext | null;
  voicings: readonly Voicing[];
  voicingIndex: number;
  nameMode?: NameMode;
  onVoicingIndexChange: (index: number) => void;
}

/**
 * Navegador de voicings para acordes seleccionados en el menú (Hito U4).
 * Permite recorrer las digitaciones en bucle con botones o con las flechas del teclado.
 */
export function VoicingNavigator({
  context,
  voicings,
  voicingIndex,
  nameMode = 'sharps',
  onVoicingIndexChange,
}: VoicingNavigatorProps) {
  if (!context || context.kind !== 'chord') {
    return null;
  }

  const chordLabel = chordName(context, nameMode);
  const count = voicings.length;

  if (count === 0) {
    return (
      <div
        className={styles.voicingBar}
        role="region"
        aria-label="Navegador de digitaciones"
        data-testid="voicing-navigator"
      >
        <strong className={styles.chordBadge} data-testid="voicing-chord-name">
          {chordLabel}
        </strong>
        <p className={styles.voicingEmpty} data-testid="voicing-empty">
          {EMPTY_VOICINGS_MESSAGE}
        </p>
      </div>
    );
  }

  const currentIndex = Math.min(Math.max(0, voicingIndex), count - 1);
  const current = voicings[currentIndex]!;
  const shapeText = formatCompactFrets(current.frets);
  const familyText = formatVoicingFamily(current.family);

  const handlePrev = () => {
    const prevIndex = (currentIndex - 1 + count) % count;
    onVoicingIndexChange(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % count;
    onVoicingIndexChange(nextIndex);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div
      className={styles.voicingBar}
      role="region"
      aria-label="Navegador de digitaciones"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="voicing-navigator"
    >
      <strong className={styles.chordBadge} data-testid="voicing-chord-name">
        {chordLabel}
      </strong>

      <button
        type="button"
        className={styles.navButton}
        onClick={handlePrev}
        data-testid="voicing-prev"
      >
        Anterior
      </button>

      <span className={styles.voicingIndicator} data-testid="voicing-indicator">
        Digitación {currentIndex + 1} de {count}
      </span>

      <code className={styles.voicingShape} data-testid="voicing-shape">
        {shapeText}
      </code>

      <span className={styles.voicingFamily} data-testid="voicing-family">
        {familyText}
      </span>

      <button
        type="button"
        className={styles.navButton}
        onClick={handleNext}
        data-testid="voicing-next"
      >
        Siguiente
      </button>
    </div>
  );
}
