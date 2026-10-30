import type { Degree, IntervalLongName } from '../core/interval';
import type { NameMode, PitchClass } from '../core/pitch';
import type { Candidate } from '../analysis/types';
import type { ChordQualityId } from '../data/chords';
import type { ScaleTypeId } from '../data/scales';

/** Tono individual de una fórmula con su semitono, grado relativo, nombre de intervalo y clase de altura. */
export interface FormulaTone {
  semitones: number;
  degree: Degree;
  intervalLong: IntervalLongName;
  pc: PitchClass;
  optional?: boolean;
}

/** Referencia a un acorde en el resultado de fórmulas (con raíz concreta o abstracto por calidad). */
export interface FormulaChordRef {
  kind: 'chord';
  quality: ChordQualityId;
  name: string;
  root?: PitchClass;
  bass?: PitchClass;
}

/** Referencia a una escala en el resultado de fórmulas (con tónica concreta o abstracta por tipo). */
export interface FormulaScaleRef {
  kind: 'scale';
  type: ScaleTypeId;
  name: string;
  tonic?: PitchClass;
}

export type FormulaItemRef = FormulaChordRef | FormulaScaleRef;

/** Consulta para identificar acordes o escalas a partir de una colección de semitonos desde la raíz. */
export interface FormulaQuery {
  semitones: number[];
  root?: PitchClass;
  kind?: 'chord' | 'scale' | 'any';
  mode?: NameMode;
}

/** Resultado estructurado de búsqueda de fórmulas. */
export interface IdentifyFormulaResult {
  /** Coincidencias exactas con la misma colección de intervalos sobre la raíz. */
  exact: Candidate<FormulaItemRef>[];
  /** Candidatos a 1 nota de distancia (añadiendo o quitando una nota). */
  near: Candidate<FormulaItemRef>[];
  /** Mismas notas con otra raíz (inversiones / modos). */
  rotations: Candidate<FormulaItemRef>[];
}
