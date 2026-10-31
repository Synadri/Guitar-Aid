import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  decksStore as defaultDecksStore,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  selectDeckQueueCounts,
  selectIntervalPreviewsForCurrentCard,
  selectCurrentCardResolved,
  selectDeckCardsDetail,
  type DecksStore,
  type SandboxStore,
  type SettingsStore,
  type MenuContext,
  type DeckCardItem,
} from '../../../state';
import {
  audioEngine as defaultAudioEngine,
  arpeggioEvents,
  chordEvents,
  intervalEvents,
  playEvents,
  type AudioEngine,
} from '../../../audio';
import { type Deck } from '../../../learning';
import { STANDARD_TUNING, pcName } from '../../../theory';
import { Fretboard } from '../../instruments';
import { ChordDiagram } from './ChordDiagram';
import { DeckBuilderModal } from './DeckBuilderModal';
import styles from './FlashcardsView.module.css';

export interface FlashcardsViewProps {
  decksStore?: StoreApi<DecksStore>;
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  audioEngine?: AudioEngine;
  onOpenInSandbox?: (context: MenuContext) => void;
  onNavigateToSandbox?: () => void;
  now?: () => number;
}

export function FlashcardsView({
  decksStore = defaultDecksStore,
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  audioEngine = defaultAudioEngine,
  onOpenInSandbox,
  onNavigateToSandbox,
  now: nowFn = Date.now,
}: FlashcardsViewProps) {
  // Estado del store de mazos
  const decks = useStore(decksStore, (s) => s.decks);
  const activeDeckId = useStore(decksStore, (s) => s.activeDeckId);
  const session = useStore(decksStore, (s) => s.session);
  const cardsSRS = useStore(decksStore, (s) => s.cardsSRS);
  const dailyUsage = useStore(decksStore, (s) => s.dailyUsage);

  // Ajustes globales
  const tuning = useStore(settingsStore, (s) => s.tuning ?? STANDARD_TUNING);
  const soundEnabled = useStore(settingsStore, (s) => s.soundEnabled);
  const nameMode = useStore(settingsStore, (s) => s.nameMode ?? 'sharps');

  // Estado del modal del constructor de mazos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialDeck, setModalInitialDeck] = useState<Deck | null>(null);
  const [modalTab, setModalTab] = useState<'builder' | 'presets'>('builder');

  // Estado local de confirmación de borrado de mazo y filtros de lista de tarjetas
  const [confirmingDeleteDeckId, setConfirmingDeleteDeckId] = useState<string | null>(null);
  const [cardsFilter, setCardsFilter] = useState<'all' | 'learning' | 'new'>('all');
  const [cardsSearch, setCardsSearch] = useState('');

  const now = nowFn();

  // Mazo actualmente seleccionado
  const activeDeck = useMemo(() => {
    if (!activeDeckId) return decks[0];
    return decks.find((d) => d.id === activeDeckId) ?? decks[0];
  }, [decks, activeDeckId]);

  // Contadores de tarjetas de cada mazo
  const deckCounts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof selectDeckQueueCounts>>();
    for (const d of decks) {
      map.set(
        d.id,
        selectDeckQueueCounts(
          { decks, activeDeckId, cardsSRS, dailyUsage, history: [], session: null },
          d.id,
          now,
        ),
      );
    }
    return map;
  }, [decks, activeDeckId, cardsSRS, dailyUsage, now]);

  const activeDeckCounts = activeDeck
    ? deckCounts.get(activeDeck.id) ?? { newCount: 0, learningCount: 0, reviewCount: 0, total: 0 }
    : { newCount: 0, learningCount: 0, reviewCount: 0, total: 0 };

  // Desglose de tarjetas del mazo activo (en aprendizaje/repaso y nuevas)
  const activeDeckCardsDetail = useMemo(() => {
    if (!activeDeck) {
      return { inProgressCards: [], newCards: [], unresolvableCount: 0 };
    }
    return selectDeckCardsDetail(
      { decks, activeDeckId, cardsSRS, dailyUsage, history: [], session },
      activeDeck.id,
      now,
      tuning,
      nameMode,
    );
  }, [decks, activeDeckId, cardsSRS, dailyUsage, session, activeDeck, now, tuning, nameMode]);

  // Tarjeta actualmente en pantalla
  const resolvedCard = useMemo(() => {
    return selectCurrentCardResolved(
      { decks, activeDeckId, cardsSRS, dailyUsage, history: [], session },
      tuning,
      nameMode,
    );
  }, [decks, activeDeckId, cardsSRS, dailyUsage, session, tuning, nameMode]);

  // Vista previa de intervalos SRS para los 4 botones
  const intervalPreviews = useMemo(() => {
    return selectIntervalPreviewsForCurrentCard(
      { decks, activeDeckId, cardsSRS, dailyUsage, history: [], session },
      now,
    );
  }, [decks, activeDeckId, cardsSRS, dailyUsage, session, now]);

  // Rango dinámico de trastes (0..12 o 0..24 si hay posiciones > 12)
  const dynamicFretRange = useMemo(() => {
    const frontPositions = resolvedCard?.front.positions ?? [];
    const backPositions = resolvedCard?.back.positions ?? [];
    const allFrets = [...frontPositions, ...backPositions].map((p) => p.fret);
    const maxFret = allFrets.length > 0 ? Math.max(...allFrets) : 12;
    return { from: 0, to: maxFret > 12 ? 24 : 12 };
  }, [resolvedCard]);

  // Manejo de reproducción de audio
  const handlePlayAudio = useCallback(() => {
    if (!resolvedCard?.audioMidis || resolvedCard.audioMidis.length === 0) return;
    if (!soundEnabled || !audioEngine) return;

    const midis = resolvedCard.audioMidis;
    const subjectType = resolvedCard.subject.type;

    if (subjectType === 'interval' && midis.length >= 2) {
      playEvents(intervalEvents(midis[0]!, midis[1]!), audioEngine);
    } else if (subjectType === 'scale' || subjectType === 'scaletype') {
      playEvents(arpeggioEvents(midis, 0.2, 0.65), audioEngine);
    } else if (
      subjectType === 'voicing' ||
      subjectType === 'chord' ||
      subjectType === 'quality' ||
      subjectType === 'degree' ||
      subjectType === 'progression'
    ) {
      playEvents(arpeggioEvents(midis, 0.08, 0.8), audioEngine);
    } else {
      playEvents(chordEvents(midis, 0.8), audioEngine);
    }
  }, [resolvedCard, soundEnabled, audioEngine]);

  // Abrir en Sandbox
  const handleOpenInSandbox = useCallback(() => {
    if (!resolvedCard?.sandboxContext) return;
    const { root, chordQuality, scaleType, mode } = resolvedCard.sandboxContext;

    if (mode === 'chord' && chordQuality) {
      const menuCtx: MenuContext = { kind: 'chord', root: root ?? 0, quality: chordQuality };
      if (onOpenInSandbox) {
        onOpenInSandbox(menuCtx);
      } else {
        sandboxStore.getState().setContext(menuCtx);
        onNavigateToSandbox?.();
      }
    } else if (mode === 'scale' && scaleType) {
      const menuCtx: MenuContext = { kind: 'scale', root: root ?? 0, type: scaleType };
      if (onOpenInSandbox) {
        onOpenInSandbox(menuCtx);
      } else {
        sandboxStore.getState().setContext(menuCtx);
        onNavigateToSandbox?.();
      }
    }
  }, [resolvedCard, sandboxStore, onOpenInSandbox, onNavigateToSandbox]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (!session || !session.currentCardId) return;

      if (e.code === 'Space' || e.key === ' ') {
        if (!session.isAnswerRevealed) {
          e.preventDefault();
          decksStore.getState().revealAnswer();
        }
      } else if (session.isAnswerRevealed) {
        if (e.key === '1') {
          e.preventDefault();
          decksStore.getState().rateCard('again');
        } else if (e.key === '2') {
          e.preventDefault();
          decksStore.getState().rateCard('hard');
        } else if (e.key === '3') {
          e.preventDefault();
          decksStore.getState().rateCard('good');
        } else if (e.key === '4') {
          e.preventDefault();
          decksStore.getState().rateCard('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [decksStore, session, isModalOpen]);

  // Selección de mazo
  const handleSelectDeck = (deckId: string) => {
    setConfirmingDeleteDeckId(null);
    decksStore.getState().selectDeck(deckId);
  };

  // Apertura de modales
  const handleOpenNewDeckModal = () => {
    setModalInitialDeck(null);
    setModalTab('builder');
    setIsModalOpen(true);
  };

  const handleOpenPresetModal = () => {
    setModalInitialDeck(null);
    setModalTab('presets');
    setIsModalOpen(true);
  };

  const handleEditActiveDeck = () => {
    if (!activeDeck) return;
    setModalInitialDeck(activeDeck);
    setModalTab('builder');
    setIsModalOpen(true);
  };

  const handleConfirmDeleteDeck = (deckId: string) => {
    decksStore.getState().deleteDeck(deckId);
    setConfirmingDeleteDeckId(null);
  };

  const isVisualFront =
    resolvedCard?.facet === 'shape>name' || resolvedCard?.facet === 'pos>name';

  // En tarjetas pos>name ya mostramos el mástil en el anverso y lo actualizamos al revelar,
  // evitando duplicar un segundo mástil de 236px en el reverso que empuje los botones fuera de pantalla.
  const showBackFretboard = Boolean(
    resolvedCard &&
      !isVisualFront &&
      resolvedCard.back.positions &&
      resolvedCard.back.positions.length > 0,
  );
  const showBackVoicing = Boolean(resolvedCard?.back.voicingFrets);
  const hasBackVisual = showBackVoicing || showBackFretboard;

  const filterCardByQuery = useCallback(
    (item: DeckCardItem) => {
      const q = cardsSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        item.resolved.front.title.toLowerCase().includes(q) ||
        item.resolved.back.title.toLowerCase().includes(q) ||
        item.resolved.category.toLowerCase().includes(q)
      );
    },
    [cardsSearch],
  );

  const filteredInProgressCards = useMemo(
    () =>
      cardsFilter === 'new' ? [] : activeDeckCardsDetail.inProgressCards.filter(filterCardByQuery),
    [cardsFilter, activeDeckCardsDetail.inProgressCards, filterCardByQuery],
  );

  const filteredNewCards = useMemo(
    () =>
      cardsFilter === 'learning' ? [] : activeDeckCardsDetail.newCards.filter(filterCardByQuery),
    [cardsFilter, activeDeckCardsDetail.newCards, filterCardByQuery],
  );

  const renderCardRow = (item: DeckCardItem) => {
    const stateLabel =
      item.state === 'learning'
        ? 'Aprendiendo'
        : item.state === 'relearning'
          ? 'Reaprendiendo'
          : item.state === 'review'
            ? 'En repaso'
            : 'Nueva';

    const badgeClass =
      item.state === 'learning' || item.state === 'relearning'
        ? styles.stateBadgeLearning
        : item.state === 'review'
          ? styles.stateBadgeReview
          : styles.stateBadgeNew;

    return (
      <div
        key={item.cardId}
        className={styles.cardRow}
        data-testid={`deck-card-row-${item.cardId}`}
      >
        <div className={styles.cardRowLeft}>
          <span className={styles.cardCategoryBadge}>{item.resolved.category}</span>
          <span className={styles.cardQuestionText}>{item.resolved.front.title}</span>
          <span className={styles.cardArrow}>→</span>
          <span className={styles.cardAnswerText}>{item.resolved.back.title}</span>
        </div>
        <div className={styles.cardRowRight}>
          <span className={`${styles.stateBadge} ${badgeClass}`}>{stateLabel}</span>
          <span
            className={`${styles.dueTimeText} ${item.isDueNow ? styles.dueNowHighlight : ''}`}
          >
            {item.state === 'new' ? item.nextDueText : `Próxima: ${item.nextDueText}`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container} data-testid="flashcards-view">
      {/* Columna izquierda: Lista de mazos */}
      <aside className={styles.decksSidebar} aria-label="Mazos">
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Mazos</h2>
          <span className={styles.sidebarSubtitle}>Nuevas · Aprendiendo · Repaso</span>
        </div>

        <div className={styles.deckList} role="listbox" aria-label="Mazos de tarjetas">
          {decks.length === 0 ? (
            <div className={styles.emptyDecksSidebar}>
              No hay mazos creados. Crea un mazo personalizado o añade uno predefinido.
            </div>
          ) : (
            decks.map((deck) => {
              const counts = deckCounts.get(deck.id) ?? {
                newCount: 0,
                learningCount: 0,
                reviewCount: 0,
                total: 0,
              };
              const isActive = deck.id === activeDeck?.id;

              return (
                <button
                  key={deck.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.deckItem} ${isActive ? styles.deckItemActive : ''}`}
                  onClick={() => handleSelectDeck(deck.id)}
                  data-testid={`deck-item-${deck.id}`}
                >
                  <span className={styles.deckName}>{deck.name}</span>
                  {counts.total > 0 ? (
                    <div className={styles.deckCountsRow}>
                      <span className={styles.countNew} title="Nuevas hoy">
                        {counts.newCount}
                      </span>
                      <span className={styles.countLearning} title="En aprendizaje">
                        {counts.learningCount}
                      </span>
                      <span className={styles.countReview} title="Para repasar">
                        {counts.reviewCount}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.allDoneText}>Al día · 0 pendientes</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className={styles.sidebarActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleOpenNewDeckModal}
            data-testid="btn-new-deck"
          >
            + Nuevo mazo
          </button>
          <button
            type="button"
            className={styles.actionBtnSecondary}
            onClick={handleOpenPresetModal}
            data-testid="btn-add-preset"
          >
            Añadir predefinido
          </button>
        </div>
      </aside>

      {/* Columna derecha: Lienzo de estudio o resumen */}
      <section className={styles.flashcardStage} aria-label="Lienzo de estudio">
        {session && resolvedCard ? (
          <>
            {/* Cabecera del lienzo */}
            <div className={styles.stageHeader}>
              <div className={styles.headerLeft}>
                <span className={styles.deckBadge}>{activeDeck?.name.toUpperCase()}</span>
                <span className={styles.categoryPill}>{resolvedCard.category}</span>
                <span className={styles.directionPill}>{resolvedCard.directionLabel}</span>
              </div>

              <div className={styles.headerRight}>
                <div
                  className={styles.sessionCounts}
                  aria-label="Contadores de la sesión actual"
                >
                  <span className={styles.countNew} title="Nuevas">
                    {session.counts.newCount}
                  </span>
                  <span>·</span>
                  <span className={styles.countLearning} title="En aprendizaje">
                    {session.counts.learningCount}
                  </span>
                  <span>·</span>
                  <span className={styles.countReview} title="Repaso">
                    {session.counts.reviewCount}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.editDeckBtn}
                  onClick={() => decksStore.getState().endSession()}
                  data-testid="btn-end-session"
                >
                  ← Volver al mazo
                </button>
                <button
                  type="button"
                  className={styles.editDeckBtn}
                  onClick={handleEditActiveDeck}
                  data-testid="btn-edit-active-deck"
                >
                  Editar
                </button>
              </div>
            </div>

            {/* Cuerpo scrollable de pregunta + respuesta para que los botones SRS siempre estén visibles */}
            <div className={styles.studyScrollBody}>
              {/* Anverso: Pregunta */}
              <div className={styles.frontArea} data-testid="card-front">
                <h1 className={styles.frontTitle}>{resolvedCard.front.title}</h1>
                {resolvedCard.front.subtitle && (
                  <p className={styles.frontSubtitle}>{resolvedCard.front.subtitle}</p>
                )}

                {/* Anverso visual cuando la faceta oculta el nombre (shape>name o pos>name) */}
                {isVisualFront && (
                  <div className={styles.frontVisual} data-testid="front-visual">
                    {resolvedCard.front.voicingFrets && (
                      <ChordDiagram
                        frets={resolvedCard.front.voicingFrets}
                        silent={true}
                        ariaLabel="Digitación a identificar"
                      />
                    )}
                    {resolvedCard.front.positions && !resolvedCard.front.voicingFrets && (
                      <Fretboard
                        tuning={tuning}
                        fretRange={dynamicFretRange}
                        marks={resolvedCard.front.positions.map((p) => ({
                          ...p,
                          role: session.isAnswerRevealed
                            ? ('correct' as const)
                            : ('question' as const),
                          label: session.isAnswerRevealed ? resolvedCard.back.title : '?',
                        }))}
                      />
                    )}
                  </div>
                )}
              </div>

              <hr className={styles.divider} />

              {/* Reverso: Respuesta */}
              <div className={styles.backArea} data-testid="card-back">
                {!session.isAnswerRevealed ? (
                  <button
                    type="button"
                    className={styles.revealButton}
                    onClick={() => decksStore.getState().revealAnswer()}
                    data-testid="btn-reveal-answer"
                  >
                    Mostrar respuesta · Espacio
                  </button>
                ) : (
                  <>
                    <div role="status" aria-live="polite" className={styles.srOnly}>
                      Respuesta mostrada
                    </div>
                    <div
                      className={
                        showBackFretboard ? styles.revealedContentStacked : styles.revealedContent
                      }
                      data-testid="revealed-content"
                    >
                      {/* Representación visual sólo si el reverso aporta un diagrama nuevo */}
                      {hasBackVisual && (
                        <div
                          className={
                            showBackFretboard ? styles.revealedVisualFull : styles.revealedVisual
                          }
                        >
                          {showBackVoicing && resolvedCard.back.voicingFrets ? (
                            <ChordDiagram
                              frets={resolvedCard.back.voicingFrets}
                              root={
                                resolvedCard.subject.type === 'voicing'
                                  ? resolvedCard.subject.root
                                  : undefined
                              }
                              tuning={tuning}
                              ariaLabel={`Diagrama de digitación ${resolvedCard.back.title}`}
                            />
                          ) : showBackFretboard && resolvedCard.back.positions ? (
                            <Fretboard
                              tuning={tuning}
                              fretRange={dynamicFretRange}
                              marks={resolvedCard.back.positions.map((p) => ({
                                ...p,
                                role: 'root' as const,
                                label:
                                  resolvedCard.subject.type === 'notestring'
                                    ? pcName(resolvedCard.subject.pitchClass, nameMode)
                                    : `${p.fret}`,
                              }))}
                            />
                          ) : null}
                        </div>
                      )}

                      {/* Datos y acciones */}
                      <div
                        className={
                          hasBackVisual && !showBackFretboard
                            ? styles.revealedData
                            : styles.revealedDataCentered
                        }
                      >
                        <span className={styles.answerTag}>RESPUESTA</span>
                        <div className={styles.answerMainValue}>{resolvedCard.back.title}</div>

                        {resolvedCard.back.notes && resolvedCard.back.notes.length > 0 && (
                          <div className={styles.answerNotes}>
                            Notas: {resolvedCard.back.notes.join(' · ')}
                          </div>
                        )}

                        {resolvedCard.back.degrees && resolvedCard.back.degrees.length > 0 && (
                          <div className={styles.answerDegrees}>
                            Grados: {resolvedCard.back.degrees.join(' · ')}
                          </div>
                        )}

                        {resolvedCard.back.details &&
                          !resolvedCard.back.notes &&
                          !resolvedCard.back.degrees && (
                            <div className={styles.answerDetails}>{resolvedCard.back.details}</div>
                          )}

                        <div className={styles.revealedActions}>
                          <button
                            type="button"
                            className={styles.listenBtn}
                            onClick={handlePlayAudio}
                            data-testid="btn-listen-card"
                          >
                            <span aria-hidden="true">🔊</span> Escuchar
                          </button>
                          {resolvedCard.sandboxContext && (
                            <button
                              type="button"
                              className={styles.sandboxBtn}
                              onClick={handleOpenInSandbox}
                              data-testid="btn-open-sandbox-card"
                            >
                              Abrir en Sandbox
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Barra de valoración SRS */}
            <div className={styles.srsBar} data-testid="srs-bar">
              <div className={styles.srsGrid}>
                <button
                  type="button"
                  className={`${styles.srsBtn} ${styles.srsBtnAgain}`}
                  disabled={!session.isAnswerRevealed}
                  onClick={() => decksStore.getState().rateCard('again')}
                  data-testid="srs-btn-again"
                >
                  <span className={styles.srsLabel}>Otra vez</span>
                  <span className={styles.srsInterval}>
                    {intervalPreviews?.again.text ?? '1 min'}
                  </span>
                  <span className={styles.srsShortcut}>1</span>
                </button>

                <button
                  type="button"
                  className={`${styles.srsBtn} ${styles.srsBtnHard}`}
                  disabled={!session.isAnswerRevealed}
                  onClick={() => decksStore.getState().rateCard('hard')}
                  data-testid="srs-btn-hard"
                >
                  <span className={styles.srsLabel}>Difícil</span>
                  <span className={styles.srsInterval}>
                    {intervalPreviews?.hard.text ?? '5,5 min'}
                  </span>
                  <span className={styles.srsShortcut}>2</span>
                </button>

                <button
                  type="button"
                  className={`${styles.srsBtn} ${styles.srsBtnGood}`}
                  disabled={!session.isAnswerRevealed}
                  onClick={() => decksStore.getState().rateCard('good')}
                  data-testid="srs-btn-good"
                >
                  <span className={styles.srsLabel}>Bien</span>
                  <span className={styles.srsInterval}>
                    {intervalPreviews?.good.text ?? '10 min'}
                  </span>
                  <span className={styles.srsShortcut}>3</span>
                </button>

                <button
                  type="button"
                  className={`${styles.srsBtn} ${styles.srsBtnEasy}`}
                  disabled={!session.isAnswerRevealed}
                  onClick={() => decksStore.getState().rateCard('easy')}
                  data-testid="srs-btn-easy"
                >
                  <span className={styles.srsLabel}>Fácil</span>
                  <span className={styles.srsInterval}>
                    {intervalPreviews?.easy.text ?? '4 d'}
                  </span>
                  <span className={styles.srsShortcut}>4</span>
                </button>
              </div>

              <div className={styles.srsFooter}>
                Espacio: mostrar respuesta · 1–4: valorar
              </div>
            </div>
          </>
        ) : !activeDeck ? (
          /* Estado vacío cuando no hay ningún mazo en la colección */
          <div className={styles.overviewStage} data-testid="deck-overview">
            <div className={styles.overviewHero}>
              <div className={styles.overviewIcon} aria-hidden="true">
                🗂️
              </div>
              <h2 className={styles.overviewTitle}>No tienes ningún mazo activo</h2>
              <p className={styles.overviewDesc}>
                Crea un mazo personalizado con los bloques que quieras practicar o añade uno de los
                mazos predefinidos (Principiante, Intermedio o Avanzado).
              </p>
              <div className={styles.overviewActions}>
                <button
                  type="button"
                  className={styles.startStudyBtn}
                  onClick={handleOpenNewDeckModal}
                >
                  + Crear mazo personalizado
                </button>
                <button
                  type="button"
                  className={styles.actionBtnSecondary}
                  onClick={handleOpenPresetModal}
                >
                  Añadir mazo predefinido
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Vista de mazo e inspector de tarjetas cuando no hay sesión activa */
          <div className={styles.overviewStage} data-testid="deck-overview">
            <div className={styles.overviewHero}>
              {activeDeckCounts.total > 0 ? (
                <>
                  <h2 className={styles.overviewTitle}>{activeDeck.name}</h2>
                  {activeDeck.description && (
                    <p className={styles.overviewDesc}>{activeDeck.description}</p>
                  )}

                  <div className={styles.overviewMetricsRow}>
                    <div className={styles.overviewMetric}>
                      <span className={`${styles.overviewMetricValue} ${styles.countNew}`}>
                        {activeDeckCounts.newCount}
                      </span>
                      <span className={styles.overviewMetricLabel}>Nuevas hoy</span>
                    </div>
                    <div className={styles.overviewMetric}>
                      <span className={`${styles.overviewMetricValue} ${styles.countLearning}`}>
                        {activeDeckCounts.learningCount}
                      </span>
                      <span className={styles.overviewMetricLabel}>En aprendizaje</span>
                    </div>
                    <div className={styles.overviewMetric}>
                      <span className={`${styles.overviewMetricValue} ${styles.countReview}`}>
                        {activeDeckCounts.reviewCount}
                      </span>
                      <span className={styles.overviewMetricLabel}>Para repasar</span>
                    </div>
                  </div>

                  <div className={styles.overviewActions}>
                    <button
                      type="button"
                      className={styles.startStudyBtn}
                      onClick={() =>
                        decksStore.getState().startSession(activeDeck.id, { tuning })
                      }
                      data-testid="btn-start-study"
                    >
                      Comenzar estudio
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnSecondary}
                      onClick={handleEditActiveDeck}
                      data-testid="btn-overview-edit"
                    >
                      Editar reglas del mazo
                    </button>
                    {confirmingDeleteDeckId !== activeDeck.id ? (
                      <button
                        type="button"
                        className={styles.deleteDeckBtn}
                        onClick={() => setConfirmingDeleteDeckId(activeDeck.id)}
                        data-testid="btn-delete-deck"
                      >
                        Eliminar mazo
                      </button>
                    ) : (
                      <div className={styles.confirmDeleteInline}>
                        <span>¿Eliminar mazo?</span>
                        <button
                          type="button"
                          className={styles.confirmDeleteYesBtn}
                          onClick={() => handleConfirmDeleteDeck(activeDeck.id)}
                          data-testid="btn-confirm-delete-deck"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          className={styles.confirmDeleteNoBtn}
                          onClick={() => setConfirmingDeleteDeckId(null)}
                          data-testid="btn-cancel-delete-deck"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.overviewIcon} aria-hidden="true">
                    🎉
                  </div>
                  <h2 className={styles.overviewTitle}>¡Estás al día!</h2>
                  <p className={styles.overviewDesc}>
                    No tienes tarjetas pendientes de repaso para hoy en{' '}
                    <strong>{activeDeck.name}</strong>. Los límites diarios se reinician mañana a
                    las 04:00, o puedes iniciar una ronda extra ahora mismo.
                  </p>

                  <div className={styles.overviewActions}>
                    <button
                      type="button"
                      className={styles.startStudyBtn}
                      onClick={() =>
                        decksStore
                          .getState()
                          .startSession(activeDeck.id, { forceExtraRound: true, tuning })
                      }
                      data-testid="btn-start-study-anyway"
                    >
                      Estudiar de todos modos
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnSecondary}
                      onClick={handleEditActiveDeck}
                      data-testid="btn-overview-edit"
                    >
                      Editar reglas del mazo
                    </button>
                    {confirmingDeleteDeckId !== activeDeck.id ? (
                      <button
                        type="button"
                        className={styles.deleteDeckBtn}
                        onClick={() => setConfirmingDeleteDeckId(activeDeck.id)}
                        data-testid="btn-delete-deck"
                      >
                        Eliminar mazo
                      </button>
                    ) : (
                      <div className={styles.confirmDeleteInline}>
                        <span>¿Eliminar mazo?</span>
                        <button
                          type="button"
                          className={styles.confirmDeleteYesBtn}
                          onClick={() => handleConfirmDeleteDeck(activeDeck.id)}
                          data-testid="btn-confirm-delete-deck"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          className={styles.confirmDeleteNoBtn}
                          onClick={() => setConfirmingDeleteDeckId(null)}
                          data-testid="btn-cancel-delete-deck"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Lista de información de tarjetas del mazo */}
            <div className={styles.cardsListSection} data-testid="deck-cards-list">
              <div className={styles.cardsListHeader}>
                <h3 className={styles.cardsListTitle}>
                  Tarjetas del mazo (
                  {activeDeckCardsDetail.inProgressCards.length +
                    activeDeckCardsDetail.newCards.length}
                  )
                </h3>

                <div className={styles.cardsFilterRow}>
                  <button
                    type="button"
                    className={`${styles.filterTabBtn} ${cardsFilter === 'all' ? styles.filterTabBtnActive : ''}`}
                    onClick={() => setCardsFilter('all')}
                    data-testid="cards-filter-all"
                  >
                    Todas (
                    {activeDeckCardsDetail.inProgressCards.length +
                      activeDeckCardsDetail.newCards.length}
                    )
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTabBtn} ${cardsFilter === 'learning' ? styles.filterTabBtnActive : ''}`}
                    onClick={() => setCardsFilter('learning')}
                    data-testid="cards-filter-learning"
                  >
                    En aprendizaje / repaso ({activeDeckCardsDetail.inProgressCards.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTabBtn} ${cardsFilter === 'new' ? styles.filterTabBtnActive : ''}`}
                    onClick={() => setCardsFilter('new')}
                    data-testid="cards-filter-new"
                  >
                    Nuevas por aprender ({activeDeckCardsDetail.newCards.length})
                  </button>
                  <input
                    type="search"
                    className={styles.cardsSearchInput}
                    placeholder="Buscar tarjeta..."
                    value={cardsSearch}
                    onChange={(e) => setCardsSearch(e.target.value)}
                    aria-label="Buscar tarjeta en el mazo"
                    data-testid="cards-search-input"
                  />
                </div>
              </div>

              <div className={styles.cardsTableContainer}>
                {filteredInProgressCards.length === 0 && filteredNewCards.length === 0 ? (
                  <div className={styles.emptyCardsFilterNotice}>
                    No hay tarjetas que coincidan con el filtro seleccionado.
                  </div>
                ) : (
                  <>
                    {filteredInProgressCards.length > 0 && (
                      <>
                        <div className={styles.cardsGroupHeading}>
                          En aprendizaje y repaso ({filteredInProgressCards.length}) · Ordenadas por
                          próximo repaso
                        </div>
                        {filteredInProgressCards.map(renderCardRow)}
                      </>
                    )}

                    {filteredNewCards.length > 0 && (
                      <>
                        <div className={styles.cardsGroupHeading}>
                          Nuevas por aprender ({filteredNewCards.length})
                        </div>
                        {filteredNewCards.map(renderCardRow)}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Modal Constructor / Editor / Presets */}
      <DeckBuilderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialDeck={modalInitialDeck}
        initialTab={modalTab}
        onSaveDeck={(data) => {
          if (modalInitialDeck) {
            decksStore.getState().updateDeck(modalInitialDeck.id, data);
          } else {
            decksStore.getState().createDeck(data);
          }
        }}
        onDeleteDeck={(deckId) => {
          decksStore.getState().deleteDeck(deckId);
        }}
        onAddPreset={(presetId) => {
          decksStore.getState().addPresetDeck(presetId);
        }}
      />
    </div>
  );
}
