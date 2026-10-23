/** Clase de altura: 0 = C … 11 = B. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Modo de deletreo de las notas alteradas. */
export type NameMode = 'sharps' | 'flats';

/** Convención: MIDI 60 = C4 (por tanto E3 = 52, A2 = 45). */
export function pitchClassOf(midi: number): PitchClass {
  return (((midi % 12) + 12) % 12) as PitchClass;
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function toMidi(pc: PitchClass, octave: number): number {
  return (octave + 1) * 12 + pc;
}
