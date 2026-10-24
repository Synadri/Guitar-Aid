import { describe, expect, it } from 'vitest';
import type { PitchClass } from '../core/pitch';
import { CHORD_QUALITIES, chordPitchClasses } from '../data/chords';
import { getProgression, PROGRESSIONS, PROGRESSION_WEIGHTS } from '../data/progressions';
import type { ScaleRef } from '../analysis/types';
import { chordsContaining } from './forNote';
import { progressionChords, progressionsFor } from './forChord';
import { chordsWithinScale, diatonicChords, relatedScales } from './forScale';

const ref = (tonic: number, type: ScaleRef['type']): ScaleRef => ({
  tonic: tonic as PitchClass,
  type,
  name: '',
});
const A = 9 as PitchClass;
const C = 0 as PitchClass;
const G = 7 as PitchClass;
const codes = (c: { reasons: { code: string }[] }) => c.reasons.map((r) => r.code);

describe('chordsContaining', () => {
  it('devuelve solo acordes que contienen la clase de altura, con su papel (fundamental, 3ª, 5ª, 7ª, extensión)', () => {
    const res = chordsContaining(C);
    expect(res.length).toBeGreaterThan(0);

    for (const c of res) {
      const pcs = chordPitchClasses(c.value.chord.root, c.value.chord.quality);
      expect(pcs).toContain(C);
      expect(c.reasons[0]?.code).toBe('noteRoleInChord');
    }

    const findChord = (name: string) => res.find((c) => c.value.chord.name === name)!.value;
    // C en C mayor → fundamental (1)
    expect(findChord('C')).toMatchObject({
      role: '1',
      category: 'fundamental',
      intervalLong: 'fundamental',
    });
    // C en Am → 3ª menor (♭3)
    expect(findChord('Am')).toMatchObject({
      role: '♭3',
      category: '3ª',
      intervalLong: '3ª menor',
    });
    // C en F mayor → 5ª justa (5)
    expect(findChord('F')).toMatchObject({
      role: '5',
      category: '5ª',
      intervalLong: '5ª justa',
    });
    // C en Dm7 → 7ª menor (♭7)
    expect(findChord('Dm7')).toMatchObject({
      role: '♭7',
      category: '7ª',
      intervalLong: '7ª menor',
    });
    // C en B♭9 (A♯9) → 9ª mayor (9, extensión)
    expect(findChord('A♯9')).toMatchObject({
      role: '9',
      category: 'extensión',
      intervalLong: '9ª mayor',
    });
  });

  it('ordena por peso de la calidad y, a igualdad, la nota como fundamental antes que como otro grado', () => {
    const res = chordsContaining(C);
    const weightOf = (q: string) => CHORD_QUALITIES.find((x) => x.id === q)!.weight;

    for (let i = 1; i < res.length; i++) {
      const prev = res[i - 1]!.value;
      const curr = res[i]!.value;
      const wPrev = weightOf(prev.chord.quality);
      const wCurr = weightOf(curr.chord.quality);
      expect(wPrev).toBeGreaterThanOrEqual(wCurr);
      if (wPrev === wCurr && curr.role === '1') {
        expect(prev.role).toBe('1');
      }
    }

    // Dentro de las tríadas mayores (peso 100), C va antes que F y G♯; dentro de menores (peso 95), Cm va antes que Am y Fm.
    expect(res[0]!.value.chord.name).toBe('C');
    const minors = res.filter((c) => c.value.chord.quality === 'm').map((c) => c.value.chord.name);
    expect(minors[0]).toBe('Cm');
    expect(minors).toEqual(expect.arrayContaining(['Cm', 'Am', 'Fm']));

    // Entre m7 y 6 (ambos peso 88), Cm7 y C6 (donde C es fundamental) van antes que Am7 o F6.
    const w88 = res
      .filter((c) => weightOf(c.value.chord.quality) === 88)
      .map((c) => c.value.chord.name);
    expect(w88.slice(0, 2)).toEqual(['Cm7', 'C6']);
  });
});

describe('diatonicChords y chordsWithinScale', () => {
  it('diatonicChords de Do mayor da I, ii, iii, IV, V, vi, vii°', () => {
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

  it('los acordes de La menor pentatónica incluyen Am, Am7, C6 y Asus4 y no incluyen Em', () => {
    const scale = ref(A, 'minorPentatonic');
    const within = chordsWithinScale(scale);
    const fromDiatonic = diatonicChords(scale);
    expect(fromDiatonic).toEqual(within);

    const names = within.map((d) => d.chord.name);
    expect(names).toEqual(expect.arrayContaining(['Am', 'Am7', 'C6', 'Asus4']));
    expect(names).not.toContain('Em');

    // Ordenados por peso de calidad descendente.
    const weightOf = (q: string) => CHORD_QUALITIES.find((x) => x.id === q)!.weight;
    for (let i = 1; i < within.length; i++) {
      expect(weightOf(within[i - 1]!.chord.quality)).toBeGreaterThanOrEqual(
        weightOf(within[i]!.chord.quality),
      );
    }
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
    const res = progressionsFor({ root: A, quality: 'm' });
    const top = res[0]!;
    expect(top.value.key).toMatchObject({ tonic: C, mode: 'major' });
    expect(top.value.degree).toBe('vi');
    expect(top.value.template.id).toBe('popI-V-vi-IV');
    expect(codes(top)).toEqual(['appearsInKey', 'progressionCommonness']);
    expect(top.reasons[0]!.params).toMatchObject({ tonic: C, degree: 'vi' });
    // Am también es la tónica de La menor.
    expect(res.some((c) => c.value.key.mode === 'minor' && c.value.key.tonic === A)).toBe(true);
  });

  it('progressionsFor con Am7 devuelve Do mayor con grado vi y Sol mayor con grado ii', () => {
    const res = progressionsFor({ root: A, quality: 'm7' });
    expect(
      res.some(
        (c) => c.value.key.tonic === C && c.value.key.mode === 'major' && c.value.degree === 'vi',
      ),
    ).toBe(true);
    expect(
      res.some(
        (c) => c.value.key.tonic === G && c.value.key.mode === 'major' && c.value.degree === 'ii',
      ),
    ).toBe(true);
  });

  it('apila terceras sobre el grado: C7 es V de Fa mayor (no I de Do mayor) y Cmaj7 es I de Do / IV de Sol (no V de Fa)', () => {
    const F = 5 as PitchClass;
    const c7 = progressionsFor({ root: C, quality: '7' });
    expect(
      c7.some(
        (c) => c.value.key.tonic === F && c.value.key.mode === 'major' && c.value.degree === 'V',
      ),
    ).toBe(true);
    expect(c7.some((c) => c.value.key.tonic === C && c.value.key.mode === 'major')).toBe(false);

    const g7 = progressionsFor({ root: G, quality: '7' });
    expect(
      g7.some(
        (c) => c.value.key.tonic === C && c.value.key.mode === 'major' && c.value.degree === 'V',
      ),
    ).toBe(true);
    expect(g7.some((c) => c.value.key.tonic === G && c.value.key.mode === 'major')).toBe(false);

    const cmaj7 = progressionsFor({ root: C, quality: 'maj7' });
    expect(
      cmaj7.some(
        (c) => c.value.key.tonic === C && c.value.key.mode === 'major' && c.value.degree === 'I',
      ),
    ).toBe(true);
    expect(
      cmaj7.some(
        (c) => c.value.key.tonic === G && c.value.key.mode === 'major' && c.value.degree === 'IV',
      ),
    ).toBe(true);
    expect(cmaj7.some((c) => c.value.key.tonic === F && c.value.key.mode === 'major')).toBe(false);
  });

  it('dentro de una misma plantilla prioriza la tonalidad donde el acorde es tónica (I/i)', () => {
    const res = progressionsFor({ root: G, quality: 'maj' }).filter(
      (c) => c.value.template.id === 'I-IV-V',
    );
    expect(res[0]!.value.key.tonic).toBe(G);
    expect(res[0]!.value.degree).toBe('I');
  });

  it('los acordes que acompañan salen de la plantilla y la tonalidad', () => {
    const chords = progressionChords(getProgression('popI-V-vi-IV'), C);
    expect(chords.map((c) => c.chord.name)).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('un acorde que no está en ninguna plantilla → []', () => {
    expect(progressionsFor({ root: C, quality: 'aug' })).toEqual([]);
  });

  it('las 10 plantillas tienen pesos distintos', () => {
    expect(PROGRESSIONS).toHaveLength(10);
    const w = PROGRESSIONS.map((p) => p.weight);
    expect(new Set(w).size).toBe(w.length);
    expect(Object.keys(PROGRESSION_WEIGHTS)).toHaveLength(PROGRESSIONS.length);
  });
});
