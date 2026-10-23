import type { PitchClass } from './pitch';

const NAMES = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7'] as const;

const LONG_NAMES = [
  'fundamental',
  '2ª menor',
  '2ª mayor',
  '3ª menor',
  '3ª mayor',
  '4ª justa',
  'tritono',
  '5ª justa',
  '6ª menor',
  '6ª mayor',
  '7ª menor',
  '7ª mayor',
] as const;

const DEGREES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const;

export type IntervalShortName = (typeof NAMES)[number];
export type IntervalLongName =
  (typeof LONG_NAMES)[number] | '5ª disminuida' | '5ª aumentada' | '9ª mayor';
export type Degree = (typeof DEGREES)[number] | '♯4' | '♯5' | '9';

function mod12(semitones: number): number {
  return ((semitones % 12) + 12) % 12;
}

/** Semitonos con signo entre dos notas MIDI (positivo si `to` es más aguda). */
export function midiInterval(fromMidi: number, toMidi: number): number {
  return toMidi - fromMidi;
}

/** Semitonos ascendentes de a hasta b, módulo octava (0–11). */
export function pcInterval(from: PitchClass, to: PitchClass): number {
  return mod12(to - from);
}

/** Nombre corto del intervalo simple (0–11 semitonos), p. ej. "P1", "m3", "P5", "m7". */
export function intervalName(semitones: number): IntervalShortName {
  return NAMES[mod12(semitones)]!;
}

/**
 * Nombre descriptivo en español del intervalo respecto a la fundamental
 * (p. ej. 0 → "fundamental", 3 → "3ª menor", 7 → "5ª justa", 10 → "7ª menor").
 */
export function intervalLongName(semitones: number): IntervalLongName {
  if (semitones === 14) return '9ª mayor';
  return LONG_NAMES[mod12(semitones)]!;
}

/** Grado cromático respecto a la tónica/fundamental (0–11 semitonos; 14 → "9"). */
export function degreeName(semitones: number): Degree {
  if (semitones === 14) return '9';
  return DEGREES[mod12(semitones)]!;
}

/** Grado de `to` respecto a la raíz `from`. */
export function pcDegree(from: PitchClass, to: PitchClass): Degree {
  return degreeName(pcInterval(from, to));
}
