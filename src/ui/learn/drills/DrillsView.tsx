import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  drillsStore as defaultDrillsStore,
  settingsStore as defaultSettingsStore,
  selectDrillFretboardMarks,
  selectDrillPianoMarks,
  type DrillsStore,
  type SettingsStore,
} from '../../../state';
import {
  audioEngine as defaultAudioEngine,
  type AudioEngine,
  intervalEvents,
  arpeggioEvents,
  playEvents,
} from '../../../audio';
import {
  positionToMidi,
  pitchClassOf,
  pcName,
  toMidi,
  formulaOfScale,
  formulaOfChord,
  STANDARD_TUNING,
  type FretPosition,
  type PitchClass,
  type StringNumber,
  type NameMode,
  type ScaleTypeId,
  type ChordQualityId,
} from '../../../theory';
import {
  DRILL_CATALOG,
  type DrillQuestion,
  samePosition,
} from '../../../learning';
import { Fretboard, Piano, type PianoRange } from '../../instruments';
import styles from './DrillsView.module.css';

export interface DrillsViewProps {
  drillsStore?: StoreApi<DrillsStore>;
  settingsStore?: StoreApi<SettingsStore>;
  audioEngine?: AudioEngine;
}

const DEGREE_PILLS = [
  '1',
  '♭2',
  '2',
  '♭3',
  '3',
  '4',
  '♭5',
  '5',
  '♯5',
  '6',
  '♭7',
  '7',
  '9',
] as const;

const INTERVAL_BUTTONS: readonly {
  semitones: number;
  shortName: string;
  longName: string;
}[] = [
  { semitones: 1, shortName: 'm2', longName: '2ª menor' },
  { semitones: 2, shortName: 'M2', longName: '2ª mayor' },
  { semitones: 3, shortName: 'm3', longName: '3ª menor' },
  { semitones: 4, shortName: 'M3', longName: '3ª mayor' },
  { semitones: 5, shortName: 'P4', longName: '4ª justa' },
  { semitones: 6, shortName: 'TT', longName: 'Tritono' },
  { semitones: 7, shortName: 'P5', longName: '5ª justa' },
  { semitones: 8, shortName: 'm6', longName: '6ª menor' },
  { semitones: 9, shortName: 'M6', longName: '6ª mayor' },
  { semitones: 10, shortName: 'm7', longName: '7ª menor' },
  { semitones: 11, shortName: 'M7', longName: '7ª mayor' },
  { semitones: 12, shortName: 'P8', longName: 'Octava' },
];

const NATURAL_PCS: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
const ALL_PCS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Formatea el título del ejercicio resaltando el objetivo principal en turquesa. */
function renderQuestionTitle(
  q: DrillQuestion | null,
  onScaleClick?: () => void,
) {
  if (!q) return null;
  const prompt = q.prompt as Record<string, unknown> | null;
  const title = typeof prompt?.title === 'string' ? prompt.title : '';
  if (!title) return null;

  const targets: string[] = [];
  if (q.drill === 'A1' && typeof prompt?.noteName === 'string') {
    targets.push(prompt.noteName);
  } else if (q.drill === 'A2' && prompt?.position) {
    const pos = prompt.position as FretPosition;
    targets.push(`cuerda ${pos.string}, traste ${pos.fret}`);
  } else if (q.drill === 'B1' || q.drill === 'B2') {
    if (typeof prompt?.intervalLongName === 'string') {
      targets.push(prompt.intervalLongName);
    } else if (typeof prompt?.intervalName === 'string') {
      targets.push(prompt.intervalName);
    }
  } else if (q.drill === 'B3') {
    if (typeof prompt?.fromNoteName === 'string') targets.push(prompt.fromNoteName);
    if (typeof prompt?.toNoteName === 'string') targets.push(prompt.toNoteName);
  } else if (q.drill === 'B4') {
    if (typeof prompt?.intervalName === 'string') targets.push(prompt.intervalName);
    if (typeof prompt?.referenceNoteName === 'string') targets.push(prompt.referenceNoteName);
  } else if (q.drill === 'B5' && typeof prompt?.chordName === 'string') {
    targets.push(prompt.chordName);
  } else if (q.drill === 'C1' && typeof prompt?.chordName === 'string') {
    targets.push(prompt.chordName);
  } else if (q.drill === 'C2' && typeof prompt?.scaleName === 'string') {
    targets.push(prompt.scaleName);
  }

  if (targets.length === 0) {
    return title;
  }

  const escaped = targets.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = title.split(regex);

  return parts.map((part, index) => {
    if (targets.includes(part)) {
      if (
        (q.drill === 'C1' || q.drill === 'C2') &&
        onScaleClick &&
        ((q.drill === 'C2' && typeof prompt?.scaleName === 'string' && part === prompt.scaleName) ||
          (q.drill === 'C1' && typeof prompt?.chordName === 'string' && part === prompt.chordName))
      ) {
        return (
          <span
            key={index}
            className={`${styles.highlightTurquoise ?? ''} ${styles.scaleTitleClickable ?? ''}`}
            onClick={onScaleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onScaleClick();
              }
            }}
            title={
              q.drill === 'C1'
                ? 'Haz clic para ver los grados del acorde (-50% puntos)'
                : 'Haz clic para ver los grados de la escala (-50% puntos)'
            }
            data-testid={q.drill === 'C1' ? 'c1-chord-title-clickable' : 'c2-scale-title-clickable'}
          >
            {part}
          </span>
        );
      }
      return (
        <span key={index} className={styles.highlightTurquoise}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export function DrillsView({
  drillsStore = defaultDrillsStore,
  settingsStore = defaultSettingsStore,
  audioEngine = defaultAudioEngine,
}: DrillsViewProps) {
  const store = drillsStore;
  const drillId = useStore(store, (s) => s.drillId);
  const phase = useStore(store, (s) => s.phase);
  const config = useStore(store, (s) => s.config);
  const currentQuestion = useStore(store, (s) => s.currentQuestion);
  const questionNumber = useStore(store, (s) => s.questionNumber);
  const totalQuestions = useStore(store, (s) => s.totalQuestions);
  const pinnedPositions = useStore(store, (s) => s.pinnedPositions);
  const selectedChoice = useStore(store, (s) => s.selectedChoice);
  const assignedLabels = useStore(store, (s) => s.assignedLabels);
  const lastGrade = useStore(store, (s) => s.lastGrade);
  const sessionStats = useStore(store, (s) => s.sessionStats);

  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const leftHanded = useStore(settingsStore, (s) => s.leftHanded);
  const soundEnabled = useStore(settingsStore, (s) => s.soundEnabled);

  const activeDrillInfo = DRILL_CATALOG.find((d) => d.id === drillId) ?? DRILL_CATALOG[0]!;
  const tuning = config.tuning ?? STANDARD_TUNING;
  const effectiveNameMode: NameMode = config.nameMode ?? nameMode ?? 'sharps';

  // Foco en posición de voicing para B5
  const [focusedVoicingPos, setFocusedVoicingPos] = useState<FretPosition | null>(null);

  // Estado para la pista de fórmula en C2 (Escala en una cuerda)
  const [showScaleFormulaHint, setShowScaleFormulaHint] = useState(false);
  const [usedScaleFormulaHint, setUsedScaleFormulaHint] = useState(false);

  useEffect(() => {
    setShowScaleFormulaHint(false);
    setUsedScaleFormulaHint(false);
  }, [currentQuestion?.id]);

  const handleToggleScaleFormulaHint = useCallback(() => {
    setShowScaleFormulaHint((prev) => !prev);
    setUsedScaleFormulaHint(true);
  }, []);

  const scaleFormulaDegrees = useMemo(() => {
    if (!currentQuestion) return [];
    const prompt = currentQuestion.prompt as Record<string, unknown>;
    if (currentQuestion.drill === 'C2') {
      const root = prompt?.root as PitchClass | undefined;
      const scaleType = prompt?.scaleType as ScaleTypeId | undefined;
      if (root === undefined || !scaleType) return [];
      try {
        const tones = formulaOfScale({ tonic: root, type: scaleType });
        return tones.map((t) => t.degree);
      } catch {
        return [];
      }
    } else if (currentQuestion.drill === 'C1') {
      const root = prompt?.root as PitchClass | undefined;
      const quality = prompt?.quality as ChordQualityId | undefined;
      if (root === undefined || !quality) return [];
      try {
        const tones = formulaOfChord({ root, quality });
        return tones.map((t) => t.degree);
      } catch {
        return [];
      }
    }
    return [];
  }, [currentQuestion]);

  const handleCheckAnswer = useCallback(() => {
    const s = store.getState();
    if (
      usedScaleFormulaHint &&
      (s.currentQuestion?.drill === 'C1' || s.currentQuestion?.drill === 'C2')
    ) {
      s.submitAnswer(undefined, {
        scoreMultiplier: 0.5,
        hintExplanation:
          s.currentQuestion?.drill === 'C1'
            ? '(Puntuación: 50% por consultar los grados del acorde)'
            : '(Puntuación: 50% por consultar los grados de la escala)',
      });
    } else {
      s.submitAnswer();
    }
  }, [store, usedScaleFormulaHint]);

  // Asegurar que hay una sesión iniciada al montar si estamos en 'configuring'
  useEffect(() => {
    const s = store.getState();
    if (s.phase === 'configuring') {
      s.startSession(s.drillId);
    }
  }, [store]);

  // En B5: pre-asignar la raíz como '1' si no está en assignedLabels y establecer foco
  useEffect(() => {
    if (currentQuestion?.drill === 'B5') {
      const prompt = currentQuestion.prompt as Record<string, unknown>;
      const rootPos = prompt.rootPosition as FretPosition | undefined;
      const positions = (prompt.positions as FretPosition[] | undefined) ?? [];

      if (rootPos) {
        const state = store.getState();
        const hasRoot = state.assignedLabels.some((l) => samePosition(l.position, rootPos));
        if (!hasRoot) {
          state.assignLabel(rootPos, '1');
        }
      }

      // Enfocar por defecto la primera posición que no sea la raíz
      const firstNonRoot = positions.find((p) => !rootPos || !samePosition(p, rootPos));
      setFocusedVoicingPos(firstNonRoot ?? positions[0] ?? null);
    } else {
      setFocusedVoicingPos(null);
    }
  }, [currentQuestion, store]);

  // Marcas para el mástil
  const fretMarks = useMemo(() => {
    return selectDrillFretboardMarks(store.getState(), {
      nameMode: effectiveNameMode,
      labels: 'interval',
    });
  }, [store, phase, currentQuestion, lastGrade, pinnedPositions, assignedLabels, effectiveNameMode]);

  // Rango dinámico y marcas del piano recortado a las 2–3 octavas de la pregunta
  const computedPianoRange: PianoRange = useMemo(() => {
    if (fretMarks.length === 0) {
      return { from: 48, to: 72 }; // C3–C5 por defecto (2 octavas)
    }
    const midis = fretMarks.map((m) =>
      positionToMidi(tuning, { string: m.string, fret: m.fret }),
    );
    const minM = Math.min(...midis);
    const maxM = Math.max(...midis);

    const minOctave = Math.floor(minM / 12) * 12;
    const maxOctave = Math.ceil((maxM + 1) / 12) * 12;

    const from = Math.max(36, minOctave);
    const to = Math.min(96, Math.max(from + 24, maxOctave));

    return { from, to };
  }, [fretMarks, tuning]);

  const pianoMarks = useMemo(() => {
    return selectDrillPianoMarks(store.getState(), {
      pianoRange: computedPianoRange,
      nameMode: effectiveNameMode,
      labels: 'interval',
    });
  }, [store, phase, currentQuestion, lastGrade, pinnedPositions, assignedLabels, computedPianoRange, effectiveNameMode]);

  // Reproducción de audio al corregir o al pulsar "Escuchar"
  const playAudioFeedback = useCallback(() => {
    if (!soundEnabled || !audioEngine || !currentQuestion) return;
    const prompt = currentQuestion.prompt as Record<string, unknown>;

    switch (currentQuestion.drill) {
      case 'A1': {
        const pc = prompt.pitchClass as PitchClass | undefined;
        if (pc !== undefined) {
          const midi = toMidi(pc, 3);
          audioEngine.playNote?.(midi);
        }
        break;
      }
      case 'A2': {
        const pos = prompt.position as FretPosition | undefined;
        if (pos) {
          const midi = positionToMidi(tuning, pos);
          audioEngine.playNote?.(midi);
        }
        break;
      }
      case 'B1': {
        const refPos = prompt.referencePosition as FretPosition | undefined;
        const semis = prompt.intervalSemitones as number | undefined;
        const dir = prompt.direction as 'ascending' | 'descending' | undefined;
        if (refPos && semis !== undefined) {
          const fromMidi = positionToMidi(tuning, refPos);
          const toMidiVal = fromMidi + (dir === 'descending' ? -semis : semis);
          playEvents(intervalEvents(fromMidi, toMidiVal), audioEngine);
        }
        break;
      }
      case 'B2': {
        const refPos = prompt.referencePosition as FretPosition | undefined;
        const expectedPositions = (currentQuestion.expected as { positions?: readonly FretPosition[] }).positions;
        const targetPos = expectedPositions?.[0];
        if (refPos && targetPos) {
          const fromMidi = positionToMidi(tuning, refPos);
          const toMidiVal = positionToMidi(tuning, targetPos);
          playEvents(intervalEvents(fromMidi, toMidiVal), audioEngine);
        }
        break;
      }
      case 'B3': {
        const fromPos = prompt.fromPosition as FretPosition | undefined;
        const toPos = prompt.toPosition as FretPosition | undefined;
        if (fromPos && toPos) {
          const fromMidi = positionToMidi(tuning, fromPos);
          const toMidiVal = positionToMidi(tuning, toPos);
          playEvents(intervalEvents(fromMidi, toMidiVal), audioEngine);
        }
        break;
      }
      case 'B4': {
        const refPos = prompt.referencePosition as FretPosition | undefined;
        const expectedPositions = (currentQuestion.expected as { positions?: readonly FretPosition[] }).positions ?? [];
        if (refPos) {
          const refMidi = positionToMidi(tuning, refPos);
          const midis = [refMidi, ...expectedPositions.map((p) => positionToMidi(tuning, p))];
          playEvents(arpeggioEvents(midis), audioEngine);
        }
        break;
      }
      case 'B5': {
        const positions = (prompt.positions as FretPosition[] | undefined) ?? [];
        const midis = positions.map((p) => positionToMidi(tuning, p));
        playEvents(arpeggioEvents(midis), audioEngine);
        break;
      }
      case 'C1': {
        const rootPos = prompt.rootPosition as FretPosition | undefined;
        const expectedPositions = (currentQuestion.expected as { positions?: readonly FretPosition[] }).positions ?? [];
        const allPositions = rootPos ? [rootPos, ...expectedPositions] : expectedPositions;
        const midis = allPositions
          .map((p) => positionToMidi(tuning, p))
          .sort((a, b) => a - b);
        playEvents(arpeggioEvents(midis), audioEngine);
        break;
      }
      case 'C2': {
        const expectedPositions = (currentQuestion.expected as { positions?: readonly FretPosition[] }).positions ?? [];
        const midis = expectedPositions
          .map((p) => positionToMidi(tuning, p))
          .sort((a, b) => a - b);
        playEvents(arpeggioEvents(midis), audioEngine);
        break;
      }
    }
  }, [audioEngine, currentQuestion, soundEnabled, tuning]);

  // Auto-play sonoro al entrar en la fase 'corrected'
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'corrected' && phase === 'corrected') {
      if (config.playAudio !== false && soundEnabled) {
        playAudioFeedback();
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, config.playAudio, soundEnabled, playAudioFeedback]);

  // Atajos de teclado: Enter (comprobar / siguiente / reiniciar)
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

      if (e.key === 'Enter') {
        e.preventDefault();
        const s = store.getState();
        if (s.phase === 'summary') {
          s.restartSession();
        } else if (s.phase === 'corrected') {
          s.nextQuestion();
        } else if (
          s.phase === 'answering' ||
          (s.phase === 'question' && s.currentQuestion?.mode === 'all')
        ) {
          handleCheckAnswer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, handleCheckAnswer]);

  // Manejador de clics en el mástil
  const handleFretboardClick = useCallback(
    (pos: FretPosition) => {
      const s = store.getState();
      if (s.phase === 'question' || s.phase === 'answering') {
        if (s.currentQuestion?.drill === 'B5') {
          // En B5, hacer clic en una posición la selecciona para asignarle grado
          const prompt = s.currentQuestion.prompt as Record<string, unknown>;
          const positions = (prompt.positions as FretPosition[] | undefined) ?? [];
          if (positions.some((p) => samePosition(p, pos))) {
            setFocusedVoicingPos(pos);
          }
        } else {
          s.togglePosition(pos);
        }
      } else if (s.phase === 'corrected') {
        // En fase corregida, hacer clic en una posición reproduce su sonido
        if (soundEnabled && audioEngine) {
          const midi = positionToMidi(tuning, pos);
          audioEngine.playNote?.(midi);
        }
      }
    },
    [store, soundEnabled, audioEngine, tuning],
  );

  // Manejador de clics en el piano
  const handlePianoKeyClick = useCallback(
    (midi: number) => {
      const s = store.getState();
      if (soundEnabled && audioEngine) {
        audioEngine.playNote?.(midi);
      }
      if (
        (s.phase === 'question' || s.phase === 'answering') &&
        s.currentQuestion?.answerKind === 'pitchClass'
      ) {
        const pc = pitchClassOf(midi);
        s.selectChoice(pc);
      }
    },
    [store, soundEnabled, audioEngine],
  );

  // Métricas de sesión en vivo
  const precisionPct =
    sessionStats.questionsAnswered > 0
      ? Math.round((sessionStats.correctCount / sessionStats.questionsAnswered) * 100)
      : 0;

  const averageTimeSecFormatted =
    sessionStats.questionsAnswered > 0
      ? (sessionStats.totalTimeMs / sessionStats.questionsAnswered / 1000)
          .toFixed(1)
          .replace('.', ',') + ' s'
      : '0,0 s';

  // Opciones de configuración
  const handleStringToggle = (stringNum: StringNumber) => {
    const current = store.getState().config.activeStrings ?? [1, 2, 3, 4, 5, 6];
    let next: StringNumber[];
    if (current.includes(stringNum)) {
      if (current.length <= 1) return; // Al menos 1 cuerda activa
      next = current.filter((s) => s !== stringNum);
    } else {
      next = [...current, stringNum].sort((a, b) => a - b);
    }
    store.getState().updateConfig({ activeStrings: next });
  };

  const handleFretRangeChange = (range: [number, number]) => {
    store.getState().updateConfig({ fretRange: range });
  };

  const handleDirectionChange = (direction: 'ascending' | 'descending' | 'both') => {
    store.getState().updateConfig({ direction });
  };

  const handleModeChange = (mode: 'all' | 'first') => {
    store.getState().updateConfig({ mode });
  };

  // -------------------------------------------------------------------------
  // Renderizado principal
  // -------------------------------------------------------------------------
  return (
    <div className={styles.container} data-testid="drills-view">
      {/* 1. Columna izquierda: Selector de Ejercicios */}
      <aside
        className={styles.drillsSidebar}
        role="region"
        aria-label="Selector de Ejercicios"
        data-testid="drills-sidebar"
      >
        <h2 className={styles.sidebarTitle}>Ejercicios</h2>

        {(['notes', 'intervals', 'build'] as const).map((group) => {
          const drillsInGroup = DRILL_CATALOG.filter((d) => d.group === group);
          const groupTitle =
            group === 'notes' ? 'NOTAS' : group === 'intervals' ? 'INTERVALOS' : 'CONSTRUIR';

          return (
            <div key={group} className={styles.drillGroup}>
              <div className={styles.groupHeader}>{groupTitle}</div>
              <div className={styles.drillList} role="listbox" aria-label={`Ejercicios de ${groupTitle}`}>
                {drillsInGroup.map((drill) => {
                  const isActive = drill.id === drillId;
                  return (
                    <button
                      key={drill.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      aria-current={isActive ? 'true' : undefined}
                      className={`${styles.drillButton} ${isActive ? styles.drillButtonActive : ''}`}
                      onClick={() => store.getState().startSession(drill.id)}
                      data-testid={`drill-select-${drill.id}`}
                    >
                      <span className={styles.drillCode}>{drill.id}</span>
                      <span className={styles.drillName}>{drill.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      {/* 2. Columna central: Escenario de Pregunta, Instrumentos y Corrección */}
      <main className={styles.drillStage} data-testid="drill-stage">
        {phase === 'summary' ? (
          /* Pantalla de resumen de fin de sesión */
          <div className={styles.summaryContainer} data-testid="drill-summary">
            <div className={styles.summaryIconBadge} aria-hidden="true">
              🏆
            </div>
            <p className={styles.summaryEyebrow}>Sesión completada</p>
            <h2 className={styles.summaryTitle}>
              Resumen de la sesión · {activeDrillInfo.name}
            </h2>
            <p className={styles.summaryMessage}>
              {precisionPct >= 80
                ? '¡Excelente trabajo! Has consolidado el ejercicio con gran precisión y soltura.'
                : '¡Buen esfuerzo! Continúa practicando con el modo adaptativo para reforzar los puntos débiles.'}
            </p>

            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardValue}>{precisionPct}%</span>
                <span className={styles.summaryCardLabel}>
                  Precisión ({sessionStats.correctCount}/{sessionStats.questionsAnswered})
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardValue}>{averageTimeSecFormatted}</span>
                <span className={styles.summaryCardLabel}>Tiempo medio</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardValue}>
                  {sessionStats.questionsAnswered}
                </span>
                <span className={styles.summaryCardLabel}>Preguntas</span>
              </div>
            </div>

            <div className={styles.summaryActions}>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => store.getState().restartSession()}
                data-testid="drill-restart-button"
              >
                Repetir sesión · Enter
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => store.getState().endSession()}
                data-testid="drill-configure-button"
              >
                Configurar ejercicio
              </button>
            </div>
          </div>
        ) : (
          /* Flujo normal de pregunta y corrección */
          <>
            {/* Cabecera de la pregunta */}
            <header className={styles.questionHeader}>
              <div className={styles.headerLeft}>
                <p className={styles.eyebrow} data-testid="drill-eyebrow">
                  {drillId} · {activeDrillInfo.name.toUpperCase()}
                </p>
                <h2 className={styles.questionTitle} data-testid="drill-question-title">
                  {renderQuestionTitle(currentQuestion, handleToggleScaleFormulaHint)}
                </h2>
                {(currentQuestion?.drill === 'C1' || currentQuestion?.drill === 'C2') && (
                  <div
                    className={styles.scaleFormulaBox ?? ''}
                    data-testid={currentQuestion.drill === 'C1' ? 'c1-scale-formula-box' : 'c2-scale-formula-box'}
                  >
                    <div className={styles.scaleFormulaContent ?? ''}>
                      <span className={styles.scaleFormulaTitle ?? ''}>Fórmula:</span>
                      {showScaleFormulaHint ? (
                        <span
                          className={styles.scaleFormulaDegrees ?? ''}
                          data-testid={currentQuestion.drill === 'C1' ? 'c1-scale-formula-degrees' : 'c2-scale-formula-degrees'}
                        >
                          {scaleFormulaDegrees.join('  ')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.scaleFormulaHintButton ?? ''}
                          onClick={handleToggleScaleFormulaHint}
                          data-testid={currentQuestion.drill === 'C1' ? 'c1-show-formula-button' : 'c2-show-formula-button'}
                          aria-label={
                            currentQuestion.drill === 'C1'
                              ? 'Ver grados del acorde'
                              : 'Ver grados de la escala'
                          }
                        >
                          <span aria-hidden="true">💡</span>
                          {currentQuestion.drill === 'C1'
                            ? 'Ver grados del acorde (-50% puntos)'
                            : 'Ver grados de la escala (-50% puntos)'}
                        </button>
                      )}
                    </div>
                    {showScaleFormulaHint && (
                      <span
                        className={styles.scaleFormulaBadge ?? ''}
                        data-testid={currentQuestion.drill === 'C1' ? 'c1-formula-penalty-badge' : 'c2-formula-penalty-badge'}
                      >
                        Pista activa: 50% puntos
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.progressContainer}>
                <span className={styles.progressText}>
                  Pregunta {questionNumber} / {totalQuestions}
                </span>
                <div
                  className={styles.progressBarTrack}
                  role="progressbar"
                  aria-valuenow={questionNumber}
                  aria-valuemin={1}
                  aria-valuemax={totalQuestions}
                >
                  <div
                    className={styles.progressBarFill}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (phase === 'corrected'
                            ? questionNumber / totalQuestions
                            : (questionNumber - 1) / totalQuestions) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </header>

            {/* Mástil interactivo */}
            <section
              className={styles.instrumentSection}
              aria-label="Mástil de guitarra interactivo"
            >
              <Fretboard
                tuning={tuning}
                fretRange={{
                  from: config.fretRange?.[0] ?? 0,
                  to: config.fretRange?.[1] ?? 12,
                }}
                activeStrings={new Set(config.activeStrings ?? [1, 2, 3, 4, 5, 6])}
                showInlays={config.showInlays !== false}
                leftHanded={leftHanded}
                nameMode={effectiveNameMode}
                marks={fretMarks}
                onPositionClick={handleFretboardClick}
              />
            </section>

            {/* Fila media: Piano contextual sincronizado + Leyenda */}
            <section className={styles.middleRow} aria-label="Piano contextual y leyenda">
              <div className={styles.pianoContainer}>
                <Piano
                  range={computedPianoRange}
                  marks={pianoMarks}
                  nameMode={effectiveNameMode}
                  onKeyClick={handlePianoKeyClick}
                />
              </div>

              <div className={styles.legend} aria-label="Leyenda de marcas">
                <div className={styles.legendItem}>
                  <span className={styles.legendIconQuestion} aria-hidden="true" />
                  <span>Referencia (pregunta)</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendIconWrong} aria-hidden="true">
                    ×
                  </span>
                  <span>Tu respuesta, incorrecta</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendIconMissed} aria-hidden="true" />
                  <span>Correcta que faltó</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendIconCorrect} aria-hidden="true">
                    ✓
                  </span>
                  <span>Acierto</span>
                </div>
              </div>
            </section>

            {/* Botonera de opciones contextuales (A2, B3, B5) */}
            {currentQuestion?.answerKind === 'pitchClass' && (
              /* A2 · Nombra la nota */
              <section className={styles.optionsSection} aria-label="Opciones de notas">
                <p className={styles.optionsTitle}>Elige la nota correspondiente:</p>
                <div className={styles.notesButtonRow}>
                  {(config.naturalOnly ? NATURAL_PCS : ALL_PCS).map((pc) => {
                    const noteStr = pcName(pc, effectiveNameMode);
                    const isSelected = selectedChoice === pc;
                    let extraClass = '';
                    if (phase === 'corrected') {
                      const expectedPc = (currentQuestion.expected as { pitchClass?: PitchClass }).pitchClass;
                      if (isSelected) {
                        extraClass = (lastGrade?.correct
                          ? styles.noteOptionButtonCorrect
                          : styles.noteOptionButtonWrong) ?? '';
                      } else if (expectedPc === pc) {
                        extraClass = styles.noteOptionButtonCorrect ?? '';
                      }
                    } else if (isSelected) {
                      extraClass = styles.noteOptionButtonSelected ?? '';
                    }

                    return (
                      <button
                        key={pc}
                        type="button"
                        className={`${styles.noteOptionButton} ${extraClass}`}
                        onClick={() => store.getState().selectChoice(pc)}
                        aria-label={`Nota ${noteStr}`}
                        data-testid={`drill-note-choice-${pc}`}
                      >
                        {noteStr}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {currentQuestion?.answerKind === 'interval' && (
              /* B3 · Nombra el intervalo */
              <section className={styles.optionsSection} aria-label="Opciones de intervalo">
                <p className={styles.optionsTitle}>Elige el intervalo existente:</p>
                <div className={styles.intervalButtonRow}>
                  {INTERVAL_BUTTONS.map((item) => {
                    const isSelected = selectedChoice === item.semitones;
                    let extraClass = '';
                    if (phase === 'corrected') {
                      const expectedSemis = (currentQuestion.expected as { semitones?: number }).semitones;
                      if (isSelected) {
                        extraClass = (lastGrade?.correct
                          ? styles.intervalOptionButtonCorrect
                          : styles.intervalOptionButtonWrong) ?? '';
                      } else if (expectedSemis === item.semitones) {
                        extraClass = styles.intervalOptionButtonCorrect ?? '';
                      }
                    } else if (isSelected) {
                      extraClass = styles.intervalOptionButtonSelected ?? '';
                    }

                    return (
                      <button
                        key={item.semitones}
                        type="button"
                        className={`${styles.intervalOptionButton} ${extraClass}`}
                        onClick={() => store.getState().selectChoice(item.semitones)}
                        aria-label={`${item.shortName} (${item.longName})`}
                        data-testid={`drill-interval-choice-${item.semitones}`}
                      >
                        <span className={styles.intervalShort}>{item.shortName}</span>
                        <span className={styles.intervalLong}>{item.longName}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {currentQuestion?.drill === 'B5' && (
              /* B5 · Etiqueta la forma */
              <section className={styles.optionsSection} aria-label="Asignación de grados de voicing">
                <p className={styles.optionsTitle}>
                  Selecciona una cuerda y asígnale su grado armónico:
                </p>

                {/* Fichas de las cuerdas del voicing */}
                <div className={styles.voicingPositionsRow}>
                  {((currentQuestion.prompt as Record<string, unknown>).positions as FretPosition[] | undefined)?.map(
                    (pos) => {
                      const rootPos = (currentQuestion.prompt as Record<string, unknown>).rootPosition as FretPosition | undefined;
                      const isRoot = rootPos ? samePosition(pos, rootPos) : false;
                      const isFocused = focusedVoicingPos ? samePosition(pos, focusedVoicingPos) : false;
                      const assigned = assignedLabels.find((l) => samePosition(l.position, pos));
                      const labelText = isRoot ? '1' : assigned?.label ?? '?';

                      if (phase === 'corrected') {
                        const expLabels =
                          'labels' in currentQuestion.expected && Array.isArray(currentQuestion.expected.labels)
                            ? (currentQuestion.expected.labels as readonly { position: FretPosition; degree?: string; label?: string }[])
                            : undefined;
                        const expItem = expLabels?.find((l) => samePosition(l.position, pos));
                        const expectedDegree = expItem?.degree ?? expItem?.label;
                        const isCorrect = isRoot || assigned?.label === expectedDegree;

                        return (
                          <div
                            key={`s${pos.string}f${pos.fret}`}
                            className={`${styles.voicingCard ?? ''} ${
                              isCorrect ? styles.voicingCardCorrect ?? '' : styles.voicingCardWrong ?? ''
                            }`}
                            aria-label={`Cuerda ${pos.string}, traste ${pos.fret}, ${
                              isCorrect
                                ? `correcto ${labelText}`
                                : `incorrecto pusiste ${assigned?.label ?? '?'} esperado ${expectedDegree}`
                            }`}
                            data-testid={`voicing-card-s${pos.string}-f${pos.fret}`}
                          >
                            <span className={styles.voicingCardPos ?? ''}>
                              Cuerda {pos.string} (tr. {pos.fret})
                            </span>
                            {isCorrect ? (
                              <span
                                className={styles.voicingDegreeBadgeCorrect ?? ''}
                                data-testid={`voicing-badge-correct-s${pos.string}`}
                              >
                                ✓ {labelText}
                              </span>
                            ) : (
                              <div
                                className={styles.voicingDegreeWrongGroup ?? ''}
                                data-testid={`voicing-badge-wrong-group-s${pos.string}`}
                              >
                                <span
                                  className={styles.voicingDegreeBadgeWrong ?? ''}
                                  data-testid={`voicing-badge-wrong-s${pos.string}`}
                                >
                                  × {assigned?.label ?? '?'}
                                </span>
                                <span className={styles.voicingDegreeArrow ?? ''} aria-hidden="true">
                                  →
                                </span>
                                <span
                                  className={styles.voicingDegreeBadgeExpected ?? ''}
                                  data-testid={`voicing-badge-expected-s${pos.string}`}
                                >
                                  ✓ {expectedDegree}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`s${pos.string}f${pos.fret}`}
                          type="button"
                          className={`${styles.voicingCard} ${
                            isFocused ? styles.voicingCardFocused : ''
                          } ${isRoot ? styles.voicingCardRoot : ''}`}
                          onClick={() => setFocusedVoicingPos(pos)}
                          aria-label={`Cuerda ${pos.string}, traste ${pos.fret}, grado ${labelText}`}
                          data-testid={`voicing-card-s${pos.string}-f${pos.fret}`}
                        >
                          <span className={styles.voicingCardPos}>
                            Cuerda {pos.string} (tr. {pos.fret})
                          </span>
                          <span
                            className={`${styles.voicingDegreeBadge} ${
                              isRoot ? styles.voicingDegreeBadgeRoot : ''
                            }`}
                          >
                            {labelText}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Fila de píldoras de grado */}
                <div className={styles.degreePillsRow}>
                  {DEGREE_PILLS.map((deg) => {
                    const isSelected = focusedVoicingPos
                      ? assignedLabels.find((l) => samePosition(l.position, focusedVoicingPos))
                          ?.label === deg
                      : false;

                    return (
                      <button
                        key={deg}
                        type="button"
                        className={`${styles.degreePill} ${
                          isSelected ? styles.degreePillSelected : ''
                        }`}
                        onClick={() => {
                          if (focusedVoicingPos) {
                            store.getState().assignLabel(focusedVoicingPos, deg);
                          }
                        }}
                        aria-label={`Grado ${deg}`}
                        data-testid={`degree-pill-${deg}`}
                      >
                        {deg}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Franja inferior de corrección y acción */}
            <div
              className={`${styles.feedbackBanner} ${
                phase === 'corrected'
                  ? lastGrade?.correct
                    ? styles.feedbackBannerCorrect
                    : styles.feedbackBannerWrong
                  : styles.feedbackBannerIdle
              }`}
              role="status"
              aria-live="polite"
              data-testid="drill-feedback-banner"
            >
              {phase === 'corrected' ? (
                <>
                  <div className={styles.feedbackText} data-testid="drill-feedback-text">
                    {lastGrade?.correct ? (
                      <span className={styles.feedbackTitleCorrect}>Correcto.</span>
                    ) : (
                      <span className={styles.feedbackTitleWrong}>Incorrecto.</span>
                    )}
                    <span>{lastGrade?.explanation ?? ''}</span>
                  </div>

                  <div className={styles.feedbackActions}>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={playAudioFeedback}
                      aria-label="Escuchar sonido del ejercicio"
                      data-testid="drill-listen-button"
                    >
                      <span aria-hidden="true">🔊</span>
                      Escuchar
                    </button>
                    <button
                      type="button"
                      className={styles.buttonPrimary}
                      onClick={() => store.getState().nextQuestion()}
                      data-testid="drill-next-button"
                    >
                      Siguiente · Enter
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.feedbackText}>
                    {activeDrillInfo.defaultMode === 'first' &&
                    currentQuestion?.mode === 'first' ? (
                      <span>Haz clic en el mástil o selecciona la opción para responder.</span>
                    ) : (
                      <span>
                        {currentQuestion?.drill === 'B5'
                          ? `${assignedLabels.length} notas etiquetadas`
                          : `${pinnedPositions.length} posiciones marcadas`}
                      </span>
                    )}
                  </div>

                  {(currentQuestion?.mode === 'all' ||
                    currentQuestion?.answerKind === 'labels' ||
                    pinnedPositions.length > 0) && (
                    <div className={styles.feedbackActions}>
                      <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={handleCheckAnswer}
                        data-testid="drill-check-button"
                      >
                        Comprobar · Enter
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* 3. Columna derecha: Configuración y Estadísticas de Sesión */}
      <aside
        className={styles.drillConfigPanel}
        role="region"
        aria-label="Configuración de ejercicios"
        data-testid="drill-config-panel"
      >
        <h2 className={styles.configTitle}>Configuración</h2>

        {/* Cuerdas */}
        <div className={styles.configSection}>
          <span className={styles.configSectionTitle}>Cuerdas</span>
          <div className={styles.stringsRow} role="group" aria-label="Cuerdas activas">
            {([1, 2, 3, 4, 5, 6] as StringNumber[]).map((sNum) => {
              const isActive = (config.activeStrings ?? [1, 2, 3, 4, 5, 6]).includes(sNum);
              return (
                <button
                  key={sNum}
                  type="button"
                  aria-pressed={isActive}
                  className={`${styles.stringButton} ${isActive ? styles.stringButtonActive : ''}`}
                  onClick={() => handleStringToggle(sNum)}
                  data-testid={`drill-config-string-${sNum}`}
                >
                  {sNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* Trastes */}
        <div className={styles.configSection}>
          <span className={styles.configSectionTitle}>Trastes</span>
          <div className={styles.segmentedGroup} role="radiogroup" aria-label="Rango de trastes">
            {[
              { label: '0–5', range: [0, 5] as [number, number] },
              { label: '0–12', range: [0, 12] as [number, number] },
              { label: '0–24', range: [0, 24] as [number, number] },
            ].map((opt) => {
              const currentMax = config.fretRange?.[1] ?? 12;
              const isSelected = currentMax === opt.range[1];
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.segmentedButton} ${
                    isSelected ? styles.segmentedButtonActive : ''
                  }`}
                  onClick={() => handleFretRangeChange(opt.range)}
                  data-testid={`drill-config-fret-${opt.range[1]}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dirección (si el ejercicio lo soporta) */}
        {activeDrillInfo.supportsDirection && (
          <div className={styles.configSection}>
            <span className={styles.configSectionTitle}>Dirección</span>
            <div className={styles.segmentedGroup} role="radiogroup" aria-label="Dirección del intervalo">
              {[
                { label: 'Asc.', value: 'ascending' as const },
                { label: 'Desc.', value: 'descending' as const },
                { label: 'Ambas', value: 'both' as const },
              ].map((opt) => {
                const currentDir = config.direction ?? 'ascending';
                const isSelected = currentDir === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`${styles.segmentedButton} ${
                      isSelected ? styles.segmentedButtonActive : ''
                    }`}
                    onClick={() => handleDirectionChange(opt.value)}
                    data-testid={`drill-config-dir-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modo (en A1 y B4) */}
        {(drillId === 'A1' || drillId === 'B4') && (
          <div className={styles.configSection}>
            <span className={styles.configSectionTitle}>Modo</span>
            <div className={styles.segmentedGroup} role="radiogroup" aria-label="Modo de evaluación">
              {[
                { label: 'Todas', value: 'all' as const },
                { label: 'La primera', value: 'first' as const },
              ].map((opt) => {
                const currentMode = config.mode ?? activeDrillInfo.defaultMode;
                const isSelected = currentMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`${styles.segmentedButton} ${
                      isSelected ? styles.segmentedButtonActive : ''
                    }`}
                    onClick={() => handleModeChange(opt.value)}
                    data-testid={`drill-config-mode-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Interruptores */}
        <div className={styles.configSection}>
          <label className={styles.switchRow}>
            <span className={styles.switchLabel}>Adaptativo</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.adaptive ?? true}
              className={`${styles.switch} ${
                (config.adaptive ?? true) ? styles.switchActive : ''
              }`}
              onClick={() =>
                store.getState().updateConfig({ adaptive: !(config.adaptive ?? true) })
              }
              data-testid="drill-config-switch-adaptive"
            >
              <span
                className={`${styles.switchThumb} ${
                  (config.adaptive ?? true) ? styles.switchThumbActive : ''
                }`}
              />
            </button>
          </label>

          <label className={styles.switchRow}>
            <span className={styles.switchLabel}>Ocultar puntos</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.showInlays === false}
              className={`${styles.switch} ${
                config.showInlays === false ? styles.switchActive : ''
              }`}
              onClick={() =>
                store.getState().updateConfig({ showInlays: config.showInlays === false })
              }
              data-testid="drill-config-switch-inlays"
            >
              <span
                className={`${styles.switchThumb} ${
                  config.showInlays === false ? styles.switchThumbActive : ''
                }`}
              />
            </button>
          </label>

          <label className={styles.switchRow}>
            <span className={styles.switchLabel}>Sonido al corregir</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.playAudio ?? true}
              className={`${styles.switch} ${
                (config.playAudio ?? true) ? styles.switchActive : ''
              }`}
              onClick={() =>
                store.getState().updateConfig({ playAudio: !(config.playAudio ?? true) })
              }
              data-testid="drill-config-switch-sound"
            >
              <span
                className={`${styles.switchThumb} ${
                  (config.playAudio ?? true) ? styles.switchThumbActive : ''
                }`}
              />
            </button>
          </label>
        </div>

        {/* Sección Esta Sesión */}
        <div className={styles.configSection}>
          <span className={styles.configSectionTitle}>Esta sesión</span>
          <div className={styles.sessionStatsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue} data-testid="session-stat-precision">
                {precisionPct} %
              </span>
              <span className={styles.statLabel}>Precisión</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue} data-testid="session-stat-time">
                {averageTimeSecFormatted}
              </span>
              <span className={styles.statLabel}>Tiempo medio</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
