import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  chordPitchClasses,
  chordsContaining,
  chordsContainingAll,
  chordsWithinScale,
  diatonicChords,
  getProgression,
  getScaleType,
  pcName,
  progressionChords,
  progressionsFor,
  rankScalesForChord,
  relatedScales,
  scalesContaining,
  scalesOnTonic,
  toWeightedPcs,
  type Candidate,
  type ChordRef,
  type NameMode,
  type PitchClass,
  type Reason,
  type ScaleRef,
} from '../../theory';
import {
  effectiveNotesRoot,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  suggestionSubject,
  type ChordFocus,
  type MenuContext,
  type SandboxLayer,
  type SandboxStore,
  type SettingsStore,
  type SuggestionSubject,
  type SuggestionsMode,
} from '../../state';
import { SUGGESTIONS_PANEL_TEXTS, formatReason } from './texts';
import styles from './SuggestionsPanel.module.css';

export const INITIAL_SUGGESTIONS_LIMIT = 8;

export interface SuggestionItem {
  key: string;
  name: string;
  badge?: string;
  reasonText: string;
  context: MenuContext;
  chordRef?: ChordRef;
}

export interface ProgressionSuggestionItem {
  key: string;
  keyName: string;
  degree: string;
  templateName: string;
  reasonText: string;
  chords: {
    roman: string;
    name: string;
    reasonText: string;
    context: MenuContext;
    chordRef: ChordRef;
  }[];
}

export function formatReasonsList(reasons: readonly Reason[], nameMode: NameMode): string {
  return reasons.map((r) => formatReason(r, nameMode)).join(' · ');
}

export function chordToMenuContext(chord: ChordRef): MenuContext {
  return { kind: 'chord', root: chord.root, quality: chord.quality };
}

export function scaleToMenuContext(scale: ScaleRef): MenuContext {
  return { kind: 'scale', root: scale.tonic, type: scale.type };
}

export interface ExpandableSuggestionListProps {
  items: readonly SuggestionItem[];
  listLabel: string;
  sectionKey: string;
  onPreview: (ctx: MenuContext | null) => void;
  onApply: (ctx: MenuContext) => void;
  chordFocus?: ChordFocus | null;
  onToggleChordFocus?: (focus: ChordFocus) => void;
  testId?: string;
}

export function ExpandableSuggestionList({
  items,
  listLabel,
  sectionKey,
  onPreview,
  onApply,
  chordFocus,
  onToggleChordFocus,
  testId = 'suggestions-list',
}: ExpandableSuggestionListProps) {
  const [expandedForKey, setExpandedForKey] = useState<string | null>(null);
  const expanded = expandedForKey === sectionKey;
  const visible = expanded ? items : items.slice(0, INITIAL_SUGGESTIONS_LIMIT);
  const hasMore = items.length > INITIAL_SUGGESTIONS_LIMIT && !expanded;

  if (items.length === 0) {
    return (
      <p className={styles.empty} data-testid="no-suggestions">
        {SUGGESTIONS_PANEL_TEXTS.noSuggestions}
      </p>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.scrollArea}>
        <ul className={styles.list} aria-label={listLabel} data-testid={testId}>
          {visible.map((item) => {
            const ariaLabel = item.badge
              ? `${item.name} (${item.badge}): ${item.reasonText}`
              : `${item.name}: ${item.reasonText}`;
            const isFocused = Boolean(
              item.chordRef &&
              chordFocus &&
              chordFocus.chord.root === item.chordRef.root &&
              chordFocus.chord.quality === item.chordRef.quality,
            );
            const canFocusChord = Boolean(item.chordRef && onToggleChordFocus);

            return (
              <li
                key={item.key}
                className={`${styles.listItem} ${canFocusChord ? styles.listItemWithAction : ''}`}
              >
                <button
                  type="button"
                  className={`${styles.suggestionButton} ${isFocused ? styles.suggestionButtonFocused : ''}`}
                  aria-label={ariaLabel}
                  aria-pressed={canFocusChord ? isFocused : undefined}
                  onMouseEnter={() => onPreview(item.context)}
                  onMouseLeave={() => onPreview(null)}
                  onFocus={() => onPreview(item.context)}
                  onBlur={() => onPreview(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      onPreview(null);
                    }
                  }}
                  onClick={() => {
                    if (canFocusChord && item.chordRef && onToggleChordFocus) {
                      onPreview(null);
                      onToggleChordFocus({
                        chord: item.chordRef,
                        ...(item.badge ? { degree: item.badge } : {}),
                        voicingIndex: 0,
                        mode: 'voicing',
                      });
                    } else {
                      onApply(item.context);
                    }
                  }}
                  data-testid="suggestion-button"
                >
                  <span className={styles.suggestionTop}>
                    <span className={styles.suggestionName} data-testid="suggestion-name">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className={styles.suggestionBadge} data-testid="suggestion-badge">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span className={styles.suggestionReason} data-testid="suggestion-reason">
                    {item.reasonText}
                  </span>
                </button>
                {canFocusChord && (
                  <button
                    type="button"
                    className={styles.goToChordButton}
                    aria-label={`Ir al acorde ${item.name}`}
                    title={`Ir al acorde ${item.name}`}
                    onClick={() => onApply(item.context)}
                    data-testid="go-to-chord-button"
                  >
                    ↗
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {hasMore && (
        <button
          type="button"
          className={styles.showMoreButton}
          onClick={() => setExpandedForKey(sectionKey)}
          data-testid="suggestions-show-more"
        >
          {SUGGESTIONS_PANEL_TEXTS.showMoreButton}
        </button>
      )}
    </div>
  );
}

interface ExpandableProgressionsListProps {
  items: readonly ProgressionSuggestionItem[];
  listLabel: string;
  sectionKey: string;
  activeChord?: ChordRef;
  chordFocus?: ChordFocus | null;
  isContextLayer?: boolean;
  onToggleChordFocus?: (focus: ChordFocus) => void;
  onClearChordFocus?: () => void;
  onPreview: (ctx: MenuContext | null) => void;
  onApply: (ctx: MenuContext) => void;
}

function ExpandableProgressionsList({
  items,
  listLabel,
  sectionKey,
  activeChord,
  chordFocus,
  isContextLayer = false,
  onToggleChordFocus,
  onClearChordFocus,
  onPreview,
  onApply,
}: ExpandableProgressionsListProps) {
  const [expandedForKey, setExpandedForKey] = useState<string | null>(null);
  const expanded = expandedForKey === sectionKey;
  const visible = expanded ? items : items.slice(0, INITIAL_SUGGESTIONS_LIMIT);
  const hasMore = items.length > INITIAL_SUGGESTIONS_LIMIT && !expanded;

  if (items.length === 0) {
    return (
      <p className={styles.empty} data-testid="no-suggestions">
        {SUGGESTIONS_PANEL_TEXTS.noSuggestions}
      </p>
    );
  }

  return (
    <div className={styles.section}>
      {isContextLayer && chordFocus && activeChord && (
        <div className={styles.focusRestoreBar} data-testid="progression-focus-bar">
          <span className={styles.focusRestoreText}>
            Inspeccionando <strong>{chordFocus.chord.name}</strong>
          </span>
          <div className={styles.focusRestoreActions}>
            <button
              type="button"
              className={styles.restoreContextBtn}
              onClick={onClearChordFocus}
              data-testid="restore-context-chord"
            >
              Volver a {activeChord.name}
            </button>
            <button
              type="button"
              className={styles.promoteContextBtn}
              aria-label={`Ir al acorde ${chordFocus.chord.name}`}
              title={`Ir al acorde ${chordFocus.chord.name}`}
              onClick={() => onApply(chordToMenuContext(chordFocus.chord))}
            >
              Ir al acorde
            </button>
          </div>
        </div>
      )}
      <div className={styles.scrollArea}>
        <ul className={styles.list} aria-label={listLabel} data-testid="progressions-list">
          {visible.map((prog) => (
            <li key={prog.key} className={styles.progressionItem} data-testid="progression-item">
              <div className={styles.progressionHeader}>
                <span className={styles.progressionTitle} data-testid="progression-title">
                  {prog.keyName} · grado {prog.degree} · {prog.templateName}
                </span>
                <span className={styles.progressionMeta} data-testid="progression-reason">
                  {prog.reasonText}
                </span>
              </div>
              <ul
                className={styles.progressionChordsList}
                aria-label={`Acordes de ${prog.templateName} en ${prog.keyName}`}
              >
                {prog.chords.map((ch, idx) => {
                  const isCurrent = Boolean(
                    activeChord &&
                    ch.chordRef.root === activeChord.root &&
                    ch.chordRef.quality === activeChord.quality,
                  );
                  const isFocused = Boolean(
                    chordFocus &&
                    ch.chordRef.root === chordFocus.chord.root &&
                    ch.chordRef.quality === chordFocus.chord.quality,
                  );
                  const canFocusStep = isContextLayer && Boolean(onToggleChordFocus);

                  return (
                    <li
                      key={`${prog.key}-${idx}-${ch.roman}-${ch.name}`}
                      className={styles.progressionStepWrapper}
                    >
                      <button
                        type="button"
                        className={`${styles.progressionChordButton} ${isCurrent ? styles.progressionChordCurrent : ''} ${isFocused ? styles.progressionChordFocused : ''}`}
                        aria-label={`${ch.name} (${ch.roman}): ${ch.reasonText}`}
                        data-current-degree={isCurrent ? 'true' : undefined}
                        data-focused-degree={isFocused ? 'true' : undefined}
                        onMouseEnter={() => onPreview(ch.context)}
                        onMouseLeave={() => onPreview(null)}
                        onFocus={() => onPreview(ch.context)}
                        onBlur={() => onPreview(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            onPreview(null);
                          }
                        }}
                        onClick={() => {
                          if (canFocusStep && onToggleChordFocus) {
                            onPreview(null);
                            if (isCurrent) {
                              onClearChordFocus?.();
                            } else {
                              onToggleChordFocus({
                                chord: ch.chordRef,
                                degree: ch.roman,
                                voicingIndex: 0,
                                mode: 'voicing',
                              });
                            }
                          } else {
                            onApply(ch.context);
                          }
                        }}
                        data-testid="suggestion-button"
                      >
                        <span className={styles.suggestionName} data-testid="suggestion-name">
                          {ch.name}
                        </span>
                        <span className={styles.progressionChordRoman}>{ch.roman}</span>
                      </button>
                      {canFocusStep && !isCurrent && (
                        <button
                          type="button"
                          className={styles.progressionGoToBtn}
                          aria-label={`Ir al acorde ${ch.name}`}
                          title={`Ir al acorde ${ch.name}`}
                          onClick={() => onApply(ch.context)}
                        >
                          ↗
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {hasMore && (
        <button
          type="button"
          className={styles.showMoreButton}
          onClick={() => setExpandedForKey(sectionKey)}
          data-testid="suggestions-show-more"
        >
          {SUGGESTIONS_PANEL_TEXTS.showMoreButton}
        </button>
      )}
    </div>
  );
}

export interface SuggestionsPanelProps {
  subject: SuggestionSubject;
  suggestionsMode?: SuggestionsMode;
  nameMode?: NameMode;
  /** Raíz efectiva cuando se analizan notas que no forman acorde. */
  notesRoot?: PitchClass;
  chordFocus?: ChordFocus | null;
  harmonyMode?: 'triads' | 'sevenths';
  onHarmonyModeChange?: (mode: 'triads' | 'sevenths') => void;
  onToggleChordFocus?: (focus: ChordFocus) => void;
  onClearChordFocus?: () => void;
  onSuggestionsModeChange?: (mode: SuggestionsMode) => void;
  onSelectLayer?: (layer: SandboxLayer) => void;
  onPreview: (context: MenuContext | null) => void;
  onApply: (context: MenuContext) => void;
}

/**
 * Componente presentacional del panel de sugerencias (Hito U5 / H5c-d).
 * Recibe `subject` (`suggestionSubject`), el modo (`suggestionsMode`) y callbacks por props.
 */
export function SuggestionsPanel({
  subject,
  suggestionsMode = 'chords',
  nameMode = 'sharps',
  notesRoot,
  chordFocus,
  harmonyMode = 'triads',
  onHarmonyModeChange,
  onToggleChordFocus,
  onClearChordFocus,
  onSelectLayer,
  onPreview,
  onApply,
}: SuggestionsPanelProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPreview]);

  const handleApply = (ctx: MenuContext) => {
    onApply(ctx);
  };

  const renderContent = () => {
    if (subject.kind === 'none') {
      return (
        <p className={styles.empty} data-testid="suggestions-empty">
          {SUGGESTIONS_PANEL_TEXTS.emptyPrompt}
        </p>
      );
    }

    // 1. Una única nota seleccionada
    if (subject.kind === 'note') {
      const pc = subject.pc;
      const noteLabel = pcName(pc, nameMode);

      if (suggestionsMode === 'chords') {
        // chordsContainingAll con 1 nota da el mismo conjunto que chordsContaining; usamos
        // el orden de chordsContaining (peso + fundamental primero) con el papel de la nota.
        const singleMatches = chordsContaining(pc, nameMode);
        const allSet = new Set(
          chordsContainingAll([pc], pc, nameMode).map((c) => `${c.value.root}:${c.value.quality}`),
        );
        const items: SuggestionItem[] = singleMatches
          .filter((m) => allSet.has(`${m.value.chord.root}:${m.value.chord.quality}`))
          .map((m) => ({
            key: `note-chord-${m.value.chord.root}-${m.value.chord.quality}`,
            name: m.value.chord.name,
            badge: m.value.role,
            reasonText: formatReasonsList(m.reasons, nameMode),
            context: chordToMenuContext(m.value.chord),
          }));

        return (
          <ExpandableSuggestionList
            items={items}
            listLabel={SUGGESTIONS_PANEL_TEXTS.chordsListLabel}
            sectionKey={`note-chords-${pc}-${nameMode}`}
            onPreview={onPreview}
            onApply={handleApply}
          />
        );
      }

      // Escalas para una sola nota: las que tienen esa nota de tónica y las que la contienen.
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

      const items: SuggestionItem[] = merged.map((c) => ({
        key: `note-scale-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));

      return (
        <ExpandableSuggestionList
          items={items}
          listLabel={`${SUGGESTIONS_PANEL_TEXTS.scalesListLabel} (${noteLabel})`}
          sectionKey={`note-scales-${pc}-${nameMode}`}
          onPreview={onPreview}
          onApply={handleApply}
        />
      );
    }

    // 2. Varias notas que no forman un acorde reconocido
    if (subject.kind === 'unrecognized') {
      const pcs = subject.pcs;
      const effectiveRoot = notesRoot ?? pcs[0];
      const sig = pcs.join(',');

      if (suggestionsMode === 'chords') {
        const candidates = chordsContainingAll(pcs, effectiveRoot, nameMode);
        const items: SuggestionItem[] = candidates.map((c) => ({
          key: `unrec-chord-${c.value.root}-${c.value.quality}`,
          name: c.value.name,
          reasonText: formatReasonsList(c.reasons, nameMode),
          context: chordToMenuContext(c.value),
        }));
        return (
          <ExpandableSuggestionList
            items={items}
            listLabel={SUGGESTIONS_PANEL_TEXTS.chordsListLabel}
            sectionKey={`unrec-chords-${sig}-${effectiveRoot ?? 'none'}-${nameMode}`}
            onPreview={onPreview}
            onApply={handleApply}
          />
        );
      }

      const scaleCandidates = rankScalesForChord(
        { notes: toWeightedPcs(pcs), root: effectiveRoot },
        nameMode,
      );
      const items: SuggestionItem[] = scaleCandidates.map((c) => ({
        key: `unrec-scale-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));
      return (
        <ExpandableSuggestionList
          items={items}
          listLabel={SUGGESTIONS_PANEL_TEXTS.scalesListLabel}
          sectionKey={`unrec-scales-${sig}-${effectiveRoot ?? 'none'}-${nameMode}`}
          onPreview={onPreview}
          onApply={handleApply}
        />
      );
    }

    // 3. Un acorde (reconocido en las notas o elegido en el menú)
    if (subject.kind === 'chord') {
      const primary = subject.candidates[0]?.value;
      if (!primary) {
        return (
          <p className={styles.empty} data-testid="no-suggestions">
            {SUGGESTIONS_PANEL_TEXTS.noSuggestions}
          </p>
        );
      }

      const chordPcs = chordPitchClasses(primary.root, primary.quality);

      if (suggestionsMode === 'scales') {
        const scales = rankScalesForChord(
          { notes: toWeightedPcs(chordPcs), root: primary.root },
          nameMode,
        );
        const items: SuggestionItem[] = scales.map((c) => ({
          key: `chord-scale-${c.value.tonic}-${c.value.type}`,
          name: c.value.name,
          reasonText: formatReasonsList(c.reasons, nameMode),
          context: scaleToMenuContext(c.value),
        }));
        return (
          <ExpandableSuggestionList
            items={items}
            listLabel={SUGGESTIONS_PANEL_TEXTS.scalesListLabel}
            sectionKey={`chord-scales-${primary.root}-${primary.quality}-${nameMode}`}
            onPreview={onPreview}
            onApply={handleApply}
          />
        );
      }

      // Modo Acordes para un acorde: progresiones que lo incluyen
      const progressions = progressionsFor(
        { root: primary.root, quality: primary.quality },
        nameMode,
      );
      const progItems: ProgressionSuggestionItem[] = progressions.map((p) => {
        const template = getProgression(p.value.template.id);
        const chordsInProg = progressionChords(template, p.value.key.tonic, nameMode);
        return {
          key: `prog-${p.value.template.id}-${p.value.key.tonic}-${p.value.degree}`,
          keyName: p.value.key.name,
          degree: p.value.degree,
          templateName: p.value.template.name,
          reasonText: formatReasonsList(p.reasons, nameMode),
          chords: chordsInProg.map((step) => ({
            roman: step.roman,
            name: step.chord.name,
            reasonText: SUGGESTIONS_PANEL_TEXTS.progressionChordReason(
              step.roman,
              p.value.key.name,
              p.value.template.name,
            ),
            context: chordToMenuContext(step.chord),
            chordRef: step.chord,
          })),
        };
      });

      return (
        <ExpandableProgressionsList
          items={progItems}
          listLabel={SUGGESTIONS_PANEL_TEXTS.progressionsListLabel}
          sectionKey={`chord-progs-${primary.root}-${primary.quality}-${nameMode}`}
          activeChord={primary}
          chordFocus={chordFocus}
          isContextLayer={subject.layer === 'context'}
          onToggleChordFocus={onToggleChordFocus}
          onClearChordFocus={onClearChordFocus}
          onPreview={onPreview}
          onApply={handleApply}
        />
      );
    }

    // 4. Una escala seleccionada
    if (subject.kind === 'scale') {
      const scale = subject.scale;
      const scaleType = getScaleType(scale.type);
      const effectiveType = scaleType.baseScale ? getScaleType(scaleType.baseScale) : scaleType;
      const isHeptatonic = effectiveType.intervals.length === 7;

      if (suggestionsMode === 'chords') {
        const list = isHeptatonic
          ? diatonicChords(scale, nameMode, harmonyMode)
          : chordsWithinScale(scale, nameMode);
        const items: SuggestionItem[] = list.map((d) => ({
          key: `scale-chord-${d.chord.root}-${d.chord.quality}-${d.roman}`,
          name: d.chord.name,
          badge: d.roman,
          reasonText: isHeptatonic
            ? SUGGESTIONS_PANEL_TEXTS.diatonicDegreeReason(d.roman, scale.name)
            : SUGGESTIONS_PANEL_TEXTS.withinScaleReason(d.roman, scale.name),
          context: chordToMenuContext(d.chord),
          chordRef: d.chord,
        }));
        return (
          <div className={styles.scaleHarmonyWrapper}>
            {isHeptatonic && onHarmonyModeChange && (
              <div
                className={styles.harmonyModeBar}
                role="group"
                aria-label="Modo de acordes diatónicos"
                data-testid="harmony-mode-toggle"
              >
                <button
                  type="button"
                  className={`${styles.harmonyModeBtn} ${harmonyMode === 'triads' ? styles.harmonyModeBtnActive : ''}`}
                  aria-pressed={harmonyMode === 'triads'}
                  onClick={() => onHarmonyModeChange('triads')}
                >
                  Tríadas
                </button>
                <button
                  type="button"
                  className={`${styles.harmonyModeBtn} ${harmonyMode === 'sevenths' ? styles.harmonyModeBtnActive : ''}`}
                  aria-pressed={harmonyMode === 'sevenths'}
                  onClick={() => onHarmonyModeChange('sevenths')}
                >
                  Cuatríadas (7ª)
                </button>
              </div>
            )}
            <ExpandableSuggestionList
              items={items}
              listLabel={SUGGESTIONS_PANEL_TEXTS.chordsListLabel}
              sectionKey={`scale-chords-${scale.tonic}-${scale.type}-${harmonyMode}-${nameMode}`}
              chordFocus={chordFocus}
              onToggleChordFocus={onToggleChordFocus}
              onPreview={onPreview}
              onApply={handleApply}
            />
          </div>
        );
      }

      const related = relatedScales(scale, nameMode);
      const items: SuggestionItem[] = related.map((c) => ({
        key: `scale-rel-${c.value.tonic}-${c.value.type}`,
        name: c.value.name,
        reasonText: formatReasonsList(c.reasons, nameMode),
        context: scaleToMenuContext(c.value),
      }));
      return (
        <ExpandableSuggestionList
          items={items}
          listLabel={SUGGESTIONS_PANEL_TEXTS.scalesListLabel}
          sectionKey={`scale-rel-${scale.tonic}-${scale.type}-${nameMode}`}
          onPreview={onPreview}
          onApply={handleApply}
        />
      );
    }

    return null;
  };

  const hasTwoLayers = subject.availableLayers.length === 2;
  const activeLayer: SandboxLayer | null = subject.kind === 'none' ? null : subject.layer;

  return (
    <section
      className={styles.panel}
      aria-label={SUGGESTIONS_PANEL_TEXTS.regionLabel}
      data-testid="suggestions-panel"
    >
      <div className={styles.header}>
        {subject.kind !== 'none' ? (
          <h2 className={styles.title} data-testid="suggestions-subject-header">
            {subject.description}
          </h2>
        ) : (
          <h2 className={styles.title}>{SUGGESTIONS_PANEL_TEXTS.heading}</h2>
        )}

        {hasTwoLayers && (
          <div
            className={styles.tabs}
            role="tablist"
            aria-label={SUGGESTIONS_PANEL_TEXTS.tabsLabel}
            data-testid="suggestions-layer-tabs"
          >
            <button
              type="button"
              role="tab"
              className={`${styles.tabButton} ${activeLayer === 'notes' ? styles.tabButtonActive : ''}`}
              aria-selected={activeLayer === 'notes'}
              onClick={() => onSelectLayer?.('notes')}
              data-testid="suggestions-tab-notes"
            >
              {SUGGESTIONS_PANEL_TEXTS.notesTabLabel}
            </button>
            <button
              type="button"
              role="tab"
              className={`${styles.tabButton} ${activeLayer === 'context' ? styles.tabButtonActive : ''}`}
              aria-selected={activeLayer === 'context'}
              onClick={() => onSelectLayer?.('context')}
              data-testid="suggestions-tab-context"
            >
              {SUGGESTIONS_PANEL_TEXTS.contextTabLabel}
            </button>
          </div>
        )}
      </div>

      {renderContent()}
    </section>
  );
}

export interface SandboxSuggestionsPanelProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
}

/**
 * Contenedor que conecta `SuggestionsPanel` con `sandboxStore` y `settingsStore`.
 * La Columna 2 del dashboard siempre muestra Armonía y Progresiones (`suggestionsMode="chords"`).
 */
export function SandboxSuggestionsPanel({
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
}: SandboxSuggestionsPanelProps = {}) {
  const nameMode = useStore(settingsStore, (s) => s.nameMode);

  const notes = useStore(sandboxStore, (s) => s.notes);
  const context = useStore(sandboxStore, (s) => s.context);
  const focus = useStore(sandboxStore, (s) => s.focus);
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
  const chordFocus = useStore(sandboxStore, (s) => s.chordFocus);
  const harmonyMode = useStore(sandboxStore, (s) => s.harmonyMode);
  const setFocus = useStore(sandboxStore, (s) => s.setFocus);
  const setPreview = useStore(sandboxStore, (s) => s.setPreview);
  const setContext = useStore(sandboxStore, (s) => s.setContext);
  const toggleChordFocus = useStore(sandboxStore, (s) => s.toggleChordFocus);
  const clearChordFocus = useStore(sandboxStore, (s) => s.clearChordFocus);
  const setHarmonyMode = useStore(sandboxStore, (s) => s.setHarmonyMode);

  const subject = suggestionSubject({ notes, context, focus, rootOverride }, nameMode);
  const notesRoot = effectiveNotesRoot({ notes, rootOverride });

  const handleApply = (nextContext: MenuContext) => {
    setPreview(null);
    setContext(nextContext);
  };

  return (
    <SuggestionsPanel
      subject={subject}
      suggestionsMode="chords"
      nameMode={nameMode}
      notesRoot={notesRoot}
      chordFocus={chordFocus}
      harmonyMode={harmonyMode}
      onHarmonyModeChange={setHarmonyMode}
      onToggleChordFocus={toggleChordFocus}
      onClearChordFocus={clearChordFocus}
      onSelectLayer={setFocus}
      onPreview={setPreview}
      onApply={handleApply}
    />
  );
}
