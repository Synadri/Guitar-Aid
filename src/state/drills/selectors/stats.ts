import type { StringNumber } from '../../../theory';
import type { DrillsState, DrillSessionRecord } from '../types';

export type PositionAccuracyStatus = 'mastered' | 'learning' | 'weak' | 'untested';

export interface PositionAccuracyCell {
  string: StringNumber;
  fret: number;
  attempts: number;
  hits: number;
  accuracy: number;
  status: PositionAccuracyStatus;
  averageTimeMs?: number;
}

export interface WeakIntervalItem {
  interval: string;
  attempts: number;
  hits: number;
  accuracy: number;
}

/**
 * Genera la matriz de aciertos del mástil (6 cuerdas × N trastes) a partir de las
 * estadísticas históricas acumuladas en los ejercicios de notas (A1 y A2).
 */
export function selectFretboardAccuracyMap(
  state: DrillsState,
  maxFret: number = 12,
): PositionAccuracyCell[] {
  const result: PositionAccuracyCell[] = [];
  const strings: StringNumber[] = [1, 2, 3, 4, 5, 6];

  for (const s of strings) {
    for (let f = 0; f <= maxFret; f++) {
      const key = `pos:s${s}f${f}`;
      const item = state.itemStats[key];
      const attempts = item?.attempts ?? 0;
      const hits = item?.hits ?? 0;
      const accuracy = attempts > 0 ? Math.round((hits / attempts) * 100) : 0;

      let status: PositionAccuracyStatus = 'untested';
      if (attempts > 0) {
        if (accuracy >= 85) {
          status = 'mastered';
        } else if (accuracy >= 60) {
          status = 'learning';
        } else {
          status = 'weak';
        }
      }

      result.push({
        string: s,
        fret: f,
        attempts,
        hits,
        accuracy,
        status,
        averageTimeMs: item?.averageTimeMs,
      });
    }
  }

  return result;
}

/**
 * Extrae los intervalos con menor precisión acumulada en los ejercicios B1–B4,
 * agregando todas las variantes de cuerdas o pares bajo el mismo intervalo.
 */
export function selectWeakIntervals(
  state: DrillsState,
  limit: number = 5,
): WeakIntervalItem[] {
  const aggregates = new Map<string, { attempts: number; hits: number }>();

  for (const [key, stats] of Object.entries(state.itemStats)) {
    if (!key.startsWith('interval:')) continue;
    // Formato de clave: "interval:<nombre>|..."
    const match = key.match(/^interval:([^|]+)/);
    if (!match) continue;
    const interval = match[1]!;

    const current = aggregates.get(interval) ?? { attempts: 0, hits: 0 };
    current.attempts += stats.attempts;
    current.hits += stats.hits;
    aggregates.set(interval, current);
  }

  const list: WeakIntervalItem[] = [];
  for (const [interval, data] of aggregates.entries()) {
    if (data.attempts === 0) continue;
    const accuracy = Math.round((data.hits / data.attempts) * 100);
    list.push({
      interval,
      attempts: data.attempts,
      hits: data.hits,
      accuracy,
    });
  }

  // Ordena por menor precisión primero; desempata por mayor número de intentos
  list.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.attempts - a.attempts;
  });

  return list.slice(0, limit);
}

/**
 * Devuelve las últimas sesiones registradas en el historial (por defecto las últimas 10)
 * para representar el gráfico de evolución temporal en la UI.
 */
export function selectRecentSessionEvolution(
  state: DrillsState,
  limit: number = 10,
): DrillSessionRecord[] {
  return state.history.slice(-limit);
}
