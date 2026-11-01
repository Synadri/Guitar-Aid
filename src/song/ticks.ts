import type { SongBar } from './types';

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
