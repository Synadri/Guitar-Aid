import type {
  ChordQualityId,
  NameMode,
  ScaleTypeId,
  StringNumber,
  Tuning,
} from '../../theory';
import type { ExpectedAnswer } from '../answers';

export type DrillId =
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'B5'
  | 'C1'
  | 'C2';

export type DrillGroup = 'notes' | 'intervals' | 'build';

export type AnswerKind = 'positions' | 'pitchClass' | 'interval' | 'labels' | 'choice';

export type QuestionMode = 'all' | 'first';

/** Configuración de una sesión de ejercicio. */
export interface DrillConfig {
  tuning?: Tuning;
  activeStrings?: readonly StringNumber[];
  fretRange?: readonly [number, number] | [number, number];
  direction?: 'ascending' | 'descending' | 'both';
  mode?: QuestionMode;
  naturalOnly?: boolean;
  nameMode?: NameMode;
  intervals?: readonly number[];
  qualities?: readonly ChordQualityId[];
  scaleTypes?: readonly ScaleTypeId[];
  showInlays?: boolean;
  playAudio?: boolean;
  adaptive?: boolean;
}

/** Modelo estándar de una pregunta generada para un ejercicio. */
export interface DrillQuestion<P = unknown> {
  /** Identificador único y estable dentro de la sesión. */
  id: string;
  /** Identificador del ejercicio del catálogo (A1–C2). */
  drill: DrillId;
  /** Clave estadística (p. ej. "interval:m3|pair:3-2"), base del modo adaptativo. */
  itemKey: string;
  /** Datos requeridos por la vista para presentar la pregunta (título, notas o posiciones de referencia). */
  prompt: P;
  /** Tipo de interacción requerida para responder. */
  answerKind: AnswerKind;
  /** Conjunto de posiciones, nota, intervalo o etiquetas esperadas. */
  expected: ExpectedAnswer;
  /** Modo de evaluación: 'all' (todas las posiciones) o 'first' (basta con la primera). */
  mode: QuestionMode;
}

/** Metadatos de catálogo de un ejercicio para presentación en la UI. */
export interface DrillInfo {
  id: DrillId;
  group: DrillGroup;
  name: string;
  description: string;
  defaultMode: QuestionMode;
  answerKind: AnswerKind;
  supportsDirection?: boolean;
}

export const DRILL_CATALOG: readonly DrillInfo[] = [
  {
    id: 'A1',
    group: 'notes',
    name: 'Encuentra la nota',
    description: 'Encuentra en el mástil las posiciones de la nota indicada.',
    defaultMode: 'all',
    answerKind: 'positions',
  },
  {
    id: 'A2',
    group: 'notes',
    name: 'Nombra la nota',
    description: 'Identifica qué nota suena en la posición marcada en el mástil.',
    defaultMode: 'first',
    answerKind: 'pitchClass',
  },
  {
    id: 'B1',
    group: 'intervals',
    name: 'Intervalo en una cuerda',
    description: 'Calcula y pulsa el intervalo indicado a lo largo de la misma cuerda.',
    defaultMode: 'first',
    answerKind: 'positions',
    supportsDirection: true,
  },
  {
    id: 'B2',
    group: 'intervals',
    name: 'Intervalo entre cuerdas',
    description: 'Resuelve el intervalo pasando de una cuerda de origen a otra de destino.',
    defaultMode: 'first',
    answerKind: 'positions',
    supportsDirection: true,
  },
  {
    id: 'B3',
    group: 'intervals',
    name: 'Nombra el intervalo',
    description: 'Determina el intervalo existente entre dos posiciones marcadas.',
    defaultMode: 'first',
    answerKind: 'interval',
    supportsDirection: true,
  },
  {
    id: 'B4',
    group: 'intervals',
    name: 'Mapa de intervalos',
    description: 'Marca todas las posiciones de un intervalo alrededor de una nota fundamental.',
    defaultMode: 'all',
    answerKind: 'positions',
  },
  {
    id: 'B5',
    group: 'intervals',
    name: 'Etiqueta la forma',
    description: 'Asigna el grado armónico correspondiente a cada nota de un acorde o voicing conocido.',
    defaultMode: 'all',
    answerKind: 'labels',
  },
  {
    id: 'C1',
    group: 'build',
    name: 'Construye el acorde',
    description: 'Construye la digitación de un acorde en el mástil a partir de la fundamental marcada.',
    defaultMode: 'all',
    answerKind: 'positions',
  },
  {
    id: 'C2',
    group: 'build',
    name: 'Escala en una cuerda',
    description: 'Toca los tonos de una escala de forma lineal a lo largo de una sola cuerda.',
    defaultMode: 'all',
    answerKind: 'positions',
    supportsDirection: true,
  },
];
