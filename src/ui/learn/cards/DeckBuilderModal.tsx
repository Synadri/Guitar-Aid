import { useEffect, useMemo, useState } from 'react';
import { buildDeckCardIds } from '../../../learning/cards/builder';
import { PRESET_DECKS } from '../../../learning/cards/presets';
import type {
  Deck,
  DeckLimits,
  DeckSource,
  VoicingFacet,
  ChordFacet,
  QualityFacet,
  ScaleFacet,
  ScaletypeFacet,
  DegreeFacet,
  ProgressionFacet,
  IntervalFacet,
  FretnoteFacet,
  NotestringFacet,
} from '../../../learning/cards/types';
import {
  CHORD_QUALITIES,
  SCALE_TYPES,
  PROGRESSIONS,
  pcName,
  type ChordQualityId,
  type ScaleTypeId,
  type ProgressionId,
  type VoicingFamily,
  type PitchClass,
  type StringNumber,
} from '../../../theory';
import styles from './DeckBuilderModal.module.css';

export interface DeckBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDeck?: Deck | null;
  onSaveDeck: (input: {
    name: string;
    limits: DeckLimits;
    sources: readonly DeckSource[];
  }) => void;
  onDeleteDeck?: (deckId: string) => void;
  onAddPreset?: (presetId: 'beginner' | 'intermediate' | 'advanced') => void;
  initialTab?: 'builder' | 'presets';
}

const VOICING_FAMILIES: readonly { id: VoicingFamily; label: string }[] = [
  { id: 'open', label: 'Abiertos' },
  { id: 'barre-E', label: 'Cejilla 6ª' },
  { id: 'barre-A', label: 'Cejilla 5ª' },
  { id: 'strings-1-4', label: 'Cuerdas 1–4' },
  { id: 'strings-1-3', label: 'Cuerdas 1–3' },
];

const BASIC_QUALITY_IDS: readonly ChordQualityId[] = [
  'maj',
  'm',
  '7',
  'maj7',
  'm7',
  'm7b5',
  'dim7',
  'sus4',
  '9',
];

const ALL_QUALITY_IDS: readonly ChordQualityId[] = CHORD_QUALITIES.map((q) => q.id);

const QUALITY_LABELS: Readonly<Record<ChordQualityId, string>> = {
  maj: 'Mayor',
  m: 'Menor',
  '7': '7ª',
  maj7: 'maj7',
  m7: 'm7',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6ª',
  m6: 'm6',
  '9': '9ª',
  '5': '5ª (power)',
  add9: 'add9',
  madd9: 'm(add9)',
  m7b5: 'm7♭5',
  dim7: 'dim7',
  mMaj7: 'm(maj7)',
  'maj7#5': 'maj7♯5',
};

const BASIC_SCALE_IDS: readonly ScaleTypeId[] = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
];

const ALL_SCALE_IDS: readonly ScaleTypeId[] = SCALE_TYPES.map((s) => s.id);

const ALL_ROOTS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const NATURAL_ROOTS: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

const ALL_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const STRING_LABELS: Readonly<Record<StringNumber, string>> = {
  1: '1ª (E aguda)',
  2: '2ª (B)',
  3: '3ª (G)',
  4: '4ª (D)',
  5: '5ª (A)',
  6: '6ª (E grave)',
};

const INTERVAL_ITEMS: readonly { semitones: number; label: string }[] = [
  { semitones: 1, label: '1 · 2ªm (♭2)' },
  { semitones: 2, label: '2 · 2ªM (2)' },
  { semitones: 3, label: '3 · 3ªm (♭3)' },
  { semitones: 4, label: '4 · 3ªM (3)' },
  { semitones: 5, label: '5 · 4ªJ (4)' },
  { semitones: 6, label: '6 · Tritono (♭5)' },
  { semitones: 7, label: '7 · 5ªJ (5)' },
  { semitones: 8, label: '8 · 6ªm (♭6)' },
  { semitones: 9, label: '9 · 6ªM (6)' },
  { semitones: 10, label: '10 · 7ªm (♭7)' },
  { semitones: 11, label: '11 · 7ªM (7)' },
  { semitones: 12, label: '12 · Octava (8ª)' },
];

const DEGREE_ITEMS: readonly { degree: number; label: string }[] = [
  { degree: 1, label: 'I (1º)' },
  { degree: 2, label: 'II (2º)' },
  { degree: 3, label: 'III (3º)' },
  { degree: 4, label: 'IV (4º)' },
  { degree: 5, label: 'V (5º)' },
  { degree: 6, label: 'VI (6º)' },
  { degree: 7, label: 'VII (7º)' },
];

const MAJOR_MODE_PREVIEW: readonly { roman: string; modeName: string; offset: number }[] = [
  { roman: 'I', modeName: 'Jónico (Mayor)', offset: 0 },
  { roman: 'II', modeName: 'Dórico', offset: 2 },
  { roman: 'III', modeName: 'Frigio', offset: 4 },
  { roman: 'IV', modeName: 'Lidio', offset: 5 },
  { roman: 'V', modeName: 'Mixolidio', offset: 7 },
  { roman: 'VI', modeName: 'Eólico (Menor)', offset: 9 },
  { roman: 'VII', modeName: 'Locrio', offset: 11 },
];

interface BlockMetaInfo {
  title: string;
  subtitle: string;
  tooltipDescription: string;
  tooltipExample: string;
  tooltipNote?: string;
}

const BLOCK_META: Readonly<Record<DeckSource['type'], BlockMetaInfo>> = {
  fretNotes: {
    title: '📍 Notas en el mástil',
    subtitle: 'Identifica qué nota suena en una cuerda y traste concretos (o viceversa).',
    tooltipDescription:
      'Crea una tarjeta por cada posición (cuerda + traste) dentro del rango seleccionado.',
    tooltipExample: 'Anverso: Cuerda 6 · Traste 5 → Reverso: A',
    tooltipNote:
      'Ideal para memorizar el diapasón por zonas (trastes 0–5, 0–12 o hasta el 24).',
  },
  stringNotes: {
    title: '🧵 Notas por cuerda',
    subtitle: 'Localiza todas las apariciones de una nota concreta a lo largo de una cuerda.',
    tooltipDescription:
      'Pregunta en qué trastes se encuentra una nota determinada dentro de una cuerda específica.',
    tooltipExample: 'Anverso: Nota F en 6ª cuerda → Reverso: Trastes 1 y 13',
    tooltipNote:
      'Diferencia con «Notas en el mástil»: aquí partes del nombre de la nota y una cuerda para encontrar su posición.',
  },
  intervals: {
    title: '📏 Intervalos',
    subtitle: 'Relaciona el nombre del intervalo con su distancia en semitonos y grado.',
    tooltipDescription:
      'Pregunta cuántos semitonos abarca cada intervalo musical (de 2ª menor a octava justa) o cuál es su nombre a partir del número de semitonos.',
    tooltipExample: 'Anverso: 3ª menor (♭3) ↔ Reverso: 3 semitonos',
  },
  qualities: {
    title: '🎵 Calidades de acordes (fórmulas)',
    subtitle: 'Fórmulas interválicas abstractas de cada tipo de acorde sin nota raíz.',
    tooltipDescription:
      'Pregunta qué grados componen una calidad de acorde en abstracto (sin depender de una tónica concreta).',
    tooltipExample: 'Anverso: Acorde m7 ↔ Reverso: 1 – ♭3 – 5 – ♭7',
    tooltipNote:
      'Diferencia con «Acordes concretos»: aquí estudias la fórmula universal (1–3–5) en vez de las notas de un acorde concreto (C–E–G).',
  },
  chords: {
    title: '🎼 Acordes concretos (notas y fórmulas)',
    subtitle: 'Notas reales que forman un acorde con tónica y calidad específicas.',
    tooltipDescription:
      'Combina las tónicas elegidas con las calidades seleccionadas para preguntar las notas exactas de cada acorde.',
    tooltipExample: 'Anverso: Cmaj7 ↔ Reverso: C – E – G – B',
  },
  voicings: {
    title: '🎸 Digitaciones de acordes (diagramas)',
    subtitle: 'Formas y posiciones de acordes en el mástil (abiertos, cejillas, Drop 2, tríadas).',
    tooltipDescription:
      'Muestra el diagrama de guitarra para identificar el acorde, o pide visualizar la postura en el mástil a partir del cifrado.',
    tooltipExample: 'Anverso: C (Abierto) ↔ Reverso: Diagrama ×32010',
  },
  scaleTypes: {
    title: '📐 Fórmulas de escalas (sin tónica)',
    subtitle: 'Estructura interválica universal de cada escala o modo en abstracto.',
    tooltipDescription:
      'Pregunta la fórmula en grados de un tipo de escala o qué grado ocupa un modo respecto a su escala madre.',
    tooltipExample: 'Anverso: Escala Dórica ↔ Reverso: 1 – 2 – ♭3 – 4 – 5 – 6 – ♭7',
    tooltipNote:
      'Diferencia con «Escalas y modos por tónica»: no usa notas concretas (C, D...), sino sólo la fórmula de intervalos.',
  },
  scales: {
    title: '🎹 Escalas y modos por tónica',
    subtitle: 'Combina cualquier tipo de escala con las tónicas que elijas (en paralelo).',
    tooltipDescription:
      'Genera el producto cartesiano entre las escalas seleccionadas y las tónicas elegidas, preguntando sus notas exactas.',
    tooltipExample: 'Anverso: A pentatónica menor ↔ Reverso: A – C – D – E – G',
    tooltipNote:
      'Diferencia con «Los 7 modos de una escala madre»: aquí eliges libremente escalas y tónicas independientes.',
  },
  scaleModes: {
    title: '✨ Los 7 modos relativos de una escala madre',
    subtitle: 'Genera los 7 modos diatónicos que comparten las mismas notas de una tonalidad mayor.',
    tooltipDescription:
      'A partir de una única tonalidad mayor madre (p. ej. C mayor), genera automáticamente sus 7 modos relativos (I Jónico, II Dórico, III Frigio, IV Lidio, V Mixolidio, VI Eólico y VII Locrio), cada uno desde su propia nota tónica.',
    tooltipExample:
      'Madre C mayor → C Jónico, D Dórico, E Frigio, F Lidio, G Mixolidio, A Eólico, B Locrio (todos con las notas naturales C D E F G A B).',
    tooltipNote:
      'Diferencia con «Escalas por tónica»: en vez de combinar escalas al azar, agrupa la familia modal relativa completa de una tonalidad.',
  },
  degrees: {
    title: '🏛️ Grados armónicos diatónicos',
    subtitle: 'Acordes diatónicos (I, ii, iii, IV, V, vi, vii°) de una tonalidad mayor o menor.',
    tooltipDescription:
      'Pregunta qué acorde (tríada o cuatríada de 7ª) corresponde a cada grado romano dentro de las tonalidades seleccionadas.',
    tooltipExample: 'Anverso: Grado ii en C mayor (cuatríadas) ↔ Reverso: Dm7',
  },
  progressions: {
    title: '🔄 Progresiones armónicas',
    subtitle: 'Traduce progresiones en números romanos a los acordes reales de una tonalidad.',
    tooltipDescription:
      'Combina plantillas clásicas (I–IV–V, ii–V–I, I–V–vi–IV, cadencia andaluza, etc.) con las tónicas seleccionadas.',
    tooltipExample: 'Anverso: ii–V–I en C mayor ↔ Reverso: Dm – G – C',
  },
};

export function DeckBuilderModal({
  isOpen,
  onClose,
  initialDeck,
  onSaveDeck,
  onDeleteDeck,
  onAddPreset,
  initialTab = 'builder',
}: DeckBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<'builder' | 'presets'>(initialTab);
  const [name, setName] = useState('');
  const [newPerDay, setNewPerDay] = useState(20);
  const [reviewsPerDay, setReviewsPerDay] = useState(200);
  const [sources, setSources] = useState<DeckSource[]>([]);
  const [openHelpIndex, setOpenHelpIndex] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Sincronizar estado cuando se abre el modal o cambia initialDeck
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setOpenHelpIndex(null);
      setConfirmingDelete(false);
      if (initialDeck) {
        setName(initialDeck.name);
        setNewPerDay(initialDeck.limits.newPerDay);
        setReviewsPerDay(initialDeck.limits.reviewsPerDay);
        setSources([...initialDeck.sources]);
      } else {
        setName('Mi mazo');
        setNewPerDay(20);
        setReviewsPerDay(200);
        setSources([
          {
            type: 'voicings',
            qualities: ['maj', 'm', '7'],
            families: ['open'],
            facets: ['name>shape', 'shape>name'],
          },
        ]);
      }
    }
  }, [isOpen, initialDeck, initialTab]);

  // Manejo de la tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cómputo en vivo del número total de tarjetas generadas
  const totalCards = useMemo(() => {
    try {
      return buildDeckCardIds(sources).length;
    } catch {
      return 0;
    }
  }, [sources]);

  if (!isOpen) return null;

  const updateSourceAt = (index: number, updater: (prevSource: DeckSource) => DeckSource) => {
    setSources((prev) => prev.map((s, i) => (i === index ? updater(s) : s)));
  };

  // Acciones sobre fuentes
  const handleRemoveSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
    if (openHelpIndex === index) {
      setOpenHelpIndex(null);
    }
  };

  const handleAddVoicingsBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'voicings',
        qualities: ['maj', 'm', '7'],
        families: ['open'],
        facets: ['name>shape', 'shape>name'],
      },
    ]);
  };

  const handleAddQualitiesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'qualities',
        qualities: ['maj', 'm', '7', 'maj7', 'm7'],
        facets: ['name>formula', 'formula>name'],
      },
    ]);
  };

  const handleAddChordsBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'chords',
        qualities: ['maj', 'm', '7', 'maj7', 'm7'],
        roots: [...NATURAL_ROOTS],
        facets: ['name>notes', 'notes>name'],
      },
    ]);
  };

  const handleAddScaleTypesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'scaleTypes',
        scaleTypes: ['major', 'minor', 'majorPentatonic', 'minorPentatonic'],
        facets: ['name>formula', 'formula>name'],
      },
    ]);
  };

  const handleAddScalesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'scales',
        scaleTypes: ['major', 'minor', 'minorPentatonic'],
        tonics: [0, 7, 2, 9, 4],
        facets: ['name>notes'],
      },
    ]);
  };

  const handleAddMajorModesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'scaleModes',
        parentScale: 'major',
        parentTonic: 0, // C mayor
        facets: ['name>notes', 'mode>parent'],
      },
    ]);
  };

  const handleAddDegreesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'degrees',
        tonics: [0, 7, 2, 5, 9],
        modes: ['major'],
        degrees: [1, 2, 3, 4, 5, 6, 7],
        chordKinds: ['triads'],
        facets: ['roman>chord'],
      },
    ]);
  };

  const handleAddProgressionsBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'progressions',
        progressionIds: ['I-IV-V', 'popI-V-vi-IV', 'ii-V-I'],
        tonics: [0, 7, 2, 9, 4],
        facets: ['roman>chords', 'chords>roman'],
      },
    ]);
  };

  const handleAddFretNotesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'fretNotes',
        strings: [6, 5],
        fretRange: [0, 12],
        naturalsOnly: true,
        facets: ['pos>name'],
      },
    ]);
  };

  const handleAddStringNotesBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'stringNotes',
        strings: [6, 5],
        pitchClasses: [...NATURAL_ROOTS],
        facets: ['name>pos'],
      },
    ]);
  };

  const handleAddIntervalsBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'intervals',
        semitones: [1, 2, 3, 4, 5, 7, 12],
        facets: ['name>semitones', 'semitones>name'],
      },
    ]);
  };

  const handleSave = () => {
    if (!name.trim() || totalCards === 0) return;
    onSaveDeck({
      name: name.trim(),
      limits: {
        newPerDay: Math.max(1, newPerDay),
        reviewsPerDay: Math.max(1, reviewsPerDay),
      },
      sources,
    });
    onClose();
  };

  const renderPitchClassSelector = (
    selectedPcs: readonly PitchClass[],
    onChange: (next: PitchClass[]) => void,
    label: string,
    allowEmptyLabel?: string,
  ) => {
    return (
      <div>
        <div className={styles.fieldHeaderRow}>
          <span className={styles.fieldLabel}>{label}</span>
          <div className={styles.fieldQuickActions}>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...NATURAL_ROOTS])}
            >
              Naturales (7)
            </button>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...ALL_ROOTS])}
            >
              Todas (12)
            </button>
            {allowEmptyLabel && (
              <button
                type="button"
                className={styles.miniActionBtn}
                onClick={() => onChange([])}
              >
                {allowEmptyLabel}
              </button>
            )}
          </div>
        </div>
        <div className={styles.chipsContainer}>
          {ALL_ROOTS.map((pc) => {
            const selected = selectedPcs.includes(pc);
            return (
              <button
                key={pc}
                type="button"
                className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                onClick={() => {
                  const next = selected
                    ? selectedPcs.filter((r) => r !== pc)
                    : [...selectedPcs, pc];
                  onChange(next);
                }}
              >
                {pcName(pc)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQualitiesSelector = (
    selectedQualities: readonly ChordQualityId[],
    onChange: (next: ChordQualityId[]) => void,
    label: string = 'Calidades de acorde',
  ) => {
    return (
      <div>
        <div className={styles.fieldHeaderRow}>
          <span className={styles.fieldLabel}>{label}</span>
          <div className={styles.fieldQuickActions}>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...BASIC_QUALITY_IDS])}
            >
              Comunes (9)
            </button>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...ALL_QUALITY_IDS])}
            >
              Todas (19)
            </button>
          </div>
        </div>
        <div className={styles.chipsContainer}>
          {CHORD_QUALITIES.map((q) => {
            const selected = selectedQualities.includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                onClick={() => {
                  const next = selected
                    ? selectedQualities.filter((qid) => qid !== q.id)
                    : [...selectedQualities, q.id];
                  onChange(next);
                }}
              >
                {QUALITY_LABELS[q.id] ?? q.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderScalesSelector = (
    selectedScaleIds: readonly ScaleTypeId[],
    onChange: (next: ScaleTypeId[]) => void,
    label: string = 'Tipos de escala',
  ) => {
    return (
      <div>
        <div className={styles.fieldHeaderRow}>
          <span className={styles.fieldLabel}>{label}</span>
          <div className={styles.fieldQuickActions}>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...BASIC_SCALE_IDS])}
            >
              Esenciales (10)
            </button>
            <button
              type="button"
              className={styles.miniActionBtn}
              onClick={() => onChange([...ALL_SCALE_IDS])}
            >
              Todas (22)
            </button>
          </div>
        </div>
        <div className={styles.chipsContainer}>
          {SCALE_TYPES.map((sc) => {
            const selected = selectedScaleIds.includes(sc.id);
            return (
              <button
                key={sc.id}
                type="button"
                className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                onClick={() => {
                  const next = selected
                    ? selectedScaleIds.filter((sid) => sid !== sc.id)
                    : [...selectedScaleIds, sc.id];
                  onChange(next);
                }}
              >
                {sc.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
      data-testid="deck-builder-overlay"
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-builder-title"
      >
        {/* Cabecera */}
        <header className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h2 id="deck-builder-title" className={styles.modalTitle}>
              {initialDeck ? `Editar mazo: ${initialDeck.name}` : 'Constructor de mazos'}
            </h2>
            <div className={styles.tabList} role="tablist" aria-label="Modo de constructor">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'builder'}
                className={`${styles.tabBtn} ${activeTab === 'builder' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('builder')}
                data-testid="tab-builder"
              >
                Reglas personalizadas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'presets'}
                className={`${styles.tabBtn} ${activeTab === 'presets' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('presets')}
                data-testid="tab-presets"
              >
                Mazos predefinidos
              </button>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar ventana modal"
          >
            ×
          </button>
        </header>

        {/* Cuerpo */}
        <div className={styles.modalBody}>
          {activeTab === 'builder' && (
            <>
              {/* Metadatos y límites */}
              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="deck-name-input" className={styles.fieldLabel}>
                    Nombre del mazo
                  </label>
                  <input
                    id="deck-name-input"
                    type="text"
                    className={styles.textInput}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del mazo..."
                    data-testid="deck-name-input"
                  />
                </div>
                <div className={styles.fieldGroupSmall}>
                  <label htmlFor="new-per-day-input" className={styles.fieldLabel}>
                    Nuevas / día
                  </label>
                  <input
                    id="new-per-day-input"
                    type="number"
                    min={1}
                    max={100}
                    className={styles.numberInput}
                    value={newPerDay}
                    onChange={(e) => setNewPerDay(parseInt(e.target.value, 10) || 1)}
                    data-testid="new-per-day-input"
                  />
                </div>
                <div className={styles.fieldGroupSmall}>
                  <label htmlFor="reviews-per-day-input" className={styles.fieldLabel}>
                    Repasos / día
                  </label>
                  <input
                    id="reviews-per-day-input"
                    type="number"
                    min={1}
                    max={1000}
                    className={styles.numberInput}
                    value={reviewsPerDay}
                    onChange={(e) => setReviewsPerDay(parseInt(e.target.value, 10) || 1)}
                    data-testid="reviews-per-day-input"
                  />
                </div>
              </div>

              {/* Lista de bloques de reglas */}
              <h3 className={styles.rulesSectionTitle}>Bloques de contenido ({sources.length})</h3>

              <div className={styles.rulesList}>
                {sources.length === 0 ? (
                  <div className={styles.emptyRulesNotice}>
                    No hay reglas añadidas todavía. Añade uno o varios bloques de contenido abajo
                    para generar tarjetas.
                  </div>
                ) : (
                  sources.map((source, index) => {
                    const meta = BLOCK_META[source.type];
                    const blockCount = buildDeckCardIds([source]).length;
                    const isHelpOpen = openHelpIndex === index;

                    return (
                      <div
                        key={`source-${index}`}
                        className={styles.ruleBlock}
                        data-testid={`rule-block-${index}`}
                      >
                        <div className={styles.ruleBlockHeader}>
                          <div className={styles.ruleBlockHeaderLeft}>
                            <div className={styles.ruleBlockTitleRow}>
                              <div className={styles.ruleBlockTitle}>{meta.title}</div>
                              <div
                                className={styles.helpContainer}
                                onMouseEnter={() => setOpenHelpIndex(index)}
                                onMouseLeave={() =>
                                  setOpenHelpIndex((prev) => (prev === index ? null : prev))
                                }
                              >
                                <button
                                  type="button"
                                  className={styles.helpBtn}
                                  aria-label={`Información sobre ${meta.title}`}
                                  aria-expanded={isHelpOpen}
                                  onClick={() =>
                                    setOpenHelpIndex((prev) => (prev === index ? null : index))
                                  }
                                  onFocus={() => setOpenHelpIndex(index)}
                                  onBlur={() =>
                                    setOpenHelpIndex((prev) => (prev === index ? null : prev))
                                  }
                                  data-testid={`rule-help-btn-${index}`}
                                >
                                  ?
                                </button>
                                {isHelpOpen && (
                                  <div
                                    className={styles.helpTooltip}
                                    role="tooltip"
                                    data-testid={`rule-help-tooltip-${index}`}
                                  >
                                    <span className={styles.helpTooltipTitle}>{meta.title}</span>
                                    <span>{meta.tooltipDescription}</span>
                                    <div className={styles.helpTooltipExample}>
                                      {meta.tooltipExample}
                                    </div>
                                    {meta.tooltipNote && (
                                      <span className={styles.helpTooltipNote}>
                                        💡 {meta.tooltipNote}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className={styles.ruleBlockSubtitle}>{meta.subtitle}</p>
                          </div>

                          <div className={styles.ruleBlockActions}>
                            <span
                              className={styles.blockCardCount}
                              data-testid={`rule-card-count-${index}`}
                            >
                              {blockCount} {blockCount === 1 ? 'tarjeta' : 'tarjetas'}
                            </span>
                            <button
                              type="button"
                              className={styles.removeBlockBtn}
                              onClick={() => handleRemoveSource(index)}
                              aria-label={`Eliminar bloque ${index + 1}`}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {/* 1. VOICINGS (Digitaciones de acordes) */}
                        {source.type === 'voicings' && (
                          <>
                            <div>
                              <span className={styles.fieldLabel}>Familias de acordes</span>
                              <div className={styles.chipsContainer}>
                                {VOICING_FAMILIES.map((fam) => {
                                  const selected = source.families.includes(fam.id);
                                  return (
                                    <button
                                      key={fam.id}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.families.filter((f) => f !== fam.id)
                                          : [...source.families, fam.id];
                                        updateSourceAt(index, (s) =>
                                          s.type === 'voicings' ? { ...s, families: next } : s,
                                        );
                                      }}
                                    >
                                      {fam.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {renderQualitiesSelector(
                              source.qualities,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'voicings' ? { ...s, qualities: next } : s,
                                ),
                              'Calidades',
                            )}

                            {renderPitchClassSelector(
                              source.roots ?? NATURAL_ROOTS,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'voicings'
                                    ? { ...s, roots: next.length > 0 ? next : undefined }
                                    : s,
                                ),
                              'Tónicas (para cejillas y formas móviles)',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>shape', 'Nombre → Forma (diagrama)'],
                                    ['shape>name', 'Forma (diagrama) → Nombre'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: VoicingFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'voicings' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 2. QUALITIES (Fórmulas de calidades de acordes) */}
                        {source.type === 'qualities' && (
                          <>
                            {renderQualitiesSelector(
                              source.qualities,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'qualities' ? { ...s, qualities: next } : s,
                                ),
                              'Calidades de acorde incluidas',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>formula', 'Calidad → Fórmula (grados)'],
                                    ['formula>name', 'Fórmula (grados) → Calidad'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: QualityFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'qualities' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 3. CHORDS (Acordes concretos: notas y fórmulas) */}
                        {source.type === 'chords' && (
                          <>
                            {renderQualitiesSelector(
                              source.qualities,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'chords' ? { ...s, qualities: next } : s,
                                ),
                              'Calidades de acorde',
                            )}

                            {renderPitchClassSelector(
                              source.roots,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'chords' ? { ...s, roots: next } : s,
                                ),
                              'Tónicas (raíces del acorde)',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>notes', 'Nombre → Notas'],
                                    ['notes>name', 'Notas → Nombre'],
                                    ['name>formula', 'Nombre → Fórmula'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: ChordFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'chords' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 4. SCALE TYPES (Fórmulas de escalas en abstracto) */}
                        {source.type === 'scaleTypes' && (
                          <>
                            {renderScalesSelector(
                              source.scaleTypes,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'scaleTypes' ? { ...s, scaleTypes: next } : s,
                                ),
                              'Tipos de escala (fórmulas)',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>formula', 'Escala → Fórmula (grados)'],
                                    ['formula>name', 'Fórmula (grados) → Escala'],
                                    ['mode>parent', 'Modo → Grado en su escala madre'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: ScaletypeFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'scaleTypes' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 5. SCALES (Escalas y modos por tónica) */}
                        {source.type === 'scales' && (
                          <>
                            {renderScalesSelector(
                              source.scaleTypes,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'scales' ? { ...s, scaleTypes: next } : s,
                                ),
                              'Tipos de escala',
                            )}

                            {renderPitchClassSelector(
                              source.tonics,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'scales' ? { ...s, tonics: next } : s,
                                ),
                              'Tónicas',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>notes', 'Nombre → Notas'],
                                    ['notes>name', 'Notas → Nombre'],
                                    ['name>parent', 'Modo → Escala madre relativa'],
                                    ['name>formula', 'Nombre → Fórmula y notas'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: ScaleFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'scales' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 6. SCALE MODES (Los 7 modos relativos de una tonalidad mayor) */}
                        {source.type === 'scaleModes' && (
                          <>
                            <div>
                              <span className={styles.fieldLabel}>
                                Tonalidad mayor madre (genera sus 7 modos relativos)
                              </span>
                              <div className={styles.chipsContainer}>
                                {ALL_ROOTS.map((pc) => {
                                  const selected = source.parentTonic === pc;
                                  return (
                                    <button
                                      key={pc}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() =>
                                        updateSourceAt(index, (s) =>
                                          s.type === 'scaleModes' ? { ...s, parentTonic: pc } : s,
                                        )
                                      }
                                    >
                                      {pcName(pc)} mayor
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className={styles.modesPreviewBox}>
                              <span className={styles.modesPreviewLabel}>
                                Modos relativos generados (comparten las 7 notas de{' '}
                                {pcName(source.parentTonic)} mayor):
                              </span>
                              <div className={styles.modesPreviewPills}>
                                {MAJOR_MODE_PREVIEW.map((m) => {
                                  const modeRoot = ((source.parentTonic + m.offset) %
                                    12) as PitchClass;
                                  return (
                                    <span key={m.roman} className={styles.modePill}>
                                      {m.roman} · {pcName(modeRoot)} {m.modeName}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Preguntas a incluir</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>notes', 'Modo → Notas (p. ej. D Dórico → D E F G A B C)'],
                                    ['notes>name', 'Notas → Modo'],
                                    ['name>parent', 'Modo con tónica → Tonalidad madre'],
                                    ['mode>parent', 'Nombre del modo → Qué grado ocupa'],
                                    ['name>formula', 'Modo → Fórmula interválica'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: (ScaleFacet | ScaletypeFacet)[] = e.target
                                          .checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'scaleModes' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 7. DEGREES (Grados armónicos diatónicos) */}
                        {source.type === 'degrees' && (
                          <>
                            {renderPitchClassSelector(
                              source.tonics,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'degrees' ? { ...s, tonics: next } : s,
                                ),
                              'Tonalidades (tónicas)',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Modo de la tonalidad</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['major', 'Mayor (Jónico)'],
                                    ['minor', 'Menor natural (Eólico)'],
                                  ] as const
                                ).map(([modeKey, modeLabel]) => {
                                  const selected = source.modes.includes(modeKey);
                                  return (
                                    <button
                                      key={modeKey}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.modes.filter((m) => m !== modeKey)
                                          : [...source.modes, modeKey];
                                        updateSourceAt(index, (s) =>
                                          s.type === 'degrees' ? { ...s, modes: next } : s,
                                        );
                                      }}
                                    >
                                      {modeLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Grados de la escala (1–7)</span>
                              <div className={styles.chipsContainer}>
                                {DEGREE_ITEMS.map((d) => {
                                  const selected = source.degrees.includes(d.degree);
                                  return (
                                    <button
                                      key={d.degree}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.degrees.filter((deg) => deg !== d.degree)
                                          : [...source.degrees, d.degree].sort((a, b) => a - b);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'degrees' ? { ...s, degrees: next } : s,
                                        );
                                      }}
                                    >
                                      {d.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Tipo de acordes diatónicos</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['triads', 'Tríadas (3 notas: C, Dm, Em...)'],
                                    ['sevenths', 'Cuatríadas de 7ª (4 notas: Cmaj7, Dm7, G7...)'],
                                  ] as const
                                ).map(([kindKey, kindLabel]) => {
                                  const selected = source.chordKinds.includes(kindKey);
                                  return (
                                    <button
                                      key={kindKey}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.chordKinds.filter((k) => k !== kindKey)
                                          : [...source.chordKinds, kindKey];
                                        updateSourceAt(index, (s) =>
                                          s.type === 'degrees' ? { ...s, chordKinds: next } : s,
                                        );
                                      }}
                                    >
                                      {kindLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['roman>chord', 'Grado romano → Acorde'],
                                    ['chord>roman', 'Acorde → Grado romano'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: DegreeFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'degrees' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 8. PROGRESSIONS (Progresiones armónicas) */}
                        {source.type === 'progressions' && (
                          <>
                            <div>
                              <div className={styles.fieldHeaderRow}>
                                <span className={styles.fieldLabel}>Plantillas de progresión</span>
                                <div className={styles.fieldQuickActions}>
                                  <button
                                    type="button"
                                    className={styles.miniActionBtn}
                                    onClick={() =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'progressions'
                                          ? {
                                              ...s,
                                              progressionIds: PROGRESSIONS.map((p) => p.id),
                                            }
                                          : s,
                                      )
                                    }
                                  >
                                    Todas (10)
                                  </button>
                                </div>
                              </div>
                              <div className={styles.chipsContainer}>
                                {PROGRESSIONS.map((prog) => {
                                  const selected = source.progressionIds.includes(prog.id);
                                  return (
                                    <button
                                      key={prog.id}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next: ProgressionId[] = selected
                                          ? source.progressionIds.filter((pid) => pid !== prog.id)
                                          : [...source.progressionIds, prog.id];
                                        updateSourceAt(index, (s) =>
                                          s.type === 'progressions'
                                            ? { ...s, progressionIds: next }
                                            : s,
                                        );
                                      }}
                                    >
                                      {prog.name} ({prog.mode === 'major' ? 'Mayor' : 'Menor'})
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {renderPitchClassSelector(
                              source.tonics,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'progressions' ? { ...s, tonics: next } : s,
                                ),
                              'Tónicas',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['roman>chords', 'Grados romanos → Acordes'],
                                    ['chords>roman', 'Acordes → Grados romanos'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: ProgressionFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'progressions' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 9. FRET NOTES (Notas en el mástil por cuerda y traste) */}
                        {source.type === 'fretNotes' && (
                          <>
                            <div>
                              <div className={styles.fieldHeaderRow}>
                                <span className={styles.fieldLabel}>Cuerdas a incluir</span>
                                <div className={styles.fieldQuickActions}>
                                  <button
                                    type="button"
                                    className={styles.miniActionBtn}
                                    onClick={() =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'fretNotes' ? { ...s, strings: [6, 5] } : s,
                                      )
                                    }
                                  >
                                    6ª y 5ª
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.miniActionBtn}
                                    onClick={() =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'fretNotes'
                                          ? { ...s, strings: [...ALL_STRINGS] }
                                          : s,
                                      )
                                    }
                                  >
                                    Todas (1–6)
                                  </button>
                                </div>
                              </div>
                              <div className={styles.chipsContainer}>
                                {ALL_STRINGS.map((strNum) => {
                                  const selected = source.strings.includes(strNum);
                                  return (
                                    <button
                                      key={strNum}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.strings.filter((st) => st !== strNum)
                                          : [...source.strings, strNum].sort((a, b) => a - b);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'fretNotes' ? { ...s, strings: next } : s,
                                        );
                                      }}
                                    >
                                      {STRING_LABELS[strNum]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <div className={styles.fieldHeaderRow}>
                                <span className={styles.fieldLabel}>
                                  Rango de trastes ({source.fretRange[0]}–{source.fretRange[1]})
                                </span>
                                <div className={styles.fieldQuickActions}>
                                  {(
                                    [
                                      [[0, 5], '0–5 (Abierta)'],
                                      [[0, 12], '0–12 (1ª octava)'],
                                      [[0, 24], '0–24 (Todo el mástil)'],
                                    ] as const
                                  ).map(([rangePair, rangeLabel]) => (
                                    <button
                                      key={rangeLabel}
                                      type="button"
                                      className={styles.miniActionBtn}
                                      onClick={() =>
                                        updateSourceAt(index, (s) =>
                                          s.type === 'fretNotes'
                                            ? { ...s, fretRange: [rangePair[0], rangePair[1]] }
                                            : s,
                                        )
                                      }
                                    >
                                      {rangeLabel}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className={styles.rangeRow}>
                                <label className={styles.rangeInputInline}>
                                  Desde traste:
                                  <input
                                    type="number"
                                    min={0}
                                    max={24}
                                    className={styles.smallNumberInput}
                                    value={source.fretRange[0]}
                                    onChange={(e) => {
                                      const minF = Math.max(
                                        0,
                                        Math.min(24, parseInt(e.target.value, 10) || 0),
                                      );
                                      const maxF = Math.max(minF, source.fretRange[1]);
                                      updateSourceAt(index, (s) =>
                                        s.type === 'fretNotes'
                                          ? { ...s, fretRange: [minF, maxF] }
                                          : s,
                                      );
                                    }}
                                    data-testid={`fretnotes-min-${index}`}
                                  />
                                </label>
                                <label className={styles.rangeInputInline}>
                                  Hasta traste:
                                  <input
                                    type="number"
                                    min={0}
                                    max={24}
                                    className={styles.smallNumberInput}
                                    value={source.fretRange[1]}
                                    onChange={(e) => {
                                      const maxF = Math.max(
                                        0,
                                        Math.min(24, parseInt(e.target.value, 10) || 0),
                                      );
                                      const minF = Math.min(source.fretRange[0], maxF);
                                      updateSourceAt(index, (s) =>
                                        s.type === 'fretNotes'
                                          ? { ...s, fretRange: [minF, maxF] }
                                          : s,
                                      );
                                    }}
                                    data-testid={`fretnotes-max-${index}`}
                                  />
                                </label>
                                <label className={styles.checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    className={styles.checkboxInput}
                                    checked={Boolean(source.naturalsOnly)}
                                    onChange={(e) =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'fretNotes'
                                          ? { ...s, naturalsOnly: e.target.checked }
                                          : s,
                                      )
                                    }
                                  />
                                  Solo notas naturales (sin ♯/♭)
                                </label>
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['pos>name', 'Posición (cuerda/traste) → Nombre de la nota'],
                                    ['name>pos', 'Nota y cuerda → Traste'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: FretnoteFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'fretNotes' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 10. STRING NOTES (Notas por cuerda) */}
                        {source.type === 'stringNotes' && (
                          <>
                            <div>
                              <div className={styles.fieldHeaderRow}>
                                <span className={styles.fieldLabel}>Cuerdas a incluir</span>
                                <div className={styles.fieldQuickActions}>
                                  <button
                                    type="button"
                                    className={styles.miniActionBtn}
                                    onClick={() =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'stringNotes'
                                          ? { ...s, strings: [...ALL_STRINGS] }
                                          : s,
                                      )
                                    }
                                  >
                                    Todas (1–6)
                                  </button>
                                </div>
                              </div>
                              <div className={styles.chipsContainer}>
                                {ALL_STRINGS.map((strNum) => {
                                  const selected = source.strings.includes(strNum);
                                  return (
                                    <button
                                      key={strNum}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.strings.filter((st) => st !== strNum)
                                          : [...source.strings, strNum].sort((a, b) => a - b);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'stringNotes' ? { ...s, strings: next } : s,
                                        );
                                      }}
                                    >
                                      {STRING_LABELS[strNum]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {renderPitchClassSelector(
                              source.pitchClasses,
                              (next) =>
                                updateSourceAt(index, (s) =>
                                  s.type === 'stringNotes' ? { ...s, pitchClasses: next } : s,
                                ),
                              'Notas a localizar en cada cuerda',
                            )}

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>pos', 'Nota + Cuerda → Posiciones en el mástil'],
                                    ['pos>name', 'Posiciones en la cuerda → Nota'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: NotestringFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'stringNotes' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* 11. INTERVALS (Intervalos musicales) */}
                        {source.type === 'intervals' && (
                          <>
                            <div>
                              <div className={styles.fieldHeaderRow}>
                                <span className={styles.fieldLabel}>Intervalos (semitonos)</span>
                                <div className={styles.fieldQuickActions}>
                                  <button
                                    type="button"
                                    className={styles.miniActionBtn}
                                    onClick={() =>
                                      updateSourceAt(index, (s) =>
                                        s.type === 'intervals'
                                          ? {
                                              ...s,
                                              semitones: INTERVAL_ITEMS.map((it) => it.semitones),
                                            }
                                          : s,
                                      )
                                    }
                                  >
                                    Todos (1–12)
                                  </button>
                                </div>
                              </div>
                              <div className={styles.chipsContainer}>
                                {INTERVAL_ITEMS.map((item) => {
                                  const selected = source.semitones.includes(item.semitones);
                                  return (
                                    <button
                                      key={item.semitones}
                                      type="button"
                                      className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                      onClick={() => {
                                        const next = selected
                                          ? source.semitones.filter((st) => st !== item.semitones)
                                          : [...source.semitones, item.semitones].sort(
                                              (a, b) => a - b,
                                            );
                                        updateSourceAt(index, (s) =>
                                          s.type === 'intervals' ? { ...s, semitones: next } : s,
                                        );
                                      }}
                                    >
                                      {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                              <div className={styles.chipsContainer}>
                                {(
                                  [
                                    ['name>semitones', 'Nombre del intervalo → Semitonos'],
                                    ['semitones>name', 'Semitonos → Nombre del intervalo'],
                                  ] as const
                                ).map(([facetKey, facetLabel]) => (
                                  <label key={facetKey} className={styles.checkboxLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.checkboxInput}
                                      checked={source.facets.includes(facetKey)}
                                      onChange={(e) => {
                                        const next: IntervalFacet[] = e.target.checked
                                          ? [...source.facets, facetKey]
                                          : source.facets.filter((f) => f !== facetKey);
                                        updateSourceAt(index, (s) =>
                                          s.type === 'intervals' ? { ...s, facets: next } : s,
                                        );
                                      }}
                                    />
                                    {facetLabel}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Botonera completa para añadir cualquiera de los 11 bloques de contenido */}
              <div className={styles.addSourceMenu}>
                <span className={styles.addBlockLabel}>
                  + Añadir bloque de tarjetas (pasa el ratón por «?» en cada bloque para ver ejemplos):
                </span>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddFretNotesBlock}
                  title={BLOCK_META.fretNotes.subtitle}
                  data-testid="add-block-fretnotes"
                >
                  + 📍 Notas en el mástil
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddStringNotesBlock}
                  title={BLOCK_META.stringNotes.subtitle}
                  data-testid="add-block-stringnotes"
                >
                  + 🧵 Notas por cuerda
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddIntervalsBlock}
                  title={BLOCK_META.intervals.subtitle}
                  data-testid="add-block-intervals"
                >
                  + 📏 Intervalos
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddQualitiesBlock}
                  title={BLOCK_META.qualities.subtitle}
                  data-testid="add-block-qualities"
                >
                  + 🎵 Calidades de acordes
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddChordsBlock}
                  title={BLOCK_META.chords.subtitle}
                  data-testid="add-block-chords"
                >
                  + 🎼 Acordes concretos
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddVoicingsBlock}
                  title={BLOCK_META.voicings.subtitle}
                  data-testid="add-block-voicings"
                >
                  + 🎸 Digitaciones
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddScaleTypesBlock}
                  title={BLOCK_META.scaleTypes.subtitle}
                  data-testid="add-block-scaletypes"
                >
                  + 📐 Fórmulas de escalas
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddScalesBlock}
                  title={BLOCK_META.scales.subtitle}
                  data-testid="add-block-scales"
                >
                  + 🎹 Escalas por tónica
                </button>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={handleAddMajorModesBlock}
                  title={BLOCK_META.scaleModes.subtitle}
                  data-testid="add-block-major-modes"
                >
                  ✨ + 7 modos relativos de una tonalidad
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddDegreesBlock}
                  title={BLOCK_META.degrees.subtitle}
                  data-testid="add-block-degrees"
                >
                  + 🏛️ Grados diatónicos
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddProgressionsBlock}
                  title={BLOCK_META.progressions.subtitle}
                  data-testid="add-block-progressions"
                >
                  + 🔄 Progresiones armónicas
                </button>
              </div>
            </>
          )}

          {activeTab === 'presets' && (
            <div className={styles.presetsGrid} data-testid="presets-list">
              {PRESET_DECKS.map((preset) => {
                const presetCardCount = buildDeckCardIds(preset.sources).length;
                return (
                  <div
                    key={preset.id}
                    className={styles.presetCard}
                    data-testid={`preset-card-${preset.id}`}
                  >
                    <div className={styles.presetInfo}>
                      <div className={styles.presetHeaderRow}>
                        <h4 className={styles.presetName}>{preset.name}</h4>
                        <span className={styles.presetCardCount}>
                          {presetCardCount} tarjetas
                        </span>
                      </div>
                      <p className={styles.presetDesc}>{preset.description}</p>
                      <span className={styles.presetLimits}>
                        Límites: {preset.limits.newPerDay} nuevas/día ·{' '}
                        {preset.limits.reviewsPerDay} repasos/día
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.addPresetBtn}
                      onClick={() => {
                        onAddPreset?.(preset.id);
                        onClose();
                      }}
                      data-testid={`add-preset-btn-${preset.id}`}
                    >
                      Añadir a mis mazos
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie */}
        <footer className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            <div className={styles.liveCardCount}>
              <span>Total:</span>
              <span className={styles.countBadge} data-testid="total-card-count">
                {activeTab === 'builder' ? `${totalCards} tarjetas` : '3 mazos disponibles'}
              </span>
            </div>

            {activeTab === 'builder' && initialDeck && onDeleteDeck && (
              <>
                {!confirmingDelete ? (
                  <button
                    type="button"
                    className={styles.deleteDeckBtn}
                    onClick={() => setConfirmingDelete(true)}
                    data-testid="modal-delete-deck-btn"
                  >
                    Eliminar mazo
                  </button>
                ) : (
                  <div className={styles.confirmDeleteGroup}>
                    <span>¿Eliminar «{initialDeck.name}»?</span>
                    <button
                      type="button"
                      className={styles.confirmDeleteBtn}
                      onClick={() => {
                        onDeleteDeck(initialDeck.id);
                        onClose();
                      }}
                      data-testid="modal-confirm-delete-deck-btn"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      className={styles.miniActionBtn}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      No
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              data-testid="deck-builder-cancel"
            >
              Cancelar
            </button>
            {activeTab === 'builder' && (
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!name.trim() || totalCards === 0}
                onClick={handleSave}
                data-testid="deck-builder-save"
              >
                Guardar mazo
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
