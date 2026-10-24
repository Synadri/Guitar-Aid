import type { PitchClass } from '../core/pitch';
import type { ChordQualityId } from '../data/chords';
import type { ScaleTypeId } from '../data/scales';

/** Nota por clase de altura con peso de relevancia (1 = normal). */
export interface WeightedPc {
  pc: PitchClass;
  weight: number;
}

/** Entrada estándar de las funciones de análisis armónico y melódico. */
export interface AnalysisInput {
  notes: readonly WeightedPc[];
  root?: PitchClass;
}

/** Códigos estructurados de razón (la UI los traduce a texto; los tests comprueban el código). */
export type ReasonCode =
  | 'containsChordTones'
  | 'rootMatches'
  | 'invertedBass'
  | 'omitsOptionalTones'
  | 'scaleContainsAllNotes'
  | 'tonicMatches'
  | 'noteRoleInChord'
  | 'scaleContainsNote'
  | 'scaleExtraNotes'
  | 'scaleCommonness'
  | 'sharedParentScale'
  | 'relativeScale'
  | 'closeScaleVariant'
  | 'appearsInKey';

export interface Reason {
  code: ReasonCode;
  params?: Record<string, string | number>;
}

export interface Candidate<T> {
  value: T;
  score: number;
  reasons: Reason[];
}

/** Referencia a un acorde concreto (raíz + calidad, y bajo opcional en inversiones). */
export interface ChordRef {
  root: PitchClass;
  quality: ChordQualityId;
  /** Nombre base del acorde según el modo de enarmonía (p. ej. "C", "Am7", "C6"). */
  name: string;
  /** Bajo cuando difiere de la fundamental del acorde (p. ej. 0 en Am7/C). */
  bass?: PitchClass;
}

/** Referencia a una escala concreta (tónica + tipo del catálogo). */
export interface ScaleRef {
  tonic: PitchClass;
  type: ScaleTypeId;
  /** Nombre base (p. ej. "A Dórico") según el modo de enarmonía. */
  name: string;
}
