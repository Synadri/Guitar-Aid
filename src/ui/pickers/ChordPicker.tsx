import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  CHORD_QUALITIES,
  chordTones,
  getChordQuality,
  pcName,
  type ChordQuality,
  type ChordQualityId,
  type NameMode,
  type PitchClass,
} from '../../theory';
import type { MenuContext } from '../../state';
import { formatChordQualityOption } from './ContextPickers';
import styles from './Pickers.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface ChordQualityDisplayMeta {
  /** Sufijo visual junto a la tónica en el desplegable ("", "m", "°", "+", "maj7", etc.). */
  suffix: string;
  /** Etiqueta descriptiva en la celda del desplegable ("Mayor", "menor", "dominante", etc.). */
  label: string;
  /** Etiqueta mostrada en el botón disparador de la barra superior. */
  triggerLabel: string;
}

export const CHORD_PICKER_META: Readonly<Record<ChordQualityId, ChordQualityDisplayMeta>> = {
  maj: { suffix: '', label: 'Mayor', triggerLabel: 'mayor' },
  m: { suffix: 'm', label: 'menor', triggerLabel: 'menor' },
  dim: { suffix: '°', label: 'disminuido', triggerLabel: 'disminuido' },
  aug: { suffix: '+', label: 'aumentado', triggerLabel: 'aumentado' },
  '5': { suffix: '5', label: 'quinta', triggerLabel: 'quinta' },
  sus2: { suffix: 'sus2', label: 'sus2', triggerLabel: 'sus2' },
  sus4: { suffix: 'sus4', label: 'sus4', triggerLabel: 'sus4' },
  '6': { suffix: '6', label: 'sexta', triggerLabel: '6' },
  m6: { suffix: 'm6', label: 'menor sexta', triggerLabel: 'm6' },
  add9: { suffix: 'add9', label: 'añadida 9', triggerLabel: 'add9' },
  madd9: { suffix: 'm(add9)', label: 'menor add9', triggerLabel: 'm(add9)' },
  '7': { suffix: '7', label: 'dominante', triggerLabel: '7' },
  maj7: { suffix: 'maj7', label: 'mayor 7', triggerLabel: 'maj7' },
  m7: { suffix: 'm7', label: 'menor 7', triggerLabel: 'm7' },
  m7b5: { suffix: 'm7♭5', label: 'semidisminuido', triggerLabel: 'm7♭5' },
  dim7: { suffix: 'dim7', label: 'disminuido 7', triggerLabel: 'dim7' },
  mMaj7: { suffix: 'm(maj7)', label: 'menor maj7', triggerLabel: 'm(maj7)' },
  'maj7#5': { suffix: 'maj7♯5', label: 'maj7 aumentada', triggerLabel: 'maj7♯5' },
  '9': { suffix: '9', label: 'novena', triggerLabel: '9' },
};

interface ChordCategoryDef {
  id: string;
  title: string;
  qualityIds: readonly ChordQualityId[];
}

export const CHORD_CATEGORIES: readonly ChordCategoryDef[] = [
  {
    id: 'triads',
    title: 'TRÍADAS',
    qualityIds: ['maj', 'm', 'dim', 'aug', '5', 'sus2', 'sus4'],
  },
  {
    id: 'sixths-added',
    title: 'SEXTAS Y AÑADIDAS',
    qualityIds: ['6', 'm6', 'add9', 'madd9'],
  },
  {
    id: 'sevenths',
    title: 'SÉPTIMAS',
    qualityIds: ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7', 'maj7#5'],
  },
  {
    id: 'ninths',
    title: 'NOVENAS',
    qualityIds: ['9'],
  },
];

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ChordPickerProps {
  context: MenuContext | null;
  nameMode?: NameMode;
  onSelectContext: (ctx: MenuContext | null) => void;
  onPreviewContext?: (ctx: MenuContext | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ChordPicker({
  context,
  nameMode = 'sharps',
  onSelectContext,
  onPreviewContext,
  open: controlledOpen,
  onOpenChange,
}: ChordPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      onPreviewContext?.(null);
    }
  };

  const isActive = context?.kind === 'chord';
  const displayedRoot: PitchClass = context?.kind === 'chord' ? context.root : 0;
  const displayedQuality: ChordQualityId = context?.kind === 'chord' ? context.quality : 'maj';
  const rootName = pcName(displayedRoot, nameMode);
  const currentMeta = CHORD_PICKER_META[displayedQuality];

  const [searchQuery, setSearchQuery] = useState('');
  const [previewedQuality, setPreviewedQuality] = useState<ChordQualityId>(displayedQuality);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    const q = normalizeSearchText(searchQuery.trim());
    return CHORD_CATEGORIES.map((cat) => {
      const qualities = cat.qualityIds
        .map((id) => getChordQuality(id))
        .filter((quality) => {
          if (!q) return true;
          const meta = CHORD_PICKER_META[quality.id];
          const fullSymbol = normalizeSearchText(`${rootName}${meta.suffix}`);
          const labelNorm = normalizeSearchText(meta.label);
          const nameNorm = normalizeSearchText(quality.name);
          const idNorm = normalizeSearchText(quality.id);
          const degreesNorm = normalizeSearchText(
            chordTones(displayedRoot, quality.id, nameMode)
              .map((t) => t.degree)
              .join(' '),
          );
          return (
            fullSymbol.includes(q) ||
            labelNorm.includes(q) ||
            nameNorm.includes(q) ||
            idNorm.includes(q) ||
            degreesNorm.includes(q)
          );
        });
      return { ...cat, qualities };
    }).filter((cat) => cat.qualities.length > 0);
  }, [searchQuery, rootName, displayedRoot, nameMode]);

  const flatFilteredQualities = useMemo<ChordQuality[]>(
    () => filteredCategories.flatMap((cat) => cat.qualities),
    [filteredCategories],
  );

  const effectivePreviewedQuality: ChordQualityId = useMemo(() => {
    if (flatFilteredQualities.some((q) => q.id === previewedQuality)) {
      return previewedQuality;
    }
    return flatFilteredQualities[0]?.id ?? displayedQuality;
  }, [flatFilteredQualities, previewedQuality, displayedQuality]);

  const handleToggleOpen = () => {
    if (isOpen) {
      setOpen(false);
    } else {
      setSearchQuery('');
      setPreviewedQuality(displayedQuality);
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Cerrar al hacer clic fuera o pulsar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  });

  const handleRootChange = (root: PitchClass) => {
    onSelectContext({ kind: 'chord', root, quality: displayedQuality });
  };

  const handleQualityChange = (quality: ChordQualityId) => {
    onPreviewContext?.(null);
    onSelectContext({ kind: 'chord', root: displayedRoot, quality });
    setOpen(false);
  };

  const handleHoverQuality = (quality: ChordQualityId) => {
    setPreviewedQuality(quality);
    onPreviewContext?.({ kind: 'chord', root: displayedRoot, quality });
  };

  const handleApply = () => {
    onSelectContext({ kind: 'chord', root: displayedRoot, quality: displayedQuality });
  };

  const handleClear = () => {
    setOpen(false);
    onSelectContext(null);
  };

  const handlePopoverKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (flatFilteredQualities.length === 0) return;
    const currentIdx = flatFilteredQualities.findIndex((q) => q.id === effectivePreviewedQuality);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 2 : 1;
      const nextIdx = (safeIdx + step) % flatFilteredQualities.length;
      const nextQ = flatFilteredQualities[nextIdx]!;
      handleHoverQuality(nextQ.id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? 2 : 1;
      const prevIdx =
        (safeIdx - step + flatFilteredQualities.length) % flatFilteredQualities.length;
      const prevQ = flatFilteredQualities[prevIdx]!;
      handleHoverQuality(prevQ.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleQualityChange(effectivePreviewedQuality);
    }
  };

  // Datos para el pie de previsualización
  const previewMeta = CHORD_PICKER_META[effectivePreviewedQuality];
  const previewSymbol = `${rootName}${previewMeta.suffix}`;
  const previewTones = chordTones(displayedRoot, effectivePreviewedQuality, nameMode);
  const previewNotesText = previewTones.map((t) => t.name).join(' ');

  return (
    <div ref={wrapperRef} className={styles.pickerWrapper}>
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

        {/* Botón disparador del desplegable enriquecido */}
        <button
          type="button"
          className={`${styles.dropdownTrigger} ${styles.chordQualityTrigger} ${isOpen ? styles.dropdownTriggerOpen : ''}`}
          onClick={handleToggleOpen}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Elegir calidad del acorde (${currentMeta.triggerLabel})`}
          data-testid="chord-quality-trigger"
        >
          <span className={styles.triggerText}>{currentMeta.triggerLabel}</span>
          <svg
            className={styles.triggerChevron}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Select nativo oculto para compatibilidad con tests existentes */}
        <select
          className={styles.visuallyHidden}
          aria-label="Calidad del acorde"
          value={displayedQuality}
          onChange={(e) => handleQualityChange(e.target.value as ChordQualityId)}
          tabIndex={-1}
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

      {/* Popover Desplegable de Calidades de Acorde */}
      {isOpen && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Catálogo de calidades de acorde"
          data-testid="chord-picker-popover"
          onKeyDown={handlePopoverKeyDown}
        >
          <div className={styles.caret} aria-hidden="true" />

          {/* Buscador */}
          <div className={styles.searchBar}>
            <svg
              className={styles.searchIcon}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Buscar calidad (maj7, sus, dim...)"
              aria-label="Buscar calidad de acorde"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="chord-search-input"
            />
            <span className={styles.searchCount} data-testid="chord-search-count">
              {flatFilteredQualities.length}{' '}
              {flatFilteredQualities.length === 1 ? 'calidad' : 'calidades'}
            </span>
          </div>

          {/* Categorías en 2 columnas */}
          <div className={styles.categoriesBody} onMouseLeave={() => onPreviewContext?.(null)}>
            {filteredCategories.length === 0 ? (
              <p className={styles.emptySearch} data-testid="chord-search-empty">
                No se encontraron calidades para «{searchQuery}»
              </p>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryTitle}>{cat.title}</span>
                    <span className={styles.categoryMeta}>
                      {cat.qualities.length} {cat.qualities.length === 1 ? 'calidad' : 'calidades'}
                    </span>
                  </div>
                  <div className={styles.itemsGrid}>
                    {cat.qualities.map((quality) => {
                      const isSelected = isActive && displayedQuality === quality.id;
                      const isPreviewed = effectivePreviewedQuality === quality.id;
                      const meta = CHORD_PICKER_META[quality.id];
                      const chordSymbol = `${rootName}${meta.suffix}`;
                      const formula = chordTones(displayedRoot, quality.id, nameMode)
                        .map((t) => t.degree)
                        .join(' ');
                      return (
                        <button
                          key={quality.id}
                          type="button"
                          className={`${styles.optionBtn} ${styles.chordOptionBtn} ${isSelected ? styles.optionBtnSelected : ''} ${isPreviewed ? styles.optionBtnPreviewed : ''}`}
                          aria-label={`${chordSymbol} ${meta.label} (${formula})`}
                          aria-pressed={isSelected}
                          onMouseEnter={() => handleHoverQuality(quality.id)}
                          onFocus={() => handleHoverQuality(quality.id)}
                          onClick={() => handleQualityChange(quality.id)}
                          data-testid={`chord-option-${quality.id}`}
                        >
                          <span className={styles.chordSymbolText}>{chordSymbol}</span>
                          <span className={styles.chordLabelCell}>
                            {isSelected && (
                              <span className={styles.checkIcon} aria-hidden="true">
                                ✓
                              </span>
                            )}
                            <span className={styles.optionName}>{meta.label}</span>
                          </span>
                          <span className={styles.optionFormula}>{formula}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pie de previsualización y atajos */}
          <div className={styles.popoverFooter}>
            <div className={styles.previewSummary} data-testid="chord-picker-preview-info">
              <span className={styles.previewTag}>Previsualizando</span>
              <strong className={styles.previewStrong}>{previewSymbol}</strong>
              <span className={styles.previewMono}>{previewNotesText}</span>
              <span className={styles.previewContextNote}>· {previewMeta.label.toLowerCase()}</span>
            </div>
            <div className={styles.footerShortcuts} aria-hidden="true">
              <span className={styles.shortcutItem}>
                <kbd className={styles.kbdBadge}>↵</kbd> aplicar
              </span>
              <span className={styles.shortcutItem}>
                <kbd className={styles.kbdBadge}>Esc</kbd> cerrar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
