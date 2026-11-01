import type { PitchClass } from '../core/pitch';
import type { ChordQuality } from '../data/chords';

/**
 * Numeración romana cromática relativa a la tónica: las alteraciones (♭) se toman respecto a la
 * escala mayor de esa tónica (p. ej. 10 semitonos → ♭VII, 3 → ♭III, 6 → ♭V).
 */
export const CHROMATIC_ROMAN = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '♭V',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII',
] as const;

/** Calidades que se escriben con numeral en minúscula (tercera menor). */
const MINOR_LIKE = new Set<string>(['m', 'm7', 'm6', 'dim', 'm7b5', 'dim7', 'mMaj7', 'madd9']);

/**
 * Numeral romano de un acorde (fundamental `root`, calidad `q`) respecto a la tónica `tonic`:
 * mayúscula = mayor/aumentado/sus/5, minúscula = menor/disminuido, alteración ♭ respecto a la
 * escala mayor y sufijo de calidad (`°`, `+`, `7`, `ø7`, `°7`, `(maj7)`, `maj7`, `sus4`…).
 * Ejemplos en Do: G7 → `V7`, Am → `vi`, B♭ → `♭VII`, Bdim → `vii°`, Fm → `iv`.
 */
export function romanNumeral(tonic: PitchClass, root: PitchClass, q: ChordQuality): string {
  const semitones = (root - tonic + 12) % 12;
  const base = CHROMATIC_ROMAN[semitones]!;
  const numeral = MINOR_LIKE.has(q.id) ? base.toLowerCase() : base;
  let suffix = '';
  if (q.id === 'dim') suffix = '°';
  else if (q.id === 'aug') suffix = '+';
  else if (q.id === 'm7') suffix = '7';
  else if (q.id === 'm6') suffix = '6';
  else if (q.id === 'm7b5') suffix = 'ø7';
  else if (q.id === 'dim7') suffix = '°7';
  else if (q.id === 'mMaj7') suffix = '(maj7)';
  else if (q.id === 'madd9') suffix = '(add9)';
  else if (q.id !== 'maj' && q.id !== 'm') suffix = q.symbol;
  return `${numeral}${suffix}`;
}
