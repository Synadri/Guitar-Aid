import { useId } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { chordDisplayName, pcName, type NameMode, type PitchClass } from '../../theory';
import {
  infoPanelModel,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type InfoPanelModel,
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
  onRootChange,
}: InfoPanelProps) {
  const baseId = useId();
  const rootHeadingId = `${baseId}-root-heading`;
  const notesHeadingId = `${baseId}-notes-heading`;
  const chordsHeadingId = `${baseId}-chords-heading`;
  const contextHeadingId = `${baseId}-context-heading`;
  const warningsHeadingId = `${baseId}-warnings-heading`;

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

  return (
    <section
      className={styles.panel}
      aria-label={INFO_PANEL_TEXTS.regionLabel}
      aria-live="polite"
      data-testid="info-panel"
    >
      <div className={styles.header}>
        <h2 className={styles.title}>{INFO_PANEL_TEXTS.heading}</h2>
      </div>

      <section
        className={styles.section}
        aria-labelledby={rootHeadingId}
        data-testid="root-section"
      >
        <h3 id={rootHeadingId} className={styles.sectionTitle}>
          {INFO_PANEL_TEXTS.rootHeading}
        </h3>
        <div className={styles.rootControl}>
          <div className={styles.rootRow}>
            <label className={styles.rootLabel}>
              {INFO_PANEL_TEXTS.rootLabel}
              <select
                className={styles.select}
                aria-label={INFO_PANEL_TEXTS.rootLabel}
                value={selectValue}
                onChange={(e) => handleRootSelectChange(e.target.value)}
              >
                <option value="auto">{INFO_PANEL_TEXTS.rootAutoOption}</option>
                {PITCH_CLASSES.map((pc) => (
                  <option key={pc} value={String(pc)}>
                    {pcName(pc, nameMode)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.effectiveRoot} data-testid="effective-root">
            {INFO_PANEL_TEXTS.effectiveRootLabel}: <strong>{effectiveRootDisplay}</strong>
          </p>
        </div>
      </section>

      {!hasSelection && (
        <p className={styles.empty} data-testid="info-empty">
          {INFO_PANEL_TEXTS.emptyPrompt}
        </p>
      )}

      {hasNotes && model.notes && (
        <section
          className={styles.section}
          aria-labelledby={notesHeadingId}
          data-testid="notes-section"
        >
          <h3 id={notesHeadingId} className={styles.sectionTitle}>
            {INFO_PANEL_TEXTS.selectedNotesHeading}
          </h3>
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
                  <th scope="col">{INFO_PANEL_TEXTS.noteColumnHeader}</th>
                  <th scope="col">{INFO_PANEL_TEXTS.fromRootColumnHeader}</th>
                  <th scope="col">{INFO_PANEL_TEXTS.fromPreviousColumnHeader}</th>
                </tr>
              </thead>
              <tbody>
                {model.notes.rows.map((row) => (
                  <tr key={row.midi} className={styles.noteRow} data-testid="selected-note-row">
                    <td className={styles.noteName}>{row.name}</td>
                    <td className={styles.noteCell} data-testid="note-from-root">
                      {row.fromRoot
                        ? `${row.fromRoot.long} (${row.fromRoot.short} · ${row.fromRoot.degree})`
                        : '—'}
                    </td>
                    <td className={styles.noteCell} data-testid="note-from-previous">
                      {row.fromPrevious
                        ? `+${row.fromPrevious.semitones} st (${row.fromPrevious.short} · ${row.fromPrevious.long})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showChordAnalysis && model.notes && (
        <section
          className={`${styles.section} ${styles.chordsSection}`}
          aria-labelledby={chordsHeadingId}
          data-testid="chord-analysis-section"
        >
          <h3 id={chordsHeadingId} className={styles.sectionTitle}>
            {INFO_PANEL_TEXTS.chordsHeading}
          </h3>
          {model.notes.chords.length > 0 ? (
            <div
              className={`${styles.scrollArea} ${styles.chordScrollArea}`}
              tabIndex={0}
              role="region"
              aria-label={INFO_PANEL_TEXTS.chordsScrollLabel}
              data-testid="chords-scroll-area"
            >
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
            </div>
          ) : (
            <p className={styles.noChord} data-testid="no-chord-recognized">
              {INFO_PANEL_TEXTS.noChordRecognized}
            </p>
          )}
        </section>
      )}

      {model.context && (
        <section
          className={styles.section}
          aria-labelledby={contextHeadingId}
          data-testid="context-section"
        >
          <h3 id={contextHeadingId} className={styles.sectionTitle}>
            {INFO_PANEL_TEXTS.contextHeading}
          </h3>
          <p className={styles.contextTitle} data-testid="context-title">
            {model.context.title}
          </p>
          <ul className={styles.contextToneList} data-testid="context-tones-list">
            {model.context.tones.map((tone) => (
              <li key={tone.pc} className={styles.contextToneItem} data-testid="context-tone">
                <span className={styles.toneName}>{tone.name}</span>
                <span className={styles.toneMeta}>
                  <span>
                    {tone.interval.long} ({tone.interval.short})
                  </span>
                  <span>Grado {tone.interval.degree}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.unplayableNotes.length > 0 && (
        <section
          className={styles.section}
          aria-labelledby={warningsHeadingId}
          data-testid="warnings-section"
        >
          <h3 id={warningsHeadingId} className={styles.sectionTitle}>
            {INFO_PANEL_TEXTS.warningsHeading}
          </h3>
          <div className={styles.warning} role="note" data-testid="unplayable-warning">
            {INFO_PANEL_TEXTS.unplayableWarning(model.unplayableNotes)}
          </div>
        </section>
      )}
    </section>
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
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const unplayableMidis = useStore(sandboxStore, (s) => s.unplayableMidis);
  const setRootOverride = useStore(sandboxStore, (s) => s.setRootOverride);

  const model = infoPanelModel(
    {
      tuning,
      notes,
      context,
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
      onRootChange={setRootOverride}
    />
  );
}
