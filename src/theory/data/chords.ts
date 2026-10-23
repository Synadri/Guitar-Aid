import {
  type Degree,
  type IntervalLongName,
  degreeName,
  intervalLongName,
  intervalName,
} from '../core/interval';
import { type PcMask, pcsToMask } from '../core/pcset';
import { type NameMode, type PitchClass, pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';

/** Calidades de acorde del catálogo de la Fase 1 (Requisitos §6.4). */
export type ChordQualityId =
  'maj' | 'm' | '7' | 'maj7' | 'm7' | 'dim' | 'aug' | 'sus2' | 'sus4' | '6' | 'm6' | '9';

export interface ChordQuality {
  id: ChordQualityId;
  /** Nombre descriptivo en español ("mayor", "menor", "m7", etc.). */
  name: string;
  /** Sufijo para el cifrado del acorde ("" para mayor, "m", "7", "maj7", etc.). */
  symbol: string;
  /**
   * Intervalos del acorde en orden funcional desde la fundamental (en semitonos;
   * 14 representa la 9ª mayor).
   */
  intervals: readonly number[];
  /** Clases de intervalo (0–11) obligatorias para reconocer el acorde. */
  required: readonly PitchClass[];
  /** Clases de intervalo (0–11) opcionales (p. ej. la 5ª justa en el acorde de 9). */
  optional: readonly PitchClass[];
  /** Peso intrínseco en el catálogo para desempatar candidatos. */
  weight: number;
  /** Máscara de bits precalculada de los intervalos requeridos. */
  requiredMask: PcMask;
  /** Máscara de bits precalculada de los intervalos opcionales. */
  optionalMask: PcMask;
  /** Unión de requeridos y opcionales. */
  allowedMask: PcMask;
}

export interface ChordTone {
  pc: PitchClass;
  name: string;
  /** Semitonos desde la fundamental según la definición del acorde (0–14). */
  semitones: number;
  /** Nombre corto del intervalo ("P1", "m3", "P5", "m7", etc.). */
  interval: string;
  /** Nombre descriptivo del intervalo ("fundamental", "3ª menor", "5ª justa", "7ª menor", etc.). */
  intervalLong: IntervalLongName;
  /** Grado respecto a la fundamental ("1", "♭3", "5", "♭7", etc.). */
  degree: Degree;
  /** Si la nota puede omitirse en un voicing (p. ej. la 5ª en 9). */
  optional: boolean;
}

/** Pesos intrínsecos de cada calidad de acorde en el catálogo (centralizados para ajuste). */
export const CHORD_QUALITY_WEIGHTS: Readonly<Record<ChordQualityId, number>> = {
  maj: 100,
  m: 95,
  '7': 90,
  maj7: 89,
  m7: 88,
  '6': 88,
  '9': 85,
  m6: 84,
  sus4: 78,
  sus2: 76,
  dim: 74,
  aug: 72,
};

/** Constantes de puntuación para `detectChords` (centralizadas junto a los pesos del catálogo). */
export const CHORD_DETECTION_SCORING = {
  /** Bonificación cuando la fundamental del candidato coincide con `input.root`. */
  ROOT_MATCH_BONUS: 1000,
  /** Penalización por cada nota opcional del acorde omitida en la entrada. */
  OMITTED_OPTIONAL_PENALTY: 200,
  /** Factor multiplicador para el peso extra (`weight - 1`) de la nota que actúa como raíz. */
  ROOT_NOTE_WEIGHT_FACTOR: 10,
} as const;

interface RawChordQuality {
  id: ChordQualityId;
  name: string;
  symbol: string;
  intervals: readonly number[];
  required: readonly PitchClass[];
  optional: readonly PitchClass[];
}

const RAW_CHORD_QUALITIES: readonly RawChordQuality[] = [
  {
    id: 'maj',
    name: 'mayor',
    symbol: '',
    intervals: [0, 4, 7],
    required: [0, 4, 7],
    optional: [],
  },
  {
    id: 'm',
    name: 'menor',
    symbol: 'm',
    intervals: [0, 3, 7],
    required: [0, 3, 7],
    optional: [],
  },
  {
    id: '7',
    name: '7',
    symbol: '7',
    intervals: [0, 4, 7, 10],
    required: [0, 4, 7, 10],
    optional: [],
  },
  {
    id: 'maj7',
    name: 'maj7',
    symbol: 'maj7',
    intervals: [0, 4, 7, 11],
    required: [0, 4, 7, 11],
    optional: [],
  },
  {
    id: 'm7',
    name: 'm7',
    symbol: 'm7',
    intervals: [0, 3, 7, 10],
    required: [0, 3, 7, 10],
    optional: [],
  },
  {
    id: '6',
    name: '6',
    symbol: '6',
    intervals: [0, 4, 7, 9],
    required: [0, 4, 7, 9],
    optional: [],
  },
  {
    id: 'm6',
    name: 'm6',
    symbol: 'm6',
    intervals: [0, 3, 7, 9],
    required: [0, 3, 7, 9],
    optional: [],
  },
  {
    id: '9',
    name: '9',
    symbol: '9',
    intervals: [0, 4, 7, 10, 14],
    required: [0, 4, 10, 2],
    optional: [7],
  },
  {
    id: 'sus4',
    name: 'sus4',
    symbol: 'sus4',
    intervals: [0, 5, 7],
    required: [0, 5, 7],
    optional: [],
  },
  {
    id: 'sus2',
    name: 'sus2',
    symbol: 'sus2',
    intervals: [0, 2, 7],
    required: [0, 2, 7],
    optional: [],
  },
  {
    id: 'dim',
    name: 'disminuido',
    symbol: 'dim',
    intervals: [0, 3, 6],
    required: [0, 3, 6],
    optional: [],
  },
  {
    id: 'aug',
    name: 'aumentado',
    symbol: 'aug',
    intervals: [0, 4, 8],
    required: [0, 4, 8],
    optional: [],
  },
];

export const CHORD_QUALITIES: readonly ChordQuality[] = RAW_CHORD_QUALITIES.map((q) => {
  const requiredMask = pcsToMask(q.required);
  const optionalMask = pcsToMask(q.optional);
  return {
    ...q,
    weight: CHORD_QUALITY_WEIGHTS[q.id],
    requiredMask,
    optionalMask,
    allowedMask: requiredMask | optionalMask,
  };
});

const QUALITY_MAP = new Map<ChordQualityId, ChordQuality>(CHORD_QUALITIES.map((q) => [q.id, q]));

export function getChordQuality(id: ChordQualityId): ChordQuality {
  const q = QUALITY_MAP.get(id);
  if (!q) throw new Error(`Unknown chord quality: ${id}`);
  return q;
}

/** Clases de altura del acorde en orden funcional desde la fundamental. */
export function chordPitchClasses(root: PitchClass, qualityId: ChordQualityId): PitchClass[] {
  const q = getChordQuality(qualityId);
  return q.intervals.map((semitones) => pitchClassOf(root + semitones));
}

function toneMeta(
  qualityId: ChordQualityId,
  semitones: number,
): { interval: string; intervalLong: IntervalLongName; degree: Degree } {
  if (qualityId === 'dim' && semitones === 6) {
    return { interval: 'd5', intervalLong: '5ª disminuida', degree: '♭5' };
  }
  if (qualityId === 'aug' && semitones === 8) {
    return { interval: 'A5', intervalLong: '5ª aumentada', degree: '♯5' };
  }
  if (semitones === 14) {
    return { interval: 'M9', intervalLong: '9ª mayor', degree: '9' };
  }
  return {
    interval: intervalName(semitones),
    intervalLong: intervalLongName(semitones),
    degree: degreeName(semitones),
  };
}

/**
 * Notas del acorde con su nombre, intervalo (corto y largo) y grado respecto a la fundamental.
 * Ejemplo: Am7 → A (fundamental, 1), C (3ª menor, ♭3), E (5ª justa, 5), G (7ª menor, ♭7).
 */
export function chordTones(
  root: PitchClass,
  qualityId: ChordQualityId,
  mode: NameMode = 'sharps',
): ChordTone[] {
  const q = getChordQuality(qualityId);
  const optionalSet = new Set<number>(q.optional);
  return q.intervals.map((semitones) => {
    const relPc = pitchClassOf(semitones);
    const pc = pitchClassOf(root + semitones);
    const meta = toneMeta(qualityId, semitones);
    return {
      pc,
      name: pcName(pc, mode),
      semitones,
      interval: meta.interval,
      intervalLong: meta.intervalLong,
      degree: meta.degree,
      optional: optionalSet.has(relPc),
    };
  });
}
