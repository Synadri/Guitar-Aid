import { useMemo, useState } from 'react';
import {
  chordDisplayName,
  chordName,
  formatCompactFrets,
  getScaleType,
  midiToName,
  pcName,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
  type Tuning,
  type Voicing,
  type VoicingFamily,
} from '../../theory';
import type { ChordFocus, LabelMode, SelectedNote, MenuContext, SandboxLayer } from '../../state';
import {
  EMPTY_VOICINGS_MESSAGE,
  VOICING_FAMILY_LABELS,
  VOICING_INVERSION_LABELS,
} from '../pickers/VoicingNavigator';
import styles from './ContextStrip.module.css';

function formatScale(tonic: PitchClass, type: ScaleTypeId, mode: NameMode): string {
  return `${pcName(tonic, mode)} ${getScaleType(type).name}`;
}

function matchesFamilyFilter(v: Voicing, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'barre') return v.family === 'barre-E' || v.family === 'barre-A';
  return v.family === (filter as VoicingFamily);
}

export interface ContextStripProps {
  context: MenuContext | null;
  chordFocus: ChordFocus | null;
  notes: readonly SelectedNote[];
  activeLayer: SandboxLayer | null;
  onSelectLayer: (layer: SandboxLayer) => void;
  tuning: Tuning;
  activeVoicings: readonly Voicing[];
  voicingIndex: number;
  onVoicingIndexChange: (index: number) => void;
  onClearChordFocus: () => void;
  onPromoteChordFocus?: () => void;
  onSetChordFocusMode: (mode: 'voicing' | 'tones') => void;
  nameMode: NameMode;
  labels: LabelMode;
  onLabelsChange: (labels: LabelMode) => void;
}

export function ContextStrip(props: ContextStripProps) {
  const {
    context,
    chordFocus,
    notes,
    activeLayer,
    onSelectLayer,
    activeVoicings,
    voicingIndex,
    onVoicingIndexChange,
    onClearChordFocus,
    onPromoteChordFocus,
    onSetChordFocusMode,
    nameMode,
    labels,
    onLabelsChange,
  } = props;
  const [familyFilter, setFamilyFilter] = useState<string>('all');

  const hasNotes = notes.length > 0;
  const hasContext = context !== null;
  const hasBoth = hasNotes && hasContext;

  const familyCounts = useMemo(
    () => ({
      open: activeVoicings.filter((v) => matchesFamilyFilter(v, 'open')).length,
      barre: activeVoicings.filter((v) => matchesFamilyFilter(v, 'barre')).length,
      'strings-1-4': activeVoicings.filter((v) => matchesFamilyFilter(v, 'strings-1-4')).length,
      'strings-1-3': activeVoicings.filter((v) => matchesFamilyFilter(v, 'strings-1-3')).length,
    }),
    [activeVoicings],
  );

  // Filtrado de voicings según familia seleccionada
  const filteredVoicings = useMemo(
    () => activeVoicings.filter((v) => matchesFamilyFilter(v, familyFilter)),
    [activeVoicings, familyFilter],
  );

  const effectiveFamilyFilter =
    familyFilter !== 'all' && filteredVoicings.length === 0 ? 'all' : familyFilter;
  const voicingsToUse = filteredVoicings.length > 0 ? filteredVoicings : activeVoicings;
  const totalCount = voicingsToUse.length;

  const clampedGlobalIndex = Math.min(
    Math.max(0, voicingIndex),
    Math.max(0, activeVoicings.length - 1),
  );
  const activeVoicingFromStore = activeVoicings[clampedGlobalIndex];
  const indexInFiltered = activeVoicingFromStore
    ? voicingsToUse.indexOf(activeVoicingFromStore)
    : -1;
  const currentIndex = indexInFiltered >= 0 ? indexInFiltered : 0;
  const currentVoicing = voicingsToUse[currentIndex];

  const handleFamilyChange = (nextFamily: string) => {
    setFamilyFilter(nextFamily);
    if (nextFamily === 'all') return;
    const firstMatchIdx = activeVoicings.findIndex((v) => matchesFamilyFilter(v, nextFamily));
    if (firstMatchIdx >= 0) {
      onVoicingIndexChange(firstMatchIdx);
    }
  };

  const handlePrevVoicing = () => {
    if (totalCount === 0) return;
    const nextIdx = (currentIndex - 1 + totalCount) % totalCount;
    const targetVoicing = voicingsToUse[nextIdx];
    const originalIndex = targetVoicing ? activeVoicings.indexOf(targetVoicing) : -1;
    onVoicingIndexChange(originalIndex >= 0 ? originalIndex : nextIdx);
  };

  const handleNextVoicing = () => {
    if (totalCount === 0) return;
    const nextIdx = (currentIndex + 1) % totalCount;
    const targetVoicing = voicingsToUse[nextIdx];
    const originalIndex = targetVoicing ? activeVoicings.indexOf(targetVoicing) : -1;
    onVoicingIndexChange(originalIndex >= 0 ? originalIndex : nextIdx);
  };

  const handleNavigatorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevVoicing();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNextVoicing();
    }
  };

  // Texto del sujeto analizado
  const analyzedText = useMemo(() => {
    const formatPressedNotes = () => {
      const sortedMidis = [...notes].map((n) => n.midi).sort((a, b) => a - b);
      const noteNames = sortedMidis.map((m) => midiToName(m, nameMode)).join(' ');
      return `notas pulsadas ${noteNames}`;
    };

    if (activeLayer === 'notes' && hasNotes) {
      return {
        name: formatPressedNotes(),
        origin: 'guitarra/piano',
      };
    }
    if (context?.kind === 'scale') {
      return {
        name: formatScale(context.root, context.type, nameMode),
        origin: 'menú',
      };
    }
    if (context?.kind === 'chord') {
      return {
        name: chordDisplayName(context, nameMode),
        origin: `menú · raíz ${chordName({ root: context.root, quality: 'maj' }, nameMode)}`,
      };
    }
    if (hasNotes) {
      return {
        name: formatPressedNotes(),
        origin: 'guitarra/piano',
      };
    }
    return {
      name: 'Sin selección',
      origin: 'pulsa notas o elige un contexto',
    };
  }, [activeLayer, hasNotes, context, notes, nameMode]);

  // Si hay acorde activo (contexto acorde o chordFocus)
  const isChordActive = context?.kind === 'chord' || chordFocus !== null;
  const activeChordName = chordFocus
    ? chordDisplayName(chordFocus.chord, nameMode)
    : context?.kind === 'chord'
      ? chordDisplayName(context, nameMode)
      : '';

  return (
    <div
      className={styles.strip}
      role="region"
      aria-label="Franja de contexto"
      data-testid="context-strip"
    >
      {/* 1. Izquierda: Analizando */}
      <div className={styles.leftSection}>
        <span className={styles.analyzingLabel}>Analizando</span>
        <span className={styles.subjectName}>{analyzedText.name}</span>
        <span className={styles.originBadge}>{analyzedText.origin}</span>

        {chordFocus && (
          <div className={styles.focusBadge} data-testid="chord-focus-badge">
            <span>
              Foco: {chordFocus.degree ? `${chordFocus.degree} · ` : ''}
              {chordDisplayName(chordFocus.chord, nameMode)}
            </span>
          </div>
        )}

        {/* Pestañas Notas / Contexto cuando conviven ambas capas */}
        {hasBoth && (
          <div className={styles.tabsGroup} role="tablist" aria-label="Capa activa">
            <button
              type="button"
              role="tab"
              aria-selected={activeLayer === 'notes'}
              className={`${styles.tabBtn} ${activeLayer === 'notes' ? styles.tabBtnActive : ''}`}
              onClick={() => onSelectLayer('notes')}
            >
              Notas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLayer === 'context'}
              className={`${styles.tabBtn} ${activeLayer === 'context' ? styles.tabBtnActive : ''}`}
              onClick={() => onSelectLayer('context')}
            >
              Contexto
            </button>
          </div>
        )}
      </div>

      {/* 2. Centro: Voicings y Foco de acorde */}
      {isChordActive && (
        <div
          className={styles.centerSection}
          role="region"
          aria-label="Navegador de digitaciones"
          tabIndex={0}
          onKeyDown={handleNavigatorKeyDown}
          data-testid="voicing-navigator"
        >
          {/* Nombre accesible del acorde en voicings para tests */}
          <strong className={styles.visuallyHidden} data-testid="voicing-chord-name">
            {activeChordName}
          </strong>

          {totalCount > 0 && currentVoicing ? (
            <>
              {/* Selector de familia de voicings */}
              <label className={styles.familyLabel} htmlFor="voicing-family-select">
                Familia
              </label>
              <select
                id="voicing-family-select"
                className={styles.familySelect}
                aria-label="Familia de digitaciones"
                value={effectiveFamilyFilter}
                onChange={(e) => handleFamilyChange(e.target.value)}
                data-testid="voicing-family-select"
              >
                <option value="all">Todos ({activeVoicings.length})</option>
                <option value="open" disabled={familyCounts.open === 0}>
                  Abiertos ({familyCounts.open})
                </option>
                <option value="barre" disabled={familyCounts.barre === 0}>
                  Cejilla ({familyCounts.barre})
                </option>
                <option value="strings-1-4" disabled={familyCounts['strings-1-4'] === 0}>
                  Cuerdas 1–4 ({familyCounts['strings-1-4']})
                </option>
                <option value="strings-1-3" disabled={familyCounts['strings-1-3'] === 0}>
                  Cuerdas 1–3 ({familyCounts['strings-1-3']})
                </option>
              </select>

              {/* Navegador de digitaciones: ‹ Familia · forma · index de total › */}
              <div className={styles.voicingNav}>
                <button
                  type="button"
                  className={styles.navArrowBtn}
                  onClick={handlePrevVoicing}
                  aria-label="Anterior"
                  data-testid="voicing-prev"
                >
                  ‹
                </button>

                <div className={styles.voicingTextWrapper}>
                  <span className={styles.voicingText}>
                    {VOICING_FAMILY_LABELS[currentVoicing.family] ?? currentVoicing.family}
                    {currentVoicing.inversion !== 'root'
                      ? ` · ${VOICING_INVERSION_LABELS[currentVoicing.inversion]}`
                      : ''}
                    {' · '}
                    <span data-testid="voicing-indicator">
                      {`Digitación ${currentIndex + 1} de ${totalCount}`}
                    </span>
                  </span>
                  <code className={styles.voicingShapeBadge} data-testid="voicing-shape">
                    {formatCompactFrets(currentVoicing.frets)}
                  </code>
                </div>

                <span className={styles.visuallyHidden} data-testid="voicing-family">
                  {VOICING_FAMILY_LABELS[currentVoicing.family]}
                </span>

                <button
                  type="button"
                  className={styles.navArrowBtn}
                  onClick={handleNextVoicing}
                  aria-label="Siguiente"
                  data-testid="voicing-next"
                >
                  ›
                </button>
              </div>

              {/* Si chordFocus está activo: conmutador Digitación | Notas en la escala, Ir al acorde y Quitar foco */}
              {chordFocus && (
                <>
                  <div
                    className={styles.focusModeToggle}
                    role="group"
                    aria-label="Modo de visualización de foco"
                  >
                    <button
                      type="button"
                      className={`${styles.focusModeBtn} ${chordFocus.mode === 'voicing' ? styles.focusModeBtnActive : ''}`}
                      onClick={() => onSetChordFocusMode('voicing')}
                      aria-pressed={chordFocus.mode === 'voicing'}
                    >
                      Digitación
                    </button>
                    <button
                      type="button"
                      className={`${styles.focusModeBtn} ${chordFocus.mode === 'tones' ? styles.focusModeBtnActive : ''}`}
                      onClick={() => onSetChordFocusMode('tones')}
                      aria-pressed={chordFocus.mode === 'tones'}
                    >
                      Notas en la escala
                    </button>
                  </div>

                  {onPromoteChordFocus && (
                    <button
                      type="button"
                      className={styles.promoteFocusBtn}
                      onClick={onPromoteChordFocus}
                      aria-label={`Ir al acorde ${activeChordName}`}
                      title={`Ir al acorde ${activeChordName}`}
                      data-testid="promote-chord-focus"
                    >
                      Ir al acorde
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.clearFocusBtn}
                    onClick={onClearChordFocus}
                    aria-label="Quitar foco"
                  >
                    Quitar foco
                  </button>
                </>
              )}
            </>
          ) : (
            <p className={styles.emptyVoicings} data-testid="voicing-empty">
              {EMPTY_VOICINGS_MESSAGE}
            </p>
          )}
        </div>
      )}

      {/* 3. Derecha: Etiquetas (Nota · Intervalo · Grado · Ninguna) */}
      <div className={styles.rightSection}>
        <span className={styles.labelsGroupLabel}>Etiquetas</span>
        <div className={styles.labelsToggle} role="group" aria-label="Modo de etiqueta">
          <button
            type="button"
            className={`${styles.labelBtn} ${labels === 'note' ? styles.labelBtnActive : ''}`}
            onClick={() => onLabelsChange('note')}
            aria-pressed={labels === 'note'}
          >
            Nota
          </button>
          <button
            type="button"
            className={`${styles.labelBtn} ${labels === 'interval' ? styles.labelBtnActive : ''}`}
            onClick={() => onLabelsChange('interval')}
            aria-pressed={labels === 'interval'}
          >
            Intervalo
          </button>
          <button
            type="button"
            className={`${styles.labelBtn} ${labels === 'degree' ? styles.labelBtnActive : ''}`}
            onClick={() => onLabelsChange('degree')}
            aria-pressed={labels === 'degree'}
          >
            Grado
          </button>
          <button
            type="button"
            className={`${styles.labelBtn} ${labels === 'none' ? styles.labelBtnActive : ''}`}
            onClick={() => onLabelsChange('none')}
            aria-pressed={labels === 'none'}
          >
            Ninguna
          </button>
        </div>
      </div>
    </div>
  );
}
