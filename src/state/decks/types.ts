import type {
  CardSRS,
  CardState,
  DailyUsage,
  IntervalPreview,
  QueueCounts,
  Rating,
  SchedulerConfig,
} from '../../learning/srs/types';
import type {
  Deck,
  DeckLimits,
  DeckPreset,
  DeckSource,
  ResolvedCard,
} from '../../learning/cards/types';

export type {
  CardSRS,
  CardState,
  DailyUsage,
  IntervalPreview,
  QueueCounts,
  Rating,
  SchedulerConfig,
  Deck,
  DeckLimits,
  DeckPreset,
  DeckSource,
  ResolvedCard,
};

// ============================================================================
// 1. Historial de Repasos (§6.3)
// ============================================================================

/** Registro individual de un repaso completado en el historial persistido. */
export interface ReviewLogEntry {
  id: string;
  cardId: string;
  deckId: string;
  rating: Rating;
  at: number;
  prevInterval: number;
  newInterval: number;
  ease: number;
  prevState?: CardState;
  nextState?: CardState;
}

// ============================================================================
// 2. Sesión Activa de Estudio de Tarjetas (§5.3)
// ============================================================================

/** Estado en memoria de una sesión activa de estudio (volátil, no persistida en recargas). */
export interface FlashcardSession {
  /** ID del mazo que se está estudiando. */
  deckId: string;
  /** Cola ordenada de IDs de tarjeta para esta sesión. */
  queue: string[];
  /** Índice de la tarjeta actual en la cola (0..queue.length - 1). */
  currentIndex: number;
  /** ID de la tarjeta actualmente mostrada, o null si la sesión ha finalizado. */
  currentCardId: string | null;
  /** Indica si el usuario ha pulsado "Mostrar respuesta" (reverso visible). */
  isAnswerRevealed: boolean;
  /** Timestamp (ms) en el que se mostró el anverso de la tarjeta actual. */
  cardStartTime: number;
  /** Contadores de tarjetas pendientes calculados al iniciar o actualizar la sesión. */
  counts: QueueCounts;
}

// ============================================================================
// 3. Entradas para CRUD de Mazos (§6.2)
// ============================================================================

export interface CreateDeckInput {
  name: string;
  description?: string;
  sources?: readonly DeckSource[];
  limits?: Partial<DeckLimits>;
}

export interface UpdateDeckInput {
  name?: string;
  description?: string;
  sources?: readonly DeckSource[];
  limits?: Partial<DeckLimits>;
}

// ============================================================================
// 4. Estadísticas y Agregados para la UI (§7.3)
// ============================================================================

export interface DeckStats {
  total: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  dueToday: number;
  /** Porcentaje de retención histórica (0..100). */
  retentionRate: number;
}

export interface GlobalDeckStats {
  /** Total de tarjetas que tocan repasar o aprender hoy entre todos los mazos. */
  pendientesHoy: number;
  /** Porcentaje global de retención histórica (0..100). */
  retención: number;
  /** Total de tarjetas nuevas aún no iniciadas entre todos los mazos. */
  nuevas: number;
  /** Total de tarjetas actualmente en aprendizaje o reaprendizaje. */
  enAprendizaje: number;
  /** Total de repasos históricos registrados. */
  totalRepasos: number;
}

// ============================================================================
// 5. Estado y Acciones de Zustand (§6.2, §6.3, §5.2)
// ============================================================================

export interface DecksState {
  /** Lista de mazos creados o añadidos por el usuario. */
  decks: Deck[];
  /** ID del mazo actualmente seleccionado en la barra lateral o en estudio. */
  activeDeckId: string | null;
  /**
   * Estado de repetición espaciada (SRS) indexado por mazo y tarjeta:
   * `cardsSRS[deckId][cardId]` → `CardSRS` (§6.2, Criterio j).
   */
  cardsSRS: Record<string, Record<string, CardSRS>>;
  /**
   * Cómputo de tarjetas nuevas y repasos estudiados hoy por mazo:
   * `dailyUsage[deckId]` → `DailyUsage` (§6.3, Criterio k).
   */
  dailyUsage: Record<string, DailyUsage>;
  /** Historial cronológico de repasos (máximo 5000 entradas). */
  history: ReviewLogEntry[];
  /** Sesión activa de estudio (null si no se está estudiando ninguna tarjeta). */
  session: FlashcardSession | null;
}

export interface DecksActions {
  /** Crea un nuevo mazo a partir de reglas declarativas o vacío. */
  createDeck: (input: CreateDeckInput) => Deck;
  /**
   * Actualiza el nombre, límites o reglas de un mazo. Si las reglas cambian,
   * regenera `cardIds` conservando el progreso SRS de las tarjetas que siguen (Criterio j).
   */
  updateDeck: (id: string, updates: UpdateDeckInput) => Deck | null;
  /** Elimina un mazo y limpia su estado SRS y de uso diario. */
  deleteDeck: (id: string) => boolean;
  /** Duplica un mazo existente con un nuevo ID, nombre y progreso independiente. */
  duplicateDeck: (id: string, newName?: string) => Deck | null;
  /**
   * Añade una copia editable e independiente de un mazo predefinido
   * ('beginner' | 'intermediate' | 'advanced') con su propio progreso (Criterio l).
   */
  addPresetDeck: (presetId: 'beginner' | 'intermediate' | 'advanced') => Deck;
  /** Selecciona el mazo activo en la interfaz. */
  selectDeck: (deckId: string | null) => void;

  /** Inicia una sesión de estudio para el mazo especificado (o el activo). */
  startSession: (deckId?: string) => void;
  /** Muestra el reverso de la tarjeta actual (Espacio). */
  revealAnswer: () => void;
  /**
   * Valora la tarjeta actual con SM-2 (Otra vez, Difícil, Bien, Fácil),
   * actualiza su SRS, uso diario e historial, y avanza a la siguiente tarjeta (Criterios h, j, k).
   */
  rateCard: (rating: Rating) => void;
  /** Finaliza la sesión de estudio activa y regresa a la vista de lista de mazos. */
  endSession: () => void;
  /** Reinicia el progreso SRS y el uso diario de un mazo concreto a cero. */
  resetDeckProgress: (deckId: string) => void;

  /** Exporta el estado completo de mazos y SRS a una cadena JSON (Criterio m). */
  exportData: () => string;
  /** Importa y restaura mazos y estado SRS desde un JSON o backup estructurado (Criterio m). */
  importData: (jsonOrObj: string | unknown) => boolean;
  /** Restablece todos los mazos, progresos e historial a los valores iniciales. */
  resetAll: () => void;
}

export type DecksStore = DecksState & DecksActions;

// ============================================================================
// 6. Esquema de Persistencia (localStorage, version: 1)
// ============================================================================

export interface PersistedDecksState {
  version: 1;
  decks: Deck[];
  activeDeckId: string | null;
  cardsSRS: Record<string, Record<string, CardSRS>>;
  dailyUsage: Record<string, DailyUsage>;
  history: ReviewLogEntry[];
}
