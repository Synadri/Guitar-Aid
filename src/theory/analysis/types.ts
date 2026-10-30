import type { PitchClass } from '../core/pitch';
import type { ChordQualityId } from '../data/chords';
import type { ProgressionId } from '../data/progressions';
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
  | 'chordExtraNotes'
  | 'scaleContainsNote'
  | 'scaleExtraNotes'
  | 'scaleCommonness'
  | 'sharedParentScale'
  | 'relativeScale'
  | 'closeScaleVariant'
  | 'appearsInKey'
  | 'progressionCommonness'
  | 'formulaExact'
  | 'formulaAddsTone'
  | 'formulaMissingTone'
  | 'sameNotesOtherRoot';

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

/** Tonalidad (tónica + modo mayor/menor). */
export interface KeyRef {
  tonic: PitchClass;
  mode: 'major' | 'minor';
  /** Nombre base (p. ej. "C mayor", "A menor"). */
  name: string;
}

/** Plantilla de progresión (los grados se resuelven contra una tonalidad). */
export interface ProgressionRef {
  id: ProgressionId;
  /** Nombre en números romanos (p. ej. "I–V–vi–IV"). */
  name: string;
}

/** Acorde diatónico: numeración romana + acorde concreto. */
export interface DiatonicChord {
  roman: string;
  chord: ChordRef;
}
