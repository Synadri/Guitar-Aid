import {
  type Degree,
  type FretPosition,
  type IntervalLongName,
  type IntervalShortName,
  type NameMode,
  type PitchClass,
  type StringNumber,
  degreeName,
  intervalLongName,
  intervalName,
  pcName,
  pitchClassOf,
  positionToMidi,
  STANDARD_TUNING,
} from '../../theory';
import type { Rng } from '../rng';
import { adaptivePick, type DrillStatsMap } from './adaptive';
import type { DrillConfig, DrillQuestion } from './types';

const DEFAULT_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const DEFAULT_RANGE: readonly [number, number] = [0, 12];
const COMMON_INTERVALS: readonly number[] = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]; // m2 a P8

function normalizeRange(fretRange?: readonly [number, number] | [number, number]): [number, number] {
  if (!fretRange) return [DEFAULT_RANGE[0], DEFAULT_RANGE[1]];
  return [Math.min(fretRange[0], fretRange[1]), Math.max(fretRange[0], fretRange[1])];
}

function openMidi(tuning = STANDARD_TUNING, string: StringNumber): number {
  return tuning.strings[tuning.strings.length - string]!;
}

// -----------------------------------------------------------------------
// B1 · Intervalo en una cuerda
// -----------------------------------------------------------------------

export interface B1Prompt {
  referencePosition: FretPosition;
  direction: 'ascending' | 'descending';
  intervalSemitones: number;
  intervalName: IntervalShortName;
  intervalLongName: IntervalLongName;
  referenceNoteName: string;
  title: string;
  eyebrow: string;
}

export function generateB1(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<B1Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const allowedIntervals = config?.intervals ?? COMMON_INTERVALS;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';

  // Colecciona todas las combinaciones válidas (cuerda, trasteRef, dirección, intervalo)
  interface B1Candidate {
    string: StringNumber;
    refFret: number;
    targetFret: number;
    semis: number;
    direction: 'ascending' | 'descending';
  }

  const candidates: B1Candidate[] = [];
  const dirConfig = config?.direction ?? 'both';

  for (const s of activeStrings) {
    for (const semis of allowedIntervals) {
      if (semis > maxFret - minFret) continue;

      if (dirConfig === 'ascending' || dirConfig === 'both') {
        for (let rf = minFret; rf <= maxFret - semis; rf++) {
          candidates.push({
            string: s,
            refFret: rf,
            targetFret: rf + semis,
            semis,
            direction: 'ascending',
          });
        }
      }

      if (dirConfig === 'descending' || dirConfig === 'both') {
        for (let rf = minFret + semis; rf <= maxFret; rf++) {
          candidates.push({
            string: s,
            refFret: rf,
            targetFret: rf - semis,
            semis,
            direction: 'descending',
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback defensivo
    candidates.push({
      string: activeStrings[0] ?? 5,
      refFret: minFret,
      targetFret: minFret + 4,
      semis: 4,
      direction: 'ascending',
    });
  }

  const chosen = adaptivePick(
    rng,
    candidates,
    (c) => `interval:${intervalName(c.semis)}|string:${c.string}`,
    stats,
    config?.adaptive ?? true,
  );

  const refPos: FretPosition = { string: chosen.string, fret: chosen.refFret };
  const targetPos: FretPosition = { string: chosen.string, fret: chosen.targetFret };
  const refMidi = positionToMidi(tuning, refPos);
  const refPc = pitchClassOf(refMidi);
  const refNoteName = pcName(refPc, nameMode);
  const iShort = intervalName(chosen.semis);
  const iLong = intervalLongName(chosen.semis);

  const dirVerb = chosen.direction === 'ascending' ? 'sube' : 'baja';
  const title = `Desde ${refNoteName}, ${dirVerb} una ${iLong} en la misma cuerda`;
  const qId = `b1-s${chosen.string}f${chosen.refFret}-${iShort}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'B1',
    itemKey: `interval:${iShort}|string:${chosen.string}`,
    prompt: {
      referencePosition: refPos,
      direction: chosen.direction,
      intervalSemitones: chosen.semis,
      intervalName: iShort,
      intervalLongName: iLong,
      referenceNoteName: refNoteName,
      title,
      eyebrow: 'B1 · INTERVALO EN UNA CUERDA',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      // Estrictamente en la misma cuerda
      positions: [targetPos],
    },
    mode: 'first',
  };
}

// -----------------------------------------------------------------------
// B2 · Intervalo entre cuerdas
// -----------------------------------------------------------------------

export interface B2Prompt {
  referencePosition: FretPosition;
  targetString: StringNumber;
  direction: 'ascending' | 'descending';
  intervalSemitones: number;
  intervalName: IntervalShortName;
  intervalLongName: IntervalLongName;
  referenceNoteName: string;
  title: string;
  eyebrow: string;
}

export function generateB2(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<B2Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const allowedIntervals = config?.intervals ?? COMMON_INTERVALS;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';
  const dirConfig = config?.direction ?? 'both';

  interface B2Candidate {
    fromStr: StringNumber;
    toStr: StringNumber;
    refFret: number;
    targetFret: number;
    semis: number;
    direction: 'ascending' | 'descending';
  }

  const candidates: B2Candidate[] = [];

  for (const fromStr of activeStrings) {
    for (const toStr of activeStrings) {
      if (fromStr === toStr) continue;

      for (const semis of allowedIntervals) {
        if (dirConfig === 'ascending' || dirConfig === 'both') {
          for (let rf = minFret; rf <= maxFret; rf++) {
            const refMidi = positionToMidi(tuning, { string: fromStr, fret: rf });
            const targetMidi = refMidi + semis;
            const tf = targetMidi - openMidi(tuning, toStr);
            if (tf >= minFret && tf <= maxFret) {
              candidates.push({
                fromStr,
                toStr,
                refFret: rf,
                targetFret: tf,
                semis,
                direction: 'ascending',
              });
            }
          }
        }

        if (dirConfig === 'descending' || dirConfig === 'both') {
          for (let rf = minFret; rf <= maxFret; rf++) {
            const refMidi = positionToMidi(tuning, { string: fromStr, fret: rf });
            const targetMidi = refMidi - semis;
            const tf = targetMidi - openMidi(tuning, toStr);
            if (tf >= minFret && tf <= maxFret) {
              candidates.push({
                fromStr,
                toStr,
                refFret: rf,
                targetFret: tf,
                semis,
                direction: 'descending',
              });
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback estándar: cuerda 3 traste 5 (C4) hacia cuerda 2 (E4 traste 5)
    candidates.push({
      fromStr: 3,
      toStr: 2,
      refFret: 5,
      targetFret: 5,
      semis: 4,
      direction: 'ascending',
    });
  }

  const chosen = adaptivePick(
    rng,
    candidates,
    (c) => `interval:${intervalName(c.semis)}|pair:${c.fromStr}-${c.toStr}`,
    stats,
    config?.adaptive ?? true,
  );

  const refPos: FretPosition = { string: chosen.fromStr, fret: chosen.refFret };
  const targetPos: FretPosition = { string: chosen.toStr, fret: chosen.targetFret };
  const refMidi = positionToMidi(tuning, refPos);
  const refPc = pitchClassOf(refMidi);
  const refNoteName = pcName(refPc, nameMode);
  const iShort = intervalName(chosen.semis);
  const iLong = intervalLongName(chosen.semis);

  const actionVerb = chosen.direction === 'ascending' ? 'sube una' : 'baja una';
  const title = `Desde ${refNoteName} (cuerda ${chosen.fromStr}), ${actionVerb} ${iLong} en la cuerda ${chosen.toStr}`;
  const qId = `b2-s${chosen.fromStr}to${chosen.toStr}-${iShort}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'B2',
    itemKey: `interval:${iShort}|pair:${chosen.fromStr}-${chosen.toStr}`,
    prompt: {
      referencePosition: refPos,
      targetString: chosen.toStr,
      direction: chosen.direction,
      intervalSemitones: chosen.semis,
      intervalName: iShort,
      intervalLongName: iLong,
      referenceNoteName: refNoteName,
      title,
      eyebrow: 'B2 · ENTRE CUERDAS',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: [targetPos],
    },
    mode: 'first',
  };
}

// -----------------------------------------------------------------------
// B3 · Nombra el intervalo
// -----------------------------------------------------------------------

export interface B3Prompt {
  fromPosition: FretPosition;
  toPosition: FretPosition;
  fromNoteName: string;
  toNoteName: string;
  semitones: number;
  intervalName: IntervalShortName;
  intervalLongName: IntervalLongName;
  title: string;
  eyebrow: string;
}

export function generateB3(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<B3Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const allowedIntervals = config?.intervals ?? COMMON_INTERVALS;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';

  interface B3Candidate {
    fromPos: FretPosition;
    toPos: FretPosition;
    semis: number;
  }

  const candidates: B3Candidate[] = [];

  for (const s1 of activeStrings) {
    for (const s2 of activeStrings) {
      for (let f1 = minFret; f1 <= maxFret; f1++) {
        const fromPos: FretPosition = { string: s1, fret: f1 };
        const m1 = positionToMidi(tuning, fromPos);

        for (let f2 = minFret; f2 <= maxFret; f2++) {
          if (s1 === s2 && f1 === f2) continue;
          const toPos: FretPosition = { string: s2, fret: f2 };
          const m2 = positionToMidi(tuning, toPos);
          const diff = m2 - m1;
          if (diff > 0 && allowedIntervals.includes(diff)) {
            candidates.push({ fromPos, toPos, semis: diff });
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      fromPos: { string: 4, fret: 2 },
      toPos: { string: 3, fret: 2 },
      semis: 5,
    });
  }

  const chosen = adaptivePick(
    rng,
    candidates,
    (c) => `interval:${intervalName(c.semis)}|pair:${c.fromPos.string}-${c.toPos.string}`,
    stats,
    config?.adaptive ?? true,
  );

  const m1 = positionToMidi(tuning, chosen.fromPos);
  const m2 = positionToMidi(tuning, chosen.toPos);
  const fromName = pcName(pitchClassOf(m1), nameMode);
  const toName = pcName(pitchClassOf(m2), nameMode);
  const iShort = intervalName(chosen.semis);
  const iLong = intervalLongName(chosen.semis);

  const title = `¿Qué intervalo hay de ${fromName} a ${toName}?`;
  const qId = `b3-${chosen.fromPos.string}f${chosen.fromPos.fret}-${chosen.toPos.string}f${chosen.toPos.fret}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'B3',
    itemKey: `interval:${iShort}|pair:${chosen.fromPos.string}-${chosen.toPos.string}`,
    prompt: {
      fromPosition: chosen.fromPos,
      toPosition: chosen.toPos,
      fromNoteName: fromName,
      toNoteName: toName,
      semitones: chosen.semis,
      intervalName: iShort,
      intervalLongName: iLong,
      title,
      eyebrow: 'B3 · NOMBRA EL INTERVALO',
    },
    answerKind: 'interval',
    expected: {
      kind: 'interval',
      semitones: chosen.semis,
      name: iShort,
    },
    mode: 'first',
  };
}

// -----------------------------------------------------------------------
// B4 · Mapa de intervalos
// -----------------------------------------------------------------------

export interface B4Prompt {
  rootPosition: FretPosition;
  rootNoteName: string;
  degree: Degree;
  intervalSemitones: number;
  intervalName: IntervalShortName;
  intervalLongName: IntervalLongName;
  title: string;
  eyebrow: string;
}

export function generateB4(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<B4Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const allowedIntervals = config?.intervals ?? [3, 4, 5, 7, 9, 10]; // Intervalos armónicos típicos (♭3, 3, 4, 5, 6, ♭7)
  const nameMode: NameMode = config?.nameMode ?? 'sharps';
  const mode = config?.mode ?? 'all';

  // Elige una posición de raíz en las cuerdas activas
  const rootCandidates: FretPosition[] = [];
  for (const s of activeStrings) {
    for (let f = minFret; f <= maxFret; f++) {
      rootCandidates.push({ string: s, fret: f });
    }
  }

  const chosenRoot = adaptivePick(
    rng,
    rootCandidates,
    (pos) => `root:s${pos.string}f${pos.fret}`,
    stats,
    config?.adaptive ?? true,
  );

  const rootMidi = positionToMidi(tuning, chosenRoot);
  const rootPc = pitchClassOf(rootMidi);
  const rootName = pcName(rootPc, nameMode);

  // Elige intervalo
  const semis = adaptivePick(
    rng,
    allowedIntervals,
    (i) => `interval:${intervalName(i)}`,
    stats,
    config?.adaptive ?? true,
  );

  const targetPc = ((rootPc + semis) % 12) as PitchClass;
  const deg = degreeName(semis);
  const iShort = intervalName(semis);
  const iLong = intervalLongName(semis);

  // Encuentra todas las posiciones de targetPc en las cuerdas activas y rango
  const matchingPositions: FretPosition[] = [];
  const orderedStrings = ([6, 5, 4, 3, 2, 1] as StringNumber[]).filter((s) =>
    activeStrings.includes(s),
  );

  for (const s of orderedStrings) {
    for (let f = minFret; f <= maxFret; f++) {
      const midi = positionToMidi(tuning, { string: s, fret: f });
      if (pitchClassOf(midi) === targetPc) {
        matchingPositions.push({ string: s, fret: f });
      }
    }
  }

  const title = `Marca todas las ${deg} alrededor de la raíz ${rootName}`;
  const qId = `b4-s${chosenRoot.string}f${chosenRoot.fret}-${deg}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'B4',
    itemKey: `interval:${iShort}`,
    prompt: {
      rootPosition: chosenRoot,
      rootNoteName: rootName,
      degree: deg,
      intervalSemitones: semis,
      intervalName: iShort,
      intervalLongName: iLong,
      title,
      eyebrow: 'B4 · MAPA DE INTERVALOS',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: matchingPositions,
    },
    mode,
  };
}
