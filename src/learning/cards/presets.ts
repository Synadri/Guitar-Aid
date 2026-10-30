import { buildDeckCardIds } from './builder';
import type { Deck, DeckPreset } from './types';

// ============================================================================
// Mazo Predefinido: Principiante (§6.4)
// ============================================================================

export const BEGINNER_PRESET: DeckPreset = {
  id: 'beginner',
  name: 'Principiante',
  description:
    'Notas naturales en las cuerdas 6 y 5 (0–12), intervalos básicos, fórmulas esenciales, acordes abiertos, pentatónicas y progresiones en tonalidades habituales.',
  limits: { newPerDay: 20, reviewsPerDay: 200 },
  sources: [
    // 1. Notas naturales en cuerdas 6 y 5 (trastes 0–12)
    {
      type: 'fretNotes',
      strings: [6, 5],
      fretRange: [0, 12],
      naturalsOnly: true,
      facets: ['pos>name'],
    },
    // 2. Intervalos de m2 a P8 (nombre ↔ semitonos)
    {
      type: 'intervals',
      semitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      facets: ['name>semitones', 'semitones>name'],
    },
    // 3. Fórmulas de maj, m, 5, 7
    {
      type: 'qualities',
      qualities: ['maj', 'm', '5', '7'],
      facets: ['name>formula', 'formula>name'],
    },
    // 4. Digitaciones open de maj, m y 7
    {
      type: 'voicings',
      qualities: ['maj', 'm', '7'],
      families: ['open'],
      facets: ['name>shape', 'shape>name'],
    },
    // 5. Fórmulas de mayor, menor natural y pentatónicas
    {
      type: 'scaleTypes',
      scaleTypes: ['major', 'minor', 'majorPentatonic', 'minorPentatonic'],
      facets: ['name>formula', 'formula>name'],
    },
    // 6. Notas de C, G y D mayor (pentatónica incluida)
    {
      type: 'scales',
      scaleTypes: ['major', 'majorPentatonic'],
      tonics: [0, 7, 2],
      facets: ['name>notes'],
    },
    // 7. Notas de A y E menor (pentatónica incluida)
    {
      type: 'scales',
      scaleTypes: ['minor', 'minorPentatonic'],
      tonics: [9, 4],
      facets: ['name>notes'],
    },
    // 8. I–IV–V e I–V–vi–IV en C, G, D, A y E
    {
      type: 'progressions',
      progressionIds: ['I-IV-V', 'popI-V-vi-IV'],
      tonics: [0, 7, 2, 9, 4],
      facets: ['roman>chords', 'chords>roman'],
    },
  ],
};

// ============================================================================
// Mazo Predefinido: Intermedio (§6.4)
// ============================================================================

export const INTERMEDIATE_PRESET: DeckPreset = {
  id: 'intermediate',
  name: 'Intermedio',
  description:
    'Todas las notas en las 6 cuerdas (0–12), fórmulas completas de 7ª y extensiones, cejillas en 6ª y 5ª cuerda, los 7 modos, menor armónica/melódica, tríadas diatónicas y progresiones estándar.',
  limits: { newPerDay: 20, reviewsPerDay: 200 },
  sources: [
    // 1. Todas las notas (con alteraciones) en las 6 cuerdas, trastes 0–12
    {
      type: 'fretNotes',
      strings: [1, 2, 3, 4, 5, 6],
      fretRange: [0, 12],
      naturalsOnly: false,
      facets: ['pos>name'],
    },
    // 2. Fórmulas de m7, maj7, 6, m6, sus2, sus4, dim, aug, add9, m7b5, dim7 y 9
    {
      type: 'qualities',
      qualities: [
        'm7',
        'maj7',
        '6',
        'm6',
        'sus2',
        'sus4',
        'dim',
        'aug',
        'add9',
        'm7b5',
        'dim7',
        '9',
      ],
      facets: ['name>formula', 'formula>name'],
    },
    // 3. Digitaciones barre-E y barre-A de maj, m, 7, m7 y maj7 en raíces naturales
    {
      type: 'voicings',
      qualities: ['maj', 'm', '7', 'm7', 'maj7'],
      families: ['barre-E', 'barre-A'],
      roots: [0, 2, 4, 5, 7, 9, 11],
      facets: ['name>shape', 'shape>name'],
    },
    // 4. Los 7 modos de la mayor (fórmula y grado en la madre)
    {
      type: 'scaleTypes',
      scaleTypes: [
        'major',
        'dorian',
        'phrygian',
        'lydian',
        'mixolydian',
        'minor',
        'locrian',
      ],
      facets: ['name>formula', 'formula>name', 'mode>parent'],
    },
    // 5. Notas de los modos de C mayor
    {
      type: 'scaleModes',
      parentScale: 'major',
      parentTonic: 0,
      facets: ['name>notes'],
    },
    // 6. Menor armónica y melódica
    {
      type: 'scaleTypes',
      scaleTypes: ['harmonicMinor', 'melodicMinor'],
      facets: ['name>formula', 'formula>name'],
    },
    // 7. Armonía diatónica en tríadas de C, G, D, F y A mayor
    {
      type: 'degrees',
      tonics: [0, 7, 2, 5, 9],
      modes: ['major'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      chordKinds: ['triads'],
      facets: ['roman>chord'],
    },
    // 8. Armonía diatónica en tríadas de A, E y D menor
    {
      type: 'degrees',
      tonics: [9, 4, 2],
      modes: ['minor'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      chordKinds: ['triads'],
      facets: ['roman>chord'],
    },
    // 9. ii–V–I, vi–IV–I–V, andaluza e i–iv–v en tonalidades comunes
    {
      type: 'progressions',
      progressionIds: ['ii-V-I', 'vi-IV-I-V'],
      tonics: [0, 7, 2, 5, 9],
      facets: ['roman>chords', 'chords>roman'],
    },
    {
      type: 'progressions',
      progressionIds: ['andaluza', 'i-iv-v'],
      tonics: [9, 4, 2],
      facets: ['roman>chords', 'chords>roman'],
    },
  ],
};

// ============================================================================
// Mazo Predefinido: Avanzado (§6.4)
// ============================================================================

export const ADVANCED_PRESET: DeckPreset = {
  id: 'advanced',
  name: 'Avanzado',
  description:
    'Todo el mástil (0–24) en ambos sentidos, las 19 fórmulas armónicas, voicings Drop 2 e inversiones de tríadas en cuerdas 1–4 y 1–3, bebop/disminuidas/napolitanas, armonía en cuatríadas en 12 tonalidades y las 10 progresiones.',
  limits: { newPerDay: 20, reviewsPerDay: 200 },
  sources: [
    // 1. Notas en todo el mástil (0–24), en los dos sentidos
    {
      type: 'fretNotes',
      strings: [1, 2, 3, 4, 5, 6],
      fretRange: [0, 24],
      naturalsOnly: false,
      facets: ['pos>name'],
    },
    {
      type: 'stringNotes',
      strings: [1, 2, 3, 4, 5, 6],
      pitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      facets: ['name>pos'],
    },
    // 2. Todo el catálogo de fórmulas (19 calidades) en los dos sentidos
    {
      type: 'qualities',
      qualities: [
        'maj',
        'm',
        '7',
        'maj7',
        'm7',
        'dim',
        'aug',
        'sus2',
        'sus4',
        '6',
        'm6',
        '9',
        '5',
        'add9',
        'madd9',
        'm7b5',
        'dim7',
        'mMaj7',
        'maj7#5',
      ],
      facets: ['name>formula', 'formula>name'],
    },
    // 3. Digitaciones strings-1-4 (Drop 2) y strings-1-3 de maj, m, maj7, m7 y 7 en raíces naturales
    {
      type: 'voicings',
      qualities: ['maj', 'm', 'maj7', 'm7', '7'],
      families: ['strings-1-4', 'strings-1-3'],
      roots: [0, 2, 4, 5, 7, 9, 11],
      facets: ['name>shape', 'shape>name'],
    },
    // 4. Bebop, disminuidas y napolitanas (fórmula ↔ nombre)
    {
      type: 'scaleTypes',
      scaleTypes: [
        'bebopDominant',
        'bebopMajor',
        'bebopDorian',
        'bebopNaturalMinor',
        'bebopMelodicMinor',
        'diminishedHalfWhole',
        'diminishedWholeHalf',
        'neapolitanMajor',
        'neapolitanMinor',
      ],
      facets: ['name>formula', 'formula>name'],
    },
    // 5. Armonía diatónica en cuatríadas en las 12 tonalidades mayores
    {
      type: 'degrees',
      tonics: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      modes: ['major'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      chordKinds: ['sevenths'],
      facets: ['roman>chord'],
    },
    // 6. Armonía diatónica en cuatríadas en las 12 tonalidades menores
    {
      type: 'degrees',
      tonics: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      modes: ['minor'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      chordKinds: ['sevenths'],
      facets: ['roman>chord'],
    },
    // 7. Las 10 progresiones en las 12 tonalidades
    {
      type: 'progressions',
      progressionIds: [
        'popI-V-vi-IV',
        'I-IV-V',
        'vi-IV-I-V',
        'ii-V-I',
        'I-vi-IV-V',
        'i-VII-VI-VII',
        'i-VI-III-VII',
        'andaluza',
        'i-iv-v',
        'iidim-V-i',
      ],
      tonics: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      facets: ['roman>chords', 'chords>roman'],
    },
  ],
};

export const PRESET_DECKS: readonly DeckPreset[] = [
  BEGINNER_PRESET,
  INTERMEDIATE_PRESET,
  ADVANCED_PRESET,
];

export function getPresetDeck(id: string): DeckPreset | undefined {
  return PRESET_DECKS.find((p) => p.id === id);
}

/**
 * Crea una copia editable e independiente de un mazo predefinido con su propio ID y progreso (§6.4, Criterio l).
 */
export function createDeckFromPreset(
  preset: DeckPreset,
  idGenerator: () => string = () =>
    `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  now: number = Date.now(),
): Deck {
  const cardIds = buildDeckCardIds(preset.sources);
  return {
    id: idGenerator(),
    name: preset.name,
    description: preset.description,
    sources: preset.sources,
    cardIds,
    limits: { ...preset.limits },
    createdAt: now,
  };
}
