import { STANDARD_TUNING, type Tuning } from '../data/tunings';

/** Cuerda 1 = la más aguda, 6 = la más grave. */
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export interface FretPosition {
  string: StringNumber;
  fret: number;
}

export const DEFAULT_FRETS = 24;

export type FretRange = [min: number, max: number] | { min?: number; max?: number };

export interface PositionsAtIntervalOptions {
  strings?: readonly StringNumber[] | StringNumber[];
  fretRange?: FretRange;
}

function openMidi(tuning: Tuning, string: StringNumber): number {
  // strings va de grave a aguda: la cuerda 6 es el índice 0.
  return tuning.strings[tuning.strings.length - string]!;
}

/** Nota MIDI de una posición (cuerda, traste). */
export function positionToMidi(tuning: Tuning, pos: FretPosition): number {
  return openMidi(tuning, pos.string) + pos.fret;
}

/** Todas las posiciones de una nota en el mástil, ordenadas de cuerda 6 a 1. */
export function midiToPositions(
  tuning: Tuning,
  midi: number,
  frets: number = DEFAULT_FRETS,
): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = tuning.strings.length; s >= 1; s--) {
    const fret = midi - openMidi(tuning, s as StringNumber);
    if (fret >= 0 && fret <= frets) out.push({ string: s as StringNumber, fret });
  }
  return out;
}

/** Posiciones equivalentes: las demás posiciones con la misma nota que `pos`. */
export function equivalentPositions(
  tuning: Tuning,
  pos: FretPosition,
  frets: number = DEFAULT_FRETS,
): FretPosition[] {
  return midiToPositions(tuning, positionToMidi(tuning, pos), frets).filter(
    (p) => p.string !== pos.string || p.fret !== pos.fret,
  );
}

/**
 * Recoloca una nota al cambiar de afinación. Conserva la cuerda si la nota
 * sigue existiendo en ella; si no, elige la posición con el traste más
 * cercano al original. Devuelve null si la nota no existe en ninguna posición.
 */
export function relocatePosition(
  newTuning: Tuning,
  midi: number,
  previous: FretPosition,
  frets: number = DEFAULT_FRETS,
): FretPosition | null {
  const candidates = midiToPositions(newTuning, midi, frets);
  if (candidates.length === 0) return null;
  const sameString = candidates.find((p) => p.string === previous.string);
  if (sameString) return sameString;
  return candidates.reduce((best, p) =>
    Math.abs(p.fret - previous.fret) < Math.abs(best.fret - previous.fret) ? p : best,
  );
}

/**
 * Semitonos entre dos posiciones del mástil (posB - posA, positivo si posB es más aguda).
 * Si no se especifica afinación, se usa STANDARD_TUNING.
 * Si las posiciones están en la misma cuerda, la diferencia es posB.fret - posA.fret
 * de forma directa sin depender de la afinación.
 */
export function intervalBetween(
  posA: FretPosition,
  posB: FretPosition,
  tuning?: Tuning,
): number;
export function intervalBetween(
  tuning: Tuning,
  posA: FretPosition,
  posB: FretPosition,
): number;
export function intervalBetween(
  arg1: FretPosition | Tuning,
  arg2: FretPosition,
  arg3?: FretPosition | Tuning,
): number {
  let tuning: Tuning;
  let posA: FretPosition;
  let posB: FretPosition;

  if ('strings' in arg1 && 'id' in arg1) {
    tuning = arg1;
    posA = arg2;
    posB = arg3 as FretPosition;
  } else {
    posA = arg1;
    posB = arg2;
    tuning = (arg3 as Tuning | undefined) ?? STANDARD_TUNING;
  }

  if (posA.string === posB.string) {
    return posB.fret - posA.fret;
  }
  return positionToMidi(tuning, posB) - positionToMidi(tuning, posA);
}

/**
 * Encuentra todas las posiciones en el mástil que están a una distancia de `semis`
 * semitonos respecto a `pos`, opcionalmente filtradas por cuerdas activas y rango de trastes.
 *
 * `semis`: distancia con signo (positivo = ascendente, negativo = descendente).
 */
export function positionsAtInterval(
  tuning: Tuning,
  pos: FretPosition,
  semis: number,
  options?: PositionsAtIntervalOptions,
): FretPosition[] {
  const targetMidi = positionToMidi(tuning, pos) + semis;

  let minFret = 0;
  let maxFret = DEFAULT_FRETS;

  if (options?.fretRange) {
    if (Array.isArray(options.fretRange)) {
      minFret = options.fretRange[0];
      maxFret = options.fretRange[1];
    } else {
      if (options.fretRange.min !== undefined) minFret = options.fretRange.min;
      if (options.fretRange.max !== undefined) maxFret = options.fretRange.max;
    }
  }

  const all = midiToPositions(tuning, targetMidi, maxFret);
  return all.filter((p) => {
    if (p.fret < minFret || p.fret > maxFret) return false;
    if (options?.strings && !options.strings.includes(p.string)) return false;
    return true;
  });
}
