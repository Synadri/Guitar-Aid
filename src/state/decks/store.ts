import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { buildDeckCardIds } from '../../learning/cards/builder';
import { BEGINNER_PRESET, createDeckFromPreset, getPresetDeck } from '../../learning/cards/presets';
import type { Deck, DeckLimits } from '../../learning/cards/types';
import {
  DEFAULT_DECK_LIMITS,
  buildStudyQueue,
  getStudyDayKey,
  getStudyQueueCounts,
} from '../../learning/srs/queue';
import {
  DEFAULT_SCHEDULER_CONFIG,
  createInitialCardSRS,
  schedule,
} from '../../learning/srs/scheduler';
import type {
  CardSRS,
  DailyUsage,
  Rating,
  SchedulerConfig,
} from '../../learning/srs/types';
import { createMemoryStorage } from '../settings';
import type {
  CreateDeckInput,
  DecksState,
  DecksStore,
  FlashcardSession,
  PersistedDecksState,
  ReviewLogEntry,
  UpdateDeckInput,
} from './types';

export const DECKS_STORAGE_KEY = 'guitar-aid:decks';
export const DECKS_STORAGE_VERSION = 1;

/** Retorna el almacenamiento por defecto (localStorage en navegador o memoria simulada). */
function resolveDefaultStorage(): StateStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return createMemoryStorage();
}

/** Genera un identificador único para un nuevo mazo. */
function defaultDeckIdGenerator(): string {
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Genera un identificador único para una entrada del historial de repasos. */
function defaultReviewIdGenerator(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Estado inicial del store de mazos (§6.2, §6.4). */
export function initialDecksState(
  overrides: Partial<DecksState> = {},
  now: number = Date.now(),
): DecksState {
  const defaultDeck = createDeckFromPreset(
    BEGINNER_PRESET,
    () => 'deck-beginner',
    now,
  );

  return {
    decks: [defaultDeck],
    activeDeckId: defaultDeck.id,
    cardsSRS: {
      [defaultDeck.id]: {},
    },
    dailyUsage: {},
    history: [],
    session: null,
    ...overrides,
  };
}

export interface CreateDecksStoreOptions {
  storage?: StateStorage;
  storageName?: string;
  now?: () => number;
  idGenerator?: () => string;
  schedulerConfig?: SchedulerConfig;
}

/**
 * Fábrica pura del store de mazos y repetición espaciada (§6.2, §6.3, Hito A5).
 */
export function createDecksStore(
  options: CreateDecksStoreOptions = {},
): StoreApi<DecksStore> {
  const {
    storage = resolveDefaultStorage(),
    storageName = DECKS_STORAGE_KEY,
    now = Date.now,
    idGenerator = defaultDeckIdGenerator,
    schedulerConfig = DEFAULT_SCHEDULER_CONFIG,
  } = options;

  return createStore<DecksStore>()(
    persist(
      (set, get) => ({
        ...initialDecksState({}, now()),

        createDeck: (input: CreateDeckInput): Deck => {
          const timestamp = now();
          const id = idGenerator();
          const sources = input.sources ?? [];
          const cardIds = buildDeckCardIds(sources);
          const limits: DeckLimits = {
            ...DEFAULT_DECK_LIMITS,
            ...input.limits,
          };

          const newDeck: Deck = {
            id,
            name: input.name.trim() || 'Nuevo mazo',
            description: input.description,
            sources,
            cardIds,
            limits,
            createdAt: timestamp,
          };

          set((state) => ({
            decks: [...state.decks, newDeck],
            activeDeckId: id,
            cardsSRS: {
              ...state.cardsSRS,
              [id]: {},
            },
          }));

          return newDeck;
        },

        updateDeck: (id: string, updates: UpdateDeckInput): Deck | null => {
          const state = get();
          const deck = state.decks.find((d) => d.id === id);
          if (!deck) {
            return null;
          }

          let newCardIds = deck.cardIds;
          let newSources = deck.sources;

          if (updates.sources !== undefined) {
            newSources = updates.sources;
            // Regenerar al editar conservando el progreso SRS (§6.2, Criterio j)
            newCardIds = buildDeckCardIds(newSources);
          }

          const newLimits: DeckLimits = {
            ...deck.limits,
            ...updates.limits,
          };

          const updatedDeck: Deck = {
            ...deck,
            name: updates.name !== undefined ? updates.name.trim() || deck.name : deck.name,
            description:
              updates.description !== undefined ? updates.description : deck.description,
            sources: newSources,
            cardIds: newCardIds,
            limits: newLimits,
          };

          set((s) => ({
            decks: s.decks.map((d) => (d.id === id ? updatedDeck : d)),
          }));

          return updatedDeck;
        },

        deleteDeck: (id: string): boolean => {
          const state = get();
          const exists = state.decks.some((d) => d.id === id);
          if (!exists) {
            return false;
          }

          const remainingDecks = state.decks.filter((d) => d.id !== id);
          const nextCardsSRS = { ...state.cardsSRS };
          delete nextCardsSRS[id];

          const nextUsage = { ...state.dailyUsage };
          delete nextUsage[id];

          const nextActiveDeckId =
            state.activeDeckId === id ? remainingDecks[0]?.id ?? null : state.activeDeckId;

          const nextSession = state.session?.deckId === id ? null : state.session;

          set({
            decks: remainingDecks,
            activeDeckId: nextActiveDeckId,
            cardsSRS: nextCardsSRS,
            dailyUsage: nextUsage,
            session: nextSession,
          });

          return true;
        },

        duplicateDeck: (id: string, newName?: string): Deck | null => {
          const state = get();
          const deck = state.decks.find((d) => d.id === id);
          if (!deck) {
            return null;
          }

          const timestamp = now();
          const newId = idGenerator();
          const duplicated: Deck = {
            ...deck,
            id: newId,
            name: newName?.trim() || `${deck.name} (copia)`,
            createdAt: timestamp,
          };

          set((s) => ({
            decks: [...s.decks, duplicated],
            activeDeckId: newId,
            cardsSRS: {
              ...s.cardsSRS,
              [newId]: {},
            },
          }));

          return duplicated;
        },

        addPresetDeck: (presetId: 'beginner' | 'intermediate' | 'advanced'): Deck => {
          const preset = getPresetDeck(presetId) ?? BEGINNER_PRESET;
          const timestamp = now();
          const newDeck = createDeckFromPreset(preset, idGenerator, timestamp);

          set((state) => ({
            decks: [...state.decks, newDeck],
            activeDeckId: newDeck.id,
            cardsSRS: {
              ...state.cardsSRS,
              [newDeck.id]: {},
            },
          }));

          return newDeck;
        },

        selectDeck: (deckId: string | null): void => {
          const state = get();
          if (state.session && state.session.deckId !== deckId) {
            set({ activeDeckId: deckId, session: null });
          } else {
            set({ activeDeckId: deckId });
          }
        },

        startSession: (deckId?: string): void => {
          const state = get();
          const targetDeckId = deckId ?? state.activeDeckId ?? state.decks[0]?.id;
          if (!targetDeckId) return;

          const deck = state.decks.find((d) => d.id === targetDeckId);
          if (!deck) return;

          const currentTime = now();
          const deckSRS = state.cardsSRS[deck.id] ?? {};
          const usage = state.dailyUsage[deck.id];

          const counts = getStudyQueueCounts(deck, deckSRS, currentTime, usage);
          const queue = buildStudyQueue({
            deck,
            cardsSRS: deckSRS,
            now: currentTime,
            dailyUsage: usage,
          });

          const session: FlashcardSession = {
            deckId: deck.id,
            queue,
            currentIndex: 0,
            currentCardId: queue[0] ?? null,
            isAnswerRevealed: false,
            cardStartTime: currentTime,
            counts,
          };

          set({
            activeDeckId: deck.id,
            session,
          });
        },

        revealAnswer: (): void => {
          const session = get().session;
          if (!session || session.isAnswerRevealed) return;

          set({
            session: {
              ...session,
              isAnswerRevealed: true,
            },
          });
        },

        rateCard: (rating: Rating): void => {
          const state = get();
          const session = state.session;
          if (!session || !session.currentCardId) return;

          const { deckId, currentCardId } = session;
          const deck = state.decks.find((d) => d.id === deckId);
          if (!deck) return;

          const currentTime = now();
          const deckSRS = { ...(state.cardsSRS[deckId] ?? {}) };
          const prevSRS =
            deckSRS[currentCardId] ??
            createInitialCardSRS(currentCardId, currentTime, schedulerConfig);

          // 1. Calcular el siguiente estado SRS mediante SM-2 (§6.3, Criterio h)
          const nextSRS = schedule(prevSRS, rating, currentTime, schedulerConfig);
          deckSRS[currentCardId] = nextSRS;

          // 2. Actualizar el cómputo de cuotas diarias (§6.3, Criterio k)
          const currentDayKey = getStudyDayKey(currentTime);
          const prevUsage =
            state.dailyUsage[deckId]?.studyDay === currentDayKey
              ? state.dailyUsage[deckId]
              : { studyDay: currentDayKey, newCount: 0, reviewCount: 0 };

          let newCount = prevUsage.newCount;
          let reviewCount = prevUsage.reviewCount;

          if (prevSRS.state === 'new') {
            newCount++;
          } else if (prevSRS.state === 'review') {
            reviewCount++;
          }

          const nextUsage: DailyUsage = {
            studyDay: currentDayKey,
            newCount,
            reviewCount,
          };

          // 3. Registrar en el historial de repasos
          const logEntry: ReviewLogEntry = {
            id: defaultReviewIdGenerator(),
            cardId: currentCardId,
            deckId,
            rating,
            at: currentTime,
            prevInterval: prevSRS.interval,
            newInterval: nextSRS.interval,
            ease: nextSRS.ease,
            prevState: prevSRS.state,
            nextState: nextSRS.state,
          };
          const nextHistory = [logEntry, ...state.history].slice(0, 5000);

          // 4. Gestión de cola de la sesión activa
          const nextQueue = [...session.queue];
          if (rating === 'again') {
            // Reencolar al final de la sesión para volver a practicarla (§6.3)
            nextQueue.push(currentCardId);
          }

          const nextIndex = session.currentIndex + 1;

          if (nextIndex < nextQueue.length) {
            const nextCardId = nextQueue[nextIndex] ?? null;
            const updatedCounts = getStudyQueueCounts(deck, deckSRS, currentTime, nextUsage);

            set({
              cardsSRS: {
                ...state.cardsSRS,
                [deckId]: deckSRS,
              },
              dailyUsage: {
                ...state.dailyUsage,
                [deckId]: nextUsage,
              },
              history: nextHistory,
              session: {
                ...session,
                queue: nextQueue,
                currentIndex: nextIndex,
                currentCardId: nextCardId,
                isAnswerRevealed: false,
                cardStartTime: currentTime,
                counts: updatedCounts,
              },
            });
          } else {
            // Sesión completada
            set({
              cardsSRS: {
                ...state.cardsSRS,
                [deckId]: deckSRS,
              },
              dailyUsage: {
                ...state.dailyUsage,
                [deckId]: nextUsage,
              },
              history: nextHistory,
              session: null,
            });
          }
        },

        endSession: (): void => {
          set({ session: null });
        },

        resetDeckProgress: (deckId: string): void => {
          set((state) => {
            const nextSRS = { ...state.cardsSRS, [deckId]: {} };
            const nextUsage = { ...state.dailyUsage };
            delete nextUsage[deckId];
            return {
              cardsSRS: nextSRS,
              dailyUsage: nextUsage,
            };
          });
        },

        exportData: (): string => {
          const state = get();
          const payload: PersistedDecksState = {
            version: DECKS_STORAGE_VERSION,
            decks: state.decks,
            activeDeckId: state.activeDeckId,
            cardsSRS: state.cardsSRS,
            dailyUsage: state.dailyUsage,
            history: state.history,
          };
          return JSON.stringify(payload, null, 2);
        },

        importData: (jsonOrObj: string | unknown): boolean => {
          try {
            let data: unknown = jsonOrObj;
            if (typeof jsonOrObj === 'string') {
              data = JSON.parse(jsonOrObj);
            }

            if (!data || typeof data !== 'object') {
              return false;
            }

            // Soporta exportación directa o empaquetada bajo 'decks'
            const root =
              'decks' in data && data.decks && typeof data.decks === 'object' && !Array.isArray(data.decks)
                ? (data as { decks: unknown }).decks
                : data;

            if (!root || typeof root !== 'object') {
              return false;
            }

            const candidate = root as Partial<PersistedDecksState>;

            if (!Array.isArray(candidate.decks)) {
              return false;
            }

            const validatedDecks: Deck[] = [];
            for (const d of candidate.decks) {
              if (
                d &&
                typeof d === 'object' &&
                typeof d.id === 'string' &&
                typeof d.name === 'string' &&
                Array.isArray(d.cardIds)
              ) {
                validatedDecks.push({
                  id: d.id,
                  name: d.name,
                  description: typeof d.description === 'string' ? d.description : undefined,
                  sources: Array.isArray(d.sources) ? d.sources : [],
                  cardIds: d.cardIds.filter((c: unknown) => typeof c === 'string'),
                  limits: {
                    newPerDay: Number(d.limits?.newPerDay) || DEFAULT_DECK_LIMITS.newPerDay,
                    reviewsPerDay:
                      Number(d.limits?.reviewsPerDay) || DEFAULT_DECK_LIMITS.reviewsPerDay,
                  },
                  createdAt: Number(d.createdAt) || now(),
                });
              }
            }

            if (validatedDecks.length === 0) {
              return false;
            }

            const cardsSRS: Record<string, Record<string, CardSRS>> = {};
            if (candidate.cardsSRS && typeof candidate.cardsSRS === 'object') {
              for (const [deckId, deckCards] of Object.entries(candidate.cardsSRS)) {
                if (deckCards && typeof deckCards === 'object') {
                  cardsSRS[deckId] = {};
                  for (const [cardId, srs] of Object.entries(deckCards)) {
                    if (srs && typeof srs === 'object' && typeof srs.state === 'string') {
                      cardsSRS[deckId][cardId] = srs as CardSRS;
                    }
                  }
                }
              }
            }

            const dailyUsage: Record<string, DailyUsage> = {};
            if (candidate.dailyUsage && typeof candidate.dailyUsage === 'object') {
              for (const [deckId, usage] of Object.entries(candidate.dailyUsage)) {
                if (
                  usage &&
                  typeof usage === 'object' &&
                  typeof usage.studyDay === 'string'
                ) {
                  dailyUsage[deckId] = {
                    studyDay: usage.studyDay,
                    newCount: Number(usage.newCount) || 0,
                    reviewCount: Number(usage.reviewCount) || 0,
                  };
                }
              }
            }

            const history: ReviewLogEntry[] = [];
            if (Array.isArray(candidate.history)) {
              for (const h of candidate.history) {
                if (
                  h &&
                  typeof h === 'object' &&
                  typeof h.cardId === 'string' &&
                  typeof h.deckId === 'string'
                ) {
                  history.push(h as ReviewLogEntry);
                }
              }
            }

            const activeDeckId =
              typeof candidate.activeDeckId === 'string' &&
              validatedDecks.some((d) => d.id === candidate.activeDeckId)
                ? candidate.activeDeckId
                : validatedDecks[0]?.id ?? null;

            set({
              decks: validatedDecks,
              activeDeckId,
              cardsSRS,
              dailyUsage,
              history: history.slice(0, 5000),
              session: null,
            });

            return true;
          } catch {
            return false;
          }
        },

        resetAll: (): void => {
          set(initialDecksState({}, now()));
        },
      }),
      {
        name: storageName,
        version: DECKS_STORAGE_VERSION,
        storage: createJSONStorage(() => storage),
        migrate: (persistedState: unknown, version: number): PersistedDecksState => {
          // Si proviene de versión 0 o datos anteriores, elevar a versión 1 de forma segura
          if (version < 1 || !persistedState || typeof persistedState !== 'object') {
            const initial = initialDecksState({}, now());
            return {
              version: 1,
              decks: initial.decks,
              activeDeckId: initial.activeDeckId,
              cardsSRS: initial.cardsSRS,
              dailyUsage: initial.dailyUsage,
              history: initial.history,
            };
          }
          return persistedState as PersistedDecksState;
        },
        partialize: (state): PersistedDecksState => ({
          version: 1,
          decks: state.decks,
          activeDeckId: state.activeDeckId,
          cardsSRS: state.cardsSRS,
          dailyUsage: state.dailyUsage,
          history: state.history,
        }),
        merge: (persistedState, currentState): DecksStore => {
          if (!persistedState || typeof persistedState !== 'object') {
            return currentState;
          }

          const p = persistedState as Partial<PersistedDecksState>;

          // Saneamiento de mazos persistidos con tolerancia a datos corruptos (Criterio m)
          const validatedDecks: Deck[] = [];
          if (Array.isArray(p.decks)) {
            for (const d of p.decks) {
              if (
                d &&
                typeof d === 'object' &&
                typeof d.id === 'string' &&
                typeof d.name === 'string' &&
                Array.isArray(d.cardIds)
              ) {
                validatedDecks.push({
                  id: d.id,
                  name: d.name,
                  description: typeof d.description === 'string' ? d.description : undefined,
                  sources: Array.isArray(d.sources) ? d.sources : [],
                  cardIds: d.cardIds.filter((c: unknown) => typeof c === 'string'),
                  limits: {
                    newPerDay: Number(d.limits?.newPerDay) || DEFAULT_DECK_LIMITS.newPerDay,
                    reviewsPerDay:
                      Number(d.limits?.reviewsPerDay) || DEFAULT_DECK_LIMITS.reviewsPerDay,
                  },
                  createdAt: Number(d.createdAt) || now(),
                });
              }
            }
          }

          const finalDecks = validatedDecks.length > 0 ? validatedDecks : currentState.decks;

          const cardsSRS: Record<string, Record<string, CardSRS>> = {};
          if (p.cardsSRS && typeof p.cardsSRS === 'object') {
            for (const [deckId, deckCards] of Object.entries(p.cardsSRS)) {
              if (deckCards && typeof deckCards === 'object') {
                cardsSRS[deckId] = {};
                for (const [cardId, srs] of Object.entries(deckCards)) {
                  if (srs && typeof srs === 'object' && typeof srs.state === 'string') {
                    cardsSRS[deckId][cardId] = srs as CardSRS;
                  }
                }
              }
            }
          }

          const dailyUsage: Record<string, DailyUsage> = {};
          if (p.dailyUsage && typeof p.dailyUsage === 'object') {
            for (const [deckId, usage] of Object.entries(p.dailyUsage)) {
              if (
                usage &&
                typeof usage === 'object' &&
                typeof usage.studyDay === 'string'
              ) {
                dailyUsage[deckId] = {
                  studyDay: usage.studyDay,
                  newCount: Number(usage.newCount) || 0,
                  reviewCount: Number(usage.reviewCount) || 0,
                };
              }
            }
          }

          const history: ReviewLogEntry[] = [];
          if (Array.isArray(p.history)) {
            for (const h of p.history) {
              if (
                h &&
                typeof h === 'object' &&
                typeof h.cardId === 'string' &&
                typeof h.deckId === 'string'
              ) {
                history.push(h as ReviewLogEntry);
              }
            }
          }

          const activeDeckId =
            typeof p.activeDeckId === 'string' &&
            finalDecks.some((d) => d.id === p.activeDeckId)
              ? p.activeDeckId
              : finalDecks[0]?.id ?? null;

          return {
            ...currentState,
            decks: finalDecks,
            activeDeckId,
            cardsSRS,
            dailyUsage,
            history: history.slice(0, 5000),
            // Las sesiones siempre arrancan limpias tras recargar el navegador
            session: null,
          };
        },
      },
    ),
  );
}

/** Store singleton para la aplicación. */
export const decksStore = createDecksStore();
