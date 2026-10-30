import type { Rng } from '../rng';
import { pick, weightedPick } from '../rng';

export interface ItemStats {
  attempts: number;
  hits: number;
  averageTimeMs?: number;
  /** Historial de los últimos intentos (true = acierto, false = fallo). */
  recentResults?: readonly boolean[];
}

export type DrillStatsMap = Readonly<Record<string, ItemStats>>;

/**
 * Calcula el peso relativo para un `itemKey` en base a sus estadísticas históricas.
 * Un mayor peso aumenta la probabilidad de que el elemento sea seleccionado en modo adaptativo.
 */
export function computeItemWeight(key: string, statsMap?: DrillStatsMap): number {
  if (!statsMap) return 1.0;
  const stats = statsMap[key];
  if (!stats || stats.attempts === 0) {
    // Los elementos nunca vistos tienen peso base
    return 1.0;
  }

  let weight = 1.0;
  const recent = stats.recentResults ?? [];

  if (recent.length > 0) {
    const failures = recent.filter((r) => !r).length;
    const errorRate = failures / recent.length;
    // Hasta +4.0 de peso por tasa de fallos reciente
    weight += errorRate * 4.0;
    // Si el último intento fue fallo, refuerzo inmediato de +1.0
    if (!recent[recent.length - 1]) {
      weight += 1.0;
    }
  } else if (stats.attempts > 0) {
    const errorRate = Math.max(0, (stats.attempts - stats.hits) / stats.attempts);
    weight += errorRate * 4.0;
  }

  // Si el tiempo medio de respuesta supera 4 segundos, indica vacilación
  if (stats.averageTimeMs && stats.averageTimeMs > 4000) {
    const timeFactor = Math.min(2.0, (stats.averageTimeMs - 4000) / 4000);
    weight += timeFactor * 0.8;
  }

  return Math.max(0.1, weight);
}

/**
 * Selecciona un elemento del array dando mayor probabilidad a los ítems con fallos recientes
 * o mayor vacilación en el historial estadístico.
 */
export function adaptivePick<T>(
  rng: Rng,
  items: readonly T[],
  getKey: (item: T) => string,
  statsMap?: DrillStatsMap,
  enabled: boolean = true,
): T {
  if (items.length === 0) {
    throw new Error('Cannot adaptivePick from empty items array');
  }

  if (!enabled || !statsMap || Object.keys(statsMap).length === 0) {
    return pick(rng, items);
  }

  const weighted = items.map((item) => ({
    item,
    weight: computeItemWeight(getKey(item), statsMap),
  }));

  return weightedPick(rng, weighted);
}
