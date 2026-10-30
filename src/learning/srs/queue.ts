import type { DeckLimits } from '../cards/types';
import type { CardSRS, DailyUsage, QueueCounts } from './types';

export const DEFAULT_DECK_LIMITS: DeckLimits = {
  newPerDay: 20,
  reviewsPerDay: 200,
};

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Devuelve la clave del día de estudio ("YYYY-MM-DD") según la hora local,
 * reiniciando el cómputo del día a las 04:00 hora local (§6.3, Criterio k).
 */
export function getStudyDayKey(timestamp: number): string {
  // Al restar 4 horas, las 03:59:59 corresponden al final del día anterior,
  // y las 04:00:00 al inicio del nuevo día de estudio.
  const d = new Date(timestamp - 4 * MS_PER_HOUR);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface QueueDeckInput {
  cardIds: readonly string[];
  limits?: DeckLimits;
}

export interface BuildStudyQueueOptions {
  deck: QueueDeckInput;
  cardsSRS: Readonly<Record<string, CardSRS>>;
  now: number;
  dailyUsage?: DailyUsage;
}

/**
 * Calcula los contadores de tarjetas pendientes hoy para un mazo dado (§6.3, §5.2).
 */
export function getStudyQueueCounts(
  deck: QueueDeckInput,
  cardsSRS: Readonly<Record<string, CardSRS>>,
  now: number,
  dailyUsage?: DailyUsage,
): QueueCounts {
  const limits = deck.limits ?? DEFAULT_DECK_LIMITS;
  const currentDayKey = getStudyDayKey(now);

  const usedToday =
    dailyUsage && dailyUsage.studyDay === currentDayKey
      ? dailyUsage
      : { studyDay: currentDayKey, newCount: 0, reviewCount: 0 };

  const remainingNewAllowance = Math.max(0, limits.newPerDay - usedToday.newCount);
  const remainingReviewAllowance = Math.max(0, limits.reviewsPerDay - usedToday.reviewCount);

  let totalNew = 0;
  let totalLearningDue = 0;
  let totalReviewDue = 0;

  for (const cardId of deck.cardIds) {
    const srs = cardsSRS[cardId];
    if (!srs || srs.state === 'new') {
      totalNew++;
    } else if (srs.state === 'learning' || srs.state === 'relearning') {
      if (srs.due <= now) {
        totalLearningDue++;
      }
    } else if (srs.state === 'review') {
      if (srs.due <= now) {
        totalReviewDue++;
      }
    }
  }

  const newCount = Math.min(remainingNewAllowance, totalNew);
  const learningCount = totalLearningDue;
  const reviewCount = Math.min(remainingReviewAllowance, totalReviewDue);

  return {
    newCount,
    learningCount,
    reviewCount,
    total: newCount + learningCount + reviewCount,
  };
}

/**
 * Construye la cola ordenada de IDs para la sesión de estudio (§6.3):
 * 1. Tarjetas en aprendizaje/reaprendizaje que ya vencieron (ordenadas por vencimiento).
 * 2. Repasos pendientes y tarjetas nuevas (hasta los límites diarios), intercaladas.
 */
export function buildStudyQueue(options: BuildStudyQueueOptions): string[] {
  const { deck, cardsSRS, now, dailyUsage } = options;
  const limits = deck.limits ?? DEFAULT_DECK_LIMITS;
  const currentDayKey = getStudyDayKey(now);

  const usedToday =
    dailyUsage && dailyUsage.studyDay === currentDayKey
      ? dailyUsage
      : { studyDay: currentDayKey, newCount: 0, reviewCount: 0 };

  const remainingNewAllowance = Math.max(0, limits.newPerDay - usedToday.newCount);
  const remainingReviewAllowance = Math.max(0, limits.reviewsPerDay - usedToday.reviewCount);

  const learningDue: { id: string; due: number }[] = [];
  const reviewDue: { id: string; due: number }[] = [];
  const availableNew: string[] = [];

  for (const cardId of deck.cardIds) {
    const srs = cardsSRS[cardId];
    if (!srs || srs.state === 'new') {
      if (availableNew.length < remainingNewAllowance) {
        availableNew.push(cardId);
      }
    } else if (srs.state === 'learning' || srs.state === 'relearning') {
      if (srs.due <= now) {
        learningDue.push({ id: cardId, due: srs.due });
      }
    } else if (srs.state === 'review') {
      if (srs.due <= now) {
        reviewDue.push({ id: cardId, due: srs.due });
      }
    }
  }

  // Ordenar por due ascendente
  learningDue.sort((a, b) => a.due - b.due);
  reviewDue.sort((a, b) => a.due - b.due);

  // Acotar repasos al límite diario
  const cappedReviews = reviewDue
    .slice(0, remainingReviewAllowance)
    .map((r) => r.id);

  // Intercalar repasos y nuevas
  const interleavedReviewAndNew: string[] = [];
  const revQueue = [...cappedReviews];
  const newQueue = [...availableNew];

  while (revQueue.length > 0 || newQueue.length > 0) {
    if (revQueue.length > 0) {
      interleavedReviewAndNew.push(revQueue.shift()!);
    }
    if (newQueue.length > 0) {
      interleavedReviewAndNew.push(newQueue.shift()!);
    }
  }

  return [...learningDue.map((l) => l.id), ...interleavedReviewAndNew];
}
