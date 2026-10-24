import { type PcMask, pcsToMask } from '../core/pcset';
import type { PitchClass } from '../core/pitch';

/** Identificadores de las escalas del catálogo de la Fase 1. */
export type ScaleTypeId =
  | 'major'
  | 'minor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'majorBlues';

/** Familia (escala madre) de la que se derivan las escalas. */
export type ScaleFamilyId = 'major' | 'harmonicMinor' | 'melodicMinor' | 'blues';

/**
 * Pesos de cada escala en el catálogo (0–100). Se usan en el ranking justo después de
 * la coincidencia de raíz. Para ajustar resultados poco musicales se tocan aquí, no el algoritmo.
 *
 * Criterio: primero las escalas más habituales para improvisar sobre un acorde.
 * - Mayor y menor natural arriba (las más reconocibles); la menor queda 2 puntos por debajo de
 *   la mayor, pero por encima de dórico.
 * - Dórico (92) y pentatónica menor (90) detrás de la menor natural: Am7 → eólico, dórico,
 *   pentatónica menor.
 * - Pentatónica mayor (88) y mixolidio (85) por encima de lidio (80), de modo que Cmaj7 pone
 *   el jónico por encima del lidio, y el lidio por encima de las escalas más coloridas.
 * - Blues (75) y blues mayor (70) por debajo de las pentatónicas (añaden una nota de paso).
 * - Armónica (71) y blues mayor (70): sin empate a propósito. La armónica es bastante más
 *   popular (música clásica, metal, flamenco, dominante de la menor), mientras que el blues
 *   mayor es un nicho del género; por eso la armónica va un punto por encima.
 * - Melódica (68): útil pero más "de color".
 * - Frigio (60) y locrio (40) al final: más inestables o raros como primera opción.
 */
export const SCALE_WEIGHTS: Readonly<Record<ScaleTypeId, number>> = {
  major: 100,
  minor: 98,
  dorian: 92,
  minorPentatonic: 90,
  majorPentatonic: 88,
  mixolydian: 85,
  lydian: 80,
  blues: 75,
  majorBlues: 70,
  harmonicMinor: 71,
  melodicMinor: 68,
  phrygian: 60,
  locrian: 40,
};

/** Constantes de puntuación de los rankings de escalas (la puntuación refleja el orden). */
export const SCALE_RANKING_SCORING = {
  /** Bonificación cuando la tónica de la escala coincide con la raíz de entrada. */
  ROOT_MATCH_BONUS: 1000,
  /** Penalización por cada nota de la escala que no está en la entrada (< 1 punto de peso). */
  EXTRA_NOTE_PENALTY: 0.01,
} as const;

export interface ScaleType {
  id: ScaleTypeId;
  /** Nombre principal en español. */
  name: string;
  /** Otros nombres de la misma escala (p. ej. Jónico para la mayor). */
  aliases: readonly string[];
  /** Semitonos desde la tónica, ascendente, sin la octava. */
  intervals: readonly number[];
  weight: number;
  /** Familia / escala madre de la que procede. */
  family: ScaleFamilyId;
  /**
   * Semitonos de la tónica de esta escala sobre la tónica de la escala madre (p. ej. dórico: 2,
   * porque D dórico procede de C mayor). Ausente si la escala no es un modo de la familia (blues).
   */
  parentOffset?: number;
  /**
   * Escala relativa (mismas notas, otra tónica): tipo y semitonos de su tónica sobre la de esta
   * (p. ej. mayor → menor natural a +9; menor natural → mayor a +3). Ausente si no tiene.
   */
  relative?: { type: ScaleTypeId; offset: number };
  /**
   * Escala heptatónica (misma tónica) de la que se toman los acordes diatónicos cuando esta no
   * tiene siete notas (pentatónicas y blues). Ausente en las heptatónicas.
   */
  chordSource?: ScaleTypeId;
  /** Máscara de bits con la tónica en la clase 0 (rotar para transponer). */
  mask: PcMask;
}

type RawScale = Omit<ScaleType, 'weight' | 'mask'>;

const RAW_SCALES: readonly RawScale[] = [
  {
    id: 'major',
    relative: { type: 'minor', offset: 9 },
    name: 'Mayor',
    aliases: ['Jónico'],
    intervals: [0, 2, 4, 5, 7, 9, 11],
    family: 'major',
    parentOffset: 0,
  },
  {
    id: 'minor',
    relative: { type: 'major', offset: 3 },
    name: 'Menor natural',
    aliases: ['Eólico'],
    intervals: [0, 2, 3, 5, 7, 8, 10],
    family: 'major',
    parentOffset: 9,
  },
  {
    id: 'harmonicMinor',
    name: 'Menor armónica',
    aliases: [],
    intervals: [0, 2, 3, 5, 7, 8, 11],
    family: 'harmonicMinor',
    parentOffset: 0,
  },
  {
    id: 'melodicMinor',
    name: 'Menor melódica',
    aliases: [],
    intervals: [0, 2, 3, 5, 7, 9, 11],
    family: 'melodicMinor',
    parentOffset: 0,
  },
  {
    id: 'dorian',
    name: 'Dórico',
    aliases: [],
    intervals: [0, 2, 3, 5, 7, 9, 10],
    family: 'major',
    parentOffset: 2,
  },
  {
    id: 'phrygian',
    name: 'Frigio',
    aliases: [],
    intervals: [0, 1, 3, 5, 7, 8, 10],
    family: 'major',
    parentOffset: 4,
  },
  {
    id: 'lydian',
    name: 'Lidio',
    aliases: [],
    intervals: [0, 2, 4, 6, 7, 9, 11],
    family: 'major',
    parentOffset: 5,
  },
  {
    id: 'mixolydian',
    name: 'Mixolidio',
    aliases: [],
    intervals: [0, 2, 4, 5, 7, 9, 10],
    family: 'major',
    parentOffset: 7,
  },
  {
    id: 'locrian',
    name: 'Locrio',
    aliases: [],
    intervals: [0, 1, 3, 5, 6, 8, 10],
    family: 'major',
    parentOffset: 11,
  },
  {
    id: 'majorPentatonic',
    chordSource: 'major',
    relative: { type: 'minorPentatonic', offset: 9 },
    name: 'Pentatónica mayor',
    aliases: [],
    intervals: [0, 2, 4, 7, 9],
    family: 'major',
    parentOffset: 0,
  },
  {
    id: 'minorPentatonic',
    chordSource: 'minor',
    relative: { type: 'majorPentatonic', offset: 3 },
    name: 'Pentatónica menor',
    aliases: [],
    intervals: [0, 3, 5, 7, 10],
    family: 'major',
    parentOffset: 9,
  },
  {
    // Pentatónica menor + ♭5 (blue note).
    id: 'blues',
    chordSource: 'minor',
    relative: { type: 'majorBlues', offset: 3 },
    name: 'Blues',
    aliases: ['Blues menor'],
    intervals: [0, 3, 5, 6, 7, 10],
    family: 'blues',
  },
  {
    // 1, 2, ♭3, 3, 5, 6 (decisiones.md, aclaración 6).
    id: 'majorBlues',
    chordSource: 'major',
    relative: { type: 'blues', offset: 9 },
    name: 'Blues mayor',
    aliases: [],
    intervals: [0, 2, 3, 4, 7, 9],
    family: 'blues',
  },
];

export const SCALE_TYPES: readonly ScaleType[] = RAW_SCALES.map((s) => ({
  ...s,
  weight: SCALE_WEIGHTS[s.id],
  mask: pcsToMask(s.intervals as PitchClass[]),
}));

const SCALE_MAP = new Map<ScaleTypeId, ScaleType>(SCALE_TYPES.map((s) => [s.id, s]));

export function getScaleType(id: ScaleTypeId): ScaleType {
  const s = SCALE_MAP.get(id);
  if (!s) throw new Error(`Unknown scale type: ${id}`);
  return s;
}

/** Clases de altura de la escala empezando por la tónica. */
export function scalePitchClasses(tonic: PitchClass, id: ScaleTypeId): PitchClass[] {
  return getScaleType(id).intervals.map((i) => ((tonic + i) % 12) as PitchClass);
}

/** Constantes de puntuación de `relatedScales` (los bonos separan los niveles; el peso desempata). */
export const RELATED_SCALE_SCORING = {
  /** Relativa mayor/menor (mismas notas, otra tónica). */
  RELATIVE_BONUS: 1000,
  /** Comparte escala madre (modos y pentatónicas de la misma tonalidad). */
  SHARED_PARENT_BONUS: 400,
  /** Misma tónica y difiere en pocas notas. */
  CLOSE_VARIANT_BONUS: 200,
  /** Máximo de notas distintas (suma de añadidas y quitadas) para ser variante cercana. */
  CLOSE_VARIANT_MAX_DIFF: 2,
} as const;
