import { useId } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { chordDisplayName, pcName, type NameMode, type PitchClass } from '../../theory';
import {
  infoPanelModel,
  resolveFocus,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type InfoPanelModel,
  type SandboxLayer,
  type SandboxStore,
  type SettingsStore,
} from '../../state';
import { INFO_PANEL_TEXTS, formatReason } from './texts';
import styles from './InfoPanel.module.css';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface InfoPanelProps {
  model: InfoPanelModel;
  nameMode?: NameMode;
  rootOverride?: PitchClass | null;
  activeLayer?: SandboxLayer | null;
  onRootChange?: (root: PitchClass | null) => void;
}

/**
 * Componente presentacional del panel de información (Hito U3).
 * Recibe el modelo calculado por `infoPanelModel` y las callbacks por props.
 */
export function InfoPanel({
  model,
  nameMode = 'sharps',
  rootOverride,
  activeLayer,
  onRootChange,
}: InfoPanelProps) {
  const baseId = useId();
  const rootHeadingId = `${baseId}-root-heading`;
  const chordsHeadingId = `${baseId}-chords-heading`;
  const contextHeadingId = `${baseId}-context-heading`;

  const resolvedRootOverride: PitchClass | null =
    rootOverride !== undefined
      ? rootOverride
      : model.notes?.rootMode === 'manual'
        ? (model.notes.root?.pc ?? null)
        : null;

  const selectValue = resolvedRootOverride === null ? 'auto' : String(resolvedRootOverride);

  const effectiveRootDisplay = (() => {
    if (model.notes?.root) {
      const modeText = model.notes.rootMode === 'manual' ? 'manual' : 'automática';
      return `${pcName(model.notes.root.pc, nameMode)} (${modeText})`;
    }
    if (resolvedRootOverride !== null) {
      return `${pcName(resolvedRootOverride, nameMode)} (manual)`;
    }
    if (model.context) {
      return `${pcName(model.context.root.pc, nameMode)} (tónica)`;
    }
    return 'Automática (nota más grave)';
  })();

  const handleRootSelectChange = (value: string) => {
    if (!onRootChange) return;
    if (value === 'auto' || value === '') {
      onRootChange(null);
      return;
    }
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 11) {
      onRootChange(numeric as PitchClass);
    }
  };

  const hasNotes = model.notes !== null && model.notes.rows.length > 0;
  const hasSelection = hasNotes || model.context !== null;
  const showChordAnalysis =
    model.notes !== null && (model.notes.rows.length >= 3 || model.notes.chords.length > 0);

  // Si hay contexto de menú activo
  const contextParts = model.context?.title.split(' · ') ?? [];
  const contextMainTitle = contextParts[0] ?? model.context?.title ?? '';
  const contextSubtitle = model.context?.subtitle ?? contextParts[1] ?? '';

  const showContextSection = model.context !== null && (!hasNotes || activeLayer !== 'notes');
  const showNotesSection =
    hasNotes && model.notes !== null && (!model.context || activeLayer === 'notes');

  return (
    <div
      className={styles.panel}
      role="region"
      aria-label="Información de la selección"
      aria-live="polite"
      data-testid="info-panel"
    >
      {/* Sección RAÍZ: siempre presente para configurar o consultar la raíz */}
      <section
        className={styles.rootSection}
        role="region"
        aria-label="Raíz"
        data-testid="root-section"
      >
        <div className={styles.rootControlCompact}>
          <label className={styles.rootLabel} id={rootHeadingId}>
            Raíz
            <select
              className={styles.rootSelect}
              aria-label="Raíz"
              value={selectValue}
              onChange={(e) => handleRootSelectChange(e.target.value)}
            >
              <option value="auto">Automática</option>
              {PITCH_CLASSES.map((pc) => (
                <option key={pc} value={String(pc)}>
                  {pcName(pc, nameMode)}
                </option>
              ))}
            </select>
          </label>
          <span data-testid="effective-root" className={styles.effectiveRootText}>
            {effectiveRootDisplay}
          </span>
        </div>
      </section>

      {!hasSelection && (
        <div className={styles.emptyContainer} data-testid="info-empty">
          <p className={styles.empty}>{INFO_PANEL_TEXTS.emptyPrompt}</p>
        </div>
      )}

      {/* CASO 1: Contexto de Menú activo (Acorde o Escala) */}
      {showContextSection && model.context && (
        <section
          className={styles.section}
          role="region"
          aria-label="Contexto del menú"
          data-testid="context-section"
        >
          <div className={styles.titleRow}>
            <h2 id={contextHeadingId} className={styles.mainTitle} data-testid="context-title">
              {contextMainTitle}
            </h2>
            {contextSubtitle && (
              <span className={styles.subtitleText} data-testid="context-subtitle">
                {contextSubtitle}
              </span>
            )}
          </div>

          {model.chordFocus && (
            <div className={styles.chordFocusCard} data-testid="chord-focus-info">
              <div className={styles.chordFocusHeader}>
                <span className={styles.chordFocusLabel}>Acorde en foco:</span>
                <strong className={styles.chordFocusTitle}>
                  {model.chordFocus.degree ? `${model.chordFocus.degree} · ` : ''}
                  {model.chordFocus.title}
                </strong>
              </div>
              <div className={styles.chordFocusFormula}>
                <span>{model.chordFocus.tones.map((t) => t.name).join(' – ')}</span>
                <span className={styles.chordFocusDegrees}>
                  ({model.chordFocus.tones.map((t) => t.interval.degree).join(' · ')})
                </span>
              </div>
            </div>
          )}

          <table className={styles.notesTable} data-testid="context-tones-list">
            <thead>
              <tr>
                <th scope="col">Nota</th>
                <th scope="col">Intervalo</th>
                <th scope="col">Grado</th>
              </tr>
            </thead>
            <tbody>
              {model.context.tones.map((tone) => {
                const isRoot = tone.pc === model.context?.root.pc;
                return (
                  <tr key={tone.pc} className={styles.noteRow} data-testid="context-tone">
                    <td className={styles.noteNameCol}>
                      <span
                        className={isRoot ? styles.dotRoot : styles.dotContext}
                        aria-hidden="true"
                      />
                      <span className={styles.noteNameText}>{tone.name}</span>
                    </td>
                    <td className={styles.intervalCol} data-testid="note-from-root">
                      {tone.interval.long}
                    </td>
                    <td className={styles.degreeCol}>
                      <span className={styles.visuallyHidden}>Grado </span>
                      {tone.interval.degree}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* CASO 2: Notas manuales pulsadas */}
      {showNotesSection && model.notes && (
        <section
          className={styles.section}
          role="region"
          aria-label="Notas seleccionadas"
          data-testid="notes-section"
        >
          <div className={styles.titleRow}>
            <h2 className={styles.mainTitle}>Notas pulsadas ({model.notes.rows.length})</h2>
          </div>

          <div
            className={styles.scrollArea}
            tabIndex={0}
            role="region"
            aria-label={INFO_PANEL_TEXTS.notesScrollLabel}
            data-testid="notes-scroll-area"
          >
            <table className={styles.notesTable} data-testid="selected-notes-list">
              <thead>
                <tr>
                  <th scope="col">Nota</th>
                  <th scope="col">Intervalo desde la raíz</th>
                  <th scope="col">Desde la anterior</th>
                </tr>
              </thead>
              <tbody>
                {model.notes.rows.map((row) => (
                  <tr key={row.midi} className={styles.noteRow} data-testid="selected-note-row">
                    <td className={styles.noteNameCol}>
                      <span className={styles.dotPinned} aria-hidden="true" />
                      <span className={styles.noteNameText}>{row.name}</span>
                    </td>
                    <td className={styles.intervalCol} data-testid="note-from-root">
                      {row.fromRoot
                        ? `${row.fromRoot.long} (${row.fromRoot.short} · ${row.fromRoot.degree})`
                        : '—'}
                    </td>
                    <td className={styles.degreeCol} data-testid="note-from-previous">
                      {row.fromPrevious
                        ? `+${row.fromPrevious.semitones} st (${row.fromPrevious.short} · ${row.fromPrevious.long})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detección de acordes para notas pulsadas */}
          {showChordAnalysis && (
            <section
              className={styles.chordsBlock}
              role="region"
              aria-label="Acordes posibles"
              data-testid="chord-analysis-section"
            >
              <h3 id={chordsHeadingId} className={styles.subHeading}>
                Acordes posibles
              </h3>
              {model.notes.chords.length > 0 ? (
                <ul className={styles.chordList} data-testid="chord-candidates">
                  {model.notes.chords.map((candidate) => {
                    const displayName = chordDisplayName(candidate.value, nameMode);
                    const reasonsText = candidate.reasons
                      .map((r) => formatReason(r, nameMode))
                      .join(' · ');
                    return (
                      <li
                        key={`${candidate.value.root}-${candidate.value.quality}-${candidate.value.bass ?? 'root'}`}
                        className={styles.chordItem}
                        data-testid="chord-candidate"
                      >
                        <strong className={styles.chordName} data-testid="chord-candidate-name">
                          {displayName}
                        </strong>
                        <span className={styles.chordReasons} data-testid="chord-candidate-reasons">
                          {reasonsText}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.noChord} data-testid="no-chord-recognized">
                  {INFO_PANEL_TEXTS.noChordRecognized}
                </p>
              )}
            </section>
          )}
        </section>
      )}

      {/* Alerta de notas no tocables en afinación actual */}
      {model.unplayableNotes.length > 0 && (
        <section
          className={styles.warningSection}
          role="region"
          aria-label="Avisos"
          data-testid="warnings-section"
        >
          <div className={styles.warning} role="note" data-testid="unplayable-warning">
            {INFO_PANEL_TEXTS.unplayableWarning(model.unplayableNotes)}
          </div>
        </section>
      )}

      {/* LEYENDA inferior común */}
      {hasSelection && (
        <div className={styles.legend}>
          <div className={styles.legendTitle}>Leyenda</div>
          <div className={styles.legendGrid}>
            <span className={styles.legendItem}>
              <span className={styles.dotPinned} /> Pulsada
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotRoot} /> Raíz
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotContext} /> Contexto
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotEquivalent} /> Equivalente
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotScaleBg} /> Fondo escala
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotPreview} /> Previsualización
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SandboxInfoPanelProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
}

/**
 * Contenedor que conecta `InfoPanel` con `sandboxStore` y `settingsStore`.
 */
export function SandboxInfoPanel({
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
}: SandboxInfoPanelProps = {}) {
  const nameMode = useStore(settingsStore, (s) => s.nameMode);

  const tuning = useStore(sandboxStore, (s) => s.tuning);
  const notes = useStore(sandboxStore, (s) => s.notes);
  const context = useStore(sandboxStore, (s) => s.context);
  const focus = useStore(sandboxStore, (s) => s.focus);
  const chordFocus = useStore(sandboxStore, (s) => s.chordFocus);
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const unplayableMidis = useStore(sandboxStore, (s) => s.unplayableMidis);
  const setRootOverride = useStore(sandboxStore, (s) => s.setRootOverride);

  const activeLayer = resolveFocus({ notes, context, focus });

  const model = infoPanelModel(
    {
      tuning,
      notes,
      context,
      chordFocus,
      rootOverride,
      voicingIndex,
      unplayableMidis,
    },
    nameMode,
  );

  return (
    <InfoPanel
      model={model}
      nameMode={nameMode}
      rootOverride={rootOverride}
      activeLayer={activeLayer}
      onRootChange={setRootOverride}
    />
  );
}
