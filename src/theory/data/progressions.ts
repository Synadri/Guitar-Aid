import type { ChordQualityId } from './chords';

export type ProgressionId =
  | 'popI-V-vi-IV'
  | 'I-IV-V'
  | 'vi-IV-I-V'
  | 'ii-V-I'
  | 'ii7-V7-Imaj7'
  | 'I-vi-IV-V'
  | 'blues12Major'
  | 'i-VII-VI-VII'
  | 'i-VI-III-VII'
  | 'andaluza'
  | 'i-iv-v'
  | 'iidim-V-i'
  | 'blues12Minor';

export interface ProgressionStep {
  /** Numeración romana con alteración y calidad (p. ej. "ii", "♭VII", "V7"). */
  roman: string;
  /** Semitonos de la fundamental sobre la tónica de la tonalidad. */
  offset: number;
  quality: ChordQualityId;
}

export interface ProgressionTemplate {
  id: ProgressionId;
  /** Nombre mostrado: los romanos de los pasos unidos con guion largo. */
  name: string;
  /** Modo de la tonalidad en la que se define la plantilla. */
  mode: 'major' | 'minor';
  /** Peso por popularidad (0–100, sin empates), análogo a `SCALE_WEIGHTS`. */
  weight: number;
  steps: readonly ProgressionStep[];
}

/**
 * Pesos de popularidad de cada plantilla de progresión. Se ajustan aquí, no en el algoritmo.
 * Criterio: primero las progresiones más extendidas en música popular; las de jazz y blues
 * (que exigen séptimas) quedan después de las de tríadas. Sin empates a propósito.
 */
export const PROGRESSION_WEIGHTS: Readonly<Record<ProgressionId, number>> = {
  'popI-V-vi-IV': 100,
  'I-IV-V': 97,
  'i-VII-VI-VII': 96,
  'vi-IV-I-V': 94,
  'i-VI-III-VII': 92,
  'ii-V-I': 90,
  andaluza: 89,
  'I-vi-IV-V': 87,
  'i-iv-v': 86,
  'ii7-V7-Imaj7': 84,
  'iidim-V-i': 82,
  blues12Major: 80,
  blues12Minor: 78,
};

const step = (roman: string, offset: number, quality: ChordQualityId): ProgressionStep => ({
  roman,
  offset,
  quality,
});

const I = step('I', 0, 'maj');
const IV = step('IV', 5, 'maj');
const V = step('V', 7, 'maj');
const vi = step('vi', 9, 'm');
const ii = step('ii', 2, 'm');
const i = step('i', 0, 'm');
const iv = step('iv', 5, 'm');
const bIII = step('♭III', 3, 'maj');
const bVI = step('♭VI', 8, 'maj');
const bVII = step('♭VII', 10, 'maj');

const RAW: readonly Omit<ProgressionTemplate, 'weight' | 'name'>[] = [
  { id: 'popI-V-vi-IV', mode: 'major', steps: [I, V, vi, IV] },
  { id: 'I-IV-V', mode: 'major', steps: [I, IV, V] },
  { id: 'vi-IV-I-V', mode: 'major', steps: [vi, IV, I, V] },
  { id: 'ii-V-I', mode: 'major', steps: [ii, V, I] },
  { id: 'I-vi-IV-V', mode: 'major', steps: [I, vi, IV, V] },
  {
    id: 'ii7-V7-Imaj7',
    mode: 'major',
    steps: [step('ii7', 2, 'm7'), step('V7', 7, '7'), step('Imaj7', 0, 'maj7')],
  },
  {
    id: 'blues12Major',
    mode: 'major',
    steps: [step('I7', 0, '7'), step('IV7', 5, '7'), step('V7', 7, '7')],
  },
  { id: 'i-VII-VI-VII', mode: 'minor', steps: [i, bVII, bVI, bVII] },
  { id: 'i-VI-III-VII', mode: 'minor', steps: [i, bVI, bIII, bVII] },
  { id: 'andaluza', mode: 'minor', steps: [i, bVII, bVI, V] },
  { id: 'i-iv-v', mode: 'minor', steps: [i, iv, step('v', 7, 'm')] },
  { id: 'iidim-V-i', mode: 'minor', steps: [step('ii°', 2, 'dim'), V, i] },
  {
    id: 'blues12Minor',
    mode: 'minor',
    steps: [step('i7', 0, 'm7'), step('iv7', 5, 'm7'), step('V7', 7, '7')],
  },
];

export const PROGRESSIONS: readonly ProgressionTemplate[] = RAW.map((t) => ({
  ...t,
  name: t.steps.map((s) => s.roman).join('–'),
  weight: PROGRESSION_WEIGHTS[t.id],
}));

export function getProgression(id: ProgressionId): ProgressionTemplate {
  const p = PROGRESSIONS.find((t) => t.id === id);
  if (!p) throw new Error(`Unknown progression: ${id}`);
  return p;
}
