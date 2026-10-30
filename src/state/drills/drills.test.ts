import { describe, expect, it } from 'vitest';
import type { FretPosition } from '../../theory';
import { createMemoryStorage } from '../settings';
import {
  createDrillsStore,
  defaultDrillConfig,
  DRILLS_STORAGE_VERSION,
  selectDrillFretboardMarks,
  selectDrillPianoMarks,
  selectFretboardAccuracyMap,
  selectRecentSessionEvolution,
  selectWeakIntervals,
  type DrillsState,
} from './index';

function createTestDrills(options: { seed?: number; now?: () => number } = {}) {
  const storage = createMemoryStorage();
  let fakeTime = 1000000;
  const now = options.now ?? (() => fakeTime);

  const store = createDrillsStore({
    storage,
    storageName: 'test:drills',
    seed: options.seed ?? 42,
    now,
  });

  return {
    store,
    storage,
    advanceTime: (ms: number) => {
      fakeTime += ms;
    },
    get: () => store.getState(),
    setState: (partial: Partial<DrillsState>) => store.setState(partial),
  };
}

describe('Hito A4 — Estado de ejercicios (state/drills)', () => {
  describe('Ciclo de vida de la sesión (configurar → preguntar → responder → corregir → resumen)', () => {
    it('inicia en fase configuring y startSession transiciona a question', () => {
      const { get } = createTestDrills();
      expect(get().phase).toBe('configuring');
      expect(get().currentQuestion).toBeNull();

      get().startSession('B1');
      expect(get().phase).toBe('question');
      expect(get().drillId).toBe('B1');
      expect(get().currentQuestion).not.toBeNull();
      expect(get().questionNumber).toBe(1);
      expect(get().totalQuestions).toBe(20);
    });

    it('en ejercicios de selección múltiple, togglePosition cambia a answering y acumula posiciones', () => {
      const { get } = createTestDrills();
      // B4 es modo 'all' (selección múltiple)
      get().startSession('B4');
      expect(get().phase).toBe('question');

      const pos1: FretPosition = { string: 5, fret: 3 };
      get().togglePosition(pos1);
      expect(get().phase).toBe('answering');
      expect(get().pinnedPositions).toEqual([pos1]);

      // Alternar la misma posición la quita
      get().togglePosition(pos1);
      expect(get().pinnedPositions).toEqual([]);
    });

    it('submitAnswer / checkAnswer evalúa y transiciona a corrected', () => {
      const { get } = createTestDrills();
      get().startSession('B1');
      expect(get().phase).toBe('question');

      const q = get().currentQuestion!;
      // Enviamos una respuesta
      get().submitAnswer({ kind: 'positions', positions: [{ string: 5, fret: 7 }] });

      expect(get().phase).toBe('corrected');
      expect(get().lastGrade).not.toBeNull();
      expect(get().sessionStats.questionsAnswered).toBe(1);
      // Registra estadísticas por itemKey
      expect(get().itemStats[q.itemKey]).toBeDefined();
      expect(get().itemStats[q.itemKey]!.attempts).toBe(1);
    });

    it('nextQuestion avanza a la siguiente pregunta mientras questionNumber < totalQuestions', () => {
      const { get } = createTestDrills();
      get().startSession('B1', {}, 3); // sesión corta de 3 preguntas

      expect(get().questionNumber).toBe(1);
      get().submitAnswer({ kind: 'positions', positions: [{ string: 1, fret: 0 }] });
      expect(get().phase).toBe('corrected');

      get().nextQuestion();
      expect(get().phase).toBe('question');
      expect(get().questionNumber).toBe(2);
      expect(get().lastGrade).toBeNull();
    });

    it('al completar la última pregunta, nextQuestion transiciona a summary y guarda en el historial', () => {
      const { get } = createTestDrills();
      get().startSession('B1', {}, 2); // 2 preguntas

      // Pregunta 1
      get().submitAnswer({ kind: 'positions', positions: [] });
      get().nextQuestion();

      // Pregunta 2
      get().submitAnswer({ kind: 'positions', positions: [] });
      get().nextQuestion();

      expect(get().phase).toBe('summary');
      expect(get().currentQuestion).toBeNull();
      expect(get().history).toHaveLength(1);
      expect(get().history[0]!.drillId).toBe('B1');
      expect(get().history[0]!.totalQuestions).toBe(2);
    });

    it('restartSession vuelve a comenzar la sesión conservando configuración', () => {
      const { get } = createTestDrills();
      get().startSession('A1', { fretRange: [0, 5] }, 10);
      get().submitAnswer({ kind: 'positions', positions: [] });
      get().restartSession();

      expect(get().phase).toBe('question');
      expect(get().questionNumber).toBe(1);
      expect(get().totalQuestions).toBe(10);
      expect(get().config.fretRange).toEqual([0, 5]);
      expect(get().sessionStats.questionsAnswered).toBe(0);
    });

    it('endSession regresa inmediatamente a configuring', () => {
      const { get } = createTestDrills();
      get().startSession('A1');
      get().endSession();

      expect(get().phase).toBe('configuring');
      expect(get().currentQuestion).toBeNull();
    });
  });

  describe('Criterio (d) — B1 en afinación estándar con evaluación e inspectores', () => {
    it('referencia (5, 3) = C3 + M3 ascendente en la misma cuerda → la única respuesta correcta es (5, 7) = E3. Marcar (4, 2) se corrige como incorrecto', () => {
      const { get, setState } = createTestDrills();
      get().startSession('B1');

      // Inyectamos manualmente una pregunta B1 determinista para validar el criterio (d) exacto
      const refPos: FretPosition = { string: 5, fret: 3 };
      const expectedTarget: FretPosition = { string: 5, fret: 7 };

      setState({
        currentQuestion: {
          id: 'test-b1-d',
          drill: 'B1',
          itemKey: 'interval:M3|string:5',
          prompt: {
            referencePosition: refPos,
            referenceNoteName: 'C',
            direction: 'ascending',
            intervalSemitones: 4,
            intervalName: 'M3',
            intervalLongName: '3ª mayor',
            title: 'Desde C, sube una 3ª mayor en la misma cuerda',
            eyebrow: 'B1 · INTERVALO EN UNA CUERDA',
          },
          answerKind: 'positions',
          expected: {
            kind: 'positions',
            positions: [expectedTarget],
          },
          mode: 'first',
        },
        phase: 'question',
      });

      // 1. Caso respuesta incorrecta: el usuario marca (4, 2) (también es E3, pero en la cuerda 4)
      const wrongPos: FretPosition = { string: 4, fret: 2 };
      get().submitAnswer({ kind: 'positions', positions: [wrongPos] });

      expect(get().phase).toBe('corrected');
      expect(get().lastGrade).not.toBeNull();
      expect(get().lastGrade!.correct).toBe(false);
      expect(get().lastGrade!.score).toBe(0);
      expect(get().lastGrade!.extras).toEqual([wrongPos]);
      expect(get().lastGrade!.misses).toEqual([expectedTarget]);

      // Comprobamos las marcas generadas en mástil y piano (Criterio n)
      const fretMarks = selectDrillFretboardMarks(get());
      const wrongMark = fretMarks.find((m) => m.string === 4 && m.fret === 2);
      const missedMark = fretMarks.find((m) => m.string === 5 && m.fret === 7);
      const questionMark = fretMarks.find((m) => m.string === 5 && m.fret === 3);

      expect(wrongMark).toBeDefined();
      expect(wrongMark!.role).toBe('wrong');

      expect(missedMark).toBeDefined();
      expect(missedMark!.role).toBe('missed');
      expect(missedMark!.label).toBe('M3');

      expect(questionMark).toBeDefined();
      expect(questionMark!.role).toBe('question');
      expect(questionMark!.isRoot).toBe(true);

      // 2. Caso respuesta correcta: marcar (5, 7) en la misma cuerda
      setState({ phase: 'question', lastGrade: null });
      get().submitAnswer({ kind: 'positions', positions: [expectedTarget] });

      expect(get().lastGrade!.correct).toBe(true);
      expect(get().lastGrade!.score).toBe(1);
      expect(get().lastGrade!.hits).toEqual([expectedTarget]);

      const correctFretMarks = selectDrillFretboardMarks(get());
      const correctMark = correctFretMarks.find((m) => m.string === 5 && m.fret === 7);
      expect(correctMark).toBeDefined();
      expect(correctMark!.role).toBe('correct');
      expect(correctMark!.label).toBe('M3');
    });
  });

  describe('Criterio (g) — B5 con voicing x-0-2-2-1-0 (Am abierto)', () => {
    it('las etiquetas correctas, de la cuerda 5 a la 1, son 1, 5, 1, ♭3, 5', () => {
      const { get, setState } = createTestDrills();
      get().startSession('B5');

      const expectedLabels = [
        { position: { string: 5 as const, fret: 0 }, degree: '1' as const, label: '1' },
        { position: { string: 4 as const, fret: 2 }, degree: '5' as const, label: '5' },
        { position: { string: 3 as const, fret: 2 }, degree: '1' as const, label: '1' },
        { position: { string: 2 as const, fret: 1 }, degree: '♭3' as const, label: '♭3' },
        { position: { string: 1 as const, fret: 0 }, degree: '5' as const, label: '5' },
      ];

      setState({
        currentQuestion: {
          id: 'test-b5-g',
          drill: 'B5',
          itemKey: 'voicing:open-Am',
          prompt: {
            voicingId: 'open-Am',
            chordName: 'Am',
            root: 9, // A
            positions: expectedLabels.map((l) => l.position),
            rootPosition: { string: 5, fret: 0 },
            title: 'Asigna el grado de cada nota del voicing de Am',
            eyebrow: 'B5 · ETIQUETA LA FORMA',
          },
          answerKind: 'labels',
          expected: {
            kind: 'labels',
            labels: expectedLabels,
          },
          mode: 'all',
        },
        phase: 'question',
      });

      // 1. Asignamos las etiquetas correctas de la cuerda 5 a la 1: 1, 5, 1, ♭3, 5
      for (const item of expectedLabels) {
        get().assignLabel(item.position, item.label);
      }
      expect(get().phase).toBe('answering');

      get().checkAnswer();
      expect(get().phase).toBe('corrected');
      expect(get().lastGrade!.correct).toBe(true);
      expect(get().lastGrade!.score).toBe(1);

      // Verificamos las marcas sobre el diapasón
      const marks = selectDrillFretboardMarks(get());
      const s5 = marks.find((m) => m.string === 5 && m.fret === 0);
      const s4 = marks.find((m) => m.string === 4 && m.fret === 2);
      const s3 = marks.find((m) => m.string === 3 && m.fret === 2);
      const s2 = marks.find((m) => m.string === 2 && m.fret === 1);
      const s1 = marks.find((m) => m.string === 1 && m.fret === 0);

      expect(s5?.label).toBe('1');
      expect(s5?.role).toBe('correct');
      expect(s4?.label).toBe('5');
      expect(s4?.role).toBe('correct');
      expect(s3?.label).toBe('1');
      expect(s3?.role).toBe('correct');
      expect(s2?.label).toBe('♭3');
      expect(s2?.role).toBe('correct');
      expect(s1?.label).toBe('5');
      expect(s1?.role).toBe('correct');
    });

    it('identifica y marca como wrong las etiquetas incorrectas en B5', () => {
      const { get, setState } = createTestDrills();
      get().startSession('B5');

      const expectedLabels = [
        { position: { string: 5 as const, fret: 0 }, degree: '1' as const, label: '1' },
        { position: { string: 2 as const, fret: 1 }, degree: '♭3' as const, label: '♭3' },
      ];

      setState({
        currentQuestion: {
          id: 'test-b5-wrong',
          drill: 'B5',
          itemKey: 'voicing:partial-Am',
          prompt: {
            voicingId: 'open-Am',
            chordName: 'Am',
            root: 9,
            positions: expectedLabels.map((l) => l.position),
            rootPosition: { string: 5, fret: 0 },
            title: 'Asigna el grado',
            eyebrow: 'B5',
          },
          answerKind: 'labels',
          expected: {
            kind: 'labels',
            labels: expectedLabels,
          },
          mode: 'all',
        },
        phase: 'question',
      });

      // El usuario asigna '3' (mayor) en vez de '♭3' (menor)
      get().assignLabel({ string: 5, fret: 0 }, '1');
      get().assignLabel({ string: 2, fret: 1 }, '3');
      get().checkAnswer();

      expect(get().lastGrade!.correct).toBe(false);
      const marks = selectDrillFretboardMarks(get());
      const s2 = marks.find((m) => m.string === 2 && m.fret === 1);
      expect(s2?.role).toBe('wrong');
      expect(s2?.label).toBe('3');
    });
  });

  describe('Criterio (n) — Selectores de marcas en mástil y piano con roles correct/wrong/missed y etiquetas de intervalo', () => {
    it('muestra roles question, correct, wrong y missed diferenciados con etiquetas respecto a la referencia', () => {
      const { get, setState } = createTestDrills();
      const refPos: FretPosition = { string: 6, fret: 3 }; // G2

      setState({
        currentQuestion: {
          id: 'test-drill-n',
          drill: 'B4',
          itemKey: 'interval:M3|root:6f3',
          prompt: {
            rootPosition: refPos,
            rootNoteName: 'G',
            degree: '3',
            intervalSemitones: 4,
            intervalName: 'M3',
            title: 'Marca todas las 3 alrededor de G',
            eyebrow: 'B4 · MAPA DE INTERVALOS',
          },
          answerKind: 'positions',
          expected: {
            kind: 'positions',
            positions: [
              { string: 6, fret: 7 }, // B2 (acertada)
              { string: 5, fret: 2 }, // B2 (olvidada / missed)
            ],
          },
          mode: 'all',
        },
        // El usuario marcó (6, 7) [acierto] y (6, 6) [error / extra]
        lastGrade: {
          correct: false,
          partial: true,
          score: 0.5,
          hits: [{ string: 6, fret: 7 }],
          misses: [{ string: 5, fret: 2 }],
          extras: [{ string: 6, fret: 6 }],
        },
        phase: 'corrected',
      });

      const fretMarks = selectDrillFretboardMarks(get());

      // Referencia G2 en (6, 3)
      const qMark = fretMarks.find((m) => m.string === 6 && m.fret === 3);
      expect(qMark).toBeDefined();
      expect(qMark!.role).toBe('question');
      expect(qMark!.label).toBe('1');

      // Acierto en (6, 7): B2, 4 semitonos -> 'M3'
      const hitMark = fretMarks.find((m) => m.string === 6 && m.fret === 7);
      expect(hitMark).toBeDefined();
      expect(hitMark!.role).toBe('correct');
      expect(hitMark!.label).toBe('M3');

      // Olvido en (5, 2): B2, 4 semitonos -> 'M3'
      const missMark = fretMarks.find((m) => m.string === 5 && m.fret === 2);
      expect(missMark).toBeDefined();
      expect(missMark!.role).toBe('missed');
      expect(missMark!.label).toBe('M3');

      // Error en (6, 6): B♭2, 3 semitonos -> 'm3'
      const wrongMark = fretMarks.find((m) => m.string === 6 && m.fret === 6);
      expect(wrongMark).toBeDefined();
      expect(wrongMark!.role).toBe('wrong');
      expect(wrongMark!.label).toBe('m3');

      // Proyección en el Piano: las marcas se trasladan linealmente tecla a tecla
      const pianoMarks = selectDrillPianoMarks(get());
      expect(pianoMarks.length).toBeGreaterThanOrEqual(3);

      // Tecla G2 (MIDI 43) -> role: question
      const keyG2 = pianoMarks.find((k) => k.midi === 43);
      expect(keyG2).toBeDefined();
      expect(keyG2!.role).toBe('question');

      // Tecla B♭2 (MIDI 46) -> role: wrong
      const keyBb2 = pianoMarks.find((k) => k.midi === 46);
      expect(keyBb2).toBeDefined();
      expect(keyBb2!.role).toBe('wrong');

      // Tecla B2 (MIDI 47): hay un acierto en (6, 7) y un olvido en (5, 2).
      // 'correct' tiene prioridad 9 frente a 'missed' (8).
      const keyB2 = pianoMarks.find((k) => k.midi === 47);
      expect(keyB2).toBeDefined();
      expect(keyB2!.role).toBe('correct');
      expect(keyB2!.label).toBe('M3');
    });

    it('respeta la opción labels: "note" devolviendo el nombre de la nota', () => {
      const { get, setState } = createTestDrills();
      setState({
        currentQuestion: {
          id: 'test-note-labels',
          drill: 'A1',
          itemKey: 'note:0',
          prompt: { pitchClass: 0, noteName: 'C', title: 'C', eyebrow: 'A1' },
          answerKind: 'positions',
          expected: { kind: 'positions', positions: [{ string: 5, fret: 3 }] },
          mode: 'all',
        },
        lastGrade: {
          correct: true,
          score: 1,
          hits: [{ string: 5, fret: 3 }],
          misses: [],
          extras: [],
        },
        phase: 'corrected',
      });

      const marks = selectDrillFretboardMarks(get(), { labels: 'note' });
      expect(marks[0]!.label).toBe('C');
    });
  });

  describe('Criterio (m) — Persistencia, exportar/importar y tolerancia a datos corruptos', () => {
    it('conserva estadísticas acumuladas e historial al simular recarga', () => {
      const storage = createMemoryStorage();
      const nowTime = 2000000;
      const now = () => nowTime;

      // 1. Sesión en la primera instancia del store
      const store1 = createDrillsStore({
        storage,
        storageName: 'persistent:drills',
        now,
      });

      store1.getState().startSession('A1', {}, 1);
      store1.getState().submitAnswer({ kind: 'positions', positions: [{ string: 5, fret: 3 }] });
      store1.getState().nextQuestion(); // termina la sesión y va a summary

      expect(store1.getState().history).toHaveLength(1);
      const itemStats = store1.getState().itemStats;
      const keys = Object.keys(itemStats);
      expect(keys.length).toBeGreaterThan(0);
      const attempts1 = itemStats[keys[0]!]!.attempts;
      expect(attempts1).toBe(1);

      // 2. Instanciamos un nuevo store simulando recarga completa de página
      const store2 = createDrillsStore({
        storage,
        storageName: 'persistent:drills',
        now,
      });

      expect(store2.getState().history).toHaveLength(1);
      expect(store2.getState().history[0]!.drillId).toBe('A1');
      expect(store2.getState().itemStats[keys[0]!]!.attempts).toBe(1);
      // Siempre arranca limpio en configuring
      expect(store2.getState().phase).toBe('configuring');
      expect(store2.getState().currentQuestion).toBeNull();
    });

    it('exportar y volver a importar produce un estado idéntico', () => {
      const { store } = createTestDrills();

      store.getState().startSession('B2', {}, 1);
      store.getState().submitAnswer({ kind: 'positions', positions: [] });
      store.getState().nextQuestion();

      const exportedJson = store.getState().exportData();
      expect(typeof exportedJson).toBe('string');
      const parsed = JSON.parse(exportedJson);
      expect(parsed.version).toBe(DRILLS_STORAGE_VERSION);
      expect(parsed.history).toHaveLength(1);

      // Importar en un store vacío nuevo
      const storageNew = createMemoryStorage();
      const freshStore = createDrillsStore({ storage: storageNew, storageName: 'import:drills' });

      expect(freshStore.getState().history).toHaveLength(0);
      const success = freshStore.getState().importData(exportedJson);
      expect(success).toBe(true);

      expect(freshStore.getState().history).toHaveLength(1);
      expect(freshStore.getState().history[0]!.drillId).toBe('B2');
      expect(freshStore.getState().itemStats).toEqual(store.getState().itemStats);
    });

    it('aplica valores por defecto sin errores ante almacenamiento con datos corruptos', () => {
      const storage = createMemoryStorage();
      storage.setItem(
        'corrupt:drills',
        JSON.stringify({
          version: 1,
          state: {
            itemStats: 'esto no es un objeto',
            history: null,
            lastDrillId: 'ejercicio_inexistente',
            configs: 'invalido',
          },
        }),
      );

      const store = createDrillsStore({
        storage,
        storageName: 'corrupt:drills',
      });

      // No lanza excepciones y arranca con valores seguros de reserva
      expect(store.getState().itemStats).toEqual({});
      expect(store.getState().history).toEqual([]);
      expect(store.getState().drillId).toBe('A1');
      expect(store.getState().phase).toBe('configuring');
    });

    it('importData rechaza cadenas JSON inválidas o tipos incoherentes sin fallar', () => {
      const { store } = createTestDrills();
      expect(store.getState().importData('esto no es json')).toBe(false);
      expect(store.getState().importData(null)).toBe(false);
      expect(store.getState().importData(12345)).toBe(false);
    });
  });

  describe('Selectores de Progreso y Estadísticas', () => {
    it('selectFretboardAccuracyMap mapea las 6 cuerdas y categoriza el nivel de dominio', () => {
      const { get, setState } = createTestDrills();

      setState({
        itemStats: {
          'pos:s5f3': { attempts: 20, hits: 19 }, // 95% -> mastered
          'pos:s4f7': { attempts: 10, hits: 7 },  // 70% -> learning
          'pos:s6f1': { attempts: 10, hits: 4 },  // 40% -> weak
        },
      });

      const map = selectFretboardAccuracyMap(get(), 12);
      expect(map.length).toBe(6 * 13); // 6 cuerdas × trastes 0..12

      const mastered = map.find((c) => c.string === 5 && c.fret === 3);
      expect(mastered?.status).toBe('mastered');
      expect(mastered?.accuracy).toBe(95);

      const learning = map.find((c) => c.string === 4 && c.fret === 7);
      expect(learning?.status).toBe('learning');
      expect(learning?.accuracy).toBe(70);

      const weak = map.find((c) => c.string === 6 && c.fret === 1);
      expect(weak?.status).toBe('weak');
      expect(weak?.accuracy).toBe(40);

      const untested = map.find((c) => c.string === 1 && c.fret === 0);
      expect(untested?.status).toBe('untested');
      expect(untested?.attempts).toBe(0);
    });

    it('selectWeakIntervals agrega variantes y lista los intervalos con menor precisión', () => {
      const { get, setState } = createTestDrills();

      setState({
        itemStats: {
          'interval:M3|string:5': { attempts: 10, hits: 9 }, // 90%
          'interval:♭5|pair:3-2': { attempts: 10, hits: 4 }, // 40% (débil)
          'interval:m7|pair:4-3': { attempts: 10, hits: 6 }, // 60%
        },
      });

      const weak = selectWeakIntervals(get(), 2);
      expect(weak).toHaveLength(2);
      // El más débil primero
      expect(weak[0]!.interval).toBe('♭5');
      expect(weak[0]!.accuracy).toBe(40);
      expect(weak[1]!.interval).toBe('m7');
      expect(weak[1]!.accuracy).toBe(60);
    });

    it('selectRecentSessionEvolution retorna las últimas N sesiones cronológicas', () => {
      const { get, setState } = createTestDrills();

      const sampleSessions = Array.from({ length: 15 }, (_, i) => ({
        id: `sess-${i}`,
        date: new Date().toISOString(),
        drillId: 'B1' as const,
        config: defaultDrillConfig('B1'),
        totalQuestions: 20,
        correctCount: 15,
        accuracy: 75,
        averageTimeMs: 2500,
      }));

      setState({ history: sampleSessions });

      const evolution = selectRecentSessionEvolution(get(), 5);
      expect(evolution).toHaveLength(5);
      expect(evolution[4]!.id).toBe('sess-14');
    });
  });
});
