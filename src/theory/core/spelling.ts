import { type NameMode, type PitchClass, octaveOf, pitchClassOf, toMidi } from './pitch';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

/** Nombre de una clase de altura según el modo de enarmonía (A♯ o B♭). */
export function pcName(pc: PitchClass, mode: NameMode = 'sharps'): string {
  return (mode === 'sharps' ? SHARP_NAMES : FLAT_NAMES)[pc];
}

/** Nombre con octava, p. ej. 52 → "E3". */
export function midiToName(midi: number, mode: NameMode = 'sharps'): string {
  return pcName(pitchClassOf(midi), mode) + octaveOf(midi);
}

const NOTE_RE = /^([A-Ga-g])([#♯b♭]?)(-?\d+)$/;
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Inversa de midiToName. Acepta #, ♯, b y ♭. Devuelve null si no es válido. */
export function nameToMidi(name: string): number | null {
  const m = NOTE_RE.exec(name.trim());
  if (!m) return null;
  const letter = m[1]!.toUpperCase();
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const midi = (Number(m[3]) + 1) * 12 + NATURALS[letter]! + acc;
  return midi;
}

export { toMidi };
