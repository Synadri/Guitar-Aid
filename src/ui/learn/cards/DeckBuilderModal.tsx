import { useEffect, useMemo, useState } from 'react';
import { buildDeckCardIds } from '../../../learning/cards/builder';
import { PRESET_DECKS } from '../../../learning/cards/presets';
import type {
  Deck,
  DeckLimits,
  DeckSource,
  VoicingFacet,
  ChordFacet,
} from '../../../learning/cards/types';
import type { ChordQualityId } from '../../../theory/data/chords';
import type { ScaleTypeId } from '../../../theory/data/scales';
import type { VoicingFamily } from '../../../theory/data/voicings/standard';
import type { PitchClass } from '../../../theory';
import { pcName } from '../../../theory';
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
  onAddPreset?: (presetId: 'beginner' | 'intermediate' | 'advanced') => void;
  initialTab?: 'builder' | 'presets';
}

const COMMON_QUALITIES: readonly { id: ChordQualityId; label: string }[] = [
  { id: 'maj', label: 'Mayor' },
  { id: 'm', label: 'Menor' },
  { id: '7', label: '7ª' },
  { id: 'maj7', label: 'maj7' },
  { id: 'm7', label: 'm7' },
  { id: 'm7b5', label: 'm7♭5' },
  { id: 'dim7', label: 'dim7' },
  { id: 'sus4', label: 'sus4' },
  { id: '9', label: '9ª' },
];

const VOICING_FAMILIES: readonly { id: VoicingFamily; label: string }[] = [
  { id: 'open', label: 'Abiertos' },
  { id: 'barre-E', label: 'Cejilla 6ª' },
  { id: 'barre-A', label: 'Cejilla 5ª' },
  { id: 'strings-1-4', label: 'Cuerdas 1–4' },
  { id: 'strings-1-3', label: 'Cuerdas 1–3' },
];

const COMMON_SCALES: readonly { id: ScaleTypeId; label: string }[] = [
  { id: 'major', label: 'Mayor' },
  { id: 'dorian', label: 'Dórico' },
  { id: 'phrygian', label: 'Frigio' },
  { id: 'lydian', label: 'Lidio' },
  { id: 'mixolydian', label: 'Mixolidio' },
  { id: 'minor', label: 'Menor' },
  { id: 'locrian', label: 'Locrio' },
  { id: 'majorPentatonic', label: 'Pentatónica Mayor' },
  { id: 'minorPentatonic', label: 'Pentatónica Menor' },
  { id: 'blues', label: 'Blues' },
];

const NATURAL_ROOTS: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

export function DeckBuilderModal({
  isOpen,
  onClose,
  initialDeck,
  onSaveDeck,
  onAddPreset,
  initialTab = 'builder',
}: DeckBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<'builder' | 'presets'>(initialTab);
  const [name, setName] = useState('');
  const [newPerDay, setNewPerDay] = useState(20);
  const [reviewsPerDay, setReviewsPerDay] = useState(200);
  const [sources, setSources] = useState<DeckSource[]>([]);

  // Sincronizar estado cuando se abre el modal o cambia initialDeck
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
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

  // Acciones sobre fuentes
  const handleRemoveSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
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

  const handleAddChordsBlock = () => {
    setSources((prev) => [
      ...prev,
      {
        type: 'chords',
        qualities: ['maj', 'm', '7', 'maj7', 'm7'],
        roots: [0, 2, 4, 5, 7, 9, 11],
        facets: ['name>notes', 'notes>name'],
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
                  sources.map((source, index) => (
                    <div
                      key={`source-${index}`}
                      className={styles.ruleBlock}
                      data-testid={`rule-block-${index}`}
                    >
                      <div className={styles.ruleBlockHeader}>
                        <div className={styles.ruleBlockTitle}>
                          {source.type === 'voicings' && '🎸 Digitaciones de acordes'}
                          {source.type === 'chords' && '🎼 Fórmulas y notas de acordes'}
                          {source.type === 'qualities' && '🎵 Calidades de acordes'}
                          {source.type === 'scales' && '📐 Escalas y modos'}
                          {source.type === 'scaleModes' && '✨ Los 7 modos de una escala madre'}
                          {source.type === 'progressions' && '🔄 Progresiones armónicas'}
                          {source.type === 'fretNotes' && '📍 Notas en el mástil'}
                          {source.type === 'intervals' && '📏 Intervalos'}
                        </div>
                        <button
                          type="button"
                          className={styles.removeBlockBtn}
                          onClick={() => handleRemoveSource(index)}
                          aria-label={`Eliminar bloque ${index + 1}`}
                        >
                          Eliminar
                        </button>
                      </div>

                      {/* Configuración específica según el tipo */}
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
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'voicings'
                                            ? { ...s, families: next }
                                            : s,
                                        ),
                                      );
                                    }}
                                  >
                                    {fam.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <span className={styles.fieldLabel}>Calidades</span>
                            <div className={styles.chipsContainer}>
                              {COMMON_QUALITIES.map((q) => {
                                const selected = source.qualities.includes(q.id);
                                return (
                                  <button
                                    key={q.id}
                                    type="button"
                                    className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                    onClick={() => {
                                      const next = selected
                                        ? source.qualities.filter((qid) => qid !== q.id)
                                        : [...source.qualities, q.id];
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'voicings'
                                            ? { ...s, qualities: next }
                                            : s,
                                        ),
                                      );
                                    }}
                                  >
                                    {q.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <span className={styles.fieldLabel}>Dirección de las tarjetas</span>
                            <div className={styles.chipsContainer}>
                              <label className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  className={styles.checkboxInput}
                                  checked={source.facets.includes('name>shape')}
                                  onChange={(e) => {
                                    const next: VoicingFacet[] = e.target.checked
                                      ? [...source.facets, 'name>shape']
                                      : source.facets.filter((f) => f !== 'name>shape');
                                    setSources((prev) =>
                                      prev.map((s, i) =>
                                        i === index && s.type === 'voicings'
                                          ? { ...s, facets: next }
                                          : s,
                                      ),
                                    );
                                  }}
                                />
                                Nombre → Forma
                              </label>
                              <label className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  className={styles.checkboxInput}
                                  checked={source.facets.includes('shape>name')}
                                  onChange={(e) => {
                                    const next: VoicingFacet[] = e.target.checked
                                      ? [...source.facets, 'shape>name']
                                      : source.facets.filter((f) => f !== 'shape>name');
                                    setSources((prev) =>
                                      prev.map((s, i) =>
                                        i === index && s.type === 'voicings'
                                          ? { ...s, facets: next }
                                          : s,
                                      ),
                                    );
                                  }}
                                />
                                Forma → Nombre
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      {source.type === 'chords' && (
                        <>
                          <div>
                            <span className={styles.fieldLabel}>Calidades de acorde</span>
                            <div className={styles.chipsContainer}>
                              {COMMON_QUALITIES.map((q) => {
                                const selected = source.qualities.includes(q.id);
                                return (
                                  <button
                                    key={q.id}
                                    type="button"
                                    className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                    onClick={() => {
                                      const next = selected
                                        ? source.qualities.filter((qid) => qid !== q.id)
                                        : [...source.qualities, q.id];
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'chords'
                                            ? { ...s, qualities: next }
                                            : s,
                                        ),
                                      );
                                    }}
                                  >
                                    {q.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <span className={styles.fieldLabel}>Facetas</span>
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
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'chords'
                                            ? { ...s, facets: next }
                                            : s,
                                        ),
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

                      {source.type === 'scales' && (
                        <>
                          <div>
                            <span className={styles.fieldLabel}>Tipos de escala</span>
                            <div className={styles.chipsContainer}>
                              {COMMON_SCALES.map((sc) => {
                                const selected = source.scaleTypes.includes(sc.id);
                                return (
                                  <button
                                    key={sc.id}
                                    type="button"
                                    className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                    onClick={() => {
                                      const next = selected
                                        ? source.scaleTypes.filter((sid) => sid !== sc.id)
                                        : [...source.scaleTypes, sc.id];
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'scales'
                                            ? { ...s, scaleTypes: next }
                                            : s,
                                        ),
                                      );
                                    }}
                                  >
                                    {sc.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <span className={styles.fieldLabel}>Tónicas</span>
                            <div className={styles.chipsContainer}>
                              {NATURAL_ROOTS.map((root) => {
                                const selected = source.tonics.includes(root);
                                return (
                                  <button
                                    key={root}
                                    type="button"
                                    className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
                                    onClick={() => {
                                      const next = selected
                                        ? source.tonics.filter((r) => r !== root)
                                        : [...source.tonics, root];
                                      setSources((prev) =>
                                        prev.map((s, i) =>
                                          i === index && s.type === 'scales'
                                            ? { ...s, tonics: next }
                                            : s,
                                        ),
                                      );
                                    }}
                                  >
                                    {pcName(root)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {source.type === 'scaleModes' && (
                        <div>
                          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                            Genera los 7 modos de la escala mayor sobre la tónica elegida (Jónico,
                            Dórico, Frigio, Lidio, Mixolidio, Eólico y Locrio).
                          </p>
                        </div>
                      )}

                      {source.type === 'fretNotes' && (
                        <div>
                          <span className={styles.fieldLabel}>
                            Cuerdas: {source.strings.join(', ')} · Trastes:{' '}
                            {source.fretRange.join('–')} (
                            {source.naturalsOnly ? 'Solo naturales' : 'Todas las notas'})
                          </span>
                        </div>
                      )}

                      {source.type === 'intervals' && (
                        <div>
                          <span className={styles.fieldLabel}>
                            Semitonos: {source.semitones.join(', ')} (nombre ↔ semitonos)
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Botonera para añadir bloques de contenido */}
              <div className={styles.addSourceMenu}>
                <span className={styles.addBlockLabel}>+ Añadir bloque:</span>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddVoicingsBlock}
                  data-testid="add-block-voicings"
                >
                  + Digitaciones
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddChordsBlock}
                  data-testid="add-block-chords"
                >
                  + Acordes
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddScalesBlock}
                  data-testid="add-block-scales"
                >
                  + Escalas
                </button>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={handleAddMajorModesBlock}
                  data-testid="add-block-major-modes"
                >
                  ✨ Añadir los 7 modos de C mayor
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddFretNotesBlock}
                  data-testid="add-block-fretnotes"
                >
                  + Notas del mástil
                </button>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={handleAddIntervalsBlock}
                  data-testid="add-block-intervals"
                >
                  + Intervalos
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
          <div className={styles.liveCardCount}>
            <span>Total:</span>
            <span className={styles.countBadge} data-testid="total-card-count">
              {activeTab === 'builder' ? `${totalCards} tarjetas` : '3 mazos disponibles'}
            </span>
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
