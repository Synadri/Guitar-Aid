import { describe, expect, it } from 'vitest';
import type { PitchClass } from '../core/pitch';
import type { ChordQualityId } from '../data/chords';
import { SCALE_TYPES } from '../data/scales';
import { keySignatureTonic, rankScalesForFragment } from './rankFragmentScales';
import type { WeightedPc } from './types';

const A = 9 as PitchClass;
const C = 0 as PitchClass;
const E = 4 as PitchClass;

/**
 * Compás 4/4 con un acorde plaqué en redonda: cada nota pesa 4 (duración) y el bajo × 1.5.
 * Las notas de paso se añaden como corcheas a contratiempo (0.5 × 0.75).
 */
function bar(pcs: number[], passing: number[] = []): WeightedPc[] {
  return [
    ...pcs.map((pc, i) => ({ pc: pc as PitchClass, weight: i === 0 ? 6 : 4 })),
    ...passing.map((pc) => ({ pc: pc as PitchClass, weight: 0.375 })),
  ];
}

const chord = (root: number, quality: ChordQualityId) => ({ root: root as PitchClass, quality });

const exoticIds = new Set(
  SCALE_TYPES.filter((t) => t.intervals.length > 7 || t.weight < 70).map((t) => t.id),
);

describe('rankScalesForFragment', () => {
  it('criterio (d): Am – G – F – E7 (G♯ cromática) → A menor natural/armónica por delante de exóticas', () => {
    const ranked = rankScalesForFragment({
      notes: [
        ...bar([9, 0, 4]), // Am
        ...bar([7, 11, 2]), // G
        ...bar([5, 9, 0]), // F
        ...bar([4, 8, 11, 2]), // E7 (G♯)
      ],
      openingRoot: A,
      closingRoot: E,
      chords: [chord(9, 'm'), chord(7, 'maj'), chord(5, 'maj'), chord(4, '7')],
    });
    const top = ranked[0]!.value;
    expect(top.scale.tonic).toBe(A);
    expect(['minor', 'harmonicMinor']).toContain(top.scale.type);

    const idx = (tonic: number, type: string) =>
      ranked.findIndex((c) => c.value.scale.tonic === tonic && c.value.scale.type === type);
    const natural = idx(9, 'minor');
    const harmonic = idx(9, 'harmonicMinor');
    expect(natural).toBe(0);
    expect(harmonic).toBeGreaterThan(-1);
    expect(harmonic).toBeLessThan(3);
    // Ninguna escala exótica (Bebop, disminuidas, napolitanas, locrio, frigio) por delante.
    const firstExotic = ranked.findIndex((c) => exoticIds.has(c.value.scale.type));
    expect(firstExotic).toBeGreaterThan(harmonic);

    // Porcentaje de cobertura y notas de paso explícitos.
    expect(top.passingTones).toEqual([8]);
    expect(top.coverage).toBeGreaterThan(0.9);
    expect(top.coverage).toBeLessThan(1);
    expect(top.chordsInScale).toBe(3);
    expect(top.chordCount).toBe(4);
    const codes = ranked[0]!.reasons.map((r) => r.code);
    expect(codes).toEqual(
      expect.arrayContaining(['scaleCoverage', 'passingTones', 'fitsDetectedChords', 'tonicMatches']),
    );
    expect(ranked[0]!.reasons.find((r) => r.code === 'passingTones')?.params).toEqual({
      count: 1,
      pcs: '8',
    });
    expect(ranked[0]!.reasons.find((r) => r.code === 'scaleCoverage')?.params?.pct).toBe(93);
  });

  it('criterio (d): Am – Dm – G – C con D♯ de paso → A menor natural primero', () => {
    const ranked = rankScalesForFragment({
      notes: [
        ...bar([9, 0, 4], [3]), // Am + D♯ de paso
        ...bar([2, 5, 9]), // Dm
        ...bar([7, 11, 2]), // G
        ...bar([0, 4, 7]), // C
      ],
      openingRoot: A,
      closingRoot: C,
      chords: [chord(9, 'm'), chord(2, 'm'), chord(7, 'maj'), chord(0, 'maj')],
    });
    expect(ranked[0]!.value.scale).toMatchObject({ tonic: 9, type: 'minor' });
    expect(ranked[0]!.value.passingTones).toEqual([3]);
    expect(ranked[0]!.value.chordsInScale).toBe(4);
    expect(exoticIds.has(ranked[1]!.value.scale.type)).toBe(false);
  });

  it('fragmento diatónico C – G – Am – F abierto en C → C mayor con 100 % de cobertura', () => {
    const ranked = rankScalesForFragment({
      notes: [...bar([0, 4, 7]), ...bar([7, 11, 2]), ...bar([9, 0, 4]), ...bar([5, 9, 0])],
      openingRoot: C,
      closingRoot: 5 as PitchClass,
      chords: [chord(0, 'maj'), chord(7, 'maj'), chord(9, 'm'), chord(5, 'maj')],
    });
    expect(ranked[0]!.value.scale).toMatchObject({ tonic: 0, type: 'major' });
    expect(ranked[0]!.value.coverage).toBe(1);
    expect(ranked[0]!.value.passingTones).toEqual([]);
    expect(ranked[0]!.reasons.find((r) => r.code === 'scaleCoverage')?.params?.pct).toBe(100);
  });

  it('una melodía pentatónica (A C D E G) en La prefiere la pentatónica menor a la menor natural', () => {
    const notes: WeightedPc[] = [9, 0, 2, 4, 7, 9, 4, 0].map((pc) => ({
      pc: pc as PitchClass,
      weight: 1,
    }));
    const ranked = rankScalesForFragment({ notes, openingRoot: A, closingRoot: A });
    expect(ranked[0]!.value.scale).toMatchObject({ tonic: 9, type: 'minorPentatonic' });
    const minor = ranked.find((c) => c.value.scale.tonic === 9 && c.value.scale.type === 'minor')!;
    expect(minor.reasons.find((r) => r.code === 'scaleExtraNotes')?.params?.count).toBe(2);
  });

  it('la armadura desempata relativas cuando no hay pistas de apertura/cierre', () => {
    const notes = [...bar([9, 0, 4]), ...bar([2, 5, 9]), ...bar([7, 11, 2]), ...bar([0, 4, 7])];
    const minor = rankScalesForFragment({ notes, keySignature: { accidentalCount: 0, mode: 'minor' } });
    expect(minor[0]!.value.scale).toMatchObject({ tonic: 9, type: 'minor' });
    expect(minor[0]!.reasons.map((r) => r.code)).toContain('matchesKeySignature');
    const major = rankScalesForFragment({ notes, keySignature: { accidentalCount: 0, mode: 'major' } });
    expect(major[0]!.value.scale).toMatchObject({ tonic: 0, type: 'major' });
  });

  it('keySignatureTonic: sostenidos, bemoles y relativa menor', () => {
    expect(keySignatureTonic({ accidentalCount: 0, mode: 'major' })).toBe(0);
    expect(keySignatureTonic({ accidentalCount: 1, mode: 'major' })).toBe(7); // G
    expect(keySignatureTonic({ accidentalCount: -1, mode: 'major' })).toBe(5); // F
    expect(keySignatureTonic({ accidentalCount: -3, mode: 'minor' })).toBe(0); // Cm
    expect(keySignatureTonic({ accidentalCount: 1, mode: 'minor' })).toBe(4); // Em
  });

  it('tolerancia: maxOutsideRatio filtra escalas con demasiadas notas fuera, sin devolver []', () => {
    const notes = [...bar([0, 4, 7], [1])];
    const strict = rankScalesForFragment({ notes }, 'sharps', { maxOutsideRatio: 0 });
    expect(strict.length).toBeGreaterThan(0);
    expect(strict.every((c) => c.value.passingTones.length === 0)).toBe(true);
    // Cromatismo total: ninguna escala cumple la tolerancia → se devuelven todas ordenadas.
    const chromatic = Array.from({ length: 12 }, (_, pc) => ({ pc: pc as PitchClass, weight: 1 }));
    const all = rankScalesForFragment({ notes: chromatic }, 'sharps', { maxOutsideRatio: 0 });
    expect(all.length).toBe(12 * SCALE_TYPES.length);
  });

  it('las notas de paso se ordenan por peso y [] sin notas', () => {
    const ranked = rankScalesForFragment({
      notes: [...bar([0, 4, 7]), { pc: 1, weight: 0.2 }, { pc: 6, weight: 0.5 }],
      openingRoot: C,
    });
    const cMajor = ranked.find((c) => c.value.scale.tonic === 0 && c.value.scale.type === 'major')!;
    expect(cMajor.value.passingTones).toEqual([6, 1]);
    expect(rankScalesForFragment({ notes: [] })).toEqual([]);
  });
});
