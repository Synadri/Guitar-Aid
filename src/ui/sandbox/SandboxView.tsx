import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  DEFAULT_FRETS,
  getScaleType,
  positionToMidi,
  type FretPosition,
  type StringNumber,
} from '../../theory';
import {
  DEFAULT_PIANO_RANGE,
  bindSettingsToSandbox,
  chordFocusVoicings,
  contextVoicings,
  effectiveNotesRoot,
  fretboardMarks,
  pianoMarks,
  resolveFocus,
  sandboxStore as defaultSandboxStore,
  selectedChordFocusVoicing,
  selectedVoicing,
  settingsStore as defaultSettingsStore,
  suggestionSubject,
  type SandboxStore,
  type SettingsStore,
} from '../../state';
import {
  arpeggioEvents,
  audioEngine as defaultAudioEngine,
  chordEvents,
  chordFallbackMidis,
  playEvents,
  scaleEvents,
  type AudioEngine,
} from '../../audio';
import { TopBar } from '../toolbar/TopBar';
import { ContextStrip } from './ContextStrip';
import { Fretboard } from '../instruments/Fretboard';
import { Piano } from '../instruments/Piano';
import { SandboxInfoPanel } from '../panels/InfoPanel';
import { SandboxSuggestionsPanel } from '../panels/SuggestionsPanel';
import { ScalesPanel } from '../panels/ScalesPanel';
import styles from './SandboxView.module.css';

export const SINGLE_INSTRUMENT_NOTICE = 'Siempre queda un instrumento visible';

export interface SandboxViewProps {
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  audioEngine?: AudioEngine;
}

export function SandboxView({
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  audioEngine = defaultAudioEngine,
}: SandboxViewProps) {
  useEffect(() => {
    return bindSettingsToSandbox(settingsStore, sandboxStore);
  }, [settingsStore, sandboxStore]);

  // Estado del Sandbox
  const notes = useStore(sandboxStore, (s) => s.notes);
  const context = useStore(sandboxStore, (s) => s.context);
  const preview = useStore(sandboxStore, (s) => s.preview);
  const tuning = useStore(sandboxStore, (s) => s.tuning);
  const showAllPositions = useStore(sandboxStore, (s) => s.showAllPositions);
  const voicingIndex = useStore(sandboxStore, (s) => s.voicingIndex);
  const focus = useStore(sandboxStore, (s) => s.focus);
  const rootOverride = useStore(sandboxStore, (s) => s.rootOverride);
  const chordFocus = useStore(sandboxStore, (s) => s.chordFocus);

  // Estado de Ajustes
  const visibleInstruments = useStore(settingsStore, (s) => s.visibleInstruments);
  const leftHanded = useStore(settingsStore, (s) => s.leftHanded);
  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const labels = useStore(settingsStore, (s) => s.labels);
  const volume = useStore(settingsStore, (s) => s.volume);
  const soundEnabled = useStore(settingsStore, (s) => s.soundEnabled);

  // Sincronización del motor de audio
  useEffect(() => {
    audioEngine?.setSoundEnabled?.(soundEnabled);
    audioEngine?.setVolume?.(volume);
  }, [audioEngine, soundEnabled, volume]);

  const activeLayer = resolveFocus({ notes, context, focus });
  const subject = useMemo(
    () => suggestionSubject({ notes, context, focus, rootOverride }, nameMode),
    [notes, context, focus, rootOverride, nameMode],
  );
  const notesRoot = useMemo(
    () => effectiveNotesRoot({ notes, rootOverride }),
    [notes, rootOverride],
  );
  const canPlayChordAndArpeggio =
    activeLayer === 'notes' ||
    (activeLayer === 'context' && context?.kind === 'chord') ||
    chordFocus !== null;
  const canPlayScale = activeLayer === 'context' && context?.kind === 'scale';

  const syncEngineSettings = () => {
    const currentSettings = settingsStore.getState();
    audioEngine?.setSoundEnabled?.(currentSettings.soundEnabled);
    audioEngine?.setVolume?.(currentSettings.volume);
    return currentSettings;
  };

  const resolveActiveChordOrNoteMidis = (): number[] => {
    if (activeLayer === 'notes' && !chordFocus) {
      return notes.map((n) => n.midi);
    }
    if (chordFocus) {
      const voicing = selectedChordFocusVoicing({ chordFocus, tuning });
      return voicing
        ? [...voicing.midis]
        : chordFallbackMidis(chordFocus.chord.root, chordFocus.chord.quality);
    }
    if (activeLayer === 'context' && context?.kind === 'chord') {
      const voicing = selectedVoicing({ context, tuning, voicingIndex });
      return voicing ? [...voicing.midis] : chordFallbackMidis(context.root, context.quality);
    }
    return [];
  };

  // Atajos globales de teclado: C (limpiar), M (sonido), Esc (cerrar menús/foco)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        sandboxStore.getState().clear();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const nextSound = !settingsStore.getState().soundEnabled;
        settingsStore.getState().setSoundEnabled(nextSound);
        audioEngine?.setSoundEnabled?.(nextSound);
      } else if (e.key === 'Escape') {
        sandboxStore.getState().clearChordFocus();
        sandboxStore.getState().setPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sandboxStore, settingsStore, audioEngine]);

  // Cálculo reactivo de marcas para el mástil y el piano
  const markState = useMemo(
    () => ({
      notes,
      context,
      preview,
      chordFocus,
      tuning,
      showAllPositions,
      voicingIndex,
      labels,
      nameMode,
      rootOverride,
    }),
    [
      notes,
      context,
      preview,
      chordFocus,
      tuning,
      showAllPositions,
      voicingIndex,
      labels,
      nameMode,
      rootOverride,
    ],
  );

  const fretMarks = fretboardMarks(markState, { nameMode, labels });
  const keyMarks = pianoMarks(markState, { nameMode, labels });
  const activeVoicings = chordFocus
    ? chordFocusVoicings({ chordFocus, tuning })
    : contextVoicings({ context, tuning });

  const mutedStrings = useMemo<StringNumber[]>(() => {
    const activeVoicing = chordFocus
      ? chordFocus.mode === 'voicing'
        ? selectedChordFocusVoicing({ chordFocus, tuning })
        : null
      : context?.kind === 'chord'
        ? selectedVoicing({ context, tuning, voicingIndex })
        : null;
    if (!activeVoicing) return [];
    const out: StringNumber[] = [];
    for (let s = 1; s <= 6; s++) {
      const str = s as StringNumber;
      if (activeVoicing.frets[6 - str] === 'x') {
        out.push(str);
      }
    }
    return out;
  }, [chordFocus, context, tuning, voicingIndex]);

  // Manejo de interacción en el mástil
  const handlePositionClick = (pos: FretPosition) => {
    const currentState = sandboxStore.getState();
    const midi = positionToMidi(currentState.tuning, pos);
    const existing = currentState.notes.find((n) => n.midi === midi);
    const wasPinned =
      existing?.pinned.some((p) => p.string === pos.string && p.fret === pos.fret) ?? false;

    sandboxStore.getState().toggleFretPosition(pos);

    if (!wasPinned) {
      const currentSettings = syncEngineSettings();
      if (currentSettings.soundEnabled) {
        audioEngine?.playNote?.(midi);
      }
    }
  };

  const handlePositionRightClick = (pos: FretPosition) => {
    const midi = positionToMidi(tuning, pos);
    const pc = (midi % 12) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
    sandboxStore.getState().setRootOverride(pc);
  };

  // Manejo de interacción en el piano
  const handleKeyClick = (midi: number) => {
    const currentState = sandboxStore.getState();
    const wasActive = currentState.notes.some((n) => n.midi === midi);

    sandboxStore.getState().togglePianoKey(midi);

    if (!wasActive) {
      const currentSettings = syncEngineSettings();
      if (currentSettings.soundEnabled) {
        audioEngine?.playNote?.(midi);
      }
    }
  };

  // Reproducción de audio
  const handlePlayChord = () => {
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const midis = resolveActiveChordOrNoteMidis();
    playEvents(chordEvents(midis), audioEngine);
  };

  const handlePlayArpeggio = () => {
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const midis = resolveActiveChordOrNoteMidis();
    playEvents(arpeggioEvents(midis), audioEngine);
  };

  const handlePlayScale = () => {
    if (activeLayer !== 'context' || context?.kind !== 'scale') return;
    const currentSettings = syncEngineSettings();
    if (!currentSettings.soundEnabled) return;
    const scaleType = getScaleType(context.type);
    playEvents(scaleEvents(context.root, scaleType.intervals), audioEngine);
  };

  const isOnlyOneInstrumentVisible =
    (visibleInstruments.fretboard && !visibleInstruments.piano) ||
    (!visibleInstruments.fretboard && visibleInstruments.piano);

  return (
    <div
      className={styles.sandbox}
      data-testid="sandbox-container"
      data-theme="dark"
      role="application"
      aria-label="Guitar Aid Sandbox"
    >
      {/* Barra superior (fila única) */}
      <TopBar
        context={context}
        onSelectContext={(ctx) => {
          sandboxStore.getState().setPreview(null);
          sandboxStore.getState().setContext(ctx);
        }}
        onPreviewContext={(ctx) => sandboxStore.getState().setPreview(ctx)}
        nameMode={nameMode}
        onNameModeChange={(mode) => settingsStore.getState().setNameMode(mode)}
        labels={labels}
        onLabelsChange={(lbl) => settingsStore.getState().setLabels(lbl)}
        tuning={tuning}
        onTuningChange={(tId) => settingsStore.getState().setTuning(tId)}
        showAllPositions={showAllPositions}
        onShowAllPositionsChange={(show) => settingsStore.getState().setShowAllPositions(show)}
        leftHanded={leftHanded}
        onLeftHandedChange={(lh) => settingsStore.getState().setLeftHanded(lh)}
        visibleInstruments={visibleInstruments}
        onToggleInstrument={(inst) => settingsStore.getState().toggleInstrument(inst)}
        volume={volume}
        onVolumeChange={(vol) => {
          settingsStore.getState().setVolume(vol);
          audioEngine?.setVolume?.(vol);
        }}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          settingsStore.getState().setSoundEnabled(next);
          audioEngine?.setSoundEnabled?.(next);
        }}
        onClear={() => sandboxStore.getState().clear()}
        onPlayChord={handlePlayChord}
        onPlayArpeggio={handlePlayArpeggio}
        onPlayScale={handlePlayScale}
        canPlayChordAndArpeggio={canPlayChordAndArpeggio}
        canPlayScale={canPlayScale}
        playbackDisabled={!canPlayChordAndArpeggio && !canPlayScale}
      />

      {/* Aviso accesible si solo queda un instrumento visible */}
      {isOnlyOneInstrumentVisible && (
        <span data-testid="single-instrument-notice" className={styles.visuallyHidden}>
          {SINGLE_INSTRUMENT_NOTICE}
        </span>
      )}

      {/* Área de instrumentos a ancho completo (Franja + Mástil + Piano) */}
      <div className={styles.instrumentsArea} data-testid="instruments-area">
              {/* Franja de contexto */}
              <ContextStrip
                context={context}
                chordFocus={chordFocus}
                notes={notes}
                activeLayer={activeLayer}
                onSelectLayer={(l) => sandboxStore.getState().setFocus(l)}
                tuning={tuning}
                activeVoicings={activeVoicings}
                voicingIndex={chordFocus ? chordFocus.voicingIndex : voicingIndex}
                onVoicingIndexChange={(idx) => {
                  if (chordFocus) {
                    sandboxStore.getState().setChordFocusVoicingIndex(idx);
                  } else {
                    sandboxStore.getState().setVoicingIndex(idx);
                  }
                }}
                onClearChordFocus={() => sandboxStore.getState().clearChordFocus()}
                onPromoteChordFocus={
                  chordFocus
                    ? () =>
                        sandboxStore.getState().setContext({
                          kind: 'chord',
                          root: chordFocus.chord.root,
                          quality: chordFocus.chord.quality,
                        })
                    : undefined
                }
                onSetChordFocusMode={(mode) => sandboxStore.getState().setChordFocusMode(mode)}
                nameMode={nameMode}
                labels={labels}
                onLabelsChange={(lbl) => settingsStore.getState().setLabels(lbl)}
              />

              {/* Mástil */}
              {visibleInstruments.fretboard && (
                <Fretboard
                  tuning={tuning}
                  frets={DEFAULT_FRETS}
                  leftHanded={leftHanded}
                  marks={fretMarks}
                  mutedStrings={mutedStrings}
                  nameMode={nameMode}
                  onPositionClick={handlePositionClick}
                  onPositionRightClick={handlePositionRightClick}
                />
              )}

              {/* Piano */}
              {visibleInstruments.piano && (
                <Piano
                  range={DEFAULT_PIANO_RANGE}
                  marks={keyMarks}
                  nameMode={nameMode}
                  onKeyClick={handleKeyClick}
                />
              )}
            </div>

            {/* 4. Dashboard inferior en Grid de 3 columnas */}
            <div
              className={styles.dashboard}
              data-testid="dashboard"
              role="region"
              aria-label="Panel de análisis y contexto"
            >
              {/* Columna 1 — Selección y Contexto */}
              <div className={styles.dashboardColumn} data-testid="dashboard-col-1">
                <header className={styles.dashboardColumnHeader}>
                  <h2 className={styles.columnTitle}>Selección y Contexto</h2>
                  <span className={styles.columnHint}>
                    {activeLayer === 'notes'
                      ? 'Notas pulsadas'
                      : context
                        ? 'Contexto de menú'
                        : 'Sin selección'}
                  </span>
                </header>
                <div className={styles.dashboardColumnContent}>
                  <SandboxInfoPanel sandboxStore={sandboxStore} settingsStore={settingsStore} />
                </div>
              </div>

              {/* Columna 2 — Armonía y Progresiones */}
              <div className={styles.dashboardColumn} data-testid="dashboard-col-2">
                <header className={styles.dashboardColumnHeader}>
                  <h2 className={styles.columnTitle}>Armonía y Progresiones</h2>
                  <span className={styles.columnHint}>
                    {activeLayer === 'context' && context?.kind === 'scale'
                      ? 'clic = foco'
                      : 'progresiones'}
                  </span>
                </header>
                <div className={styles.dashboardColumnContent}>
                  <SandboxSuggestionsPanel
                    sandboxStore={sandboxStore}
                    settingsStore={settingsStore}
                  />
                </div>
              </div>

              {/* Columna 3 — Escalas */}
              <div className={styles.dashboardColumn} data-testid="dashboard-col-3">
                <header className={styles.dashboardColumnHeader}>
                  <h2 className={styles.columnTitle}>Escalas</h2>
                  <span className={styles.columnHint}>
                    {activeLayer === 'context' && context?.kind === 'scale'
                      ? 'relativas · cercanas'
                      : 'escalas compatibles'}
                  </span>
                </header>
                <div className={styles.dashboardColumnContent}>
                  <ScalesPanel
                    context={context}
                    subject={subject}
                    notesRoot={notesRoot}
                    chordFocus={chordFocus}
                    nameMode={nameMode}
                    onSelectContext={(ctx) => {
                      sandboxStore.getState().setPreview(null);
                      sandboxStore.getState().setContext(ctx);
                    }}
                    onPreviewScale={(scale) => {
                      if (scale) {
                        sandboxStore
                          .getState()
                          .setPreview({ kind: 'scale', root: scale.tonic, type: scale.type });
                      } else {
                        sandboxStore.getState().setPreview(null);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
    </div>
  );
}
