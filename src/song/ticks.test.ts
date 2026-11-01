import { describe, expect, it } from 'vitest';
import { calculateTickForBarBeat } from './ticks';
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
