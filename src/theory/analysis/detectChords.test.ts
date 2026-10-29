import { describe, expect, it } from 'vitest';
import { type PitchClass, pitchClassOf } from '../core/pitch';
import { nameToMidi } from '../core/spelling';
import { CHORD_QUALITIES, chordPitchClasses, chordTones } from '../data/chords';
import { chordDisplayName, chordName, detectChords, toWeightedPcs } from './detectChords';

function inputFromNames(names: string[], rootName?: string) {
  const notes = names.map((n) => {
    const midi = nameToMidi(n);
    if (midi === null) throw new Error(`Invalid note: ${n}`);
    return { pc: pitchClassOf(midi), weight: 1 };
  });
  const root = rootName !== undefined ? pitchClassOf(nameToMidi(rootName)!) : undefined;
  return { notes, ...(root !== undefined ? { root } : {}) };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) {
      out.push([items[i]!, ...p]);
    }
  }
  return out;
}

describe('catálogo de acordes e intervalos (criterio 3 y Fase 1.1)', () => {
  it('incluye las 19 calidades requeridas en Fase 1.1', () => {
    expect(CHORD_QUALITIES.map((q) => q.id)).toEqual([
      'maj',
      'm',
      '7',
      'maj7',
      'm7',
      '6',
      'm6',
      '9',
      'sus4',
      'sus2',
      'dim',
      'aug',
      '5',
      'add9',
      'madd9',
      'm7b5',
      'dim7',
      'mMaj7',
      'maj7#5',
    ]);
  });

  it('criterio 3: Am7 tiene notas A, C, E, G e intervalos fundamental, 3ª menor, 5ª justa, 7ª menor', () => {
    const tones = chordTones(9, 'm7');
    expect(tones.map((t) => t.name)).toEqual(['A', 'C', 'E', 'G']);
    expect(tones.map((t) => t.pc)).toEqual([9, 0, 4, 7]);
    expect(tones.map((t) => t.intervalLong)).toEqual([
      'fundamental',
      '3ª menor',
      '5ª justa',
      '7ª menor',
    ]);
    expect(tones.map((t) => t.interval)).toEqual(['P1', 'm3', 'P5', 'm7']);
    expect(tones.map((t) => t.degree)).toEqual(['1', '♭3', '5', '♭7']);
  });

  it('intervalos y grados específicos para dim, aug y 9', () => {
    expect(chordTones(0, 'dim').map((t) => [t.intervalLong, t.degree])).toEqual([
      ['fundamental', '1'],
      ['3ª menor', '♭3'],
      ['5ª disminuida', '♭5'],
    ]);
    expect(chordTones(0, 'aug').map((t) => [t.intervalLong, t.degree])).toEqual([
      ['fundamental', '1'],
      ['3ª mayor', '3'],
      ['5ª aumentada', '♯5'],
    ]);
    const c9 = chordTones(0, '9', 'flats');
    expect(c9.map((t) => [t.name, t.intervalLong, t.degree, t.optional])).toEqual([
      ['C', 'fundamental', '1', false],
      ['E', '3ª mayor', '3', false],
      ['G', '5ª justa', '5', true],
      ['B♭', '7ª menor', '♭7', false],
      ['D', '9ª mayor', '9', false],
    ]);
  });
});

describe('detectChords', () => {
  it('A♯ ≡ B♭: deletreos enarmónicos producen exactamente el mismo resultado', () => {
    // Acorde de A♯ / B♭ mayor (A♯/B♭ - D - F) y de G menor (G - A♯/B♭ - D)
    const fromSharps = detectChords(inputFromNames(['A#3', 'D4', 'F4'], 'A#3'));
    const fromFlats = detectChords(inputFromNames(['Bb3', 'D4', 'F4'], 'Bb3'));
    expect(fromSharps).toEqual(fromFlats);
    expect(fromSharps[0]?.value.root).toBe(10);
    expect(fromSharps[0]?.value.quality).toBe('maj');
    expect(chordName(fromSharps[0]!.value, 'sharps')).toBe('A♯');
    expect(chordName(fromFlats[0]!.value, 'flats')).toBe('B♭');

    const gmSharp = detectChords(inputFromNames(['G3', 'A♯3', 'D4'], 'G3'));
    const gmFlat = detectChords(inputFromNames(['G3', 'B♭3', 'D4'], 'G3'));
    expect(gmSharp).toEqual(gmFlat);
    expect(gmSharp[0]?.value).toEqual({ root: 7, quality: 'm', name: 'Gm' });
  });

  it('criterio 4: C-E-G → C mayor con código de razón estructurado', () => {
    const res = detectChords({ notes: toWeightedPcs([0, 4, 7]), root: 0 });
    expect(res).toHaveLength(1);
    expect(res[0]!.value).toEqual({ root: 0, quality: 'maj', name: 'C' });
    expect(res[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 3, of: 3 } },
      { code: 'rootMatches', params: { root: 0 } },
    ]);
  });

  it('C-E-G con raíz E (E en el bajo) → el primer candidato es C mayor con invertedBass y chordDisplayName = C/E', () => {
    const res = detectChords({ notes: toWeightedPcs([0, 4, 7]), root: 4 });
    expect(res).toHaveLength(1);
    expect(res[0]!.value).toEqual({ root: 0, quality: 'maj', name: 'C', bass: 4 });
    expect(res[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 3, of: 3 } },
      { code: 'invertedBass', params: { root: 0, bass: 4 } },
    ]);
    expect(chordDisplayName(res[0]!.value)).toBe('C/E');
  });

  it('las 24 permutaciones de C-E-G-A sin raíz (construidas a mano sin toWeightedPcs) producen resultado idéntico', () => {
    const manualNotes = [
      { pc: 0 as PitchClass, weight: 1 },
      { pc: 4 as PitchClass, weight: 1 },
      { pc: 7 as PitchClass, weight: 1 },
      { pc: 9 as PitchClass, weight: 1 },
    ];
    const allPerms = permutations(manualNotes);
    expect(allPerms).toHaveLength(24);

    const reference = detectChords({ notes: allPerms[0]! });
    expect(reference.map((c) => c.value.name)).toEqual(['C6', 'Am7']);
    for (const perm of allPerms) {
      expect(detectChords({ notes: perm })).toEqual(reference);
    }
  });

  it('criterio 5: C-E-G-A → [C6, Am7] sin elegir uno por el usuario; la raíz ordena pero no filtra', () => {
    // Sin raíz explícita: devuelve ambos [C6, Am7] de forma determinista e independiente del orden de entrada
    const withoutRoot = detectChords({ notes: toWeightedPcs([0, 4, 7, 9]) });
    const withoutRootReversed = detectChords({ notes: toWeightedPcs([9, 7, 4, 0]) });
    expect(withoutRoot).toEqual(withoutRootReversed);
    expect(withoutRoot.map((c) => c.value.name)).toEqual(['C6', 'Am7']);
    expect(withoutRoot[0]!.reasons.map((r) => r.code)).toEqual(['containsChordTones']);
    expect(withoutRoot[1]!.reasons.map((r) => r.code)).toEqual(['containsChordTones']);

    // Con raíz C (0): C6 primero (rootMatches) y Am7/C segundo (invertedBass)
    const withRootC = detectChords({ notes: toWeightedPcs([0, 4, 7, 9]), root: 0 });
    expect(withRootC.map((c) => c.value.name)).toEqual(['C6', 'Am7']);
    expect(withRootC.map((c) => chordDisplayName(c.value))).toEqual(['C6', 'Am7/C']);
    expect(withRootC[0]!.score).toBeGreaterThan(withRootC[1]!.score);
    expect(withRootC[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 4, of: 4 } },
      { code: 'rootMatches', params: { root: 0 } },
    ]);
    expect(withRootC[1]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 4, of: 4 } },
      { code: 'invertedBass', params: { root: 9, bass: 0 } },
    ]);

    // Con raíz A (9): Am7 primero (rootMatches) y C6/A segundo (invertedBass)
    const withRootA = detectChords({ notes: toWeightedPcs([0, 4, 7, 9]), root: 9 });
    expect(withRootA.map((c) => c.value.name)).toEqual(['Am7', 'C6']);
    expect(withRootA.map((c) => chordDisplayName(c.value))).toEqual(['Am7', 'C6/A']);
    expect(withRootA[0]!.reasons.map((r) => r.code)).toEqual(['containsChordTones', 'rootMatches']);
    expect(withRootA[1]!.reasons.map((r) => r.code)).toEqual([
      'containsChordTones',
      'invertedBass',
    ]);
  });

  it('conjunto sin acorde reconocible → []', () => {
    expect(detectChords({ notes: [] })).toEqual([]);
    // Una sola nota o un intervalo que no sea díada de 5ª no forman acorde
    expect(detectChords({ notes: toWeightedPcs([0]) })).toEqual([]);
    expect(detectChords({ notes: toWeightedPcs([0, 6]) })).toEqual([]); // tritono aislado
    expect(detectChords({ notes: toWeightedPcs([0, 3]) })).toEqual([]); // 3ª menor aislada
    // Clúster cromático C-C♯-D
    expect(detectChords({ notes: toWeightedPcs([0, 1, 2]) })).toEqual([]);
    // Conjunto con nota ajena (C-E-G-F♯)
    expect(detectChords({ notes: toWeightedPcs([0, 4, 7, 6]) })).toEqual([]);
  });

  it('criterio (m): díadas [0, 7] y digitaciones de power chord detectan unívocamente C5 y E5', () => {
    // [0, 7] sin raíz explícita reconoce de forma unívoca C5
    const c5 = detectChords({ notes: toWeightedPcs([0, 7]) });
    expect(c5).toHaveLength(1);
    expect(c5[0]!.value).toEqual({ root: 0, quality: '5', name: 'C5' });
    expect(c5[0]!.reasons).toEqual([{ code: 'containsChordTones', params: { n: 2, of: 2 } }]);

    // Notas de digitación 355xxx (G2, D3, G3) colapsan a G5
    const g5 = detectChords({ notes: toWeightedPcs([7, 2, 7]) });
    expect(g5).toHaveLength(1);
    expect(g5[0]!.value).toEqual({ root: 7, quality: '5', name: 'G5' });

    // Notas de digitación 022xxx (E2, B2, E3) colapsan a E5
    const e5 = detectChords({ notes: toWeightedPcs([4, 11, 4]) });
    expect(e5).toHaveLength(1);
    expect(e5[0]!.value).toEqual({ root: 4, quality: '5', name: 'E5' });

    // Presencia de terceras descarta '5' gracias a allowMask y evalúa el acorde mayor o menor
    const withMajorThird = detectChords({ notes: toWeightedPcs([0, 4, 7]) });
    expect(withMajorThird[0]!.value.quality).toBe('maj');
    expect(withMajorThird.some((c) => c.value.quality === '5')).toBe(false);

    const withMinorThird = detectChords({ notes: toWeightedPcs([0, 3, 7]) });
    expect(withMinorThird[0]!.value.quality).toBe('m');
    expect(withMinorThird.some((c) => c.value.quality === '5')).toBe(false);
  });

  it('criterio (g): D, F♯, A, E con raíz D reconoce Dadd9', () => {
    const res = detectChords(inputFromNames(['D4', 'F#4', 'A4', 'E4'], 'D4'));
    expect(res).toHaveLength(1);
    expect(res[0]!.value).toEqual({ root: 2, quality: 'add9', name: 'Dadd9' });
    expect(res[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 4, of: 4 } },
      { code: 'rootMatches', params: { root: 2 } },
    ]);
  });

  it('acorde 9 con 5ª opcional: reconoce con y sin 5ª y puntúa mejor el completo', () => {
    // C9 completo: C (0), E (4), G (7), B♭ (10), D (2)
    const fullC9 = detectChords({ notes: toWeightedPcs([0, 4, 7, 10, 2]), root: 0 }, 'flats');
    expect(fullC9).toHaveLength(1);
    expect(fullC9[0]!.value).toEqual({ root: 0, quality: '9', name: 'C9' });
    expect(fullC9[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 5, of: 5 } },
      { code: 'rootMatches', params: { root: 0 } },
    ]);

    // C9 sin 5ª (shell): C (0), E (4), B♭ (10), D (2)
    const shellC9 = detectChords({ notes: toWeightedPcs([0, 4, 10, 2]), root: 0 }, 'flats');
    expect(shellC9).toHaveLength(1);
    expect(shellC9[0]!.value).toEqual({ root: 0, quality: '9', name: 'C9' });
    expect(shellC9[0]!.reasons).toEqual([
      { code: 'containsChordTones', params: { n: 4, of: 5 } },
      { code: 'rootMatches', params: { root: 0 } },
      { code: 'omitsOptionalTones', params: { count: 1 } },
    ]);
    expect(fullC9[0]!.score).toBeGreaterThan(shellC9[0]!.score);
  });

  it('reconoce las 19 calidades del catálogo en las 12 raíces cuando se da la raíz', () => {
    for (let r = 0; r < 12; r++) {
      const root = r as PitchClass;
      for (const q of CHORD_QUALITIES) {
        const pcs = chordPitchClasses(root, q.id);
        const res = detectChords({ notes: toWeightedPcs(pcs), root });
        expect(res.length).toBeGreaterThanOrEqual(1);
        expect(res[0]!.value.root).toBe(root);
        expect(res[0]!.value.quality).toBe(q.id);
      }
    }
  });
});
