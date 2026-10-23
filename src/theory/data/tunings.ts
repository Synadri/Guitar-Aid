export interface Tuning {
  id: string;
  name: string;
  /** Notas MIDI de las cuerdas al aire, de la más grave (cuerda 6) a la más aguda (cuerda 1). */
  strings: readonly number[];
}

const STANDARD = [40, 45, 50, 55, 59, 64] as const; // E2 A2 D3 G3 B3 E4
const shift = (base: readonly number[], n: number) => base.map((m) => m + n);

export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Estándar (E A D G B E)', strings: STANDARD },
  { id: 'dropD', name: 'Drop D', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
  { id: 'openG', name: 'Open G', strings: [38, 43, 50, 55, 59, 62] },
  { id: 'openD', name: 'Open D', strings: [38, 45, 50, 54, 57, 62] },
  { id: 'halfDown', name: 'Medio tono abajo (Eb)', strings: shift(STANDARD, -1) },
  { id: 'wholeDown', name: 'Un tono abajo (D)', strings: shift(STANDARD, -2) },
];

export const STANDARD_TUNING: Tuning = TUNINGS[0]!;

export function getTuning(id: string): Tuning | undefined {
  return TUNINGS.find((t) => t.id === id);
}
