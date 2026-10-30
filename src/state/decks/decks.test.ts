import { describe, expect, it } from 'vitest';
import {
  INTERMEDIATE_PRESET,
  ADVANCED_PRESET,
} from '../../learning/cards/presets';
import type { DeckSource } from '../../learning/cards/types';
import { createMemoryStorage } from '../settings';
import {
  createDecksStore,
  DECKS_STORAGE_VERSION,
  selectActiveDeck,
  selectCurrentCardResolved,
  selectDeckById,
  selectDeckQueueCounts,
  selectDeckSRS,
  selectDeckStats,
  selectGlobalStats,
  selectIntervalPreviewsForCard,
  selectIntervalPreviewsForCurrentCard,
} from './index';

describe('Hito A5 — Estado de mazos y progreso (state/decks)', () => {
  // ==========================================================================
  // 1. CRUD de Mazos y Selección (§6.2)
  // ==========================================================================

  describe('CRUD de mazos', () => {
    it('inicia por defecto con el mazo Principiante activo y con tarjetas materializadas', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:init' });
      const state = store.getState();

      expect(state.decks).toHaveLength(1);
      expect(state.decks[0]!.name).toBe('Principiante');
      expect(state.decks[0]!.cardIds.length).toBeGreaterThan(0);
      expect(state.activeDeckId).toBe(state.decks[0]!.id);
      expect(state.session).toBeNull();
    });

    it('crea un nuevo mazo con reglas declarativas y materializa sus cardIds', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:crud-create' });

      const sources: DeckSource[] = [
        {
          type: 'intervals',
          semitones: [3, 4, 7], // m3, M3, P5
          facets: ['name>semitones', 'semitones>name'],
        },
      ];

      const created = store.getState().createDeck({
        name: 'Tríadas e intervalos',
        description: 'Mazo de prueba',
        sources,
        limits: { newPerDay: 15, reviewsPerDay: 100 },
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Tríadas e intervalos');
      expect(created.description).toBe('Mazo de prueba');
      expect(created.cardIds).toHaveLength(6); // 3 intervalos * 2 facetas
      expect(created.limits.newPerDay).toBe(15);
      expect(created.limits.reviewsPerDay).toBe(100);

      const state = store.getState();
      expect(state.decks).toHaveLength(2);
      expect(state.activeDeckId).toBe(created.id);
      expect(state.cardsSRS[created.id]).toEqual({});
    });

    it('actualiza el nombre, descripción y límites de un mazo', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:crud-update' });

      const deck = store.getState().decks[0]!;
      const updated = store.getState().updateDeck(deck.id, {
        name: 'Principiante Modificado',
        description: 'Nueva descripción',
        limits: { newPerDay: 30 },
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Principiante Modificado');
      expect(updated?.description).toBe('Nueva descripción');
      expect(updated?.limits.newPerDay).toBe(30);
      expect(updated?.limits.reviewsPerDay).toBe(deck.limits.reviewsPerDay); // conserva reviewsPerDay previo

      const state = store.getState();
      expect(state.decks[0]!.name).toBe('Principiante Modificado');
    });

    it('elimina un mazo y limpia sus estructuras de datos y sesión', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:crud-delete' });

      const deckToKeep = store.getState().decks[0]!;
      const deckToDelete = store.getState().createDeck({ name: 'Temporal' });

      store.getState().selectDeck(deckToDelete.id);
      store.getState().startSession(deckToDelete.id);
      expect(store.getState().session?.deckId).toBe(deckToDelete.id);

      const deleted = store.getState().deleteDeck(deckToDelete.id);
      expect(deleted).toBe(true);

      const state = store.getState();
      expect(state.decks).toHaveLength(1);
      expect(state.decks[0]!.id).toBe(deckToKeep.id);
      expect(state.activeDeckId).toBe(deckToKeep.id);
      expect(state.cardsSRS[deckToDelete.id]).toBeUndefined();
      expect(state.dailyUsage[deckToDelete.id]).toBeUndefined();
      expect(state.session).toBeNull();
    });

    it('duplica un mazo existente con nuevo ID y progreso independiente a cero', () => {
      const storage = createMemoryStorage();
      const clock = 1000;
      const store = createDecksStore({
        storage,
        storageName: 'test:crud-dup',
        now: () => clock,
      });

      const original = store.getState().decks[0]!;
      store.getState().startSession(original.id);
      store.getState().rateCard('good'); // adquiere progreso

      const copy = store.getState().duplicateDeck(original.id, 'Copia de Principiante');
      expect(copy).not.toBeNull();
      expect(copy?.id).not.toBe(original.id);
      expect(copy?.name).toBe('Copia de Principiante');
      expect(copy?.cardIds).toEqual(original.cardIds);

      const state = store.getState();
      // El original tiene una tarjeta repasada
      expect(Object.keys(state.cardsSRS[original.id] ?? {}).length).toBe(1);
      // La copia arranca con progreso limpio
      expect(state.cardsSRS[copy!.id]).toEqual({});
    });
  });

  // ==========================================================================
  // 2. Mazos Predefinidos (Criterio l)
  // ==========================================================================

  describe('Criterio (l) — Mazos predefinidos (Principiante, Intermedio, Avanzado)', () => {
    it('añadir un predefinido crea una copia editable e independiente con su propio progreso', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:presets' });

      const intermediateDeck = store.getState().addPresetDeck('intermediate');
      const advancedDeck = store.getState().addPresetDeck('advanced');

      expect(intermediateDeck.name).toBe(INTERMEDIATE_PRESET.name);
      expect(intermediateDeck.cardIds.length).toBeGreaterThan(100);
      expect(advancedDeck.name).toBe(ADVANCED_PRESET.name);
      expect(advancedDeck.cardIds.length).toBeGreaterThan(500);

      const state = store.getState();
      expect(state.decks).toHaveLength(3); // Principiante (default) + Intermedio + Avanzado
      expect(state.activeDeckId).toBe(advancedDeck.id);

      // Editar la copia no afecta a los datos de la plantilla ni a los otros mazos
      store.getState().updateDeck(intermediateDeck.id, {
        name: 'Mi Intermedio Personalizado',
      });
      expect(store.getState().decks.find((d) => d.id === intermediateDeck.id)?.name).toBe(
        'Mi Intermedio Personalizado',
      );
    });
  });

  // ==========================================================================
  // 3. Estado SRS por Mazo y Regenerar Reglas (Criterio j)
  // ==========================================================================

  describe('Criterio (j) — Planificación independiente por mazo y conservación de progreso al editar', () => {
    it('una misma tarjeta en dos mazos distintos se planifica por separado sin interferencias', () => {
      const storage = createMemoryStorage();
      const clock = 1000000;
      const store = createDecksStore({
        storage,
        storageName: 'test:criterion-j-separate',
        now: () => clock,
      });

      // Crear dos mazos que comparten la misma regla de intervalos
      const sharedSource: DeckSource[] = [
        {
          type: 'intervals',
          semitones: [4], // M3
          facets: ['name>semitones'],
        },
      ];

      const deckA = store.getState().createDeck({ name: 'Mazo A', sources: sharedSource });
      const deckB = store.getState().createDeck({ name: 'Mazo B', sources: sharedSource });

      const cardId = deckA.cardIds[0]!;
      expect(deckB.cardIds[0]).toBe(cardId);

      // Iniciar sesión y valorar en Mazo A como 'good' (pasa a 10 min)
      store.getState().startSession(deckA.id);
      expect(store.getState().session?.currentCardId).toBe(cardId);
      store.getState().rateCard('good');

      const stateAfterA = store.getState();
      const srsA = stateAfterA.cardsSRS[deckA.id]?.[cardId];
      expect(srsA).toBeDefined();
      expect(srsA?.state).toBe('learning');
      expect(srsA?.stepIndex).toBe(1);
      expect(srsA?.due).toBe(clock + 10 * 60 * 1000); // 10 min

      // En Mazo B, la tarjeta debe permanecer virgen ('new' o sin registrar)
      const srsB = stateAfterA.cardsSRS[deckB.id]?.[cardId];
      expect(srsB).toBeUndefined();

      const countsB = selectDeckQueueCounts(stateAfterA, deckB.id, clock);
      expect(countsB.newCount).toBe(1);
      expect(countsB.learningCount).toBe(0);
    });

    it('al editar las reglas de un mazo, las tarjetas que continúan conservan su estado SRS intacto', () => {
      const storage = createMemoryStorage();
      const clock = 5000000;
      const store = createDecksStore({
        storage,
        storageName: 'test:criterion-j-preserve-edit',
        now: () => clock,
      });

      // Mazo inicial con m3 y M3
      const initialSources: DeckSource[] = [
        {
          type: 'intervals',
          semitones: [3, 4],
          facets: ['name>semitones'],
        },
      ];

      const deck = store.getState().createDeck({ name: 'Intervalos M3 y m3', sources: initialSources });
      const cardM3 = 'interval:4|name>semitones';
      const cardm3 = 'interval:3|name>semitones';

      // Estudiar y graduar cardM3 a repaso (4 d con 'easy')
      store.getState().startSession(deck.id);
      if (store.getState().session?.currentCardId !== cardM3) {
        // Asegurar que valoramos cardM3
        store.getState().rateCard('good');
      }
      store.getState().rateCard('easy');

      const srsBeforeEdit = store.getState().cardsSRS[deck.id]?.[cardM3];
      expect(srsBeforeEdit).toBeDefined();
      expect(srsBeforeEdit?.state).toBe('review');
      expect(srsBeforeEdit?.interval).toBe(4);
      const originalDue = srsBeforeEdit?.due;
      const originalEase = srsBeforeEdit?.ease;

      // Editar las reglas del mazo: cambiamos m3 por P5, pero conservamos M3
      const newSources: DeckSource[] = [
        {
          type: 'intervals',
          semitones: [4, 7], // M3 y P5
          facets: ['name>semitones'],
        },
      ];

      const updated = store.getState().updateDeck(deck.id, { sources: newSources });
      expect(updated?.cardIds).toContain(cardM3);
      expect(updated?.cardIds).toContain('interval:7|name>semitones');
      expect(updated?.cardIds).not.toContain(cardm3);

      // Comprobar que cardM3 conserva su estado SRS íntegro
      const srsAfterEdit = store.getState().cardsSRS[deck.id]?.[cardM3];
      expect(srsAfterEdit).toBeDefined();
      expect(srsAfterEdit?.state).toBe('review');
      expect(srsAfterEdit?.interval).toBe(4);
      expect(srsAfterEdit?.due).toBe(originalDue);
      expect(srsAfterEdit?.ease).toBe(originalEase);
      expect(srsAfterEdit?.reps).toBe(srsBeforeEdit?.reps);

      // Las tarjetas retiradas no se borran del diccionario histórico de SRS
      expect(store.getState().cardsSRS[deck.id]?.[cardm3]).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. Límite de Nuevas y Reinicio a las 04:00 (Criterio k)
  // ==========================================================================

  describe('Criterio (k) — Límite de 20 nuevas al día y corte diario a las 04:00 hora local', () => {
    it('no presenta más de 20 tarjetas nuevas en un mismo día y renueva el cupo a las 04:00', () => {
      const storage = createMemoryStorage();

      // Fijar hora: 2026-10-30 a las 14:00 hora local
      let currentClock = new Date(2026, 9, 30, 14, 0, 0, 0).getTime();
      const store = createDecksStore({
        storage,
        storageName: 'test:criterion-k',
        now: () => currentClock,
      });

      // Usar mazo Principiante que tiene cientos de tarjetas
      const deck = store.getState().decks[0]!;
      expect(deck.limits.newPerDay).toBe(20);

      // Iniciar sesión y estudiar exactamente 20 tarjetas nuevas valorando 'good'
      store.getState().startSession(deck.id);

      for (let i = 0; i < 20; i++) {
        const session = store.getState().session;
        expect(session).not.toBeNull();
        store.getState().rateCard('good');
      }

      // El cupo de nuevas para hoy (2026-10-30) debe estar agotado
      const countsAfter20 = selectDeckQueueCounts(store.getState(), deck.id, currentClock);
      expect(countsAfter20.newCount).toBe(0);

      // Si intentamos iniciar otra sesión ese mismo día a las 22:00, no hay nuevas disponibles
      currentClock = new Date(2026, 9, 30, 22, 0, 0, 0).getTime();
      const countsLateNight = selectDeckQueueCounts(store.getState(), deck.id, currentClock);
      expect(countsLateNight.newCount).toBe(0);

      // A las 03:59:59 del día siguiente, aún pertenece al día de estudio previo
      currentClock = new Date(2026, 9, 31, 3, 59, 59, 0).getTime();
      const countsBeforeCutoff = selectDeckQueueCounts(store.getState(), deck.id, currentClock);
      expect(countsBeforeCutoff.newCount).toBe(0);

      // A las 04:00:00 exactas, el día avanza y el cupo de 20 nuevas se renueva automáticamente
      currentClock = new Date(2026, 9, 31, 4, 0, 0, 0).getTime();
      const countsAfterCutoff = selectDeckQueueCounts(store.getState(), deck.id, currentClock);
      expect(countsAfterCutoff.newCount).toBe(20);
    });
  });

  // ==========================================================================
  // 5. Persistencia, Recarga, Exportar/Importar y Corrupción (Criterio m)
  // ==========================================================================

  describe('Criterio (m) — Persistencia tras recarga, exportar/importar y tolerancia a datos corruptos', () => {
    it('tras recargar se conservan los mazos, el estado SRS, el historial y el uso diario', () => {
      const storage = createMemoryStorage();
      const clock = 2000000;
      const storageName = 'test:criterion-m-reload';

      // 1. Sesión inicial: crear mazo, estudiar tarjetas y acumular historial
      const store1 = createDecksStore({
        storage,
        storageName,
        now: () => clock,
      });

      const customDeck = store1.getState().createDeck({
        name: 'Mazo Persistente',
        sources: [
          {
            type: 'intervals',
            semitones: [1, 2, 3],
            facets: ['name>semitones'],
          },
        ],
      });

      store1.getState().startSession(customDeck.id);
      store1.getState().revealAnswer();
      store1.getState().rateCard('good');
      store1.getState().rateCard('easy');

      const srs1 = store1.getState().cardsSRS[customDeck.id];
      const history1 = store1.getState().history;
      expect(history1).toHaveLength(2);

      // 2. Simular recarga del navegador montando un nuevo store sobre el mismo storage
      const store2 = createDecksStore({
        storage,
        storageName,
        now: () => clock,
      });

      const state2 = store2.getState();
      expect(state2.decks).toHaveLength(2);
      expect(state2.decks.find((d) => d.id === customDeck.id)?.name).toBe('Mazo Persistente');
      expect(state2.cardsSRS[customDeck.id]).toEqual(srs1);
      expect(state2.history).toHaveLength(2);
      expect(state2.history[0]!.cardId).toBe(history1[0]!.cardId);
      // La sesión activa siempre arranca limpia (null) para evitar estados huérfanos
      expect(state2.session).toBeNull();
    });

    it('exportar y volver a importar genera un estado idéntico (ida y vuelta)', () => {
      const storageA = createMemoryStorage();
      const storageB = createMemoryStorage();
      const clock = 3000000;

      const storeA = createDecksStore({
        storage: storageA,
        storageName: 'test:export-a',
        now: () => clock,
      });

      const deck = storeA.getState().addPresetDeck('intermediate');
      storeA.getState().startSession(deck.id);
      storeA.getState().rateCard('again');
      storeA.getState().rateCard('good');

      const exportedJson = storeA.getState().exportData();
      expect(typeof exportedJson).toBe('string');

      const parsed = JSON.parse(exportedJson);
      expect(parsed.version).toBe(DECKS_STORAGE_VERSION);
      expect(parsed.decks.length).toBe(2);

      // Importar en un store B virgen
      const storeB = createDecksStore({
        storage: storageB,
        storageName: 'test:import-b',
        now: () => clock,
      });

      const success = storeB.getState().importData(exportedJson);
      expect(success).toBe(true);

      const stateA = storeA.getState();
      const stateB = storeB.getState();

      expect(stateB.decks).toEqual(stateA.decks);
      expect(stateB.cardsSRS).toEqual(stateA.cardsSRS);
      expect(stateB.dailyUsage).toEqual(stateA.dailyUsage);
      expect(stateB.history).toEqual(stateA.history);
      expect(stateB.activeDeckId).toBe(stateA.activeDeckId);
    });

    it('aplica valores de reserva seguros ante almacenamiento corrupto sin lanzar excepciones', () => {
      const storage = createMemoryStorage();
      const storageName = 'test:corrupt-storage';

      // Insertar JSON corrupto en el almacenamiento
      storage.setItem(
        storageName,
        JSON.stringify({
          state: {
            version: 1,
            decks: 'esto no es un array',
            cardsSRS: null,
            dailyUsage: 42,
            history: [{ malformed: true }],
            activeDeckId: 123,
          },
          version: DECKS_STORAGE_VERSION,
        }),
      );

      // Debe instanciarse sin fallos usando los valores por defecto seguros
      const store = createDecksStore({ storage, storageName });
      const state = store.getState();

      expect(state.decks).toHaveLength(1);
      expect(state.decks[0]!.name).toBe('Principiante');
      expect(state.cardsSRS).toBeDefined();
      expect(state.history).toEqual([]);
      expect(state.session).toBeNull();
    });

    it('importData devuelve false de manera segura ante JSON inválido o esquema corrupto', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:bad-import' });

      expect(store.getState().importData('esto no es un json')).toBe(false);
      expect(store.getState().importData(null)).toBe(false);
      expect(store.getState().importData({ decks: 'invalido' })).toBe(false);
      expect(store.getState().importData({ decks: [] })).toBe(false); // lista vacía rechazada
    });
  });

  // ==========================================================================
  // 6. Flujo de Sesión de Estudio y Selectores (§5.3, §7.3)
  // ==========================================================================

  describe('Sesión de estudio y selectores de progreso', () => {
    it('gestiona el flujo completo de estudio: mostrar respuesta, valorar y reencolar en Otra vez', () => {
      const storage = createMemoryStorage();
      const clock = 1000;
      const store = createDecksStore({
        storage,
        storageName: 'test:study-flow',
        now: () => clock,
      });

      const singleCardDeck = store.getState().createDeck({
        name: 'Mazo 1 Tarjeta',
        sources: [
          {
            type: 'intervals',
            semitones: [5], // P4
            facets: ['name>semitones'],
          },
        ],
      });

      store.getState().startSession(singleCardDeck.id);
      const session = store.getState().session;
      expect(session).not.toBeNull();
      expect(session?.isAnswerRevealed).toBe(false);

      // 1. Resolver la tarjeta actual
      const resolved = selectCurrentCardResolved(store.getState());
      expect(resolved).not.toBeNull();
      expect(resolved?.front.title).toBeDefined();

      // 2. Vista previa de intervalos para los 4 botones
      const previews = selectIntervalPreviewsForCurrentCard(store.getState(), clock);
      expect(previews).not.toBeNull();
      expect(previews?.again.text).toBe('1 min');
      expect(previews?.good.text).toBe('10 min');

      // 3. Revelar respuesta
      store.getState().revealAnswer();
      expect(store.getState().session?.isAnswerRevealed).toBe(true);

      // 4. Valorar con 'again' → reencola al final de la sesión
      store.getState().rateCard('again');

      const sessionAfterAgain = store.getState().session;
      expect(sessionAfterAgain).not.toBeNull();
      // La cola ahora tiene 2 elementos: [cardId, cardId] y estamos en el segundo (índice 1)
      expect(sessionAfterAgain?.queue).toHaveLength(2);
      expect(sessionAfterAgain?.currentIndex).toBe(1);
      expect(sessionAfterAgain?.isAnswerRevealed).toBe(false);

      // 5. Segunda pasada: valorar con 'good' → la tarjeta se aprueba y la sesión finaliza
      store.getState().revealAnswer();
      store.getState().rateCard('good');

      expect(store.getState().session).toBeNull();
      expect(store.getState().history).toHaveLength(2);
    });

    it('calcula las estadísticas de mazo y consolidadas para Progreso (§7.3)', () => {
      const storage = createMemoryStorage();
      const clock = 5000;
      const store = createDecksStore({
        storage,
        storageName: 'test:progress-stats',
        now: () => clock,
      });

      const deck = store.getState().decks[0]!;
      store.getState().startSession(deck.id);

      // 3 repasos: 2 aciertos y 1 fallo (again)
      store.getState().rateCard('good');
      store.getState().rateCard('easy');
      store.getState().rateCard('again');

      const deckStats = selectDeckStats(store.getState(), deck.id, clock);
      expect(deckStats.total).toBe(deck.cardIds.length);
      // 2 aprobadas de 3 → 67 %
      expect(deckStats.retentionRate).toBe(67);

      const globalStats = selectGlobalStats(store.getState(), clock);
      expect(globalStats.totalRepasos).toBe(3);
      expect(globalStats.retención).toBe(67);
      expect(globalStats.enAprendizaje).toBeGreaterThanOrEqual(1);
      expect(globalStats.nuevas).toBeGreaterThan(0);
    });

    it('selectores individuales devuelven los valores correctos', () => {
      const storage = createMemoryStorage();
      const store = createDecksStore({ storage, storageName: 'test:individual-selectors' });
      const state = store.getState();

      const active = selectActiveDeck(state);
      expect(active?.id).toBe(state.activeDeckId);

      const found = selectDeckById(state, state.decks[0]!.id);
      expect(found?.name).toBe('Principiante');

      const srs = selectDeckSRS(state, state.decks[0]!.id);
      expect(typeof srs).toBe('object');

      const previews = selectIntervalPreviewsForCard(
        state,
        state.decks[0]!.id,
        state.decks[0]!.cardIds[0]!,
        1000,
      );
      expect(previews.good.text).toBe('10 min');
    });
  });
});
