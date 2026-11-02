import { describe, expect, it } from 'vitest';
import {
  calculateTickForBarBeat,
  calculatePlaybackRangeForBars,
  resolvePlaybackTickForBarBeat,
  resolvePlaybackRangeForBars,
} from './ticks';
import type { SongBar } from './types';

describe('calculateTickForBarBeat', () => {
  const sampleBars: SongBar[] = [
    {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.2, notes: [] },
        { index: 3, startTick: 2880, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
    {
      index: 1,
      number: 2,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.2, notes: [] },
        { index: 3, startTick: 2880, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
    {
      index: 2,
      number: 3,
      timeSignature: { numerator: 3, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
  ];

  it('calcula el inicio del compás 1 pulso 0 como tick 0', () => {
    expect(calculateTickForBarBeat(sampleBars, 1, 0)).toBe(0);
  });

  it('calcula pulsos dentro del primer compás', () => {
    expect(calculateTickForBarBeat(sampleBars, 1, 1)).toBe(960);
    expect(calculateTickForBarBeat(sampleBars, 1, 2)).toBe(1920);
    expect(calculateTickForBarBeat(sampleBars, 1, 3)).toBe(2880);
  });

  it('calcula el inicio del compás 2 (3840 ticks en 4/4)', () => {
    expect(calculateTickForBarBeat(sampleBars, 2, 0)).toBe(3840);
    expect(calculateTickForBarBeat(sampleBars, 2, 2)).toBe(3840 + 1920);
  });

  it('acumula métricas variables (compás 3 tras dos compases de 4/4 = 7680 ticks)', () => {
    expect(calculateTickForBarBeat(sampleBars, 3, 0)).toBe(7680);
    expect(calculateTickForBarBeat(sampleBars, 3, 1)).toBe(7680 + 960);
  });

  it('devuelve 0 si la lista de compases está vacía o es indefinida', () => {
    expect(calculateTickForBarBeat(undefined, 1, 0)).toBe(0);
    expect(calculateTickForBarBeat([], 2, 0)).toBe(0);
  });
});

describe('calculatePlaybackRangeForBars', () => {
  const sampleBars: SongBar[] = [
    {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.2, notes: [] },
        { index: 3, startTick: 2880, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
    {
      index: 1,
      number: 2,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.2, notes: [] },
        { index: 3, startTick: 2880, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
    {
      index: 2,
      number: 3,
      timeSignature: { numerator: 3, denominator: 4 },
      tempoBpm: 120,
      beats: [
        { index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] },
        { index: 1, startTick: 960, durationTicks: 960, metricWeight: 1.0, notes: [] },
        { index: 2, startTick: 1920, durationTicks: 960, metricWeight: 1.0, notes: [] },
      ],
    },
  ];

  it('calcula bucle de un único compás (compás 2: 3840 a 7680)', () => {
    expect(calculatePlaybackRangeForBars(sampleBars, [2, 2])).toEqual({
      startTick: 3840,
      endTick: 7680,
    });
  });

  it('calcula bucle de varios compases (compás 1 a 2: 0 a 7680)', () => {
    expect(calculatePlaybackRangeForBars(sampleBars, [1, 2])).toEqual({
      startTick: 0,
      endTick: 7680,
    });
  });

  it('calcula bucle hasta el último compás (compás 2 a 3: 3840 a 10560)', () => {
    expect(calculatePlaybackRangeForBars(sampleBars, [2, 3])).toEqual({
      startTick: 3840,
      endTick: 10560,
    });
  });

  it('soporta rangos invertidos [3, 1] ordenándolos automáticamente', () => {
    expect(calculatePlaybackRangeForBars(sampleBars, [3, 1])).toEqual({
      startTick: 0,
      endTick: 10560,
    });
  });

  it('devuelve null si no hay compases o el rango es nulo', () => {
    expect(calculatePlaybackRangeForBars(undefined, [1, 2])).toBeNull();
    expect(calculatePlaybackRangeForBars([], [1, 2])).toBeNull();
    expect(calculatePlaybackRangeForBars(sampleBars, null)).toBeNull();
  });
});

describe('resolvePlaybackTickForBarBeat y resolvePlaybackRangeForBars con tickCache', () => {
  const sampleBars: SongBar[] = [
    {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [{ index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] }],
    },
    {
      index: 1,
      number: 2,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [{ index: 0, startTick: 0, durationTicks: 960, metricWeight: 1.5, notes: [] }],
    },
  ];

  // Simulación de un tickCache con repeticiones desplegadas donde el compás 37 está en tick 276480
  const mockTickCache = {
    masterBarLookup: new Map([
      [0, { start: 0, end: 3840 }],
      [1, { start: 3840, end: 7680 }],
      [36, { start: 276480, end: 280320 }],
      [37, { start: 280320, end: 284160 }],
    ]),
  };

  const mockApi = { tickCache: mockTickCache };

  it('resuelve el tick exacto consultando tickCache cuando existe', () => {
    // Compás 37 (índice 36) debe devolver 276480, no 36 * 3840 = 138240
    const tick = resolvePlaybackTickForBarBeat(sampleBars, 37, 0, mockApi);
    expect(tick).toBe(276480);
  });

  it('resuelve el rango de compases [37, 38] respetando los ticks desplegados de la repetición', () => {
    const range = resolvePlaybackRangeForBars(sampleBars, [37, 38], mockApi);
    expect(range).toEqual({
      startTick: 276480,
      endTick: 284160,
    });
  });

  it('soporta controladores que exponen getPlayer()', () => {
    const mockController = {
      getPlayer: () => mockApi,
    };
    const range = resolvePlaybackRangeForBars(sampleBars, [37, 38], mockController);
    expect(range).toEqual({
      startTick: 276480,
      endTick: 284160,
    });
  });

  it('cae en el cálculo estándar si no se proporciona apiOrPlayer o no tiene tickCache', () => {
    const tick = resolvePlaybackTickForBarBeat(sampleBars, 2, 0);
    expect(tick).toBe(3840);

    const range = resolvePlaybackRangeForBars(sampleBars, [1, 2]);
    expect(range).toEqual({
      startTick: 0,
      endTick: 7680,
    });
  });
});
