import type { NameMode, StringNumber } from '../../theory';

/** Papel visual de una marca (lo traduce a color, forma y borde la capa UI). */
export type MarkRole =
  | 'pinned'
  | 'root'
  | 'tone'
  | 'scale-bg'
  | 'preview'
  | 'equivalent'
  | 'question'
  | 'wrong'
  | 'missed'
  | 'correct';

export type LabelMode = 'note' | 'interval' | 'degree' | 'none';

export interface FretMark {
  string: StringNumber;
  fret: number;
  role: MarkRole;
  /** Si la marca (p. ej. una nota 'pinned') coincide además con la tónica/raíz activa. */
  isRoot?: boolean;
  label?: string;
}

export interface KeyMark {
  midi: number;
  role: MarkRole;
  /** Si la marca (p. ej. una nota 'pinned') coincide además con la tónica/raíz activa. */
  isRoot?: boolean;
  label?: string;
}

export interface MarksOptions {
  nameMode?: NameMode;
  labels?: LabelMode;
  /** Rango visible del piano (por defecto C2–C7: 36..96). */
  pianoRange?: { from: number; to: number };
}

export const DEFAULT_PIANO_RANGE = { from: 36, to: 96 } as const;

/** Prioridad al superponer marcas en una misma posición o tecla (mayor gana). */
export const ROLE_PRIORITY: Record<MarkRole, number> = {
  wrong: 9,
  correct: 9,
  missed: 8,
  question: 7,
  pinned: 6,
  root: 5,
  tone: 4,
  'scale-bg': 3,
  preview: 2,
  equivalent: 1,
};
