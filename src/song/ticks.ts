import type { SongBar } from './types';

/**
 * Límites de un rango de reproducción en ticks MIDI absolutos.
 */
export interface PlaybackTickBounds {
  startTick: number;
  endTick: number;
}

/**
 * Calcula el tick MIDI absoluto (base 960 ticks/negra) correspondiente al compás y pulso dados.
 *
 * @param bars Lista de compases de la pista.
 * @param barNumber Número visible del compás (1..N).
 * @param beatIndex Índice del pulso dentro del compás (0..M-1).
 */
export function calculateTickForBarBeat(
  bars: readonly SongBar[] | undefined,
  barNumber: number,
  beatIndex = 0,
): number {
  if (!bars || bars.length === 0) return 0;
  const targetBarNumber = Math.max(1, barNumber);
  let totalTick = 0;

  for (const bar of bars) {
    if (bar.number === targetBarNumber) {
      const safeBeatIdx = Math.max(0, beatIndex);
      const beat = bar.beats[safeBeatIdx] ?? bar.beats[0];
      const beatOffset = beat ? beat.startTick : 0;
      return totalTick + beatOffset;
    }
    if (bar.number > targetBarNumber) {
      break;
    }
    const num = bar.timeSignature?.numerator ?? 4;
    const den = bar.timeSignature?.denominator ?? 4;
    const barDuration = Math.round((num / den) * 4 * 960);
    totalTick += barDuration;
  }

  return totalTick;
}

/**
 * Calcula los límites en ticks MIDI para un bucle entre compases dados [startBar, endBar] (1-based, inclusive).
 *
 * El bucle abarca desde el primer tick del compás de inicio hasta el último tick del compás final
 * (es decir, el tick de inicio del compás inmediatamente posterior).
 *
 * @param bars Lista ordenada de compases de la pista.
 * @param loopRange Tupla [compasInicio, compasFin] (1-based).
 * @returns Objeto { startTick, endTick } o null si no hay compases o rango válido.
 */
export function calculatePlaybackRangeForBars(
  bars: readonly SongBar[] | undefined,
  loopRange: readonly [number, number] | [number, number] | null | undefined,
): PlaybackTickBounds | null {
  if (!bars || bars.length === 0 || !loopRange) return null;
  const [start, end] = loopRange;
  const clampedStart = Math.max(1, Math.min(start, end));
  const clampedEnd = Math.max(1, Math.max(start, end));

  const startTick = calculateTickForBarBeat(bars, clampedStart, 0);
  const endTick = calculateTickForBarBeat(bars, clampedEnd + 1, 0);

  if (endTick <= startTick) return null;
  return { startTick, endTick };
}
