import type {
  Degree,
  FretPosition,
} from '../../theory';
import type {
  AnswerInput,
  DrillConfig,
  DrillId,
  DrillQuestion,
  Grade,
  ItemStats,
} from '../../learning';

/** Fases del ciclo de vida de una sesión de ejercicios. */
export type DrillSessionPhase =
  | 'configuring'
  | 'question'
  | 'answering'
  | 'corrected'
  | 'summary';

/** Registro histórico de una sesión completada. */
export interface DrillSessionRecord {
  id: string;
  date: string;
  drillId: DrillId;
  config: DrillConfig;
  totalQuestions: number;
  correctCount: number;
  /** Porcentaje de precisión (0..100). */
  accuracy: number;
  /** Tiempo medio de respuesta por pregunta en milisegundos. */
  averageTimeMs: number;
}

/** Métricas acumuladas en la sesión activa. */
export interface SessionRunningStats {
  questionsAnswered: number;
  correctCount: number;
  totalTimeMs: number;
}

/** Estado completo del store de ejercicios. */
export interface DrillsState {
  /** Ejercicio actualmente seleccionado en la barra lateral (A1–C2). */
  drillId: DrillId;
  /** Configuración activa del ejercicio actual. */
  config: DrillConfig;
  /** Configuraciones guardadas por ejercicio para recordar personalizaciones del usuario. */
  configs: Partial<Record<DrillId, DrillConfig>>;

  /** Fase actual de la sesión. */
  phase: DrillSessionPhase;
  /** Pregunta actualmente presentada al usuario. */
  currentQuestion: DrillQuestion | null;
  /** Número de pregunta actual en la sesión (1..totalQuestions). */
  questionNumber: number;
  /** Total de preguntas configuradas para esta sesión (por defecto 20). */
  totalQuestions: number;

  /** Respuesta actualmente construida por el usuario. */
  currentAnswer: AnswerInput | null;
  /** Posiciones seleccionadas en el mástil (en modo selección múltiple o mientras se responde). */
  pinnedPositions: FretPosition[];
  /** Opción elegida en ejercicios de opciones (A2 nombra nota, B3 nombra intervalo). */
  selectedChoice: string | number | null;
  /** Etiquetas asignadas a posiciones físicas en el ejercicio B5. */
  assignedLabels: { position: FretPosition; label: Degree | string }[];

  /** Calificación calculada por grade() para la pregunta actual tras corregir. */
  lastGrade: Grade | null;
  /** Timestamp en el que se presentó la pregunta actual (para medir tiempo de respuesta). */
  questionStartTime: number | null;
  /** Estadísticas acumuladas en la sesión en curso. */
  sessionStats: SessionRunningStats;

  /** Estadísticas históricas por itemKey (persistidas, base del modo adaptativo). */
  itemStats: Record<string, ItemStats>;
  /** Historial de las últimas 100 sesiones completadas. */
  history: DrillSessionRecord[];
}

/** Acciones disponibles en el store de ejercicios. */
export interface DrillsActions {
  /** Selecciona el ejercicio activo y carga su configuración predeterminada o guardada. */
  setDrill: (drillId: DrillId) => void;
  /** Actualiza parcialmente la configuración del ejercicio activo. */
  updateConfig: (config: Partial<DrillConfig>) => void;
  /** Inicia una nueva sesión de práctica para un ejercicio. */
  startSession: (
    drillId?: DrillId,
    configOverrides?: Partial<DrillConfig>,
    totalQuestions?: number,
  ) => void;
  /** Alterna una posición en el mástil (en clic único evalúa directamente; en múltiple conmuta). */
  togglePosition: (pos: FretPosition) => void;
  /** Selecciona una opción en ejercicios de tipo elección o clase de altura / intervalo. */
  selectChoice: (choice: string | number) => void;
  /** Asigna una etiqueta de grado a una posición en el ejercicio B5. */
  assignLabel: (pos: FretPosition, label: Degree | string) => void;
  /** Establece explícitamente el objeto de respuesta actual. */
  setAnswer: (answer: AnswerInput) => void;
  /** Envía la respuesta para corrección inmediata mediante grade(). Admite opciones de penalización por pistas. */
  submitAnswer: (
    answer?: AnswerInput,
    options?: { scoreMultiplier?: number; hintExplanation?: string },
  ) => void;
  /** Alias de submitAnswer(). */
  checkAnswer: () => void;
  /** Pasa a la siguiente pregunta de la sesión o al resumen si se alcanzó el total. */
  nextQuestion: () => void;
  /** Reinicia la sesión actual con la misma configuración. */
  restartSession: () => void;
  /** Finaliza la sesión actual y regresa a la fase de configuración. */
  endSession: () => void;
  /** Exporta el estado persistente a una cadena JSON. */
  exportData: () => string;
  /** Importa y restaura datos previamente exportados, con validación de seguridad. */
  importData: (jsonOrObj: string | unknown) => boolean;
  /** Restablece todas las estadísticas acumuladas y el historial a cero. */
  resetStats: () => void;
}

export type DrillsStore = DrillsState & DrillsActions;

/** Datos persistidos en localStorage (versión 1). */
export interface PersistedDrillsState {
  version: 1;
  itemStats: Record<string, ItemStats>;
  history: DrillSessionRecord[];
  configs?: Partial<Record<DrillId, DrillConfig>>;
  lastDrillId?: DrillId;
}
