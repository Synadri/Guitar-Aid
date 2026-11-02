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

interface TickCacheLookupItem {
  start?: number;
  end?: number;
}

interface TickCacheLike {
  masterBarLookup?: Map<number, TickCacheLookupItem> | { get?: (index: number) => TickCacheLookupItem | undefined };
  getMasterBar?: (bar: { index: number }) => TickCacheLookupItem | undefined;
  getMasterBarStart?: (bar: { index: number }) => number | undefined;
}

function extractTickCache(apiOrPlayer: unknown): TickCacheLike | undefined {
  if (!apiOrPlayer || typeof apiOrPlayer !== 'object') return undefined;
  const target =
    'getPlayer' in apiOrPlayer && typeof (apiOrPlayer as { getPlayer?: () => unknown }).getPlayer === 'function'
      ? (apiOrPlayer as { getPlayer: () => unknown }).getPlayer()
      : apiOrPlayer;

  if (target && typeof target === 'object' && 'tickCache' in target) {
    return (target as { tickCache?: TickCacheLike }).tickCache;
  }
  return undefined;
}

/**
 * Resuelve el tick de reproducción exacto para un compás y pulso dados.
 * Si se proporciona una instancia de AlphaTabApi, AlphaSynth o AlphaSynthController con caché de ticks
 * desplegada (tickCache), devuelve el tick correspondiente en la línea temporal real (respetando repeticiones).
 * En caso contrario, calcula el tick plano estándar con calculateTickForBarBeat.
 */
export function resolvePlaybackTickForBarBeat(
  bars: readonly SongBar[] | undefined,
  barNumber: number,
  beatIndex = 0,
  apiOrPlayer?: unknown,
): number {
  const tc = extractTickCache(apiOrPlayer);
  if (tc) {
    const barIndex = Math.max(0, barNumber - 1);
    let barStart: number | undefined;

    const mbLookup = tc.masterBarLookup;
    if (mbLookup && typeof (mbLookup as { get?: (k: number) => TickCacheLookupItem }).get === 'function') {
      const item = (mbLookup as { get: (k: number) => TickCacheLookupItem | undefined }).get(barIndex);
      if (item && typeof item.start === 'number' && Number.isFinite(item.start)) {
        barStart = item.start;
      }
    }

    if (barStart === undefined && typeof tc.getMasterBar === 'function') {
      const item = tc.getMasterBar({ index: barIndex });
      if (item && typeof item.start === 'number' && Number.isFinite(item.start)) {
        barStart = item.start;
      }
    }

    if (barStart === undefined && typeof tc.getMasterBarStart === 'function') {
      const start = tc.getMasterBarStart({ index: barIndex });
      if (typeof start === 'number' && Number.isFinite(start)) {
        barStart = start;
      }
    }

    if (barStart !== undefined) {
      if (!bars || beatIndex <= 0) {
        return barStart;
      }
      const bar = bars.find((b) => b.number === barNumber) ?? bars[barIndex];
      const beat = bar?.beats[beatIndex];
      const beatOffset = beat?.startTick ?? 0;
      return barStart + beatOffset;
    }
  }

  return calculateTickForBarBeat(bars, barNumber, beatIndex);
}

/**
 * Resuelve los límites de reproducción { startTick, endTick } para un rango de compases [startBar, endBar] (1-based).
 * Si se proporciona una instancia con caché de ticks desplegada (tickCache), obtiene los límites reales
 * desplegados por el reproductor. Si no está disponible, recurre a calculatePlaybackRangeForBars.
 */
export function resolvePlaybackRangeForBars(
  bars: readonly SongBar[] | undefined,
  loopRange: readonly [number, number] | [number, number] | null | undefined,
  apiOrPlayer?: unknown,
): PlaybackTickBounds | null {
  if (!loopRange) return null;
  const [start, end] = loopRange;
  const clampedStart = Math.max(1, Math.min(start, end));
  const clampedEnd = Math.max(1, Math.max(start, end));

  const tc = extractTickCache(apiOrPlayer);
  if (tc) {
    const startBarIdx = clampedStart - 1;
    const endBarIdx = clampedEnd - 1;
    let startTick: number | undefined;
    let endTick: number | undefined;

    const mbLookup = tc.masterBarLookup;
    if (mbLookup && typeof (mbLookup as { get?: (k: number) => TickCacheLookupItem }).get === 'function') {
      const startItem = (mbLookup as { get: (k: number) => TickCacheLookupItem | undefined }).get(startBarIdx);
      const endItem = (mbLookup as { get: (k: number) => TickCacheLookupItem | undefined }).get(endBarIdx);
      if (startItem && typeof startItem.start === 'number' && Number.isFinite(startItem.start)) {
        startTick = startItem.start;
      }
      if (endItem && typeof endItem.end === 'number' && Number.isFinite(endItem.end)) {
        endTick = endItem.end;
      }
    }

    if (startTick === undefined && typeof tc.getMasterBar === 'function') {
      const item = tc.getMasterBar({ index: startBarIdx });
      if (item && typeof item.start === 'number' && Number.isFinite(item.start)) {
        startTick = item.start;
      }
    }

    if (endTick === undefined && typeof tc.getMasterBar === 'function') {
      const item = tc.getMasterBar({ index: endBarIdx });
      if (item && typeof item.end === 'number' && Number.isFinite(item.end)) {
        endTick = item.end;
      }
    }

    if (startTick !== undefined && endTick !== undefined && endTick > startTick) {
      return { startTick, endTick };
    }
  }

  return calculatePlaybackRangeForBars(bars, loopRange);
}
