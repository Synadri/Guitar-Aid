import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { buildDeckCardIds } from '../../learning/cards/builder';
import {
  fragmentToDeckSources,
  type BridgeDeckOptions,
  type SongFragmentAnalysis,
  type SongModel,
} from '../../song';
import {
  decksStore as defaultDecksStore,
  type DecksStore,
} from '../../state';
import styles from './SongExportDeckModal.module.css';

export interface SongExportDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  fragment?: SongFragmentAnalysis | null;
  song?: SongModel | null;
  decksStore?: StoreApi<DecksStore>;
  onDeckCreated?: (deckId: string) => void;
}

export function SongExportDeckModal({
  isOpen,
  onClose,
  fragment,
  song,
  decksStore = defaultDecksStore,
  onDeckCreated,
}: SongExportDeckModalProps) {
  const decksState = useStore(decksStore, (s) => s);
  const decks = decksState.decks;

  // Modo: crear nuevo mazo o añadir a existente
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id ?? '');
  const [deckName, setDeckName] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Opciones de fuentes a incluir
  const [options, setOptions] = useState<BridgeDeckOptions>({
    includeChords: true,
    includeVoicings: true,
    includeScales: true,
    includeProgressions: true,
    includeDegrees: true,
  });

  // Sección del fragmento
  const sectionName = useMemo(() => {
    if (!song || !fragment) return undefined;
    const start = fragment.range.startBarNumber;
    const end = fragment.range.endBarNumber;
    const barWithSection = song.tracks[0]?.bars.find(
      (b) => b.number >= start && b.number <= end && Boolean(b.sectionMarker),
    );
    return barWithSection?.sectionMarker;
  }, [song, fragment]);

  // Nombre sugerido por defecto
  const defaultDeckName = useMemo(() => {
    const title = song?.title || 'Canción';
    const section =
      sectionName ||
      (fragment?.range
        ? `Compases ${fragment.range.startBarNumber}–${fragment.range.endBarNumber}`
        : 'Fragmento');
    return `Canción: ${title} — ${section}`;
  }, [song, fragment, sectionName]);

  // Restablecer valores cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setDeckName(defaultDeckName);
      setTargetMode('new');
      setSelectedDeckId(decks[0]?.id ?? '');
      setSuccessMessage(null);
      setOptions({
        includeChords: true,
        includeVoicings: true,
        includeScales: Boolean(fragment?.primaryScale),
        includeProgressions: Boolean(
          fragment?.progression.progressions && fragment.progression.progressions.length > 0,
        ),
        includeDegrees: Boolean(fragment?.primaryKey),
      });
    }
  }, [isOpen, defaultDeckName, fragment, decks]);

  // Tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Calcular fuentes y tarjetas resultantes en vivo
  const generatedSources = useMemo(() => {
    if (!fragment) return [];
    return fragmentToDeckSources(fragment, options);
  }, [fragment, options]);

  const generatedCardIds = useMemo(() => {
    if (generatedSources.length === 0) return [];
    return buildDeckCardIds(generatedSources);
  }, [generatedSources]);

  // Acordes únicos del fragmento para mostrar en el detalle
  const uniqueChordNames = useMemo(() => {
    if (!fragment) return [];
    const names = new Set<string>();
    for (const bc of fragment.barChords) {
      if (bc.primaryChord?.name) {
        names.add(bc.primaryChord.name);
      }
    }
    return Array.from(names);
  }, [fragment]);

  if (!isOpen) return null;

  const handleToggleOption = (key: keyof BridgeDeckOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleConfirm = () => {
    if (generatedSources.length === 0) return;

    let targetId = '';

    if (targetMode === 'new') {
      const finalName = deckName.trim() || defaultDeckName;
      const created = decksStore.getState().createDeck({
        name: finalName,
        description: `Exportado desde Guitar Aid (Modo Canción) a partir de «${song?.title ?? 'Canción'}»`,
        sources: generatedSources,
      });
      targetId = created.id;
    } else {
      const existing = decks.find((d) => d.id === selectedDeckId);
      if (existing) {
        const mergedSources = [...existing.sources, ...generatedSources];
        decksStore.getState().updateDeck(existing.id, {
          sources: mergedSources,
        });
        targetId = existing.id;
      }
    }

    if (targetId) {
      onDeckCreated?.(targetId);
      setSuccessMessage('¡Mazo guardado correctamente en tu biblioteca SRS!');
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  const subtitleText = `${song?.title || 'Canción'}${
    fragment?.range
      ? ` · Compases ${fragment.range.startBarNumber}–${fragment.range.endBarNumber}`
      : ''
  }${sectionName ? ` (${sectionName})` : ''}`;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="song-export-deck-modal"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-deck-title"
      >
        {/* Cabecera */}
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <span className={styles.icon} aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="16" height="20" x="4" y="2" rx="2" />
                  <path d="M8 6h8" />
                  <path d="M8 10h8" />
                  <path d="M8 14h6" />
                </svg>
              </span>
              <h2 id="export-deck-title" className={styles.title}>
                Crear o añadir a mazo SRS
              </h2>
            </div>
            <span className={styles.subtitle}>{subtitleText}</span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </header>

        {/* Cuerpo */}
        <div className={styles.body}>
          {successMessage ? (
            <div className={styles.successAlert} role="status">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              {/* Sección 1: Destino del mazo */}
              <section className={styles.section}>
                <span className={styles.sectionTitle}>Destino del mazo</span>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="deckTargetMode"
                      value="new"
                      checked={targetMode === 'new'}
                      onChange={() => setTargetMode('new')}
                      className={styles.radioInput}
                    />
                    <span>Crear un nuevo mazo</span>
                  </label>

                  {targetMode === 'new' && (
                    <input
                      type="text"
                      className={styles.inputField}
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      placeholder={defaultDeckName}
                      aria-label="Nombre del nuevo mazo"
                      autoFocus
                    />
                  )}

                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="deckTargetMode"
                      value="existing"
                      checked={targetMode === 'existing'}
                      onChange={() => setTargetMode('existing')}
                      disabled={decks.length === 0}
                      className={styles.radioInput}
                    />
                    <span>Añadir a un mazo existente</span>
                  </label>

                  {targetMode === 'existing' && (
                    <select
                      className={styles.selectField}
                      value={selectedDeckId}
                      onChange={(e) => setSelectedDeckId(e.target.value)}
                      aria-label="Seleccionar mazo de destino"
                    >
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.cardIds.length} tarjetas)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </section>

              {/* Sección 2: Contenido a incluir */}
              <section className={styles.section}>
                <span className={styles.sectionTitle}>Contenido a incluir del fragmento</span>
                <div className={styles.checkboxList}>
                  {/* Acordes */}
                  <label className={styles.checkboxItem}>
                    <div className={styles.checkboxLeft}>
                      <input
                        type="checkbox"
                        checked={options.includeChords}
                        onChange={() => handleToggleOption('includeChords')}
                        className={styles.checkboxInput}
                      />
                      <span>Tarjetas de acordes</span>
                    </div>
                    {uniqueChordNames.length > 0 && (
                      <span className={styles.checkboxDetail}>
                        {uniqueChordNames.join(', ')}
                      </span>
                    )}
                  </label>

                  {/* Voicings / Digitaciones */}
                  <label className={styles.checkboxItem}>
                    <div className={styles.checkboxLeft}>
                      <input
                        type="checkbox"
                        checked={options.includeVoicings}
                        onChange={() => handleToggleOption('includeVoicings')}
                        className={styles.checkboxInput}
                      />
                      <span>Digitaciones en el mástil (Voicings)</span>
                    </div>
                    <span className={styles.checkboxDetail}>Abiertos y cejillas</span>
                  </label>

                  {/* Escala */}
                  <label
                    className={`${styles.checkboxItem} ${
                      !fragment?.primaryScale ? styles.checkboxItemDisabled : ''
                    }`}
                  >
                    <div className={styles.checkboxLeft}>
                      <input
                        type="checkbox"
                        checked={options.includeScales && Boolean(fragment?.primaryScale)}
                        disabled={!fragment?.primaryScale}
                        onChange={() => handleToggleOption('includeScales')}
                        className={styles.checkboxInput}
                      />
                      <span>Escala del fragmento</span>
                    </div>
                    {fragment?.primaryScale && (
                      <span className={styles.checkboxDetail}>
                        {fragment.primaryScale.name}
                      </span>
                    )}
                  </label>

                  {/* Progresión armónica */}
                  <label
                    className={`${styles.checkboxItem} ${
                      !fragment?.progression.progressions ||
                      fragment.progression.progressions.length === 0
                        ? styles.checkboxItemDisabled
                        : ''
                    }`}
                  >
                    <div className={styles.checkboxLeft}>
                      <input
                        type="checkbox"
                        checked={
                          options.includeProgressions &&
                          Boolean(
                            fragment?.progression.progressions &&
                              fragment.progression.progressions.length > 0,
                          )
                        }
                        disabled={
                          !fragment?.progression.progressions ||
                          fragment.progression.progressions.length === 0
                        }
                        onChange={() => handleToggleOption('includeProgressions')}
                        className={styles.checkboxInput}
                      />
                      <span>Progresión armónica</span>
                    </div>
                    {fragment?.progression.progressions?.[0] && (
                      <span className={styles.checkboxDetail}>
                        {fragment.progression.progressions[0].value.template.name}
                      </span>
                    )}
                  </label>

                  {/* Grados de la tonalidad */}
                  <label
                    className={`${styles.checkboxItem} ${
                      !fragment?.primaryKey ? styles.checkboxItemDisabled : ''
                    }`}
                  >
                    <div className={styles.checkboxLeft}>
                      <input
                        type="checkbox"
                        checked={options.includeDegrees && Boolean(fragment?.primaryKey)}
                        disabled={!fragment?.primaryKey}
                        onChange={() => handleToggleOption('includeDegrees')}
                        className={styles.checkboxInput}
                      />
                      <span>Grados de la tonalidad</span>
                    </div>
                    {fragment?.primaryKey && (
                      <span className={styles.checkboxDetail}>
                        {fragment.primaryKey.name}
                      </span>
                    )}
                  </label>
                </div>
              </section>

              {/* Sección 3: Vista previa de tarjetas */}
              <div className={styles.previewBanner}>
                <div className={styles.previewText}>
                  Se generarán{' '}
                  <span className={styles.previewHighlight} data-testid="preview-card-count">
                    {generatedCardIds.length} tarjetas
                  </span>{' '}
                  para estudiar con repetición espaciada (SRS).
                </div>
                <div className={styles.previewBadges}>
                  <span className={styles.previewBadge}>
                    {generatedSources.length} fuentes
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pie de acciones */}
        {!successMessage && (
          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={generatedCardIds.length === 0}
              data-testid="confirm-export-deck-btn"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{targetMode === 'new' ? 'Crear mazo' : 'Añadir al mazo'}</span>
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
