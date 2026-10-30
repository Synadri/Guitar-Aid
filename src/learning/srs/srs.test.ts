import { describe, expect, it } from 'vitest';
import {
  buildStudyQueue,
  getStudyDayKey,
  getStudyQueueCounts,
} from './queue';
import {
  createInitialCardSRS,
  previewIntervals,
  schedule,
} from './scheduler';
import type { CardSRS, DailyUsage } from './types';

describe('SRS — planificador SM-2 y vista previa (scheduler.ts)', () => {
  const fixedNow = 1_700_000_000_000;
  const MS_PER_MIN = 60 * 1000;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  it('(h) transiciones del planificador con reloj fijo y sin fuzz', () => {
    // 1. Tarjeta nueva
    const newCard = createInitialCardSRS('card-1', fixedNow);
    expect(newCard.state).toBe('new');
    expect(newCard.ease).toBe(2.5);

    // Vista previa inicial en tarjeta nueva:
    // Otra vez 1 min · Difícil 5,5 min · Bien 10 min · Fácil 4 d
    const previewsNew = previewIntervals(newCard, fixedNow);
    expect(previewsNew.again.text).toBe('1 min');
    expect(previewsNew.hard.text).toBe('5,5 min');
    expect(previewsNew.good.text).toBe('10 min');
    expect(previewsNew.easy.text).toBe('4 d');

    // 2. nueva + Bien → 10 min
    const cardStep1 = schedule(newCard, 'good', fixedNow);
    expect(cardStep1.state).toBe('learning');
    expect(cardStep1.stepIndex).toBe(1);
    expect(cardStep1.due).toBe(fixedNow + 10 * MS_PER_MIN);

    // Vista previa en segundo paso de aprendizaje:
    const previewsStep1 = previewIntervals(cardStep1, fixedNow);
    expect(previewsStep1.again.text).toBe('1 min');
    expect(previewsStep1.good.text).toBe('1 d');

    // 3. + Bien → repaso a 1 d
    const cardGraduated = schedule(cardStep1, 'good', fixedNow);
    expect(cardGraduated.state).toBe('review');
    expect(cardGraduated.interval).toBe(1);
    expect(cardGraduated.due).toBe(fixedNow + 1 * MS_PER_DAY);

    // 4. repaso 1 d (facilidad 2,5) + Bien → 3 d
    expect(cardGraduated.ease).toBe(2.5);
    const previewsGraduated = previewIntervals(cardGraduated, fixedNow);
    expect(previewsGraduated.good.text).toBe('3 d');

    const cardReview3d = schedule(cardGraduated, 'good', fixedNow);
    expect(cardReview3d.state).toBe('review');
    expect(cardReview3d.interval).toBe(3);
    expect(cardReview3d.due).toBe(fixedNow + 3 * MS_PER_DAY);
    expect(cardReview3d.ease).toBe(2.5);

    // 5. repaso 3 d + Difícil → 4 d y facilidad 2,35
    const previews3d = previewIntervals(cardReview3d, fixedNow);
    expect(previews3d.hard.text).toBe('4 d');

    const cardReview4d = schedule(cardReview3d, 'hard', fixedNow);
    expect(cardReview4d.state).toBe('review');
    expect(cardReview4d.interval).toBe(4);
    expect(cardReview4d.due).toBe(fixedNow + 4 * MS_PER_DAY);
    expect(cardReview4d.ease).toBe(2.35);

    // 6. repaso 10 d + Fácil → 33 d y facilidad 2,65
    const cardReview10d: CardSRS = {
      cardId: 'card-10d',
      state: 'review',
      ease: 2.5,
      interval: 10,
      due: fixedNow,
      lapses: 0,
      reps: 4,
    };
    const previews10d = previewIntervals(cardReview10d, fixedNow);
    expect(previews10d.easy.text).toBe('33 d');

    const cardReview33d = schedule(cardReview10d, 'easy', fixedNow);
    expect(cardReview33d.state).toBe('review');
    expect(cardReview33d.interval).toBe(33);
    expect(cardReview33d.due).toBe(fixedNow + 33 * MS_PER_DAY);
    expect(cardReview33d.ease).toBe(2.65);

    // 7. repaso 10 d + Otra vez → reaprendizaje a 10 min, facilidad 2,30 y, tras Bien, 1 d
    expect(previews10d.again.text).toBe('10 min');

    const cardRelearn = schedule(cardReview10d, 'again', fixedNow);
    expect(cardRelearn.state).toBe('relearning');
    expect(cardRelearn.due).toBe(fixedNow + 10 * MS_PER_MIN);
    expect(cardRelearn.ease).toBe(2.3);
    expect(cardRelearn.lapses).toBe(1);

    const previewsRelearn = previewIntervals(cardRelearn, fixedNow);
    expect(previewsRelearn.good.text).toBe('1 d');

    const cardRelearned = schedule(cardRelearn, 'good', fixedNow);
    expect(cardRelearned.state).toBe('review');
    expect(cardRelearned.interval).toBe(1);
    expect(cardRelearned.due).toBe(fixedNow + 1 * MS_PER_DAY);

    // 8. nueva + Fácil → 4 d
    const cardNewEasy = schedule(newCard, 'easy', fixedNow);
    expect(cardNewEasy.state).toBe('review');
    expect(cardNewEasy.interval).toBe(4);
    expect(cardNewEasy.due).toBe(fixedNow + 4 * MS_PER_DAY);

    // 9. La facilidad nunca baja de 1,30
    let c = cardReview10d;
    for (let i = 0; i < 10; i++) {
      c = schedule(c, 'again', fixedNow);
      c = schedule(c, 'good', fixedNow); // se gradúa de nuevo a repaso
    }
    expect(c.ease).toBe(1.3);
  });
});

describe('SRS — cola de estudio y cambio de día (queue.ts)', () => {
  it('(k) con el límite de 20 nuevas al día no se presentan más de 20; se reinicia a las 04:00 hora local', () => {
    const cardIds = Array.from({ length: 50 }, (_, i) => `card-${i}`);
    const deck = { cardIds, limits: { newPerDay: 20, reviewsPerDay: 200 } };
    const cardsSRS: Record<string, CardSRS> = {};

    // 1. A las 20:00 del 30 de octubre: 20 nuevas disponibles
    const timeEvening = new Date(2026, 9, 30, 20, 0, 0, 0).getTime();
    const countsInitial = getStudyQueueCounts(deck, cardsSRS, timeEvening);
    expect(countsInitial.newCount).toBe(20);

    // 2. Si ya se han estudiado 20 nuevas en este día de estudio:
    const dayKey = getStudyDayKey(timeEvening);
    const dailyUsageFull: DailyUsage = {
      studyDay: dayKey,
      newCount: 20,
      reviewCount: 15,
    };
    const countsExhausted = getStudyQueueCounts(deck, cardsSRS, timeEvening, dailyUsageFull);
    expect(countsExhausted.newCount).toBe(0);

    const queueExhausted = buildStudyQueue({
      deck,
      cardsSRS,
      now: timeEvening,
      dailyUsage: dailyUsageFull,
    });
    // No hay tarjetas nuevas en la cola al haberse agotado el límite de 20
    expect(queueExhausted.length).toBe(0);

    // 3. A las 03:59:59 sigue perteneciendo al mismo día de estudio (continúa agotado)
    const timeBeforeCutoff = new Date(2026, 9, 31, 3, 59, 59, 0).getTime();
    expect(getStudyDayKey(timeBeforeCutoff)).toBe(dayKey);
    const countsBeforeCutoff = getStudyQueueCounts(deck, cardsSRS, timeBeforeCutoff, dailyUsageFull);
    expect(countsBeforeCutoff.newCount).toBe(0);

    // 4. A las 04:00:00 se reinicia el contador de nuevas
    const timeAfterCutoff = new Date(2026, 9, 31, 4, 0, 0, 0).getTime();
    const newDayKey = getStudyDayKey(timeAfterCutoff);
    expect(newDayKey).not.toBe(dayKey);

    const countsAfterCutoff = getStudyQueueCounts(deck, cardsSRS, timeAfterCutoff, dailyUsageFull);
    expect(countsAfterCutoff.newCount).toBe(20);

    const queueNewDay = buildStudyQueue({
      deck,
      cardsSRS,
      now: timeAfterCutoff,
      dailyUsage: dailyUsageFull,
    });
    expect(queueNewDay).toHaveLength(20);
  });

  it('ordena la cola: primero aprendizaje que ya vence, luego repasos y nuevas intercaladas', () => {
    const deck = {
      cardIds: ['rev-1', 'rev-2', 'new-1', 'new-2', 'learn-1'],
      limits: { newPerDay: 20, reviewsPerDay: 200 },
    };
    const now = 1_000_000;
    const cardsSRS: Record<string, CardSRS> = {
      'learn-1': {
        cardId: 'learn-1',
        state: 'learning',
        due: now - 50,
        ease: 2.5,
        interval: 0,
        lapses: 0,
        reps: 1,
      },
      'rev-1': {
        cardId: 'rev-1',
        state: 'review',
        due: now - 100,
        ease: 2.5,
        interval: 1,
        lapses: 0,
        reps: 2,
      },
      'rev-2': {
        cardId: 'rev-2',
        state: 'review',
        due: now - 80,
        ease: 2.5,
        interval: 3,
        lapses: 0,
        reps: 3,
      },
    };

    const queue = buildStudyQueue({ deck, cardsSRS, now });

    // learn-1 va primero
    expect(queue[0]).toBe('learn-1');
    // Luego repasos y nuevas intercaladas: rev-1, new-1, rev-2, new-2
    expect(queue.slice(1)).toEqual(['rev-1', 'new-1', 'rev-2', 'new-2']);
  });
});
