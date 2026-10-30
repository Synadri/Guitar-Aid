import {
  type FretPosition,
  type NameMode,
  type PitchClass,
  type StringNumber,
  pcName,
  pitchClassOf,
  positionToMidi,
  STANDARD_TUNING,
} from '../../theory';
import type { Rng } from '../rng';
import { adaptivePick, type DrillStatsMap } from './adaptive';
import type { DrillConfig, DrillQuestion } from './types';

const NATURAL_PITCH_CLASSES: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
const ALL_PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DEFAULT_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const DEFAULT_RANGE: readonly [number, number] = [0, 12];

function normalizeRange(fretRange?: readonly [number, number] | [number, number]): [number, number] {
  if (!fretRange) return [DEFAULT_RANGE[0], DEFAULT_RANGE[1]];
  return [Math.min(fretRange[0], fretRange[1]), Math.max(fretRange[0], fretRange[1])];
}

export interface A1Prompt {
  pitchClass: PitchClass;
  noteName: string;
  title: string;
  eyebrow: string;
}

/**
 * Generador para A1 · Encuentra la nota.
 * Presenta el nombre de una nota y exige encontrar sus posiciones en las cuerdas activas.
 */
export function generateA1(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<A1Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const naturalOnly = config?.naturalOnly ?? false;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';
  const mode = config?.mode ?? 'all';

  const candidatePcs = naturalOnly ? NATURAL_PITCH_CLASSES : ALL_PITCH_CLASSES;
  const chosenPc = adaptivePick(
    rng,
    candidatePcs,
    (pc) => `note:${pc}`,
    stats,
    config?.adaptive ?? true,
  );

  // Calcula todas las posiciones donde suena chosenPc en las cuerdas activas y dentro del rango de trastes
  const matchingPositions: FretPosition[] = [];
  // Orden de cuerdas 6 a 1 para consistencia
  const orderedStrings = ([6, 5, 4, 3, 2, 1] as StringNumber[]).filter((s) =>
    activeStrings.includes(s),
  );

  for (const s of orderedStrings) {
    for (let f = minFret; f <= maxFret; f++) {
      const midi = positionToMidi(tuning, { string: s, fret: f });
      if (pitchClassOf(midi) === chosenPc) {
        matchingPositions.push({ string: s, fret: f });
      }
    }
  }

  const noteName = pcName(chosenPc, nameMode);
  const qId = `a1-${chosenPc}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'A1',
    itemKey: `note:${chosenPc}`,
    prompt: {
      pitchClass: chosenPc,
      noteName,
      title: `Encuentra la nota ${noteName} en las cuerdas activas`,
      eyebrow: 'A1 · ENCUENTRA LA NOTA',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: matchingPositions,
    },
    mode,
  };
}

export interface A2Prompt {
  position: FretPosition;
  midi: number;
  pitchClass: PitchClass;
  noteName: string;
  title: string;
  eyebrow: string;
}

/**
 * Generador para A2 · Nombra la nota.
 * Marca una posición en el mástil y exige seleccionar la nota correspondiente.
 */
export function generateA2(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<A2Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const naturalOnly = config?.naturalOnly ?? false;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';

  // Genera todas las posiciones candidatas válidas en las cuerdas y trastes activos
  const candidates: { pos: FretPosition; pc: PitchClass; midi: number }[] = [];
  for (const s of activeStrings) {
    for (let f = minFret; f <= maxFret; f++) {
      const pos: FretPosition = { string: s, fret: f };
      const midi = positionToMidi(tuning, pos);
      const pc = pitchClassOf(midi);
      if (!naturalOnly || NATURAL_PITCH_CLASSES.includes(pc)) {
        candidates.push({ pos, pc, midi });
      }
    }
  }

  if (candidates.length === 0) {
    // Si no hubiera ninguna (caso extremo de configuración), fallback a cuerda 5 traste 3
    candidates.push({
      pos: { string: 5, fret: 3 },
      pc: 0,
      midi: positionToMidi(tuning, { string: 5, fret: 3 }),
    });
  }

  const chosen = adaptivePick(
    rng,
    candidates,
    (c) => `pos:s${c.pos.string}f${c.pos.fret}`,
    stats,
    config?.adaptive ?? true,
  );

  const noteName = pcName(chosen.pc, nameMode);
  const qId = `a2-s${chosen.pos.string}f${chosen.pos.fret}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'A2',
    itemKey: `pos:s${chosen.pos.string}f${chosen.pos.fret}`,
    prompt: {
      position: chosen.pos,
      midi: chosen.midi,
      pitchClass: chosen.pc,
      noteName,
      title: `¿Qué nota es la posición marcada en la cuerda ${chosen.pos.string}, traste ${chosen.pos.fret}?`,
      eyebrow: 'A2 · NOMBRA LA NOTA',
    },
    answerKind: 'pitchClass',
    expected: {
      kind: 'pitchClass',
      pitchClass: chosen.pc,
      noteName,
    },
    mode: 'first',
  };
}
