import type { PitchClass } from '../core/pitch';
import { degreeName, intervalLongName, type Degree, type IntervalLongName } from '../core/interval';
import { chordTones, type ChordQualityId } from '../data/chords';
import { getScaleType, type ScaleTypeId } from '../data/scales';
import type { ChordRef, ScaleRef } from '../analysis/types';
import type { FormulaTone } from './types';

/**
 * Resuelve el grado y el nombre largo de intervalo para un semitono dentro de una escala.
 * Respeta casos especiales de ortografía armónica (p. ej. en lidio el tritono es ♯4 / 4ª aumentada).
 */
function scaleIntervalMeta(
  typeId: ScaleTypeId,
  semitones: number,
): { degree: Degree; intervalLong: IntervalLongName } {
  if (typeId === 'lydian' && semitones === 6) {
    return { degree: '♯4', intervalLong: '4ª aumentada' };
  }
  return {
    degree: degreeName(semitones),
    intervalLong: intervalLongName(semitones),
  };
}

/**
 * Resuelve la fórmula de un acorde: lista de tonos con semitonos, grado, nombre largo del intervalo y clase de altura.
 *
 * Ejemplo:
 * - Am7 → 1 ♭3 5 ♭7 (A C E G)
 * - Bm7♭5 → 1 ♭3 ♭5 ♭7 (B D F A)
 */
export function formulaOfChord(
  chord: ChordRef | { root: PitchClass; quality: ChordQualityId },
): FormulaTone[] {
  const tones = chordTones(chord.root, chord.quality);
  return tones.map((t) => ({
    semitones: t.semitones,
    degree: t.degree,
    intervalLong: t.intervalLong,
    pc: t.pc,
    ...(t.optional ? { optional: true } : {}),
  }));
}

/**
 * Resuelve la fórmula de una escala: lista de tonos con semitonos, grado, nombre largo del intervalo y clase de altura.
 *
 * Ejemplo:
 * - D dórico → 1 2 ♭3 4 5 6 ♭7 (D E F G A B C)
 */
export function formulaOfScale(
  scale: ScaleRef | { tonic: PitchClass; type: ScaleTypeId },
): FormulaTone[] {
  const st = getScaleType(scale.type);
  return st.intervals.map((semis) => {
    const pc = ((scale.tonic + semis) % 12) as PitchClass;
    const meta = scaleIntervalMeta(scale.type, semis);
    return {
      semitones: semis,
      degree: meta.degree,
      intervalLong: meta.intervalLong,
      pc,
    };
  });
}
