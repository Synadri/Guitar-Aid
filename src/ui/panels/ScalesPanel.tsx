import { useState, useMemo } from 'react';
import {
  chordPitchClasses,
  getScaleType,
  groupedRelatedScales,
  pcName,
  rankScalesForChord,
  scalesContaining,
  scalesOnTonic,
  toWeightedPcs,
  type Candidate,
  type ChordRef,
  type NameMode,
  type PitchClass,
  type Reason,
  type ScaleRef,
  type ScaleTypeId,
} from '../../theory';
import type { ChordFocus, MenuContext, SuggestionSubject } from '../../state';
import {
  ExpandableSuggestionList,
  formatReasonsList,
  scaleToMenuContext,
  type SuggestionItem,
} from './SuggestionsPanel';
import { SUGGESTIONS_PANEL_TEXTS } from './texts';
import styles from './ScalesPanel.module.css';

function formatScale(tonic: PitchClass, type: ScaleTypeId, mode: NameMode): string {
  return `${pcName(tonic, mode)} ${getScaleType(type).name}`;
}

export interface ScalesPanelProps {
  context: MenuContext | null;
  subject?: SuggestionSubject | null;
  notesRoot?: PitchClass;
  chordFocus?: ChordFocus | null;
  nameMode?: NameMode;
  onSelectContext?: (ctx: MenuContext) => void;
  onPreviewScale?: (scale: ScaleRef | null) => void;
}

export function ScalesPanel({
  context,
  subject,
  notesRoot,
  chordFocus,
  nameMode = 'sharps',
  onSelectContext,
  onPreviewScale,
}: ScalesPanelProps) {
  const [relativesOpen, setRelativesOpen] = useState(true);

  const handlePreview = (ctx: MenuContext | null) => {
    if (!ctx) {
      onPreviewScale?.(null);
    } else if (ctx.kind === 'scale') {
      onPreviewScale?.({
        tonic: ctx.root,
        type: ctx.type,
        name: formatScale(ctx.root, ctx.type, nameMode),
      });
    }
  };

  const handleApply = (ctx: MenuContext) => {
    onPreviewScale?.(null);
    onSelectContext?.(ctx);
  };

  const isAnalyzingNotes = Boolean(subject && subject.kind !== 'none' && subject.layer === 'notes');

  // 1. Caso: Capa activa es una Escala -> Mostrar relativas y cercanas
  const scaleData = useMemo(() => {
    if (isAnalyzingNotes || !context || context.kind !== 'scale') return null;
    const ref: ScaleRef = {
      tonic: context.root,
      type: context.type,
      name: formatScale(context.root, context.type, nameMode),
    };
    const grouped = groupedRelatedScales(ref, nameMode);
    const filteredRelatives = grouped.relatives.filter(
      (r) => r.scale.tonic !== context.root || r.scale.type !== context.type,
    );
    const sel = getScaleType(context.type);
    if (sel.relative && sel.intervals.length < 7) {
      const relType = sel.relative.type;
      const relTonic = ((((context.root + sel.relative.offset) % 12) + 12) % 12) as PitchClass;
      const relIdx = filteredRelatives.findIndex(
        (r) => r.scale.tonic === relTonic && r.scale.type === relType,
      );
      if (relIdx > 0) {
        const [directRel] = filteredRelatives.splice(relIdx, 1);
        filteredRelatives.unshift(directRel!);
      } else if (relIdx < 0) {
        filteredRelatives.unshift({
          scale: {
            tonic: relTonic,
            type: relType,
            name: formatScale(relTonic, relType, nameMode),
          },
          degreeNumber: 1,
          degreeRoman: 'relativa',
        });
      }
    }
    return { relatives: filteredRelatives, byProximity: grouped.byProximity };
  }, [isAnalyzingNotes, context, nameMode]);

  const focusedChordRef: ChordRef | null = chordFocus ? chordFocus.chord : null;

  // 2. Si no es escala activa, calcular sugerencias de escalas según subject / context
  const suggestionItems = useMemo<SuggestionItem[] | null>(() => {
    if (!isAnalyzingNotes && context?.kind === 'scale') return null;

    // A) Notas que forman acorde o acorde en contexto
    if (subject?.kind === 'chord' || (!isAnalyzingNotes && context?.kind === 'chord')) {
      const primary =
        subject?.kind === 'chord'
          ? subject.candidates[0]?.value
          : context?.kind === 'chord'
            ? { root: context.root, quality: context.quality }
            : null;

      if (!primary) return [];
      const chordPcs = chordPitchClasses(primary.root, primary.quality);
      const scales = rankScalesForChord(
        { notes: toWeightedPcs(chordPcs), root: primary.root },
        nameMode,
      );
      return scales.map((c) => ({
        key: `chord-scale-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));
    }

    // B) Una sola nota seleccionada
    if (subject?.kind === 'note') {
      const pc = subject.pc;
      const onTonic: Candidate<ScaleRef>[] = scalesOnTonic(pc, nameMode);
      const containing: Candidate<ScaleRef>[] = scalesContaining(pc, nameMode);
      const seen = new Set<string>();
      const merged: Candidate<ScaleRef>[] = [];

      for (const c of onTonic) {
        const k = `${c.value.tonic}:${c.value.type}`;
        const alsoContains = containing.find(
          (x) => x.value.tonic === c.value.tonic && x.value.type === c.value.type,
        );
        const reasons: Reason[] = alsoContains
          ? [c.reasons[0]!, alsoContains.reasons[0]!, ...c.reasons.slice(1)]
          : c.reasons;
        seen.add(k);
        merged.push({ ...c, reasons });
      }
      for (const c of containing) {
        const k = `${c.value.tonic}:${c.value.type}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(c);
      }

      return merged.map((c) => ({
        key: `note-scale-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));
    }

    // C) Varias notas que no forman acorde reconocido
    if (subject?.kind === 'unrecognized') {
      const pcs = subject.pcs;
      const effectiveRoot = notesRoot ?? pcs[0];
      const scaleCandidates = rankScalesForChord(
        { notes: toWeightedPcs(pcs), root: effectiveRoot },
        nameMode,
      );
      return scaleCandidates.map((c) => ({
        key: `unrec-scale-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));
    }

    return null;
  }, [isAnalyzingNotes, context, subject, notesRoot, nameMode]);

  return (
    <div
      className={styles.panelContainer}
      role="region"
      aria-label="Sugerencias de escalas"
      data-testid="scales-panel"
    >
      {scaleData ? (
        <div className={styles.placeholderSection} data-testid="scales-panel-placeholder">
          {/* Bloque desplegable de Escalas Relativas */}
          <div className={styles.accordionSection}>
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={() => setRelativesOpen((prev) => !prev)}
              aria-expanded={relativesOpen}
            >
              <span>Escalas relativas (mismas notas)</span>
              <span className={styles.countBadge}>
                {scaleData.relatives.length} {relativesOpen ? '▴' : '▾'}
              </span>
            </button>

            {relativesOpen && (
              <div className={styles.accordionBody}>
                {scaleData.relatives.map((rel) => {
                  const displayName = formatScale(rel.scale.tonic, rel.scale.type, nameMode);
                  const isFocusMatch =
                    focusedChordRef &&
                    rel.scale.tonic === focusedChordRef.root &&
                    (rel.scale.type === 'mixolydian' ||
                      rel.scale.type === 'major' ||
                      rel.scale.type === 'minor');

                  return (
                    <button
                      type="button"
                      key={`${rel.scale.tonic}-${rel.scale.type}`}
                      className={styles.scaleRow}
                      onClick={() =>
                        handleApply({
                          kind: 'scale',
                          root: rel.scale.tonic,
                          type: rel.scale.type,
                        })
                      }
                      onMouseEnter={() =>
                        handlePreview({
                          kind: 'scale',
                          root: rel.scale.tonic,
                          type: rel.scale.type,
                        })
                      }
                      onMouseLeave={() => handlePreview(null)}
                      onFocus={() =>
                        handlePreview({
                          kind: 'scale',
                          root: rel.scale.tonic,
                          type: rel.scale.type,
                        })
                      }
                      onBlur={() => handlePreview(null)}
                      data-testid="suggestion-button"
                      aria-label={`${displayName}: escala relativa, mismas notas`}
                    >
                      <div className={styles.scaleLeft}>
                        <span className={styles.romanDegree}>{rel.degreeRoman}</span>
                        <span className={styles.scaleName} data-testid="suggestion-name">
                          {displayName}
                        </span>
                      </div>
                      <span className={styles.visuallyHidden} data-testid="suggestion-reason">
                        escala relativa · comparte todas las notas
                      </span>
                      {isFocusMatch && chordFocus && (
                        <span className={styles.fitBadge}>
                          encaja con {chordFocus.degree ?? ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bloque por Proximidad y Popularidad */}
          {scaleData.byProximity.length > 0 && (
            <>
              <div className={styles.sectionHeader}>Por proximidad y popularidad</div>
              <div className={styles.accordionSection}>
                <div className={styles.accordionBody}>
                  {scaleData.byProximity.slice(0, 5).map((entry) => {
                    const displayName = formatScale(entry.value.tonic, entry.value.type, nameMode);
                    const added = Number(entry.reasons[0]?.params?.added ?? 0);
                    const removed = Number(entry.reasons[0]?.params?.removed ?? 0);
                    const diffCount = added + removed > 0 ? added + removed : 1;

                    return (
                      <button
                        type="button"
                        key={`${entry.value.tonic}-${entry.value.type}`}
                        className={styles.scaleRow}
                        onClick={() =>
                          handleApply({
                            kind: 'scale',
                            root: entry.value.tonic,
                            type: entry.value.type,
                          })
                        }
                        onMouseEnter={() =>
                          handlePreview({
                            kind: 'scale',
                            root: entry.value.tonic,
                            type: entry.value.type,
                          })
                        }
                        onMouseLeave={() => handlePreview(null)}
                        onFocus={() =>
                          handlePreview({
                            kind: 'scale',
                            root: entry.value.tonic,
                            type: entry.value.type,
                          })
                        }
                        onBlur={() => handlePreview(null)}
                        data-testid="suggestion-button"
                        aria-label={`${displayName}: ${diffCount} ${diffCount === 1 ? 'nota distinta' : 'notas distintas'}`}
                      >
                        <div className={styles.scaleLeft}>
                          <span className={styles.scaleName} data-testid="suggestion-name">
                            {displayName}
                          </span>
                        </div>
                        <span className={styles.visuallyHidden} data-testid="suggestion-reason">
                          {formatReasonsList(entry.reasons, nameMode)}
                        </span>
                        <span className={styles.countBadge}>
                          {diffCount} {diffCount === 1 ? 'nota distinta' : 'notas distintas'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : suggestionItems !== null ? (
        <ExpandableSuggestionList
          items={suggestionItems}
          listLabel={SUGGESTIONS_PANEL_TEXTS.scalesListLabel}
          sectionKey={`scales-panel-list-${subject?.kind ?? 'direct'}-${nameMode}`}
          onPreview={handlePreview}
          onApply={handleApply}
        />
      ) : (
        <div className={styles.placeholderSection} data-testid="scales-panel-placeholder">
          <p className={styles.placeholderText}>
            Selecciona notas o un acorde para ver escalas compatibles.
          </p>
        </div>
      )}
    </div>
  );
}
