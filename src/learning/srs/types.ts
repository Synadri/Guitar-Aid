// ============================================================================
// Tipos de Repetición Espaciada (SRS) (§6.3)
// ============================================================================

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface CardSRS {
  cardId: string;
  state: CardState;
  /** Factor de facilidad (inicial 2.50, mínimo 1.30). */
  ease: number;
  /** Intervalo de repaso en días (0 mientras está en aprendizaje). */
  interval: number;
  /** Índice del paso actual en aprendizaje/reaprendizaje. */
  stepIndex?: number;
  /** Timestamp (ms) en el que la tarjeta vence y debe presentarse. */
  due: number;
  /** Número de fallos (lapses) acumulados en estado de repaso. */
  lapses: number;
  /** Número total de repasos realizados. */
  reps: number;
  /** Timestamp (ms) del último repaso. */
  lastReviewedAt?: number;
}

export interface SchedulerConfig {
  /** Pasos de aprendizaje en minutos (defecto: [1, 10]). */
  learningSteps: readonly number[];
  /** Paso de reaprendizaje en minutos (defecto: [10]). */
  relearningSteps: readonly number[];
  /** Intervalo en días al graduar con Bien en el último paso (defecto: 1). */
  graduatingInterval: number;
  /** Intervalo en días al pulsar Fácil en tarjeta nueva/aprendizaje (defecto: 4). */
  easyInterval: number;
  /** Facilidad inicial (defecto: 2.50). */
  initialEase: number;
  /** Facilidad mínima infranqueable (defecto: 1.30). */
  minimumEase: number;
  /** Intervalo máximo en días (defecto: 36500). */
  maximumInterval: number;
  /** Factor de multiplicación para Difícil en repaso (defecto: 1.2). */
  hardIntervalMultiplier: number;
  /** Factor de multiplicación para Fácil en repaso (defecto: 1.3). */
  easyIntervalMultiplier: number;
}

export interface IntervalPreview {
  rating: Rating;
  /** Texto formateado amigable (p. ej. "1 min", "5,5 min", "10 min", "1 d", "4 d", "33 d"). */
  text: string;
  /** Timestamp resultante de vencimiento. */
  due: number;
  nextState: CardState;
  nextEase: number;
  nextInterval: number;
}

export interface DailyUsage {
  studyDay: string;
  newCount: number;
  reviewCount: number;
}

export interface QueueCounts {
  /** Tarjetas nuevas disponibles hoy (acotadas por límite diario). */
  newCount: number;
  /** Tarjetas en aprendizaje/reaprendizaje que ya vencieron (due <= now). */
  learningCount: number;
  /** Tarjetas en repaso que ya vencieron (due <= now, acotadas por límite diario). */
  reviewCount: number;
  /** Suma de pendientes hoy. */
  total: number;
}
