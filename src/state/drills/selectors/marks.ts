import {
  intervalBetween,
  intervalName,
  pcInterval,
  pcName,
  pitchClassOf,
  positionToMidi,
  STANDARD_TUNING,
  type FretPosition,
  type PitchClass,
} from '../../../theory';
import {
  DEFAULT_PIANO_RANGE,
  ROLE_PRIORITY,
  type FretMark,
  type KeyMark,
  type MarksOptions,
} from '../../shared/marks';
import type { DrillsState } from '../types';

function samePosition(a: FretPosition, b: FretPosition): boolean {
  return a.string === b.string && a.fret === b.fret;
}

function isFretPosition(value: unknown): value is FretPosition {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.string === 'number' && typeof v.fret === 'number';
}

interface PosDegree {
  position: FretPosition;
  degree?: string;
  label?: string;
}

function isPosDegree(value: unknown): value is PosDegree {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return isFretPosition(v.position);
}

/**
 * Selector que genera las marcas del mástil (FretMark[]) para el ejercicio activo
 * según la fase (configurando, preguntando, respondiendo o corregido).
 */
export function selectDrillFretboardMarks(
  state: DrillsState,
  options?: MarksOptions,
): FretMark[] {
  const { phase, currentQuestion, lastGrade, pinnedPositions, assignedLabels } = state;
  if (!currentQuestion || phase === 'configuring' || phase === 'summary') {
    return [];
  }

  const tuning = state.config.tuning ?? STANDARD_TUNING;
  const nameMode = options?.nameMode ?? state.config.nameMode ?? 'sharps';
  const labelMode = options?.labels ?? 'interval';
  const prompt = currentQuestion.prompt as Record<string, unknown>;
  const marksMap = new Map<string, FretMark>();

  const posKey = (pos: FretPosition) => `s${pos.string}f${pos.fret}`;

  const setMark = (mark: FretMark) => {
    const key = posKey({ string: mark.string, fret: mark.fret });
    const existing = marksMap.get(key);
    if (!existing || ROLE_PRIORITY[mark.role] >= ROLE_PRIORITY[existing.role]) {
      marksMap.set(key, mark);
    }
  };

  // -------------------------------------------------------------------------
  // Fases 'question' o 'answering': pregunta inicial e interacción del usuario
  // -------------------------------------------------------------------------
  if (phase === 'question' || phase === 'answering') {
    // 1. Marcas de referencia / prompt
    if (isFretPosition(prompt.referencePosition)) {
      const ref = prompt.referencePosition;
      setMark({
        string: ref.string,
        fret: ref.fret,
        role: 'question',
        isRoot: true,
        label: typeof prompt.referenceNoteName === 'string' ? prompt.referenceNoteName : '1',
      });
    }

    if (isFretPosition(prompt.fromPosition)) {
      const from = prompt.fromPosition;
      setMark({
        string: from.string,
        fret: from.fret,
        role: 'question',
        isRoot: true,
        label: typeof prompt.fromNoteName === 'string' ? prompt.fromNoteName : '1',
      });
    }

    if (isFretPosition(prompt.toPosition)) {
      const to = prompt.toPosition;
      setMark({
        string: to.string,
        fret: to.fret,
        role: 'question',
        isRoot: false,
        label: typeof prompt.toNoteName === 'string' ? prompt.toNoteName : undefined,
      });
    }

    if (isFretPosition(prompt.rootPosition)) {
      const rootPos = prompt.rootPosition;
      setMark({
        string: rootPos.string,
        fret: rootPos.fret,
        role: 'question',
        isRoot: true,
        label: typeof prompt.rootNoteName === 'string' ? prompt.rootNoteName : '1',
      });
    }

    if (Array.isArray(prompt.positions)) {
      // Voicings en B5: muestra todas las posiciones del acorde
      const rootPos = isFretPosition(prompt.rootPosition) ? prompt.rootPosition : undefined;
      for (const p of prompt.positions) {
        if (isFretPosition(p)) {
          const isRoot = rootPos ? samePosition(p, rootPos) : false;
          const assigned = assignedLabels.find((l) => samePosition(l.position, p));
          setMark({
            string: p.string,
            fret: p.fret,
            role: 'question',
            isRoot,
            label: assigned?.label ?? (isRoot ? '1' : undefined),
          });
        }
      }
    }

    if (isFretPosition(prompt.position)) {
      const p = prompt.position;
      setMark({
        string: p.string,
        fret: p.fret,
        role: 'question',
        isRoot: false,
        label: '?',
      });
    }

    // 2. Posiciones seleccionadas / fijadas por el usuario
    const hideNoteLabel =
      (currentQuestion.drill === 'A1' && currentQuestion.mode === 'all') ||
      currentQuestion.drill === 'B4' ||
      currentQuestion.drill === 'C1' ||
      currentQuestion.drill === 'C2';

    for (const pinned of pinnedPositions) {
      const midi = positionToMidi(tuning, pinned);
      const noteName = pcName(pitchClassOf(midi), nameMode);
      setMark({
        string: pinned.string,
        fret: pinned.fret,
        role: 'pinned',
        label: hideNoteLabel ? '?' : noteName,
      });
    }

    return Array.from(marksMap.values());
  }

  // -------------------------------------------------------------------------
  // Fase 'corrected': muestra simultáneamente question, correct, wrong, missed
  // -------------------------------------------------------------------------
  let refPos: FretPosition | undefined;
  let refPc: PitchClass | undefined;

  if (isFretPosition(prompt.referencePosition)) {
    refPos = prompt.referencePosition;
  } else if (isFretPosition(prompt.fromPosition)) {
    refPos = prompt.fromPosition;
  } else if (isFretPosition(prompt.rootPosition)) {
    refPos = prompt.rootPosition;
  } else if (isFretPosition(prompt.position)) {
    refPos = prompt.position;
  }

  if (typeof prompt.pitchClass === 'number') {
    refPc = prompt.pitchClass as PitchClass;
  } else if (typeof prompt.root === 'number') {
    refPc = prompt.root as PitchClass;
  } else if (refPos) {
    refPc = pitchClassOf(positionToMidi(tuning, refPos));
  }

  const resolveLabel = (pos: FretPosition, degreeOverride?: string): string => {
    if (degreeOverride) return degreeOverride;
    if (labelMode === 'note') {
      return pcName(pitchClassOf(positionToMidi(tuning, pos)), nameMode);
    }
    if (refPos) {
      if (samePosition(refPos, pos)) return '1';
      const semis = Math.abs(intervalBetween(refPos, pos, tuning));
      return intervalName(semis);
    }
    if (refPc !== undefined) {
      const posPc = pitchClassOf(positionToMidi(tuning, pos));
      const semis = pcInterval(refPc, posPc);
      return semis === 0 ? '1' : intervalName(semis);
    }
    return '';
  };

  // Posición de referencia de la pregunta (B1, B2, B3, B4)
  if (refPos && currentQuestion.drill !== 'A2') {
    setMark({
      string: refPos.string,
      fret: refPos.fret,
      role: 'question',
      isRoot: true,
      label: labelMode === 'note' && typeof prompt.referenceNoteName === 'string'
        ? prompt.referenceNoteName
        : '1',
    });
  }

  if (lastGrade) {
    // 1. Aciertos (hits -> role: 'correct')
    for (const item of lastGrade.hits) {
      if (isPosDegree(item)) {
        setMark({
          string: item.position.string,
          fret: item.position.fret,
          role: 'correct',
          isRoot: refPos ? samePosition(item.position, refPos) : false,
          label: item.degree ?? item.label,
        });
      } else if (isFretPosition(item)) {
        setMark({
          string: item.string,
          fret: item.fret,
          role: 'correct',
          isRoot: refPos ? samePosition(item, refPos) : false,
          label: resolveLabel(item),
        });
      } else if (currentQuestion.drill === 'A2' && refPos) {
        setMark({
          string: refPos.string,
          fret: refPos.fret,
          role: 'correct',
          label: resolveLabel(refPos),
        });
      } else if (currentQuestion.drill === 'B3' && isFretPosition(prompt.toPosition)) {
        setMark({
          string: prompt.toPosition.string,
          fret: prompt.toPosition.fret,
          role: 'correct',
          label: resolveLabel(prompt.toPosition),
        });
      }
    }

    // 2. Faltantes (misses -> role: 'missed')
    for (const item of lastGrade.misses) {
      if (isPosDegree(item)) {
        setMark({
          string: item.position.string,
          fret: item.position.fret,
          role: 'missed',
          isRoot: refPos ? samePosition(item.position, refPos) : false,
          label: item.degree ?? item.label,
        });
      } else if (isFretPosition(item)) {
        setMark({
          string: item.string,
          fret: item.fret,
          role: 'missed',
          isRoot: refPos ? samePosition(item, refPos) : false,
          label: resolveLabel(item),
        });
      } else if (currentQuestion.drill === 'A2' && refPos && !lastGrade.correct) {
        setMark({
          string: refPos.string,
          fret: refPos.fret,
          role: 'missed',
          label: resolveLabel(refPos),
        });
      } else if (currentQuestion.drill === 'B3' && isFretPosition(prompt.toPosition) && !lastGrade.correct) {
        setMark({
          string: prompt.toPosition.string,
          fret: prompt.toPosition.fret,
          role: 'missed',
          label: resolveLabel(prompt.toPosition),
        });
      }
    }

    // 3. Sobrantes o erróneas (extras -> role: 'wrong')
    for (const item of lastGrade.extras) {
      if (isPosDegree(item)) {
        setMark({
          string: item.position.string,
          fret: item.position.fret,
          role: 'wrong',
          isRoot: refPos ? samePosition(item.position, refPos) : false,
          label: item.label ?? item.degree,
        });
      } else if (isFretPosition(item)) {
        setMark({
          string: item.string,
          fret: item.fret,
          role: 'wrong',
          isRoot: refPos ? samePosition(item, refPos) : false,
          label: resolveLabel(item),
        });
      } else if (currentQuestion.drill === 'A2' && refPos) {
        setMark({
          string: refPos.string,
          fret: refPos.fret,
          role: 'wrong',
          label: typeof item === 'number' ? pcName(item as PitchClass, nameMode) : '×',
        });
      } else if (currentQuestion.drill === 'B3' && isFretPosition(prompt.toPosition)) {
        setMark({
          string: prompt.toPosition.string,
          fret: prompt.toPosition.fret,
          role: 'wrong',
          label: typeof item === 'number' ? intervalName(item) : String(item),
        });
      }
    }
  }

  return Array.from(marksMap.values());
}

/**
 * Selector que proyecta las marcas del mástil sobre el teclado del piano lineal (KeyMark[]),
 * calculando los números MIDI a partir de la afinación y resolviendo solapes por prioridad.
 */
export function selectDrillPianoMarks(
  state: DrillsState,
  options?: MarksOptions,
): KeyMark[] {
  const fretMarks = selectDrillFretboardMarks(state, options);
  if (fretMarks.length === 0) return [];

  const tuning = state.config.tuning ?? STANDARD_TUNING;
  const pianoRange = options?.pianoRange ?? DEFAULT_PIANO_RANGE;
  const keyMap = new Map<number, KeyMark>();

  for (const mark of fretMarks) {
    const midi = positionToMidi(tuning, { string: mark.string, fret: mark.fret });
    if (midi < pianoRange.from || midi > pianoRange.to) {
      continue;
    }

    const existing = keyMap.get(midi);
    if (!existing || ROLE_PRIORITY[mark.role] >= ROLE_PRIORITY[existing.role]) {
      keyMap.set(midi, {
        midi,
        role: mark.role,
        isRoot: mark.isRoot,
        label: mark.label,
      });
    }
  }

  return Array.from(keyMap.values()).sort((a, b) => a.midi - b.midi);
}
