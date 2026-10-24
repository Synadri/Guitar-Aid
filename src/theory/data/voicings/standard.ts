import type { PitchClass } from '../../core/pitch';
import type { StringNumber } from '../../fretboard';
import type { ChordQualityId } from '../chords';

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

/** Familias de voicings incluidas en T4a (abiertas y cejilla con raíz en 6ª o 5ª cuerda). */
export type VoicingFamily = 'open' | 'barre-E' | 'barre-A';

export interface OpenVoicingShape {
  id: string;
  quality: ChordQualityId;
  family: 'open';
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
  family: 'barre-E' | 'barre-A';
  /** Cuerda donde se ubica la referencia de la raíz (6 para barre-E, 5 para barre-A). */
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
];

/**
 * Formas móviles de cejilla (raíz en cuerda 6 o 5) para las 12 calidades en afinación estándar.
 * Garantizan que las 12 calidades × 12 raíces tengan siempre al menos un voicing.
 */
export const MOVABLE_VOICING_SHAPES: readonly MovableVoicingShape[] = [
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
];

export const STANDARD_VOICING_SHAPES: readonly VoicingShape[] = [
  ...OPEN_VOICING_SHAPES,
  ...MOVABLE_VOICING_SHAPES,
];
