import { describe, expect, it } from 'vitest';
import type { PitchClass } from '../core/pitch';
import type { ChordQualityId } from '../data/chords';
import { analyzeChordSequence } from './analyzeProgression';

const ch = (root: number, quality: ChordQualityId) => ({ root: root as PitchClass, quality });
const C_MAJOR = { tonic: 0 as PitchClass, type: 'major' as const };
const A_MINOR = { tonic: 9 as PitchClass, type: 'minor' as const };

describe('analyzeChordSequence — numerales y funciones', () => {
  it('criterio (g): C – G – Am – F en Do mayor → I – V – vi – IV y plantilla exacta', () => {
    const res = analyzeChordSequence(
      [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'm'), ch(5, 'maj')],
      C_MAJOR,
    );
    expect(res.scale.name).toBe('C Mayor');
    expect(res.chords.map((c) => c.roman)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(res.chords.every((c) => c.kind === 'diatonic')).toBe(true);
    expect(res.chords[2]!.chord?.name).toBe('Am');
    expect(res.chords[2]!.reasons).toEqual([{ code: 'diatonicDegree', params: { degree: 'vi' } }]);

    const top = res.progressions[0]!;
    expect(top.value.template.id).toBe('popI-V-vi-IV');
    expect(top.value.matchKind).toBe('exact');
    expect(top.value.key).toMatchObject({ tonic: 0, mode: 'major', name: 'C mayor' });
    expect(top.value.indices).toEqual([0, 1, 2, 3]);
    expect(top.reasons.map((r) => r.code)).toEqual(['matchesProgression', 'progressionCommonness']);
  });

  it('cuatríadas y numerales con sufijo: Dm7 – G7 – Cmaj7 → ii7 – V7 – Imaj7 (ii–V–I)', () => {
    const res = analyzeChordSequence([ch(2, 'm7'), ch(7, '7'), ch(0, 'maj7')], C_MAJOR);
    expect(res.chords.map((c) => c.roman)).toEqual(['ii7', 'V7', 'Imaj7']);
    expect(res.progressions[0]!.value).toMatchObject({
      matchKind: 'exact',
      template: { id: 'ii-V-I' },
    });
  });

  it('menor: Am – G – F – E7 → i – ♭VII – ♭VI – V7 (menor armónica) y cadencia andaluza', () => {
    const res = analyzeChordSequence([ch(9, 'm'), ch(7, 'maj'), ch(5, 'maj'), ch(4, '7')], A_MINOR);
    expect(res.chords.map((c) => c.roman)).toEqual(['i', '♭VII', '♭VI', 'V7']);
    expect(res.chords.map((c) => c.kind)).toEqual([
      'diatonic',
      'diatonic',
      'diatonic',
      'harmonicMinor',
    ]);
    expect(res.chords[3]!.reasons[0]!.code).toBe('harmonicMinorDegree');
    expect(res.progressions[0]!.value).toMatchObject({
      matchKind: 'exact',
      template: { id: 'andaluza' },
      key: { tonic: 9, mode: 'minor' },
    });
  });

  it('dominantes secundarios: E7 → Am es V7/vi y D7 → G es V7/V en Do mayor', () => {
    const res = analyzeChordSequence(
      [ch(0, 'maj'), ch(4, '7'), ch(9, 'm'), ch(2, '7'), ch(7, 'maj')],
      C_MAJOR,
    );
    expect(res.chords.map((c) => c.roman)).toEqual(['I', 'V7/vi', 'vi', 'V7/V', 'V']);
    expect(res.chords[1]!.kind).toBe('secondaryDominant');
    expect(res.chords[1]!.reasons[0]).toEqual({
      code: 'secondaryDominant',
      params: { degree: 'V7/vi', target: 'vi', targetRoot: 9, resolves: 1 },
    });
    expect(res.chords[3]!.reasons[0]!.params).toMatchObject({ degree: 'V7/V', resolves: 1 });
  });

  it('un dominante secundario que no resuelve se marca igualmente con resolves = 0', () => {
    const res = analyzeChordSequence([ch(9, 'maj'), ch(5, 'maj')], C_MAJOR);
    expect(res.chords[0]).toMatchObject({ roman: 'V/ii', kind: 'secondaryDominant' });
    expect(res.chords[0]!.reasons[0]!.params?.resolves).toBe(0);
  });

  it('préstamos modales en mayor: Fm (iv), B♭ (♭VII) y A♭ (♭VI) desde Do menor natural', () => {
    const res = analyzeChordSequence([ch(5, 'm'), ch(10, 'maj'), ch(8, 'maj')], C_MAJOR);
    expect(res.chords.map((c) => c.roman)).toEqual(['iv', '♭VII', '♭VI']);
    expect(res.chords.every((c) => c.kind === 'borrowed')).toBe(true);
    expect(res.chords[0]!.reasons[0]).toEqual({
      code: 'modalBorrowing',
      params: { degree: 'iv', sourceType: 'minor', tonic: 0 },
    });
  });

  it('D♭ en Do mayor es préstamo del frigio (♭II); un acorde sin modo paralelo es cromático', () => {
    const res = analyzeChordSequence([ch(1, 'maj'), ch(6, 'aug')], C_MAJOR);
    expect(res.chords[0]).toMatchObject({ roman: '♭II', kind: 'borrowed' });
    expect(res.chords[0]!.reasons[0]!.params?.sourceType).toBe('phrygian');
    expect(res.chords[1]).toMatchObject({ roman: '♭V+', kind: 'chromatic' });
    expect(res.chords[1]!.reasons[0]!.code).toBe('chromaticChord');
  });

  it('criterio (h): los numerales se recalculan respecto a la escala elegida (D dórico)', () => {
    const seq = [ch(2, 'm'), ch(7, 'maj'), ch(0, 'maj')];
    expect(analyzeChordSequence(seq, C_MAJOR).chords.map((c) => c.roman)).toEqual([
      'ii',
      'V',
      'I',
    ]);
    const dorian = analyzeChordSequence(seq, { tonic: 2 as PitchClass, type: 'dorian' });
    expect(dorian.scale.name).toBe('D Dórico');
    expect(dorian.chords.map((c) => c.roman)).toEqual(['i', 'IV', '♭VII']);
    expect(dorian.chords.every((c) => c.kind === 'diatonic')).toBe(true);
  });

  it('compases sin acorde (null) se marcan como no reconocidos sin romper el análisis', () => {
    const res = analyzeChordSequence([ch(0, 'maj'), null, ch(5, 'maj'), ch(7, 'maj')], C_MAJOR);
    expect(res.chords[1]).toEqual({
      index: 1,
      chord: null,
      roman: null,
      kind: 'unrecognized',
      reasons: [],
    });
    expect(res.progressions[0]!.value).toMatchObject({
      template: { id: 'I-IV-V' },
      matchKind: 'exact',
      indices: [0, 2, 3],
    });
  });

  it('secuencia vacía → sin acordes ni plantillas', () => {
    expect(analyzeChordSequence([], C_MAJOR)).toMatchObject({ chords: [], progressions: [] });
  });
});

describe('analyzeChordSequence — plantillas', () => {
  it('fusiona repeticiones consecutivas (un acorde por compás) antes de buscar plantillas', () => {
    const res = analyzeChordSequence(
      [ch(0, 'maj'), ch(0, 'maj'), ch(7, 'maj'), ch(7, 'maj'), ch(9, 'm'), ch(9, 'm'), ch(5, 'maj'), ch(5, 'maj')],
      C_MAJOR,
    );
    expect(res.progressions[0]!.value).toMatchObject({
      template: { id: 'popI-V-vi-IV' },
      matchKind: 'exact',
      indices: [0, 2, 4, 6],
    });
  });

  it('detecta subsecuencias (contains) y rotaciones de bucle con menor prioridad', () => {
    // C – G – Am – F: exacta I–V–vi–IV y, como bucle, vi–IV–I–V empezando en Am.
    const res = analyzeChordSequence(
      [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'm'), ch(5, 'maj')],
      C_MAJOR,
    );
    const rot = res.progressions.find((p) => p.value.template.id === 'vi-IV-I-V')!;
    expect(rot.value.matchKind).toBe('rotation');
    expect(rot.value.indices).toEqual([2, 3, 0, 1]);
    expect(rot.score).toBeLessThan(res.progressions[0]!.score);

    // G – C – F – G – C: contiene I–IV–V (C – F – G).
    const res2 = analyzeChordSequence(
      [ch(7, 'maj'), ch(0, 'maj'), ch(5, 'maj'), ch(7, 'maj'), ch(0, 'maj')],
      C_MAJOR,
    );
    const iv = res2.progressions.find((p) => p.value.template.id === 'I-IV-V')!;
    expect(iv.value).toMatchObject({ matchKind: 'contains', indices: [1, 2, 3] });
    expect(iv.reasons[0]).toEqual({
      code: 'matchesProgression',
      params: { kind: 'contains', name: 'I–IV–V' },
    });
  });

  it('familias de tríada: blues A7 – D7 – E7 encaja con I–IV–V; los power chords valen por mayor o menor', () => {
    const blues = analyzeChordSequence([ch(9, '7'), ch(2, '7'), ch(4, '7')], {
      tonic: 9 as PitchClass,
      type: 'mixolydian',
    });
    expect(blues.progressions[0]!.value).toMatchObject({ template: { id: 'I-IV-V' } });

    const rock = analyzeChordSequence([ch(4, '5'), ch(2, '5'), ch(0, '5'), ch(2, '5')], {
      tonic: 4 as PitchClass,
      type: 'minor',
    });
    expect(rock.progressions.map((p) => p.value.template.id)).toContain('i-VII-VI-VII');
  });

  it('las plantillas se evalúan sobre la tónica activa: C – G – Am – F en La menor no es I–V–vi–IV', () => {
    const res = analyzeChordSequence(
      [ch(0, 'maj'), ch(7, 'maj'), ch(9, 'm'), ch(5, 'maj')],
      A_MINOR,
    );
    expect(res.chords.map((c) => c.roman)).toEqual(['♭III', '♭VII', 'i', '♭VI']);
    const ids = res.progressions.map((p) => p.value.template.id);
    expect(ids).not.toContain('popI-V-vi-IV');
    // Como bucle sí aparece i–♭VI–♭III–♭VII (Am – F – C – G).
    expect(res.progressions.find((p) => p.value.template.id === 'i-VI-III-VII')?.value.matchKind).toBe(
      'rotation',
    );
  });
});
