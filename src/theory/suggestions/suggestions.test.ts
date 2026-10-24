import { describe, expect, it } from 'vitest';
import type { PitchClass } from '../core/pitch';
import { getProgression, PROGRESSIONS, PROGRESSION_WEIGHTS } from '../data/progressions';
import type { ScaleRef } from '../analysis/types';
import { progressionChords, progressionsFor } from './forChord';
import { diatonicChords, relatedScales } from './forScale';

const ref = (tonic: number, type: ScaleRef['type']): ScaleRef => ({
  tonic: tonic as PitchClass,
  type,
  name: '',
});
const A = 9;
const C = 0;
const codes = (c: { reasons: { code: string }[] }) => c.reasons.map((r) => r.code);

describe('diatonicChords', () => {
  it('Do mayor: C Dm Em F G Am Bdim con romanos I ii iii IV V vi vii°', () => {
    const res = diatonicChords(ref(C, 'major'));
    expect(res.map((d) => d.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(res.map((d) => d.chord.name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  });

  it('La menor natural: i ii° ♭III iv v ♭VI ♭VII', () => {
    const res = diatonicChords(ref(A, 'minor'));
    expect(res.map((d) => d.roman)).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
    expect(res.map((d) => d.chord.name)).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  });

  it('La menor armónica: ♭III+ y V mayor', () => {
    const res = diatonicChords(ref(A, 'harmonicMinor'));
    expect(res.map((d) => d.roman)).toEqual(['i', 'ii°', '♭III+', 'iv', 'V', '♭VI', 'vii°']);
    expect(res[2]!.chord.quality).toBe('aug');
    expect(res[4]!.chord.name).toBe('E');
  });

  it('la pentatónica menor de La usa los acordes de La menor natural', () => {
    expect(diatonicChords(ref(A, 'minorPentatonic'))).toEqual(diatonicChords(ref(A, 'minor')));
  });
});

describe('relatedScales', () => {
  it('pentatónica menor de La: la relativa (Do pentatónica mayor) primero, y el resto con razones', () => {
    const res = relatedScales(ref(A, 'minorPentatonic'));
    const first = res[0]!;
    expect(first.value).toMatchObject({ tonic: C, type: 'majorPentatonic' });
    expect(codes(first)).toContain('relativeScale');
    const find = (t: number, type: ScaleRef['type']) =>
      res.find((c) => c.value.tonic === t && c.value.type === type);
    expect(codes(find(A, 'minor')!)).toEqual(
      expect.arrayContaining(['sharedParentScale', 'closeScaleVariant']),
    );
    expect(codes(find(2, 'dorian')!)).toContain('sharedParentScale');
    expect(codes(find(A, 'blues')!)).toContain('closeScaleVariant');
    expect(res.some((c) => c.value.tonic === A && c.value.type === 'minorPentatonic')).toBe(false);
    for (const c of res) expect(codes(c)).toContain('scaleCommonness');
  });

  it('Do mayor: relativa La menor y modos de la misma madre; sin duplicados', () => {
    const res = relatedScales(ref(C, 'major'));
    expect(res[0]!.value).toMatchObject({ tonic: A, type: 'minor' });
    const keys = res.map((c) => `${c.value.tonic}-${c.value.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    const dorian = res.find((c) => c.value.tonic === 2 && c.value.type === 'dorian')!;
    expect(codes(dorian)).toContain('sharedParentScale');
    const mixo = res.find((c) => c.value.tonic === C && c.value.type === 'mixolydian')!;
    expect(codes(mixo)).toContain('closeScaleVariant');
  });

  it('blues de La ↔ blues mayor de Do (relativas)', () => {
    const res = relatedScales(ref(A, 'blues'));
    expect(res[0]!.value).toMatchObject({ tonic: C, type: 'majorBlues' });
  });
});

describe('progressionsFor', () => {
  it('Am aparece como vi de Do mayor en I–V–vi–IV, la más popular', () => {
    const res = progressionsFor({ root: A as PitchClass, quality: 'm' });
    const top = res[0]!;
    expect(top.value.key).toMatchObject({ tonic: C, mode: 'major' });
    expect(top.value.degree).toBe('vi');
    expect(top.value.template.id).toBe('popI-V-vi-IV');
    expect(codes(top)).toEqual(['appearsInKey', 'progressionCommonness']);
    expect(top.reasons[0]!.params).toMatchObject({ tonic: C, degree: 'vi' });
    // Am también es la tónica de La menor.
    expect(res.some((c) => c.value.key.mode === 'minor' && c.value.key.tonic === A)).toBe(true);
  });

  it('los acordes que acompañan salen de la plantilla y la tonalidad', () => {
    const chords = progressionChords(getProgression('popI-V-vi-IV'), C as PitchClass);
    expect(chords.map((c) => c.chord.name)).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('un acorde que no está en ninguna plantilla → []', () => {
    expect(progressionsFor({ root: C as PitchClass, quality: 'aug' })).toEqual([]);
  });

  it('los pesos de las progresiones son distintos', () => {
    const w = PROGRESSIONS.map((p) => p.weight);
    expect(new Set(w).size).toBe(w.length);
    expect(Object.keys(PROGRESSION_WEIGHTS)).toHaveLength(PROGRESSIONS.length);
  });
});
