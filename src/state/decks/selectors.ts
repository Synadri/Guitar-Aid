import type { Tuning } from '../../theory/data/tunings';
import { STANDARD_TUNING } from '../../theory/data/tunings';
import type { NameMode } from '../../theory';
import { resolveCard } from '../../learning/cards/facets';
import type { Deck, ResolvedCard } from '../../learning/cards/types';
import { getStudyQueueCounts } from '../../learning/srs/queue';
import {
  DEFAULT_SCHEDULER_CONFIG,
  createInitialCardSRS,
  previewIntervals,
} from '../../learning/srs/scheduler';
import type {
  CardSRS,
  IntervalPreview,
  QueueCounts,
  Rating,
  SchedulerConfig,
} from '../../learning/srs/types';
import type {
  DeckCardItem,
  DeckCardsDetail,
  DecksState,
  DeckStats,
  GlobalDeckStats,
} from './types';

/** Devuelve el mazo actualmente activo en el estado. */
export function selectActiveDeck(state: DecksState): Deck | undefined {
  if (!state.activeDeckId) {
    return state.decks[0];
  }
  return state.decks.find((d) => d.id === state.activeDeckId) ?? state.decks[0];
}

/** Devuelve un mazo por su ID único. */
export function selectDeckById(state: DecksState, deckId: string): Deck | undefined {
  return state.decks.find((d) => d.id === deckId);
}

/** Devuelve el diccionario de estados SRS de las tarjetas para un mazo concreto. */
export function selectDeckSRS(state: DecksState, deckId: string): Record<string, CardSRS> {
  return state.cardsSRS[deckId] ?? {};
}

/** Devuelve los contadores de tarjetas pendientes hoy para un mazo concreto (§5.2). */
export function selectDeckQueueCounts(
  state: DecksState,
  deckId: string,
  now: number,
): QueueCounts {
  const deck = selectDeckById(state, deckId);
  if (!deck) {
    return { newCount: 0, learningCount: 0, reviewCount: 0, total: 0 };
  }
  const deckSRS = selectDeckSRS(state, deckId);
  const usage = state.dailyUsage[deckId];
  return getStudyQueueCounts(deck, deckSRS, now, usage);
}

/** Devuelve la proyección previa de intervalos para una tarjeta y un mazo específicos (§6.3, Criterio h). */
export function selectIntervalPreviewsForCard(
  state: DecksState,
  deckId: string,
  cardId: string,
  now: number,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): Record<Rating, IntervalPreview> {
  const deckSRS = selectDeckSRS(state, deckId);
  const cardSRS = deckSRS[cardId] ?? createInitialCardSRS(cardId, now, config);
  return previewIntervals(cardSRS, now, config);
}

/**
 * Devuelve la proyección previa de intervalos para la tarjeta actualmente en pantalla
 * durante una sesión de estudio activa (§5.3).
 */
export function selectIntervalPreviewsForCurrentCard(
  state: DecksState,
  now: number,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): Record<Rating, IntervalPreview> | null {
  const session = state.session;
  if (!session || !session.currentCardId) {
    return null;
  }
  return selectIntervalPreviewsForCard(state, session.deckId, session.currentCardId, now, config);
}

/**
 * Resuelve la tarjeta actualmente en pantalla en una estructura rica con anverso y reverso (§5.3).
 */
export function selectCurrentCardResolved(
  state: DecksState,
  tuning: Tuning = STANDARD_TUNING,
  nameMode: NameMode = 'sharps',
): ResolvedCard | null {
  const currentCardId = state.session?.currentCardId;
  if (!currentCardId) {
    return null;
  }
  return resolveCard(currentCardId, tuning, nameMode);
}

/** Formatea la fecha de próximo vencimiento de una tarjeta para la UI. */
function formatNextDueText(due: number, now: number): string {
  if (due <= now) {
    return 'Ahora (pendiente hoy)';
  }
  const diffMs = due - now;
  const diffMin = Math.max(1, Math.round(diffMs / 60_000));
  if (diffMin < 60) {
    return `En ${diffMin} min`;
  }
  const diffHours = Math.round(diffMs / 3_600_000);
  if (diffHours < 24) {
    return `En ${diffHours} h`;
  }
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays <= 1) {
    return 'Mañana (1 d)';
  }
  return `En ${diffDays} días`;
}

/**
 * Devuelve el desglose detallado de tarjetas de un mazo:
 * 1) Tarjetas en aprendizaje / reaprendizaje / repaso ordenadas por próximo vencimiento (`due` ascendente).
 * 2) Tarjetas nuevas pendientes de aprender en su orden de aparición.
 */
export function selectDeckCardsDetail(
  state: DecksState,
  deckId: string,
  now: number,
  tuning: Tuning = STANDARD_TUNING,
  nameMode: NameMode = 'sharps',
): DeckCardsDetail {
  const deck = selectDeckById(state, deckId);
  if (!deck) {
    return { inProgressCards: [], newCards: [], unresolvableCount: 0 };
  }

  const deckSRS = selectDeckSRS(state, deckId);
  const inProgressCards: DeckCardItem[] = [];
  const newCards: DeckCardItem[] = [];
  let unresolvableCount = 0;

  for (const cardId of deck.cardIds) {
    const resolved = resolveCard(cardId, tuning, nameMode);
    if (!resolved) {
      unresolvableCount++;
      continue;
    }

    const srs = deckSRS[cardId];
    if (!srs || srs.state === 'new') {
      newCards.push({
        cardId,
        resolved,
        srs,
        state: 'new',
        due: null,
        interval: 0,
        reps: 0,
        lapses: 0,
        isDueNow: false,
        nextDueText: 'Nueva (por aprender)',
      });
    } else {
      const isDueNow = srs.due <= now;
      inProgressCards.push({
        cardId,
        resolved,
        srs,
        state: srs.state,
        due: srs.due,
        interval: srs.interval,
        reps: srs.reps,
        lapses: srs.lapses,
        isDueNow,
        nextDueText: formatNextDueText(srs.due, now),
      });
    }
  }

  inProgressCards.sort((a, b) => (a.due ?? 0) - (b.due ?? 0));

  return {
    inProgressCards,
    newCards,
    unresolvableCount,
  };
}

/**
 * Calcula las métricas individuales de un mazo (total, nuevas, aprendizaje, repasos, pendientes hoy y retención).
 */
export function selectDeckStats(
  state: DecksState,
  deckId: string,
  now: number,
): DeckStats {
  const deck = selectDeckById(state, deckId);
  if (!deck) {
    return {
      total: 0,
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      dueToday: 0,
      retentionRate: 100,
    };
  }

  const deckSRS = selectDeckSRS(state, deckId);
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;

  for (const cardId of deck.cardIds) {
    const srs = deckSRS[cardId];
    if (!srs || srs.state === 'new') {
      newCount++;
    } else if (srs.state === 'learning' || srs.state === 'relearning') {
      learningCount++;
    } else if (srs.state === 'review') {
      reviewCount++;
    }
  }

  const queueCounts = selectDeckQueueCounts(state, deckId, now);

  // Retención histórica del mazo basada en el historial
  const deckHistory = state.history.filter((h) => h.deckId === deckId);
  let retentionRate = 100;
  if (deckHistory.length > 0) {
    const passed = deckHistory.filter((h) => h.rating !== 'again').length;
    retentionRate = Math.round((passed / deckHistory.length) * 100);
  }

  return {
    total: deck.cardIds.length,
    newCount,
    learningCount,
    reviewCount,
    dueToday: queueCounts.total,
    retentionRate,
  };
}

/**
 * Calcula las estadísticas globales consolidadas entre todos los mazos para la pantalla de Progreso (§7.3).
 */
export function selectGlobalStats(
  state: DecksState,
  now: number,
): GlobalDeckStats {
  let pendientesHoy = 0;
  let totalNuevas = 0;
  let totalEnAprendizaje = 0;

  for (const deck of state.decks) {
    const counts = selectDeckQueueCounts(state, deck.id, now);
    pendientesHoy += counts.total;

    const deckSRS = selectDeckSRS(state, deck.id);
    for (const cardId of deck.cardIds) {
      const srs = deckSRS[cardId];
      if (!srs || srs.state === 'new') {
        totalNuevas++;
      } else if (srs.state === 'learning' || srs.state === 'relearning') {
        totalEnAprendizaje++;
      }
    }
  }

  // Tasa de retención global a partir de todo el historial
  let retención = 100;
  if (state.history.length > 0) {
    const passed = state.history.filter((h) => h.rating !== 'again').length;
    retención = Math.round((passed / state.history.length) * 100);
  }

  return {
    pendientesHoy,
    retención,
    nuevas: totalNuevas,
    enAprendizaje: totalEnAprendizaje,
    totalRepasos: state.history.length,
  };
}
