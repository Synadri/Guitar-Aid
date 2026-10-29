import type { PitchClass } from '../../core/pitch';
import type { StringNumber } from '../../fretboard';
import type { ChordQualityId } from '../chords';

import { getChordQuality } from '../chords';

/** Valor de traste por cuerda: número de traste (0 = al aire) o 'x' si está muteada. */
export type FretValue = number | 'x';

/** Trastes de las 6 cuerdas ordenadas de la más grave (cuerda 6) a la más aguda (cuerda 1). */
export type SixStringFrets = readonly [
  FretValue,
  FretValue,
  FretValue,
  FretValue,
  FretValue,
  FretValue,
];

/** Familias de voicings del catálogo (abiertas, cejilla 6ª/5ª, cuerdas 1–4 y cuerdas 1–3). */
export type VoicingFamily = 'open' | 'barre-E' | 'barre-A' | 'strings-1-4' | 'strings-1-3';

/** Inversión del voicing según la función de la nota más grave del acorde. */
export type VoicingInversion = 'root' | '1st' | '2nd' | '3rd';

/**
 * Determina la clase de altura que ocupa el bajo para una inversión dada de un acorde.
 * - 'root': fundamental
 * - '1st': 3ª (o 2ª en sus2, 4ª en sus4)
 * - '2nd': 5ª (o ♭5 en dim/m7b5, ♯5 en aug/maj7#5)
 * - '3rd': 7ª (o 6ª en 6/m6, 9ª en add9)
 */
export function inversionBassPitchClass(
  root: PitchClass,
  qualityId: ChordQualityId,
  inversion: VoicingInversion = 'root',
): PitchClass {
  if (inversion === 'root') return root;
  const q = getChordQuality(qualityId);
  const targetIndex = inversion === '1st' ? 1 : inversion === '2nd' ? 2 : 3;
  if (targetIndex >= q.intervals.length) return root;
  const semitones = q.intervals[targetIndex]!;
  return ((root + semitones) % 12) as PitchClass;
}

export interface OpenVoicingShape {
  id: string;
  quality: ChordQualityId;
  family: 'open';
  inversion?: VoicingInversion;
  /** Clase de altura fija de la fundamental en afinación estándar. */
  root: PitchClass;
  /** Cuerda en la que se encuentra la nota raíz en el bajo. */
  rootString: StringNumber;
  /** Trastes absolutos (cuerda 6 → 1). */
  frets: SixStringFrets;
}

export interface MovableVoicingShape {
  id: string;
  quality: ChordQualityId;
  family: 'barre-E' | 'barre-A' | 'strings-1-4' | 'strings-1-3';
  inversion?: VoicingInversion;
  /** Cuerda donde se ubica la referencia de la raíz. */
  rootString: StringNumber;
  /** Desplazamientos relativos al traste de la raíz en `rootString` (cuerda 6 → 1). */
  frets: SixStringFrets;
}

export type VoicingShape = OpenVoicingShape | MovableVoicingShape;

/**
 * Formas abiertas canónicas para la afinación estándar (E A D G B E).
 * No incluyen campo `fingers`: los dedos se calculan directamente desde los trastes.
 */
export const OPEN_VOICING_SHAPES: readonly OpenVoicingShape[] = [
  // maj
  {
    id: 'open-C-maj',
    quality: 'maj',
    family: 'open',
    root: 0,
    rootString: 5,
    frets: ['x', 3, 2, 0, 1, 0],
  },
  {
    id: 'open-D-maj',
    quality: 'maj',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 3, 2],
  },
  {
    id: 'open-E-maj',
    quality: 'maj',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 1, 0, 0],
  },
  {
    id: 'open-G-maj',
    quality: 'maj',
    family: 'open',
    root: 7,
    rootString: 6,
    frets: [3, 2, 0, 0, 0, 3],
  },
  {
    id: 'open-A-maj',
    quality: 'maj',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 2, 0],
  },

  // m
  {
    id: 'open-Dm',
    quality: 'm',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 3, 1],
  },
  {
    id: 'open-Em',
    quality: 'm',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 0, 0, 0],
  },
  {
    id: 'open-Am',
    quality: 'm',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 1, 0],
  },

  // 7
  {
    id: 'open-D7',
    quality: '7',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 1, 2],
  },
  {
    id: 'open-E7',
    quality: '7',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 0, 1, 0, 0],
  },
  {
    id: 'open-G7',
    quality: '7',
    family: 'open',
    root: 7,
    rootString: 6,
    frets: [3, 2, 0, 0, 0, 1],
  },
  {
    id: 'open-A7',
    quality: '7',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 0, 2, 0],
  },
  {
    id: 'open-B7',
    quality: '7',
    family: 'open',
    root: 11,
    rootString: 5,
    frets: ['x', 2, 1, 2, 0, 2],
  },

  // maj7
  {
    id: 'open-Cmaj7',
    quality: 'maj7',
    family: 'open',
    root: 0,
    rootString: 5,
    frets: ['x', 3, 2, 0, 0, 0],
  },
  {
    id: 'open-Dmaj7',
    quality: 'maj7',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 2, 2],
  },
  {
    id: 'open-Emaj7',
    quality: 'maj7',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 1, 1, 0, 0],
  },
  {
    id: 'open-Fmaj7',
    quality: 'maj7',
    family: 'open',
    root: 5,
    rootString: 4,
    frets: ['x', 'x', 3, 2, 1, 0],
  },
  {
    id: 'open-Amaj7',
    quality: 'maj7',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 1, 2, 0],
  },

  // m7
  {
    id: 'open-Dm7',
    quality: 'm7',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 1, 1],
  },
  {
    id: 'open-Em7',
    quality: 'm7',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 0, 0, 0, 0],
  },
  {
    id: 'open-Am7',
    quality: 'm7',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 0, 1, 0],
  },

  // 6
  {
    id: 'open-D6',
    quality: '6',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 0, 2],
  },
  {
    id: 'open-E6',
    quality: '6',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 1, 2, 0],
  },
  {
    id: 'open-G6',
    quality: '6',
    family: 'open',
    root: 7,
    rootString: 6,
    frets: [3, 2, 0, 0, 0, 0],
  },
  {
    id: 'open-A6',
    quality: '6',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 2, 2],
  },

  // m6
  {
    id: 'open-Dm6',
    quality: 'm6',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 0, 1],
  },
  {
    id: 'open-Em6',
    quality: 'm6',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 0, 2, 0],
  },
  {
    id: 'open-Am6',
    quality: 'm6',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 1, 2],
  },

  // 9
  {
    id: 'open-E9',
    quality: '9',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 0, 1, 0, 2],
  },
  {
    id: 'open-A9',
    quality: '9',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 4, 2, 3],
  },

  // sus4
  {
    id: 'open-Dsus4',
    quality: 'sus4',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 3, 3],
  },
  {
    id: 'open-Esus4',
    quality: 'sus4',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 2, 0, 0],
  },
  {
    id: 'open-Asus4',
    quality: 'sus4',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 3, 0],
  },

  // sus2
  {
    id: 'open-Dsus2',
    quality: 'sus2',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 3, 0],
  },
  {
    id: 'open-Esus2',
    quality: 'sus2',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 4, 4, 0, 0],
  },
  {
    id: 'open-Gsus2',
    quality: 'sus2',
    family: 'open',
    root: 7,
    rootString: 6,
    frets: [3, 0, 0, 0, 3, 3],
  },
  {
    id: 'open-Asus2',
    quality: 'sus2',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 0, 0],
  },

  // dim
  {
    id: 'open-Ddim',
    quality: 'dim',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 1, 3, 1],
  },
  {
    id: 'open-Edim',
    quality: 'dim',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 1, 2, 0, 'x', 'x'],
  },
  {
    id: 'open-Adim',
    quality: 'dim',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 1, 2, 1, 'x'],
  },

  // aug
  {
    id: 'open-Caug',
    quality: 'aug',
    family: 'open',
    root: 0,
    rootString: 5,
    frets: ['x', 3, 2, 1, 1, 0],
  },
  {
    id: 'open-Daug',
    quality: 'aug',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 3, 3, 2],
  },
  {
    id: 'open-Eaug',
    quality: 'aug',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 'x', 2, 1, 1, 0],
  },
  {
    id: 'open-Aaug',
    quality: 'aug',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 3, 2, 2, 'x'],
  },
  // 5 (power chords canónicos)
  {
    id: 'open-E5',
    quality: '5',
    family: 'open',
    root: 4,
    rootString: 6,
    frets: [0, 2, 2, 'x', 'x', 'x'],
  },
  {
    id: 'open-A5',
    quality: '5',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 2, 'x', 'x'],
  },
  {
    id: 'open-D5',
    quality: '5',
    family: 'open',
    root: 2,
    rootString: 4,
    frets: ['x', 'x', 0, 2, 3, 'x'],
  },
  // add9
  {
    id: 'open-Cadd9',
    quality: 'add9',
    family: 'open',
    root: 0,
    rootString: 5,
    frets: ['x', 3, 2, 0, 3, 0],
  },
  // madd9
  {
    id: 'open-Am-add9',
    quality: 'madd9',
    family: 'open',
    root: 9,
    rootString: 5,
    frets: ['x', 0, 2, 4, 1, 0],
  },
];

/**
 * Formas móviles de cejilla (raíz en cuerda 6 o 5) para las 19 calidades en afinación estándar.
 * Garantizan que las 19 calidades × 12 raíces tengan siempre al menos un voicing.
 */
export const BARRE_VOICING_SHAPES: readonly MovableVoicingShape[] = [
  // maj
  {
    id: 'barre-E-maj',
    quality: 'maj',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 2, 1, 0, 0],
  },
  {
    id: 'barre-A-maj',
    quality: 'maj',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 2, 0],
  },

  // m
  {
    id: 'barre-E-m',
    quality: 'm',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 2, 0, 0, 0],
  },
  {
    id: 'barre-A-m',
    quality: 'm',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 1, 0],
  },

  // 7
  {
    id: 'barre-E-7',
    quality: '7',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 0, 1, 0, 0],
  },
  {
    id: 'barre-A-7',
    quality: '7',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 0, 2, 0],
  },

  // maj7
  {
    id: 'barre-E-maj7',
    quality: 'maj7',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 1, 1, 0, 0],
  },
  {
    id: 'barre-A-maj7',
    quality: 'maj7',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 1, 2, 0],
  },

  // m7
  {
    id: 'barre-E-m7',
    quality: 'm7',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 0, 0, 0, 0],
  },
  {
    id: 'barre-A-m7',
    quality: 'm7',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 0, 1, 0],
  },

  // 6
  {
    id: 'barre-E-6',
    quality: '6',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 'x', 1, 2, 0],
  },
  {
    id: 'barre-A-6',
    quality: '6',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 2, 2],
  },

  // m6
  {
    id: 'barre-E-m6',
    quality: 'm6',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 'x', 0, 2, 0],
  },
  {
    id: 'barre-A-m6',
    quality: 'm6',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 'x', 1, 2],
  },

  // 9
  {
    id: 'barre-E-9',
    quality: '9',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 0, 1, 0, 2],
  },
  {
    id: 'barre-A-9',
    quality: '9',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, -1, 0, 0, 0],
  },

  // sus4
  {
    id: 'barre-E-sus4',
    quality: 'sus4',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 2, 2, 0, 0],
  },
  {
    id: 'barre-A-sus4',
    quality: 'sus4',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 3, 0],
  },

  // sus2
  {
    id: 'barre-A-sus2',
    quality: 'sus2',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 0, 0],
  },

  // dim
  {
    id: 'barre-E-dim',
    quality: 'dim',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 1, 2, 0, 'x', 'x'],
  },
  {
    id: 'barre-A-dim',
    quality: 'dim',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 1, 2, 1, 'x'],
  },

  // aug
  {
    id: 'barre-E-aug',
    quality: 'aug',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', 2, 1, 1, 0],
  },
  {
    id: 'barre-A-aug',
    quality: 'aug',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 3, 2, 2, 'x'],
  },

  // 5 (power chords móviles de 3 y 2 cuerdas)
  {
    id: 'barre-E-5',
    quality: '5',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 2, 'x', 'x', 'x'],
  },
  {
    id: 'barre-A-5',
    quality: '5',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 2, 'x', 'x'],
  },
  {
    id: 'barre-E-5-2str',
    quality: '5',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 'x', 'x', 'x', 'x'],
  },
  {
    id: 'barre-A-5-2str',
    quality: '5',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 'x', 'x', 'x'],
  },

  // add9
  {
    id: 'barre-E-add9',
    quality: 'add9',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', 2, 1, 0, 2],
  },
  {
    id: 'barre-A-add9',
    quality: 'add9',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, -1, 2, 0, 0],
  },

  // madd9
  {
    id: 'barre-E-madd9',
    quality: 'madd9',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', 2, 0, 0, 2],
  },
  {
    id: 'barre-A-madd9',
    quality: 'madd9',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, -2, 'x', 0, 0],
  },

  // m7b5 (semidisminuido)
  {
    id: 'barre-E-m7b5',
    quality: 'm7b5',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', 0, 0, -1, 'x'],
  },
  {
    id: 'barre-A-m7b5',
    quality: 'm7b5',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 1, 0, 1, 'x'],
  },

  // dim7 (disminuido 7)
  {
    id: 'barre-E-dim7',
    quality: 'dim7',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', -1, 0, -1, 'x'],
  },
  {
    id: 'barre-A-dim7',
    quality: 'dim7',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 1, -1, 1, 'x'],
  },

  // mMaj7 (menor maj7)
  {
    id: 'barre-E-mMaj7',
    quality: 'mMaj7',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 2, 1, 0, 0, 0],
  },
  {
    id: 'barre-A-mMaj7',
    quality: 'mMaj7',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 2, 1, 1, 0],
  },

  // maj7#5 (maj7♯5)
  {
    id: 'barre-E-maj7#5',
    quality: 'maj7#5',
    family: 'barre-E',
    rootString: 6,
    frets: [0, 'x', 1, 1, 1, 0],
  },
  {
    id: 'barre-A-maj7#5',
    quality: 'maj7#5',
    family: 'barre-A',
    rootString: 5,
    frets: ['x', 0, 3, 1, 2, 'x'],
  },
];

/**
 * Formas en las 3 cuerdas más agudas (cuerdas 3, 2 y 1: G–B–E).
 * Tríadas cerradas en fundamental, 1ª y 2ª inversión a lo largo del mástil.
 */
export const STRINGS_1_3_VOICING_SHAPES: readonly MovableVoicingShape[] = [
  // maj (C: xxx553 fundamental, xxx988 1ª inv, xxx010 2ª inv)
  {
    id: 'strings-1-3-maj-root',
    quality: 'maj',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, 0, -2],
  },
  {
    id: 'strings-1-3-maj-1st',
    quality: 'maj',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', 1, 0, 0],
  },
  {
    id: 'strings-1-3-maj-2nd',
    quality: 'maj',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', -1, 0, -1],
  },

  // m (C: xxx543, xxx888, xxx-12-13-11)
  {
    id: 'strings-1-3-m-root',
    quality: 'm',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, -1, -2],
  },
  {
    id: 'strings-1-3-m-1st',
    quality: 'm',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', 0, 0, 0],
  },
  {
    id: 'strings-1-3-m-2nd',
    quality: 'm',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', -1, 0, -2],
  },

  // dim (C: xxx542, xxx878, xxx-11-13-11)
  {
    id: 'strings-1-3-dim-root',
    quality: 'dim',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, -1, -3],
  },
  {
    id: 'strings-1-3-dim-1st',
    quality: 'dim',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', 0, -1, 0],
  },
  {
    id: 'strings-1-3-dim-2nd',
    quality: 'dim',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', -2, 0, -2],
  },

  // aug (C: xxx554, xxx998, xxx110)
  {
    id: 'strings-1-3-aug-root',
    quality: 'aug',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, 0, -1],
  },
  {
    id: 'strings-1-3-aug-1st',
    quality: 'aug',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', 1, 1, 0],
  },
  {
    id: 'strings-1-3-aug-2nd',
    quality: 'aug',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', 0, 0, -1],
  },

  // sus2 (C: xxx533, xxx788, xxx-12-13-10)
  {
    id: 'strings-1-3-sus2-root',
    quality: 'sus2',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, -2, -2],
  },
  {
    id: 'strings-1-3-sus2-1st',
    quality: 'sus2',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', -1, 0, 0],
  },
  {
    id: 'strings-1-3-sus2-2nd',
    quality: 'sus2',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', -1, 0, -3],
  },

  // sus4 (C: xxx563, xxx-10-8-8, xxx011)
  {
    id: 'strings-1-3-sus4-root',
    quality: 'sus4',
    family: 'strings-1-3',
    inversion: 'root',
    rootString: 3,
    frets: ['x', 'x', 'x', 0, 1, -2],
  },
  {
    id: 'strings-1-3-sus4-1st',
    quality: 'sus4',
    family: 'strings-1-3',
    inversion: '1st',
    rootString: 1,
    frets: ['x', 'x', 'x', 2, 0, 0],
  },
  {
    id: 'strings-1-3-sus4-2nd',
    quality: 'sus4',
    family: 'strings-1-3',
    inversion: '2nd',
    rootString: 2,
    frets: ['x', 'x', 'x', -1, 0, 0],
  },
];

/**
 * Formas en las 4 cuerdas más agudas (cuerdas 4, 3, 2 y 1: D–G–B–E).
 * Drop 2 y digitaciones de 4 cuerdas en posición fundamental, 1ª y 2ª inversión para cuatríadas y tríadas.
 */
export const STRINGS_1_4_VOICING_SHAPES: readonly MovableVoicingShape[] = [
  // maj (tríada en 4 cuerdas)
  {
    id: 'strings-1-4-maj-root',
    quality: 'maj',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, -1, -2, -2],
  },
  {
    id: 'strings-1-4-maj-1st',
    quality: 'maj',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 1, -1, 0, -1],
  },
  {
    id: 'strings-1-4-maj-2nd',
    quality: 'maj',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, 0, -2],
  },

  // m (tríada en 4 cuerdas)
  {
    id: 'strings-1-4-m-root',
    quality: 'm',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, -2, -2, -2],
  },
  {
    id: 'strings-1-4-m-1st',
    quality: 'm',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, -1, 0, -2],
  },
  {
    id: 'strings-1-4-m-2nd',
    quality: 'm',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, -1, -2],
  },

  // 7
  {
    id: 'strings-1-4-7-root',
    quality: '7',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 1, 2],
  },
  {
    id: 'strings-1-4-7-1st',
    quality: '7',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 1, 2, 0, 2],
  },
  {
    id: 'strings-1-4-7-2nd',
    quality: '7',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, 0, 1],
  },
  {
    id: 'strings-1-4-7-3rd',
    quality: '7',
    family: 'strings-1-4',
    inversion: '3rd',
    rootString: 1,
    frets: ['x', 'x', 0, 1, 0, 0],
  },

  // maj7
  {
    id: 'strings-1-4-maj7-root',
    quality: 'maj7',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 2, 2],
  },
  {
    id: 'strings-1-4-maj7-1st',
    quality: 'maj7',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 1, 3, 0, 2],
  },
  {
    id: 'strings-1-4-maj7-2nd',
    quality: 'maj7',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, 0, 2],
  },
  {
    id: 'strings-1-4-maj7-3rd',
    quality: 'maj7',
    family: 'strings-1-4',
    inversion: '3rd',
    rootString: 1,
    frets: ['x', 'x', 1, 1, 0, 0],
  },

  // m7
  {
    id: 'strings-1-4-m7-root',
    quality: 'm7',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 1, 1],
  },
  {
    id: 'strings-1-4-m7-1st',
    quality: 'm7',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, 2, 0, 2],
  },
  {
    id: 'strings-1-4-m7-2nd',
    quality: 'm7',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, -1, 1],
  },
  {
    id: 'strings-1-4-m7-3rd',
    quality: 'm7',
    family: 'strings-1-4',
    inversion: '3rd',
    rootString: 1,
    frets: ['x', 'x', 0, 0, 0, 0],
  },

  // m7b5
  {
    id: 'strings-1-4-m7b5-root',
    quality: 'm7b5',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 1, 1, 1],
  },
  {
    id: 'strings-1-4-m7b5-1st',
    quality: 'm7b5',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, 2, 0, 1],
  },
  {
    id: 'strings-1-4-m7b5-2nd',
    quality: 'm7b5',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', -1, 0, -1, 1],
  },
  {
    id: 'strings-1-4-m7b5-3rd',
    quality: 'm7b5',
    family: 'strings-1-4',
    inversion: '3rd',
    rootString: 1,
    frets: ['x', 'x', 0, 0, -1, 0],
  },

  // dim7
  {
    id: 'strings-1-4-dim7-root',
    quality: 'dim7',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 1, 0, 1],
  },
  {
    id: 'strings-1-4-dim7-1st',
    quality: 'dim7',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, 1, 0, 1],
  },
  {
    id: 'strings-1-4-dim7-2nd',
    quality: 'dim7',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', -1, 0, -1, 0],
  },
  {
    id: 'strings-1-4-dim7-3rd',
    quality: 'dim7',
    family: 'strings-1-4',
    inversion: '3rd',
    rootString: 1,
    frets: ['x', 'x', -1, 0, -1, 0],
  },

  // mMaj7
  {
    id: 'strings-1-4-mMaj7-root',
    quality: 'mMaj7',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 2, 1],
  },
  {
    id: 'strings-1-4-mMaj7-1st',
    quality: 'mMaj7',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, 3, 0, 2],
  },
  {
    id: 'strings-1-4-mMaj7-2nd',
    quality: 'mMaj7',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, -1, 2],
  },

  // maj7#5
  {
    id: 'strings-1-4-maj7#5-root',
    quality: 'maj7#5',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 3, 2, 2],
  },
  {
    id: 'strings-1-4-maj7#5-1st',
    quality: 'maj7#5',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 1, 3, 0, 3],
  },
  {
    id: 'strings-1-4-maj7#5-2nd',
    quality: 'maj7#5',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 1, 0, 0, 2],
  },

  // add9
  {
    id: 'strings-1-4-add9-root',
    quality: 'add9',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, -1, -2, 0],
  },
  {
    id: 'strings-1-4-add9-1st',
    quality: 'add9',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 3,
    frets: ['x', 'x', -3, 0, -2, -2],
  },
  {
    id: 'strings-1-4-add9-2nd',
    quality: 'add9',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 1,
    frets: ['x', 'x', -3, -1, -3, 0],
  },

  // madd9
  {
    id: 'strings-1-4-madd9-root',
    quality: 'madd9',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, -2, -2, 0],
  },
  {
    id: 'strings-1-4-madd9-1st',
    quality: 'madd9',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, -1, 0, -3],
  },

  // 6
  {
    id: 'strings-1-4-6-root',
    quality: '6',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 0, 2],
  },
  {
    id: 'strings-1-4-6-1st',
    quality: '6',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 1, 1, 0, 2],
  },
  {
    id: 'strings-1-4-6-2nd',
    quality: '6',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, 0, 0],
  },

  // m6
  {
    id: 'strings-1-4-m6-root',
    quality: 'm6',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, 2, 0, 1],
  },
  {
    id: 'strings-1-4-m6-1st',
    quality: 'm6',
    family: 'strings-1-4',
    inversion: '1st',
    rootString: 2,
    frets: ['x', 'x', 0, 1, 0, 2],
  },
  {
    id: 'strings-1-4-m6-2nd',
    quality: 'm6',
    family: 'strings-1-4',
    inversion: '2nd',
    rootString: 3,
    frets: ['x', 'x', 0, 0, -1, 0],
  },

  // 9
  {
    id: 'strings-1-4-9-root',
    quality: '9',
    family: 'strings-1-4',
    inversion: 'root',
    rootString: 4,
    frets: ['x', 'x', 0, -1, 1, 0],
  },
];

export const MOVABLE_VOICING_SHAPES: readonly MovableVoicingShape[] = [
  ...BARRE_VOICING_SHAPES,
  ...STRINGS_1_4_VOICING_SHAPES,
  ...STRINGS_1_3_VOICING_SHAPES,
];

export const STANDARD_VOICING_SHAPES: readonly VoicingShape[] = [
  ...OPEN_VOICING_SHAPES,
  ...MOVABLE_VOICING_SHAPES,
];
