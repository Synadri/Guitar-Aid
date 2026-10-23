import type { Tuning } from '../data/tunings';

/** Cuerda 1 = la más aguda, 6 = la más grave. */
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export interface FretPosition {
  string: StringNumber;
  fret: number;
}

export const DEFAULT_FRETS = 24;

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
