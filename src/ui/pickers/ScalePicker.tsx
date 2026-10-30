import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  SCALE_TYPES,
  getScaleType,
  pcName,
  scaleParentContext,
  type NameMode,
  type PitchClass,
  type ScaleType,
  type ScaleTypeId,
} from '../../theory';
import type { MenuContext } from '../../state';
import { formatScaleTypeOption } from './ContextPickers';
import styles from './Pickers.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const SCALE_FORMULA_BY_ID: Readonly<Record<ScaleTypeId, string>> = {
  major: '1 2 3 4 5 6 7',
  dorian: '1 2 ♭3 4 5 6 ♭7',
  phrygian: '1 ♭2 ♭3 4 5 ♭6 ♭7',
  lydian: '1 2 3 ♯4 5 6 7',
  mixolydian: '1 2 3 4 5 6 ♭7',
  minor: '1 2 ♭3 4 5 ♭6 ♭7',
  locrian: '1 ♭2 ♭3 4 ♭5 ♭6 ♭7',
  harmonicMinor: '1 2 ♭3 4 5 ♭6 7',
  melodicMinor: '1 2 ♭3 4 5 6 7',
  majorPentatonic: '1 2 3 5 6',
  minorPentatonic: '1 ♭3 4 5 ♭7',
  blues: '1 ♭3 4 ♭5 5 ♭7',
  majorBlues: '1 2 ♭3 3 5 6',
  neapolitanMinor: '1 ♭2 ♭3 4 5 ♭6 7',
  neapolitanMajor: '1 ♭2 ♭3 4 5 6 7',
  bebopDominant: '1 2 3 4 5 6 ♭7 7',
  bebopDorian: '1 2 ♭3 3 4 5 6 ♭7',
  bebopMajor: '1 2 3 4 5 ♯5 6 7',
  bebopMelodicMinor: '1 2 ♭3 4 5 ♯5 6 7',
  bebopNaturalMinor: '1 2 ♭3 4 5 ♭6 ♭7 7',
  diminishedHalfWhole: '1 ♭2 ♯2 3 ♯4 5 6 ♭7',
  diminishedWholeHalf: '1 2 ♭3 4 ♭5 ♭6 6 7',
};

interface ScaleCategoryDef {
  id: string;
  title: string;
  rightLabel: string;
  scaleIds: readonly ScaleTypeId[];
}

export const SCALE_CATEGORIES: readonly ScaleCategoryDef[] = [
  {
    id: 'major-modes',
    title: 'MAYOR Y MODOS',
    rightLabel: '7 notas',
    scaleIds: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'],
  },
  {
    id: 'altered-minors',
    title: 'MENORES ALTERADAS',
    rightLabel: '7 notas',
    scaleIds: ['harmonicMinor', 'melodicMinor'],
  },
  {
    id: 'pentatonics-blues',
    title: 'PENTATÓNICAS Y BLUES',
    rightLabel: '5–6 notas',
    scaleIds: ['majorPentatonic', 'minorPentatonic', 'blues', 'majorBlues'],
  },
  {
    id: 'neapolitans',
    title: 'NAPOLITANAS',
    rightLabel: '7 notas',
    scaleIds: ['neapolitanMinor', 'neapolitanMajor'],
  },
  {
    id: 'bebop',
    title: 'BEBOP',
    rightLabel: '8 notas',
    scaleIds: [
      'bebopDominant',
      'bebopDorian',
      'bebopMajor',
      'bebopMelodicMinor',
      'bebopNaturalMinor',
    ],
  },
  {
    id: 'symmetric',
    title: 'SIMÉTRICAS',
    rightLabel: '8 notas',
    scaleIds: ['diminishedHalfWhole', 'diminishedWholeHalf'],
  },
];

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ScalePickerProps {
  context: MenuContext | null;
  nameMode?: NameMode;
  onSelectContext: (ctx: MenuContext | null) => void;
  onPreviewContext?: (ctx: MenuContext | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ScalePicker({
  context,
  nameMode = 'sharps',
  onSelectContext,
  onPreviewContext,
  open: controlledOpen,
  onOpenChange,
}: ScalePickerProps) {
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

  const isActive = context?.kind === 'scale';
  const displayedRoot: PitchClass = context?.kind === 'scale' ? context.root : 0;
  const displayedType: ScaleTypeId = context?.kind === 'scale' ? context.type : 'major';
  const currentScaleObj = getScaleType(displayedType);

  const [searchQuery, setSearchQuery] = useState('');
  const [previewedType, setPreviewedType] = useState<ScaleTypeId>(displayedType);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    const q = normalizeSearchText(searchQuery.trim());
    return SCALE_CATEGORIES.map((cat) => {
      const scales = cat.scaleIds
        .map((id) => getScaleType(id))
        .filter((s) => {
          if (!q) return true;
          const label = normalizeSearchText(formatScaleTypeOption(s));
          const formula = normalizeSearchText(SCALE_FORMULA_BY_ID[s.id]);
          const idNorm = normalizeSearchText(s.id);
          return label.includes(q) || formula.includes(q) || idNorm.includes(q);
        });
      return { ...cat, scales };
    }).filter((cat) => cat.scales.length > 0);
  }, [searchQuery]);

  const flatFilteredScales = useMemo<ScaleType[]>(
    () => filteredCategories.flatMap((cat) => cat.scales),
    [filteredCategories],
  );

  const effectivePreviewedType: ScaleTypeId = useMemo(() => {
    if (flatFilteredScales.some((s) => s.id === previewedType)) {
      return previewedType;
    }
    return flatFilteredScales[0]?.id ?? displayedType;
  }, [flatFilteredScales, previewedType, displayedType]);

  // Al abrir el desplegable, preparar buscador y foco
  const handleToggleOpen = () => {
    if (isOpen) {
      setOpen(false);
    } else {
      setSearchQuery('');
      setPreviewedType(displayedType);
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
    onSelectContext({ kind: 'scale', root, type: displayedType });
  };

  const handleTypeChange = (type: ScaleTypeId) => {
    onPreviewContext?.(null);
    onSelectContext({ kind: 'scale', root: displayedRoot, type });
    setOpen(false);
  };

  const handleHoverScale = (type: ScaleTypeId) => {
    setPreviewedType(type);
    onPreviewContext?.({ kind: 'scale', root: displayedRoot, type });
  };

  const handleApply = () => {
    onSelectContext({ kind: 'scale', root: displayedRoot, type: displayedType });
  };

  const handlePopoverKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (flatFilteredScales.length === 0) return;
    const currentIdx = flatFilteredScales.findIndex((s) => s.id === effectivePreviewedType);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 2 : 1;
      const nextIdx = (safeIdx + step) % flatFilteredScales.length;
      const nextScale = flatFilteredScales[nextIdx]!;
      handleHoverScale(nextScale.id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? 2 : 1;
      const prevIdx = (safeIdx - step + flatFilteredScales.length) % flatFilteredScales.length;
      const prevScale = flatFilteredScales[prevIdx]!;
      handleHoverScale(prevScale.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleTypeChange(effectivePreviewedType);
    }
  };

  // Datos de la barra inferior de previsualización
  const previewScaleObj = getScaleType(effectivePreviewedType);
  const previewRootName = pcName(displayedRoot, nameMode);
  const previewFullName = `${previewRootName} ${previewScaleObj.name}`;
  const previewFormula = SCALE_FORMULA_BY_ID[effectivePreviewedType];
  const previewContextSubtitle = useMemo(() => {
    if (previewScaleObj.symmetric) {
      return 'Simétrica (4 tónicas a 3 semitonos)';
    }
    const parentCtx = scaleParentContext(
      {
        tonic: displayedRoot,
        type: effectivePreviewedType,
        name: previewFullName,
      },
      nameMode,
    );
    if (parentCtx && (!parentCtx.isSelfParent || parentCtx.passingToneNote)) {
      return parentCtx.description;
    }
    return `${previewScaleObj.intervals.length} notas`;
  }, [displayedRoot, effectivePreviewedType, nameMode, previewFullName, previewScaleObj]);

  return (
    <div ref={wrapperRef} className={styles.pickerWrapper}>
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

        {/* Botón disparador del desplegable enriquecido */}
        <button
          type="button"
          className={`${styles.dropdownTrigger} ${styles.scaleTypeTrigger} ${isOpen ? styles.dropdownTriggerOpen : ''}`}
          onClick={handleToggleOpen}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Elegir tipo de escala (${formatScaleTypeOption(currentScaleObj)})`}
          data-testid="scale-type-trigger"
        >
          <span className={styles.triggerText}>{formatScaleTypeOption(currentScaleObj)}</span>
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
          aria-label="Tipo de escala"
          value={displayedType}
          onChange={(e) => handleTypeChange(e.target.value as ScaleTypeId)}
          tabIndex={-1}
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

      {/* Popover Desplegable de Escalas */}
      {isOpen && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Catálogo de escalas"
          data-testid="scale-picker-popover"
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
              placeholder="Buscar escala (dórico, bebop...)"
              aria-label="Buscar escala"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="scale-search-input"
            />
            <span className={styles.searchCount} data-testid="scale-search-count">
              {flatFilteredScales.length} {flatFilteredScales.length === 1 ? 'escala' : 'escalas'}
            </span>
          </div>

          {/* Categorías en 2 columnas */}
          <div className={styles.categoriesBody} onMouseLeave={() => onPreviewContext?.(null)}>
            {filteredCategories.length === 0 ? (
              <p className={styles.emptySearch} data-testid="scale-search-empty">
                No se encontraron escalas para «{searchQuery}»
              </p>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryTitle}>{cat.title}</span>
                    <span className={styles.categoryMeta}>{cat.rightLabel}</span>
                  </div>
                  <div className={styles.itemsGrid}>
                    {cat.scales.map((scale) => {
                      const isSelected = isActive && displayedType === scale.id;
                      const isPreviewed = effectivePreviewedType === scale.id;
                      const optionLabel = formatScaleTypeOption(scale);
                      const formula = SCALE_FORMULA_BY_ID[scale.id];
                      return (
                        <button
                          key={scale.id}
                          type="button"
                          className={`${styles.optionBtn} ${isSelected ? styles.optionBtnSelected : ''} ${isPreviewed ? styles.optionBtnPreviewed : ''}`}
                          aria-label={`${optionLabel} (${formula})`}
                          aria-pressed={isSelected}
                          onMouseEnter={() => handleHoverScale(scale.id)}
                          onFocus={() => handleHoverScale(scale.id)}
                          onClick={() => handleTypeChange(scale.id)}
                          data-testid={`scale-option-${scale.id}`}
                        >
                          <span className={styles.optionLeft}>
                            {isSelected && (
                              <span className={styles.checkIcon} aria-hidden="true">
                                ✓
                              </span>
                            )}
                            <span className={styles.optionName}>{optionLabel}</span>
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
            <div className={styles.previewSummary} data-testid="scale-picker-preview-info">
              <span className={styles.previewTag}>Previsualizando</span>
              <strong className={styles.previewStrong}>{previewFullName}</strong>
              <span className={styles.previewMono}>{previewFormula}</span>
              <span className={styles.previewContextNote}>· {previewContextSubtitle}</span>
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
