import { describe, expect, it } from 'vitest';
import { createRng, pick, randomInt, shuffle, weightedPick } from './rng';

describe('RNG determinista (Mulberry32)', () => {
  it('produce secuencias idénticas con la misma semilla', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
    expect(seq1.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('produce secuencias diferentes con semillas diferentes', () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    expect(rng1()).not.toEqual(rng2());
  });

  it('randomInt genera enteros dentro de los límites inclusive', () => {
    const rng = createRng(12345);
    const results = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const val = randomInt(rng, 3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
      expect(Number.isInteger(val)).toBe(true);
      results.add(val);
    }
    expect(results).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it('pick selecciona deterministamente elementos del array', () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const items = ['do', 're', 'mi', 'fa', 'sol'];
    expect(pick(rng1, items)).toBe(pick(rng2, items));
  });

  it('shuffle reordena sin alterar los elementos originales', () => {
    const rng = createRng(555);
    const original = [1, 2, 3, 4, 5, 6, 7];
    const shuffled = shuffle(rng, original);
    expect(shuffled).toHaveLength(original.length);
    expect(new Set(shuffled)).toEqual(new Set(original));
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7]); // Inmutabilidad
  });

  it('weightedPick favorece estadísticamente los ítems con mayor peso', () => {
    const rng = createRng(777);
    const items = [
      { item: 'A', weight: 1 },
      { item: 'B', weight: 9 },
    ];
    let countB = 0;
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      if (weightedPick(rng, items) === 'B') countB++;
    }
    // B tiene 90% de peso; con 1000 iteraciones esperamos ~900 (rango 850..950)
    expect(countB).toBeGreaterThan(830);
    expect(countB).toBeLessThan(950);
  });
});
