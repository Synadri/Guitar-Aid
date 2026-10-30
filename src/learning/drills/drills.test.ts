import { describe, expect, it } from 'vitest';
import {
  type FretPosition,
  TUNINGS,
  STANDARD_TUNING,
} from '../../theory';
import { grade } from '../answers';
import { createRng } from '../rng';
import {
  adaptivePick,
  computeItemWeight,
  type DrillStatsMap,
} from './adaptive';
import { generateC1, generateC2 } from './build';
import { generateDrillQuestion } from './index';
import {
  generateB1,
  generateB2,
  generateB3,
  generateB4,
} from './intervals';
import { generateA1, generateA2 } from './notes';
import { generateB5, resolveVoicingLabels } from './shapes';
import { DRILL_CATALOG, type DrillId } from './types';

const DROP_D_TUNING = TUNINGS.find((t) => t.id === 'dropD')!;

describe('Hito A2 — Motor de ejercicios puro (learning/drills)', () => {
  describe('Catálogo de ejercicios', () => {
    it('contiene los 9 ejercicios de la Fase 2', () => {
      const ids = DRILL_CATALOG.map((d) => d.id);
      expect(ids).toEqual(['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2']);
      expect(DRILL_CATALOG).toHaveLength(9);
    });
  });

  describe('Criterio (d) — B1: Intervalo en la misma cuerda', () => {
    it('referencia (5, 3) = C3 + M3 ascendente en la misma cuerda → la única respuesta correcta es (5, 7) = E3. Marcar (4, 2) se corrige como incorrecto', () => {
      const refPos: FretPosition = { string: 5, fret: 3 }; // C3
      const targetPos: FretPosition = { string: 5, fret: 7 }; // E3 en cuerda 5

      const question = {
        prompt: { referencePosition: refPos },
        expected: {
          kind: 'positions' as const,
          positions: [targetPos],
        },
        mode: 'first' as const,
      };

      // Acierto: (5, 7) en la misma cuerda
      const goodGrade = grade(question, {
        kind: 'positions',
        positions: [{ string: 5, fret: 7 }],
      });
      expect(goodGrade.correct).toBe(true);
      expect(goodGrade.score).toBe(1);
      expect(goodGrade.hits).toEqual([{ string: 5, fret: 7 }]);
      expect(goodGrade.misses).toEqual([]);
      expect(goodGrade.extras).toEqual([]);

      // Fallo: marcar (4, 2) que también es E3 (misma nota), pero en otra cuerda
      const badGradeDifferentString = grade(question, {
        kind: 'positions',
        positions: [{ string: 4, fret: 2 }],
      });
      expect(badGradeDifferentString.correct).toBe(false);
      expect(badGradeDifferentString.score).toBe(0);
      expect(badGradeDifferentString.hits).toEqual([]);
      expect(badGradeDifferentString.extras).toEqual([{ string: 4, fret: 2 }]);
      expect(badGradeDifferentString.misses).toEqual([targetPos]);

      // Fallo: traste incorrecto en la misma cuerda
      const badGradeWrongFret = grade(question, {
        kind: 'positions',
        positions: [{ string: 5, fret: 6 }],
      });
      expect(badGradeWrongFret.correct).toBe(false);
      expect(badGradeWrongFret.score).toBe(0);
    });

    it('generador de B1 produce preguntas coherentes en la misma cuerda', () => {
      const rng = createRng(12345);
      const q = generateB1(rng, {
        activeStrings: [5],
        fretRange: [0, 12],
        direction: 'ascending',
        intervals: [4], // M3
      });
      expect(q.drill).toBe('B1');
      expect(q.prompt.referencePosition.string).toBe(5);
      expect(q.expected.kind).toBe('positions');
      if (q.expected.kind === 'positions') {
        expect(q.expected.positions[0]!.string).toBe(5);
        expect(q.expected.positions[0]!.fret - q.prompt.referencePosition.fret).toBe(4);
      }
    });
  });

  describe('Criterio (e) — B3 y B2: Irregularidad Sol–Si', () => {
    it('B3 distingue la irregularidad Sol–Si: (4, 2) → (3, 2) es P4 (5 semitonos), pero (3, 2) → (2, 2) es M3 (4 semitonos)', () => {
      // (4, 2) = E3 (D3+2 = 52) → (3, 2) = A3 (G3+2 = 57): diferencia = 5 semitonos (P4)
      const q43 = {
        expected: {
          kind: 'interval' as const,
          semitones: 5,
          name: 'P4' as const,
        },
        mode: 'first' as const,
      };

      const grade43 = grade(q43, { kind: 'interval', semitones: 5 });
      expect(grade43.correct).toBe(true);
      expect(grade43.score).toBe(1);

      // (3, 2) = A3 (57) → (2, 2) = C#4 (B3+2 = 61): diferencia = 4 semitonos (M3)
      const q32 = {
        expected: {
          kind: 'interval' as const,
          semitones: 4,
          name: 'M3' as const,
        },
        mode: 'first' as const,
      };

      const grade32 = grade(q32, { kind: 'interval', semitones: 4 });
      expect(grade32.correct).toBe(true);
      expect(grade32.score).toBe(1);

      // Si responde P4 en vez de M3, es incorrecto
      const wrongGrade = grade(q32, { kind: 'interval', semitones: 5 });
      expect(wrongGrade.correct).toBe(false);
      expect(wrongGrade.score).toBe(0);
    });

    it('B2: desde (3, 5) = C4, M3 hacia la cuerda 2 → (2, 5) = E4', () => {
      // C4 en cuerda 3, traste 5. C4 + 4 semitonos = E4.
      // En cuerda 2 (B3 = 59), E4 (64) está en 64 - 59 = traste 5.
      const q = {
        expected: {
          kind: 'positions' as const,
          positions: [{ string: 2 as const, fret: 5 }],
        },
        mode: 'first' as const,
      };

      const goodGrade = grade(q, {
        kind: 'positions',
        positions: [{ string: 2, fret: 5 }],
      });
      expect(goodGrade.correct).toBe(true);
      expect(goodGrade.score).toBe(1);

      // Si pulsa cuerda 2, traste 4 o 6, es incorrecto
      const badGrade = grade(q, {
        kind: 'positions',
        positions: [{ string: 2, fret: 4 }],
      });
      expect(badGrade.correct).toBe(false);
    });

    it('generadores de B2 y B3 producen preguntas válidas', () => {
      const rng = createRng(444);
      const qB2 = generateB2(rng, {
        activeStrings: [2, 3],
        fretRange: [0, 12],
        intervals: [4],
      });
      expect(qB2.drill).toBe('B2');
      expect(qB2.prompt.targetString).toBeDefined();

      const qB3 = generateB3(rng, {
        activeStrings: [2, 3],
        fretRange: [0, 12],
      });
      expect(qB3.drill).toBe('B3');
      expect(qB3.prompt.semitones).toBeGreaterThan(0);
    });
  });

  describe('Criterio (f) — A1: Encuentra la nota (modos all y first)', () => {
    const expectedCInStandard0to12: FretPosition[] = [
      { string: 6, fret: 8 },
      { string: 5, fret: 3 },
      { string: 4, fret: 10 },
      { string: 3, fret: 5 },
      { string: 2, fret: 1 },
      { string: 1, fret: 8 },
    ];

    it('A1 en modo all, «C» en las 6 cuerdas, trastes 0–12, en estándar → conjunto esperado es exactamente {(6, 8), (5, 3), (4, 10), (3, 5), (2, 1), (1, 8)}', () => {
      // Semilla 7 genera pc 0 (C)
      const q = generateA1(createRng(7), {
        tuning: STANDARD_TUNING,
        activeStrings: [1, 2, 3, 4, 5, 6],
        fretRange: [0, 12],
        mode: 'all',
        naturalOnly: true,
      });

      expect(q.prompt.pitchClass).toBe(0);
      expect(q.prompt.noteName).toBe('C');
      expect(q.expected.kind).toBe('positions');
      if (q.expected.kind === 'positions') {
        expect(q.expected.positions).toEqual(expectedCInStandard0to12);
      }
    });

    it('respuesta parcial informa aciertos, fallos y sobrantes', () => {
      const q = {
        expected: {
          kind: 'positions' as const,
          positions: expectedCInStandard0to12,
        },
        mode: 'all' as const,
      };

      // El usuario marca (6, 8) y (5, 3) (aciertos) y marca erróneamente (4, 9) (sobrante)
      const partialGrade = grade(q, {
        kind: 'positions',
        positions: [
          { string: 6, fret: 8 },
          { string: 5, fret: 3 },
          { string: 4, fret: 9 }, // sobrante
        ],
      });

      expect(partialGrade.correct).toBe(false);
      expect(partialGrade.partial).toBe(true);
      expect(partialGrade.hits).toEqual([
        { string: 6, fret: 8 },
        { string: 5, fret: 3 },
      ]);
      expect(partialGrade.extras).toEqual([{ string: 4, fret: 9 }]);
      expect(partialGrade.misses).toEqual([
        { string: 4, fret: 10 },
        { string: 3, fret: 5 },
        { string: 2, fret: 1 },
        { string: 1, fret: 8 },
      ]);
      expect(partialGrade.score).toBeGreaterThan(0);
      expect(partialGrade.score).toBeLessThan(1);
    });

    it('en modo first basta con una posición correcta', () => {
      const q = {
        expected: {
          kind: 'positions' as const,
          positions: expectedCInStandard0to12,
        },
        mode: 'first' as const,
      };

      // Marcando solo (5, 3) se califica como completamente correcto en modo first
      const firstGrade = grade(q, {
        kind: 'positions',
        positions: [{ string: 5, fret: 3 }],
      });
      expect(firstGrade.correct).toBe(true);
      expect(firstGrade.score).toBe(1);
      expect(firstGrade.hits).toEqual([{ string: 5, fret: 3 }]);
      expect(firstGrade.misses).toEqual([]);
      expect(firstGrade.extras).toEqual([]);

      // Si la primera posición es incorrecta
      const badFirstGrade = grade(q, {
        kind: 'positions',
        positions: [{ string: 5, fret: 4 }],
      });
      expect(badFirstGrade.correct).toBe(false);
      expect(badFirstGrade.score).toBe(0);
      expect(badFirstGrade.extras).toEqual([{ string: 5, fret: 4 }]);
    });
  });

  describe('Criterio (g) — B5: Etiqueta la forma (Am abierto)', () => {
    it('B5 con el voicing x-0-2-2-1-0 (Am abierto) → las etiquetas correctas, de la cuerda 5 a la 1, son 1, 5, 1, ♭3, 5', () => {
      const shape = {
        root: 9 as const, // A
        quality: 'm' as const,
        rootString: 5 as const,
        frets: ['x', 0, 2, 2, 1, 0] as const,
      };

      const resolved = resolveVoicingLabels(shape, STANDARD_TUNING);

      expect(resolved.positions).toEqual([
        { string: 5, fret: 0 },
        { string: 4, fret: 2 },
        { string: 3, fret: 2 },
        { string: 2, fret: 1 },
        { string: 1, fret: 0 },
      ]);

      const degrees = resolved.labels.map((l) => l.degree);
      expect(degrees).toEqual(['1', '5', '1', '♭3', '5']);

      // Evalúa calificación completa
      const q = {
        expected: {
          kind: 'labels' as const,
          labels: resolved.labels,
        },
        mode: 'all' as const,
      };

      const goodGrade = grade(q, {
        kind: 'labels',
        labels: [
          { position: { string: 5, fret: 0 }, label: '1' },
          { position: { string: 4, fret: 2 }, label: '5' },
          { position: { string: 3, fret: 2 }, label: '1' },
          { position: { string: 2, fret: 1 }, label: '♭3' },
          { position: { string: 1, fret: 0 }, label: '5' },
        ],
      });
      expect(goodGrade.correct).toBe(true);
      expect(goodGrade.score).toBe(1);

      // Evalúa error en una etiqueta
      const badGrade = grade(q, {
        kind: 'labels',
        labels: [
          { position: { string: 5, fret: 0 }, label: '1' },
          { position: { string: 4, fret: 2 }, label: '5' },
          { position: { string: 3, fret: 2 }, label: '1' },
          { position: { string: 2, fret: 1 }, label: '3' }, // error (puso 3ª mayor en vez de menor)
          { position: { string: 1, fret: 0 }, label: '5' },
        ],
      });
      expect(badGrade.correct).toBe(false);
      expect(badGrade.partial).toBe(true);
    });
  });

  describe('Criterio (o) — Afinación Drop D', () => {
    it('en Drop D, «D» en la cuerda 6, trastes 0–12, da {(6, 0), (6, 12)}', () => {
      // Semilla 9 produce la nota D (pc 2)
      const q = generateA1(createRng(9), {
        tuning: DROP_D_TUNING,
        activeStrings: [6],
        fretRange: [0, 12],
        mode: 'all',
      });

      expect(DROP_D_TUNING.id).toBe('dropD');
      expect(q.prompt.pitchClass).toBe(2);
      expect(q.prompt.noteName).toBe('D');
      expect(q.expected).toEqual({
        kind: 'positions',
        positions: [
          { string: 6, fret: 0 },
          { string: 6, fret: 12 },
        ],
      });
    });
  });

  describe('Criterio (q) — Modo adaptativo determinista', () => {
    it('con la misma semilla, elige con más frecuencia un itemKey con fallos recientes que uno sin fallos', () => {
      const statsMap: DrillStatsMap = {
        'note:6': {
          attempts: 5,
          hits: 0,
          recentResults: [false, false, false, false, false], // 100 % fallos
        },
        'note:0': {
          attempts: 5,
          hits: 5,
          recentResults: [true, true, true, true, true], // 100 % aciertos
        },
      };

      const weightWeak = computeItemWeight('note:6', statsMap);
      const weightStrong = computeItemWeight('note:0', statsMap);
      expect(weightWeak).toBeGreaterThan(weightStrong);

      const items = ['note:6', 'note:0'];
      const rng = createRng(42);

      let weakCount = 0;
      let strongCount = 0;
      const ITERATIONS = 100;

      for (let i = 0; i < ITERATIONS; i++) {
        const picked = adaptivePick(rng, items, (item) => item, statsMap, true);
        if (picked === 'note:6') weakCount++;
        else strongCount++;
      }

      // Con el peso de fallos, note:6 debe salir muchas más veces que note:0
      expect(weakCount).toBeGreaterThan(65);
      expect(strongCount).toBeLessThan(35);
    });
  });

  describe('Ejercicios A2, B4, C1, C2 y Generador Maestro', () => {
    it('A2 genera pregunta de nombrar la nota y se evalúa correctamente', () => {
      const rng = createRng(77);
      const q = generateA2(rng, {
        activeStrings: [4],
        fretRange: [7, 7], // Cuerda 4, traste 7 en estándar es A (pc 9)
      });
      expect(q.drill).toBe('A2');
      expect(q.prompt.position).toEqual({ string: 4, fret: 7 });
      expect(q.prompt.pitchClass).toBe(9);
      expect(q.prompt.noteName).toBe('A');

      const goodGrade = grade(q, { kind: 'pitchClass', pitchClass: 9 });
      expect(goodGrade.correct).toBe(true);

      const badGrade = grade(q, { kind: 'pitchClass', pitchClass: 7 });
      expect(badGrade.correct).toBe(false);
    });

    it('B4 genera mapa de intervalos y se evalúa', () => {
      const rng = createRng(88);
      const q = generateB4(rng, {
        activeStrings: [5],
        fretRange: [0, 12],
      });
      expect(q.drill).toBe('B4');
      expect(q.expected.kind).toBe('positions');
    });

    it('B5 genera pregunta de etiqueta de forma a partir de voicings abiertos', () => {
      const rng = createRng(55);
      const q = generateB5(rng);
      expect(q.drill).toBe('B5');
      expect(q.answerKind).toBe('labels');
      expect(q.expected.kind).toBe('labels');
    });

    it('C1 genera construcción de acorde en una cuerda', () => {
      const rng = createRng(101);
      const q = generateC1(rng, {
        activeStrings: [4],
        fretRange: [0, 12],
        qualities: ['m7'],
      });
      expect(q.drill).toBe('C1');
      expect(q.prompt.string).toBe(4);
      expect(q.expected.kind).toBe('positions');
    });

    it('C2 genera escala en una cuerda', () => {
      const rng = createRng(202);
      const q = generateC2(rng, {
        activeStrings: [3],
        fretRange: [0, 12],
        scaleTypes: ['mixolydian'],
      });
      expect(q.drill).toBe('C2');
      expect(q.prompt.string).toBe(3);
      expect(q.expected.kind).toBe('positions');
    });

    it('generateDrillQuestion despacha correctamente los 9 ejercicios', () => {
      const drills: DrillId[] = ['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2'];
      const rng = createRng(333);

      for (const drillId of drills) {
        const q = generateDrillQuestion(drillId, rng);
        expect(q.drill).toBe(drillId);
        expect(q.id).toBeDefined();
        expect(q.prompt).toBeDefined();
        expect(q.expected).toBeDefined();
      }
    });

    it('la generación con la misma semilla es 100 % determinista', () => {
      const q1 = generateDrillQuestion('A1', createRng(42));
      const q2 = generateDrillQuestion('A1', createRng(42));
      expect(q1.itemKey).toBe(q2.itemKey);
      expect(q1.prompt).toEqual(q2.prompt);
      expect(q1.expected).toEqual(q2.expected);
    });
  });
});
