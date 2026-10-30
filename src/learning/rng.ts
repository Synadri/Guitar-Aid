/**
 * Generador de números pseudoaleatorios con semilla inyectable y utilidades.
 * Permite que los generadores de preguntas de ejercicios y tests sean 100 % deterministas.
 */

export type Rng = () => number;

/**
 * Crea un generador de números pseudoaleatorios usando el algoritmo Mulberry32.
 * Produce valores uniformemente distribuidos en el intervalo [0, 1).
 */
export function createRng(seed: number = 1): Rng {
  let s = (seed === 0 ? 1 : seed) >>> 0;
  return function mulberry32(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Devuelve un entero aleatorio en el rango [min, max] (ambos inclusive). */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (min > max) {
    throw new Error(`min (${min}) cannot be greater than max (${max})`);
  }
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Elige un elemento al azar de un array. */
export function pick<T>(rng: Rng, array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot pick from empty array');
  }
  const index = Math.floor(rng() * array.length);
  return array[index]!;
}

/** Devuelve una copia del array con los elementos reordenados aleatoriamente (Fisher-Yates). */
export function shuffle<T>(rng: Rng, array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

/**
 * Elige un elemento ponderado según su peso relativo.
 * Los pesos menores o iguales a 0 se consideran 0.
 */
export function weightedPick<T>(rng: Rng, items: readonly WeightedItem<T>[]): T {
  if (items.length === 0) {
    throw new Error('Cannot weightedPick from empty items');
  }
  const totalWeight = items.reduce((acc, cur) => acc + Math.max(0, cur.weight), 0);
  if (totalWeight <= 0) {
    const fallback = items[Math.floor(rng() * items.length)]!;
    return fallback.item;
  }
  let threshold = rng() * totalWeight;
  for (const entry of items) {
    const w = Math.max(0, entry.weight);
    if (threshold < w) {
      return entry.item;
    }
    threshold -= w;
  }
  return items[items.length - 1]!.item;
}
