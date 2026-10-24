import { describe, expect, it } from 'vitest';
import { maskToPcs, rotateMask } from '../core/pcset';
import type { PitchClass } from '../core/pitch';
import { SCALE_TYPES, SCALE_WEIGHTS, getScaleType, scalePitchClasses } from '../data/scales';
import { rankScalesForChord, scalesContaining, scalesOnTonic } from './rankScales';
import { toWeightedPcs } from './detectChords';

const A = 9 as PitchClass;
const C = 0 as PitchClass;

describe('catálogo de escalas', () => {
  it('la pentatónica menor de La contiene exactamente A, C, D, E, G', () => {
    expect([...scalePitchClasses(A, 'minorPentatonic')].sort((a, b) => a - b)).toEqual([
      0, 2, 4, 7, 9,
    ]);
    expect(maskToPcs(rotateMask(getScaleType('minorPentatonic').mask, A))).toEqual([0, 2, 4, 7, 9]);
  });

  it('blues y blues mayor llevan sus notas características', () => {
    expect(getScaleType('blues').intervals).toEqual([0, 3, 5, 6, 7, 10]);
    expect(getScaleType('majorBlues').intervals).toEqual([0, 2, 3, 4, 7, 9]);
  });

  it('mayor/jónico y menor natural/eólico son una sola entrada con alias', () => {
    const names = SCALE_TYPES.flatMap((s) => [s.name, ...s.aliases]);
    expect(new Set(names).size).toBe(names.length);
    expect(SCALE_TYPES.filter((s) => s.aliases.includes('Jónico'))).toHaveLength(1);
    expect(SCALE_TYPES.filter((s) => s.aliases.includes('Eólico'))).toHaveLength(1);
    expect(SCALE_TYPES.map((s) => s.id).filter((id) => id === 'major' || id === 'minor')).toEqual([
      'major',
      'minor',
    ]);
  });

  it('los pesos no tienen empates (el orden entre escalas es explícito)', () => {
    const weights = SCALE_TYPES.map((s) => s.weight);
    expect(new Set(weights).size).toBe(weights.length);
    expect(SCALE_WEIGHTS.harmonicMinor).toBe(SCALE_WEIGHTS.majorBlues + 1);
  });

  it('los pesos del catálogo vienen de SCALE_WEIGHTS', () => {
    for (const s of SCALE_TYPES) expect(s.weight).toBe(SCALE_WEIGHTS[s.id]);
  });
});

describe('rankScalesForChord', () => {
  it('Am7 con raíz A → dórico, eólico y pentatónica menor arriba; frigio por debajo', () => {
    const res = rankScalesForChord({ notes: toWeightedPcs([9, 0, 4, 7] as PitchClass[]), root: A });
    const types = res.map((c) => c.value.type);
    // El orden entre los tres lo fijan los pesos (minor 98 > dorian 92 > minorPentatonic 90).
    expect(types.slice(0, 3)).toEqual(['minor', 'dorian', 'minorPentatonic']);
    expect(types.indexOf('phrygian')).toBeGreaterThan(2);
    expect(res.slice(0, 3).every((c) => c.value.tonic === A)).toBe(true);
  });

  it('Cmaj7 con raíz C → jónico por encima de lidio, con razones que lo explican', () => {
    const res = rankScalesForChord({
      notes: toWeightedPcs([0, 4, 7, 11] as PitchClass[]),
      root: C,
    });
    const types = res.map((c) => c.value.type);
    expect(types).toContain('major');
    expect(types).toContain('lydian');
    expect(types.indexOf('major')).toBeLessThan(types.indexOf('lydian'));
    const major = res.find((c) => c.value.type === 'major')!;
    const codes = major.reasons.map((r) => r.code);
    expect(codes).toContain('scaleContainsAllNotes');
    expect(codes).toContain('tonicMatches');
    // Ambos tienen 3 notas sobrantes: lo que explica el orden es la popularidad (peso).
    const lydian = res.find((c) => c.value.type === 'lydian')!;
    const extraOf = (c: typeof major) =>
      c.reasons.find((r) => r.code === 'scaleExtraNotes')?.params;
    const weightOf = (c: typeof major) =>
      c.reasons.find((r) => r.code === 'scaleCommonness')?.params;
    expect(extraOf(major)).toEqual(extraOf(lydian));
    expect(weightOf(major)?.weight).toBe(SCALE_WEIGHTS.major);
    expect(weightOf(lydian)?.weight).toBe(SCALE_WEIGHTS.lydian);
    expect(weightOf(major)!.weight).toBeGreaterThan(weightOf(lydian)!.weight as number);
    expect(major.reasons.find((r) => r.code === 'scaleExtraNotes')?.params).toEqual({ count: 3 });
  });

  it('no duplica mayor/jónico ni menor/eólico', () => {
    const res = rankScalesForChord({ notes: toWeightedPcs([0, 4, 7] as PitchClass[]), root: C });
    const keys = res.map((c) => `${c.value.tonic}-${c.value.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(res.filter((c) => c.value.tonic === C && c.value.type === 'major')).toHaveLength(1);
  });

  it('un acorde que ninguna escala contiene → []', () => {
    // C, C♯, D, D♯, E: ninguna escala del catálogo tiene cinco semitonos consecutivos.
    const notes = toWeightedPcs([0, 1, 2, 3, 4] as PitchClass[]);
    expect(rankScalesForChord({ notes, root: C })).toEqual([]);
    expect(rankScalesForChord({ notes: [] })).toEqual([]);
  });

  it('la raíz ordena pero no filtra', () => {
    const res = rankScalesForChord({ notes: toWeightedPcs([9, 0, 4, 7] as PitchClass[]), root: A });
    expect(res.some((c) => c.value.tonic !== A)).toBe(true);
    const firstOther = res.findIndex((c) => c.value.tonic !== A);
    expect(res.slice(0, firstOther).every((c) => c.value.tonic === A)).toBe(true);
  });
});

describe('scalesContaining / scalesOnTonic', () => {
  it('scalesOnTonic devuelve todas las escalas de esa tónica', () => {
    const res = scalesOnTonic(A);
    expect(res).toHaveLength(SCALE_TYPES.length);
    expect(res.every((c) => c.value.tonic === A)).toBe(true);
    expect(new Set(res.map((c) => c.value.type))).toEqual(new Set(SCALE_TYPES.map((s) => s.id)));
    expect(res.every((c) => c.reasons[0]?.code === 'tonicMatches')).toBe(true);
  });

  it('scalesContaining solo devuelve escalas que contienen la nota, con su grado', () => {
    const res = scalesContaining(A);
    expect(res.length).toBeGreaterThan(0);
    for (const c of res) {
      const pcs = scalePitchClasses(c.value.tonic, c.value.type);
      expect(pcs).toContain(A);
      expect(c.reasons[0]?.code).toBe('scaleContainsNote');
    }
    const aMinPent = res.find((c) => c.value.tonic === A && c.value.type === 'minorPentatonic')!;
    expect(aMinPent.reasons[0]?.params?.degree).toBe('1');
  });
});
