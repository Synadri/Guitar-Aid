import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  STANDARD_TUNING,
  type FretPosition,
  type PitchClass,
  type StringNumber,
} from '../../theory';
import {
  createRng,
  generateDrillQuestion,
  grade,
  samePosition,
  type AnswerInput,
  type DrillConfig,
  type DrillId,
  type ItemStats,
  type Rng,
  DRILL_CATALOG,
} from '../../learning';
import { createMemoryStorage } from '../settings';
import type {
  DrillSessionRecord,
  DrillsState,
  DrillsStore,
  PersistedDrillsState,
} from './types';

export const DRILLS_STORAGE_KEY = 'guitar-aid:drills';
export const DRILLS_STORAGE_VERSION = 1;

export const DEFAULT_DRILL_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];

/** Retorna la configuración predeterminada para un ejercicio concreto. */
export function defaultDrillConfig(drillId: DrillId): DrillConfig {
  const info = DRILL_CATALOG.find((d) => d.id === drillId);
  return {
    tuning: STANDARD_TUNING,
    activeStrings: DEFAULT_DRILL_STRINGS,
    fretRange: [0, 12],
    mode: info?.defaultMode ?? 'all',
    direction: 'ascending',
    adaptive: true,
    showInlays: true,
    playAudio: true,
    nameMode: 'sharps',
    naturalOnly: false,
  };
}

/** Estado inicial del store de ejercicios. */
export function initialDrillsState(overrides: Partial<DrillsState> = {}): DrillsState {
  const defaultDrill: DrillId = 'A1';
  return {
    drillId: defaultDrill,
    config: defaultDrillConfig(defaultDrill),
    configs: {},

    phase: 'configuring',
    currentQuestion: null,
    questionNumber: 1,
    totalQuestions: 20,

    currentAnswer: null,
    pinnedPositions: [],
    selectedChoice: null,
    assignedLabels: [],

    lastGrade: null,
    questionStartTime: null,
    sessionStats: {
      questionsAnswered: 0,
      correctCount: 0,
      totalTimeMs: 0,
    },

    itemStats: {},
    history: [],
    ...overrides,
  };
}

function resolveDefaultStorage(): StateStorage {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return createMemoryStorage();
}

export interface CreateDrillsStoreOptions {
  storage?: StateStorage;
  storageName?: string;
  initialOverrides?: Partial<DrillsState>;
  rng?: Rng;
  seed?: number;
  now?: () => number;
}

export function createDrillsStore(
  options: CreateDrillsStoreOptions = {},
): StoreApi<DrillsStore> {
  const {
    storage = resolveDefaultStorage(),
    storageName = DRILLS_STORAGE_KEY,
    initialOverrides = {},
    rng = options.seed !== undefined ? createRng(options.seed) : createRng(),
    now = () => Date.now(),
  } = options;

  return createStore<DrillsStore>()(
    persist(
      (set, get) => ({
        ...initialDrillsState(initialOverrides),

        setDrill: (drillId: DrillId) =>
          set((state) => {
            const savedConfig = state.configs[drillId];
            const nextConfig = savedConfig ? { ...savedConfig } : defaultDrillConfig(drillId);
            return {
              drillId,
              config: nextConfig,
              phase: 'configuring',
              currentQuestion: null,
              currentAnswer: null,
              pinnedPositions: [],
              selectedChoice: null,
              assignedLabels: [],
              lastGrade: null,
            };
          }),

        updateConfig: (partial: Partial<DrillConfig>) =>
          set((state) => {
            const updatedConfig = { ...state.config, ...partial };
            return {
              config: updatedConfig,
              configs: {
                ...state.configs,
                [state.drillId]: updatedConfig,
              },
            };
          }),

        startSession: (
          drillId?: DrillId,
          configOverrides?: Partial<DrillConfig>,
          totalQuestions: number = 20,
        ) =>
          set((state) => {
            const targetDrillId = drillId ?? state.drillId;
            const baseConfig = state.configs[targetDrillId] ?? defaultDrillConfig(targetDrillId);
            const activeConfig: DrillConfig = {
              ...baseConfig,
              ...(configOverrides ?? {}),
            };

            const firstQuestion = generateDrillQuestion(
              targetDrillId,
              rng,
              activeConfig,
              state.itemStats,
            );

            return {
              drillId: targetDrillId,
              config: activeConfig,
              phase: 'question',
              currentQuestion: firstQuestion,
              questionNumber: 1,
              totalQuestions: Math.max(1, totalQuestions),
              currentAnswer: null,
              pinnedPositions: [],
              selectedChoice: null,
              assignedLabels: [],
              lastGrade: null,
              questionStartTime: now(),
              sessionStats: {
                questionsAnswered: 0,
                correctCount: 0,
                totalTimeMs: 0,
              },
            };
          }),

        togglePosition: (pos: FretPosition) => {
          const state = get();
          if (state.phase !== 'question' && state.phase !== 'answering') return;
          if (!state.currentQuestion) return;

          // En modo 'first' para ejercicios de posiciones, el clic evalúa directamente
          if (state.currentQuestion.mode === 'first' && state.currentQuestion.answerKind === 'positions') {
            get().submitAnswer({ kind: 'positions', positions: [pos] });
            return;
          }

          // En modo 'all', conmuta la posición en pinnedPositions
          const exists = state.pinnedPositions.some((p) => samePosition(p, pos));
          const updated = exists
            ? state.pinnedPositions.filter((p) => !samePosition(p, pos))
            : [...state.pinnedPositions, pos];

          set({
            pinnedPositions: updated,
            currentAnswer: { kind: 'positions', positions: updated },
            phase: 'answering',
          });
        },

        selectChoice: (choice: string | number) => {
          const state = get();
          if (state.phase !== 'question' && state.phase !== 'answering') return;
          if (!state.currentQuestion) return;

          const q = state.currentQuestion;
          set({ selectedChoice: choice });

          // Los ejercicios de opción (A2, B3) evalúan de forma inmediata al seleccionar
          if (q.answerKind === 'pitchClass') {
            get().submitAnswer({
              kind: 'pitchClass',
              pitchClass: Number(choice) as PitchClass,
            });
          } else if (q.answerKind === 'interval') {
            get().submitAnswer({
              kind: 'interval',
              semitones: Number(choice),
            });
          } else if (q.answerKind === 'choice') {
            get().submitAnswer({
              kind: 'choice',
              choice,
            });
          } else {
            set({ phase: 'answering' });
          }
        },

        assignLabel: (pos: FretPosition, label: string) => {
          const state = get();
          if (state.phase !== 'question' && state.phase !== 'answering') return;

          const updated = state.assignedLabels.filter((l) => !samePosition(l.position, pos));
          updated.push({ position: pos, label });

          set({
            assignedLabels: updated,
            currentAnswer: { kind: 'labels', labels: updated },
            phase: 'answering',
          });
        },

        setAnswer: (answer: AnswerInput) =>
          set({
            currentAnswer: answer,
            phase: 'answering',
          }),

        submitAnswer: (
          answerOverride?: AnswerInput,
          options?: { scoreMultiplier?: number; hintExplanation?: string },
        ) => {
          const state = get();
          if (state.phase === 'corrected' || !state.currentQuestion) return;

          const q = state.currentQuestion;
          let input = answerOverride ?? state.currentAnswer;

          if (!input) {
            if (q.answerKind === 'positions') {
              input = { kind: 'positions', positions: state.pinnedPositions };
            } else if (q.answerKind === 'labels') {
              input = { kind: 'labels', labels: state.assignedLabels };
            } else if (state.selectedChoice !== null) {
              if (q.answerKind === 'pitchClass') {
                input = { kind: 'pitchClass', pitchClass: Number(state.selectedChoice) as PitchClass };
              } else if (q.answerKind === 'interval') {
                input = { kind: 'interval', semitones: Number(state.selectedChoice) };
              } else {
                input = { kind: 'choice', choice: state.selectedChoice };
              }
            } else {
              // Respuesta vacía de reserva
              input = { kind: 'positions', positions: [] };
            }
          }

          // En C1 (Construye el acorde), la raíz ya está indicada como referencia en el mástil.
          // Si el usuario también la pulsó en su respuesta, la limpiamos para que no compute como extra.
          const prompt = q.prompt as Record<string, unknown> | null;
          if (q.drill === 'C1' && prompt?.rootPosition && input.kind === 'positions') {
            const rootPos = prompt.rootPosition as FretPosition;
            const filtered = input.positions.filter((p) => !samePosition(p, rootPos));
            input = { kind: 'positions', positions: filtered };
          }

          let gradeResult = grade(q, input);
          if (options?.scoreMultiplier !== undefined) {
            const adjustedScore = Math.max(0, Math.min(1, gradeResult.score * options.scoreMultiplier));
            gradeResult = {
              ...gradeResult,
              score: adjustedScore,
              explanation: options.hintExplanation
                ? `${gradeResult.explanation ? gradeResult.explanation + ' ' : ''}${options.hintExplanation}`
                : gradeResult.explanation,
            };
          }
          const currentTime = now();
          const elapsedMs = Math.max(0, currentTime - (state.questionStartTime ?? currentTime));

          // Actualización de métricas acumuladas de la sesión
          const nextQuestionsAnswered = state.sessionStats.questionsAnswered + 1;
          const isFullyCorrect =
            gradeResult.correct && (options?.scoreMultiplier === undefined || options.scoreMultiplier >= 1);
          const correctIncrement = isFullyCorrect
            ? 1
            : gradeResult.correct && options?.scoreMultiplier !== undefined
              ? options.scoreMultiplier
              : 0;
          const nextCorrectCount = state.sessionStats.correctCount + correctIncrement;
          const nextTotalTimeMs = state.sessionStats.totalTimeMs + elapsedMs;

          // Actualización de estadísticas históricas persistidas por itemKey
          const prevStats = state.itemStats[q.itemKey];
          const prevAttempts = prevStats?.attempts ?? 0;
          const prevHits = prevStats?.hits ?? 0;
          const prevResults = prevStats?.recentResults ?? [];

          const newAttempts = prevAttempts + 1;
          const newHits = prevHits + (isFullyCorrect ? 1 : 0);
          const newResults = [...prevResults, isFullyCorrect].slice(-20);

          const prevAvgTime = prevStats?.averageTimeMs ?? elapsedMs;
          const newAvgTime = Math.round(
            ((prevAvgTime * prevAttempts) + elapsedMs) / newAttempts,
          );

          const updatedItemStats: ItemStats = {
            attempts: newAttempts,
            hits: newHits,
            recentResults: newResults,
            averageTimeMs: newAvgTime,
          };

          set({
            lastGrade: gradeResult,
            phase: 'corrected',
            sessionStats: {
              questionsAnswered: nextQuestionsAnswered,
              correctCount: nextCorrectCount,
              totalTimeMs: nextTotalTimeMs,
            },
            itemStats: {
              ...state.itemStats,
              [q.itemKey]: updatedItemStats,
            },
          });
        },

        checkAnswer: () => get().submitAnswer(),

        nextQuestion: () => {
          const state = get();
          if (state.phase !== 'corrected') return;

          if (state.questionNumber < state.totalQuestions) {
            // Siguiente pregunta en la sesión activa
            const nextQ = generateDrillQuestion(
              state.drillId,
              rng,
              state.config,
              state.itemStats,
            );

            set({
              questionNumber: state.questionNumber + 1,
              currentQuestion: nextQ,
              currentAnswer: null,
              pinnedPositions: [],
              selectedChoice: null,
              assignedLabels: [],
              lastGrade: null,
              questionStartTime: now(),
              phase: 'question',
            });
          } else {
            // Fin de sesión: registra en el historial y pasa a la pantalla de resumen
            const total = state.sessionStats.questionsAnswered;
            const correct = state.sessionStats.correctCount;
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
            const averageTimeMs =
              total > 0 ? Math.round(state.sessionStats.totalTimeMs / total) : 0;

            const sessionRecord: DrillSessionRecord = {
              id: `drill-session-${now()}`,
              date: new Date(now()).toISOString(),
              drillId: state.drillId,
              config: state.config,
              totalQuestions: total,
              correctCount: correct,
              accuracy,
              averageTimeMs,
            };

            set({
              phase: 'summary',
              currentQuestion: null,
              currentAnswer: null,
              pinnedPositions: [],
              selectedChoice: null,
              assignedLabels: [],
              lastGrade: null,
              history: [...state.history, sessionRecord].slice(-100),
            });
          }
        },

        restartSession: () => {
          const state = get();
          get().startSession(state.drillId, state.config, state.totalQuestions);
        },

        endSession: () =>
          set({
            phase: 'configuring',
            currentQuestion: null,
            currentAnswer: null,
            pinnedPositions: [],
            selectedChoice: null,
            assignedLabels: [],
            lastGrade: null,
          }),

        exportData: () => {
          const state = get();
          const payload: PersistedDrillsState = {
            version: 1,
            itemStats: state.itemStats,
            history: state.history,
            configs: state.configs,
            lastDrillId: state.drillId,
          };
          return JSON.stringify(payload, null, 2);
        },

        importData: (raw: string | unknown) => {
          try {
            const data =
              typeof raw === 'string'
                ? (JSON.parse(raw) as Partial<PersistedDrillsState>)
                : (raw as Partial<PersistedDrillsState>);

            if (!data || typeof data !== 'object') return false;

            const itemStats: Record<string, ItemStats> = {};
            if (data.itemStats && typeof data.itemStats === 'object') {
              for (const [k, v] of Object.entries(data.itemStats)) {
                if (v && typeof v === 'object' && typeof v.attempts === 'number') {
                  itemStats[k] = {
                    attempts: Math.max(0, v.attempts),
                    hits: Math.max(0, v.hits ?? 0),
                    averageTimeMs: typeof v.averageTimeMs === 'number' ? v.averageTimeMs : undefined,
                    recentResults: Array.isArray(v.recentResults) ? v.recentResults : [],
                  };
                }
              }
            }

            const history: DrillSessionRecord[] = [];
            if (Array.isArray(data.history)) {
              for (const h of data.history) {
                if (h && typeof h === 'object' && typeof h.accuracy === 'number') {
                  history.push(h as DrillSessionRecord);
                }
              }
            }

            const configs = data.configs && typeof data.configs === 'object' ? data.configs : {};
            const lastDrillId =
              typeof data.lastDrillId === 'string' &&
              DRILL_CATALOG.some((d) => d.id === data.lastDrillId)
                ? (data.lastDrillId as DrillId)
                : get().drillId;

            set({
              itemStats,
              history: history.slice(-100),
              configs,
              drillId: lastDrillId,
              config: configs[lastDrillId] ?? defaultDrillConfig(lastDrillId),
              phase: 'configuring',
              currentQuestion: null,
              lastGrade: null,
            });

            return true;
          } catch {
            return false;
          }
        },

        resetStats: () =>
          set({
            itemStats: {},
            history: [],
          }),
      }),
      {
        name: storageName,
        version: DRILLS_STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
        partialize: (state): PersistedDrillsState => ({
          version: 1,
          itemStats: state.itemStats,
          history: state.history,
          configs: state.configs,
          lastDrillId: state.drillId,
        }),
        merge: (persistedState, currentState): DrillsStore => {
          if (!persistedState || typeof persistedState !== 'object') {
            return currentState;
          }

          const p = persistedState as Partial<PersistedDrillsState>;
          const itemStats: Record<string, ItemStats> = {};
          if (p.itemStats && typeof p.itemStats === 'object') {
            for (const [k, v] of Object.entries(p.itemStats)) {
              if (
                v &&
                typeof v === 'object' &&
                typeof v.attempts === 'number' &&
                Number.isFinite(v.attempts)
              ) {
                itemStats[k] = {
                  attempts: Math.max(0, v.attempts),
                  hits: Math.max(0, Number(v.hits) || 0),
                  averageTimeMs:
                    typeof v.averageTimeMs === 'number' && Number.isFinite(v.averageTimeMs)
                      ? v.averageTimeMs
                      : undefined,
                  recentResults: Array.isArray(v.recentResults)
                    ? v.recentResults.filter((r) => typeof r === 'boolean')
                    : [],
                };
              }
            }
          }

          const history: DrillSessionRecord[] = [];
          if (Array.isArray(p.history)) {
            for (const h of p.history) {
              if (h && typeof h === 'object' && typeof h.accuracy === 'number') {
                history.push(h as DrillSessionRecord);
              }
            }
          }

          const configs = p.configs && typeof p.configs === 'object' ? p.configs : {};
          const lastDrillId =
            typeof p.lastDrillId === 'string' && DRILL_CATALOG.some((d) => d.id === p.lastDrillId)
              ? (p.lastDrillId as DrillId)
              : currentState.drillId;

          return {
            ...currentState,
            itemStats,
            history: history.slice(-100),
            configs,
            drillId: lastDrillId,
            config: configs[lastDrillId] ?? currentState.config,
            // Las sesiones siempre arrancan limpias en modo configuración tras recargar
            phase: 'configuring',
            currentQuestion: null,
            lastGrade: null,
          };
        },
      },
    ),
  );
}

/** Store singleton para la aplicación. */
export const drillsStore = createDrillsStore();
