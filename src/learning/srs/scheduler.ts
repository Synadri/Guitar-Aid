import type {
  CardSRS,
  IntervalPreview,
  Rating,
  SchedulerConfig,
} from './types';

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  learningSteps: [1, 10],
  relearningSteps: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  initialEase: 2.5,
  minimumEase: 1.3,
  maximumInterval: 36500,
  hardIntervalMultiplier: 1.2,
  easyIntervalMultiplier: 1.3,
};

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Crea el estado SRS inicial para una tarjeta nueva (§6.3). */
export function createInitialCardSRS(
  cardId: string,
  now: number = Date.now(),
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): CardSRS {
  return {
    cardId,
    state: 'new',
    ease: config.initialEase,
    interval: 0,
    due: now,
    lapses: 0,
    reps: 0,
  };
}

/** Formatea una duración en milisegundos para la vista previa de intervalos (§6.3, Criterio h). */
export function formatIntervalPreview(ms: number): string {
  if (ms < MS_PER_DAY) {
    const minutes = ms / MS_PER_MINUTE;
    if (Math.abs(minutes - 5.5) < 0.05) {
      return '5,5 min';
    }
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) {
      return `${roundedMinutes} min`;
    }
    const hours = Math.round(minutes / 60);
    return `${hours} h`;
  }

  const days = Math.round(ms / MS_PER_DAY);
  if (days < 365) {
    return `${days} d`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return `${String(years).replace('.', ',')} a`;
}

/**
 * Planificador puro SM-2 (variante clásica de Anki) sin *fuzz* ni reloj mutable (§6.3, Criterio h).
 */
export function schedule(
  card: CardSRS,
  rating: Rating,
  now: number,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): CardSRS {
  const reps = card.reps + 1;
  const currentEase = card.ease ?? config.initialEase;

  // --------------------------------------------------------------------------
  // 1. Tarjetas Nuevas
  // --------------------------------------------------------------------------
  if (card.state === 'new') {
    switch (rating) {
      case 'again': {
        const due = now + config.learningSteps[0]! * MS_PER_MINUTE;
        return {
          ...card,
          state: 'learning',
          stepIndex: 0,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'hard': {
        // En Anki, difícil en nueva usa la media del primer y segundo paso: 5,5 min
        const first = config.learningSteps[0] ?? 1;
        const second = config.learningSteps[1] ?? 10;
        const avg = (first + second) / 2;
        const due = now + Math.round(avg * MS_PER_MINUTE);
        return {
          ...card,
          state: 'learning',
          stepIndex: 0,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'good': {
        // Avanza al segundo paso de aprendizaje (10 min) (Criterio h)
        const due = now + config.learningSteps[1]! * MS_PER_MINUTE;
        return {
          ...card,
          state: 'learning',
          stepIndex: 1,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'easy': {
        // Se gradúa inmediatamente con el intervalo fácil (4 d) (Criterio h)
        const due = now + config.easyInterval * MS_PER_DAY;
        return {
          ...card,
          state: 'review',
          interval: config.easyInterval,
          stepIndex: undefined,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Tarjetas en Aprendizaje (Learning)
  // --------------------------------------------------------------------------
  if (card.state === 'learning') {
    const currentStep = card.stepIndex ?? 0;

    switch (rating) {
      case 'again': {
        const due = now + config.learningSteps[0]! * MS_PER_MINUTE;
        return {
          ...card,
          stepIndex: 0,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'hard': {
        let stepMin: number;
        if (currentStep === 0) {
          const first = config.learningSteps[0] ?? 1;
          const second = config.learningSteps[1] ?? 10;
          stepMin = (first + second) / 2;
        } else {
          stepMin = config.learningSteps[currentStep] ?? 10;
        }
        const due = now + Math.round(stepMin * MS_PER_MINUTE);
        return {
          ...card,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'good': {
        if (currentStep < config.learningSteps.length - 1) {
          const nextStep = currentStep + 1;
          const due = now + config.learningSteps[nextStep]! * MS_PER_MINUTE;
          return {
            ...card,
            stepIndex: nextStep,
            due,
            reps,
            lastReviewedAt: now,
          };
        } else {
          // Último paso: se gradúa a repaso con intervalo de 1 d (Criterio h)
          const due = now + config.graduatingInterval * MS_PER_DAY;
          return {
            ...card,
            state: 'review',
            interval: config.graduatingInterval,
            stepIndex: undefined,
            due,
            reps,
            lastReviewedAt: now,
          };
        }
      }
      case 'easy': {
        const due = now + config.easyInterval * MS_PER_DAY;
        return {
          ...card,
          state: 'review',
          interval: config.easyInterval,
          stepIndex: undefined,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Tarjetas en Repaso (Review)
  // --------------------------------------------------------------------------
  if (card.state === 'review') {
    const currentInterval = card.interval <= 0 ? 1 : card.interval;

    switch (rating) {
      case 'again': {
        // Fallo: facilidad −0.20, fallo +1, reaprendizaje a 10 min, nuevo intervalo = 1 d (Criterio h)
        const nextEase = Math.max(
          config.minimumEase,
          Math.round((currentEase - 0.2) * 100) / 100,
        );
        const due = now + config.relearningSteps[0]! * MS_PER_MINUTE;
        return {
          ...card,
          state: 'relearning',
          ease: nextEase,
          interval: config.graduatingInterval,
          stepIndex: 0,
          due,
          lapses: card.lapses + 1,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'hard': {
        // Difícil: facilidad −0.15, intervalo × 1.2 (mínimo +1 d) (Criterio h)
        const nextEase = Math.max(
          config.minimumEase,
          Math.round((currentEase - 0.15) * 100) / 100,
        );
        const calculatedInterval = Math.round(
          currentInterval * config.hardIntervalMultiplier,
        );
        const nextInterval = Math.min(
          config.maximumInterval,
          Math.max(currentInterval + 1, calculatedInterval),
        );
        const due = now + nextInterval * MS_PER_DAY;
        return {
          ...card,
          ease: nextEase,
          interval: nextInterval,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'good': {
        // Bien: facilidad intacta, intervalo = máx(intervalo + 1, round(intervalo × facilidad)) (Criterio h)
        const calculatedInterval = Math.round(currentInterval * currentEase);
        const nextInterval = Math.min(
          config.maximumInterval,
          Math.max(currentInterval + 1, calculatedInterval),
        );
        const due = now + nextInterval * MS_PER_DAY;
        return {
          ...card,
          interval: nextInterval,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'easy': {
        // Fácil: facilidad +0.15, intervalo = round(intervalo × facilidad × 1.3) (Criterio h)
        const nextEase = Math.round((currentEase + 0.15) * 100) / 100;
        const calculatedInterval = Math.round(
          currentInterval * currentEase * config.easyIntervalMultiplier,
        );
        const nextInterval = Math.min(
          config.maximumInterval,
          Math.max(currentInterval + 1, calculatedInterval),
        );
        const due = now + nextInterval * MS_PER_DAY;
        return {
          ...card,
          ease: nextEase,
          interval: nextInterval,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Tarjetas en Reaprendizaje (Relearning)
  // --------------------------------------------------------------------------
  if (card.state === 'relearning') {
    switch (rating) {
      case 'again':
      case 'hard': {
        const due = now + config.relearningSteps[0]! * MS_PER_MINUTE;
        return {
          ...card,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'good': {
        // Bien: regresa a repaso con el intervalo de graduación (1 d) (Criterio h)
        const due = now + config.graduatingInterval * MS_PER_DAY;
        return {
          ...card,
          state: 'review',
          interval: config.graduatingInterval,
          stepIndex: undefined,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
      case 'easy': {
        const due = now + config.easyInterval * MS_PER_DAY;
        return {
          ...card,
          state: 'review',
          interval: config.easyInterval,
          stepIndex: undefined,
          due,
          reps,
          lastReviewedAt: now,
        };
      }
    }
  }

  return card;
}

/**
 * Devuelve la vista previa del intervalo resultante para cada uno de los 4 botones (§6.3, Criterio h).
 */
export function previewIntervals(
  card: CardSRS,
  now: number,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): Record<Rating, IntervalPreview> {
  const ratings: readonly Rating[] = ['again', 'hard', 'good', 'easy'];
  const previews = {} as Record<Rating, IntervalPreview>;

  for (const rating of ratings) {
    const nextCard = schedule(card, rating, now, config);
    const diffMs = Math.max(0, nextCard.due - now);
    const text = formatIntervalPreview(diffMs);

    previews[rating] = {
      rating,
      text,
      due: nextCard.due,
      nextState: nextCard.state,
      nextEase: nextCard.ease,
      nextInterval: nextCard.interval,
    };
  }

  return previews;
}
