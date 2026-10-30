import { describe, expect, it } from 'vitest';
import { formulaOfChord, formulaOfScale } from './formulaOf';
import { identifyByFormula } from './identify';

describe('Hito A1: Fórmulas (teoría)', () => {
  describe('Criterio b: formulaOfChord y formulaOfScale', () => {
    it('formulaOfChord(Am7) = 1 ♭3 5 ♭7 (A C E G)', () => {
      const tones = formulaOfChord({ root: 9, quality: 'm7' });
      expect(tones.map((t) => t.degree)).toEqual(['1', '♭3', '5', '♭7']);
      expect(tones.map((t) => t.pc)).toEqual([9, 0, 4, 7]);
      expect(tones.map((t) => t.semitones)).toEqual([0, 3, 7, 10]);
      expect(tones.map((t) => t.intervalLong)).toEqual([
        'fundamental',
        '3ª menor',
        '5ª justa',
        '7ª menor',
      ]);
    });

    it('formulaOfChord(Bm7♭5) = 1 ♭3 ♭5 ♭7 (B D F A)', () => {
      const tones = formulaOfChord({ root: 11, quality: 'm7b5' });
      expect(tones.map((t) => t.degree)).toEqual(['1', '♭3', '♭5', '♭7']);
      expect(tones.map((t) => t.pc)).toEqual([11, 2, 5, 9]);
      expect(tones.map((t) => t.semitones)).toEqual([0, 3, 6, 10]);
      expect(tones[2]?.intervalLong).toBe('5ª disminuida');
    });

    it('formulaOfChord con extensiones (C9)', () => {
      const tones = formulaOfChord({ root: 0, quality: '9' });
      expect(tones.map((t) => t.degree)).toEqual(['1', '3', '5', '♭7', '9']);
      expect(tones.map((t) => t.semitones)).toEqual([0, 4, 7, 10, 14]);
      expect(tones[4]?.intervalLong).toBe('9ª mayor');
    });

    it('formulaOfScale(D dórico) = 1 2 ♭3 4 5 6 ♭7 (D E F G A B C)', () => {
      const tones = formulaOfScale({ tonic: 2, type: 'dorian' });
      expect(tones.map((t) => t.degree)).toEqual(['1', '2', '♭3', '4', '5', '6', '♭7']);
      expect(tones.map((t) => t.pc)).toEqual([2, 4, 5, 7, 9, 11, 0]);
      expect(tones.map((t) => t.semitones)).toEqual([0, 2, 3, 5, 7, 9, 10]);
      expect(tones.map((t) => t.intervalLong)).toEqual([
        'fundamental',
        '2ª mayor',
        '3ª menor',
        '4ª justa',
        '5ª justa',
        '6ª mayor',
        '7ª menor',
      ]);
    });

    it('formulaOfScale(C lidio) escribe ♯4 y 4ª aumentada para el tritono', () => {
      const tones = formulaOfScale({ tonic: 0, type: 'lydian' });
      expect(tones.map((t) => t.degree)).toEqual(['1', '2', '3', '♯4', '5', '6', '7']);
      expect(tones[3]?.degree).toBe('♯4');
      expect(tones[3]?.intervalLong).toBe('4ª aumentada');
      expect(tones[3]?.semitones).toBe(6);
    });
  });

  describe('Criterio c: identifyByFormula', () => {
    it('[0, 3, 7, 10] da m7 como exacta y 6 como «mismas notas con otra raíz» (sobre ♭3)', () => {
      const res = identifyByFormula({ semitones: [0, 3, 7, 10] });

      // Exacta: m7
      const exactM7 = res.exact.find(
        (c) => c.value.kind === 'chord' && c.value.quality === 'm7',
      );
      expect(exactM7).toBeDefined();
      expect(exactM7?.value.name).toBe('m7');
      expect(exactM7?.reasons[0]?.code).toBe('formulaExact');

      // Rotación: 6 sobre el ♭3
      const rot6 = res.rotations.find(
        (c) => c.value.kind === 'chord' && c.value.quality === '6',
      );
      expect(rot6).toBeDefined();
      expect(rot6?.value.name).toBe('6');
      expect(rot6?.reasons[0]?.code).toBe('sameNotesOtherRoot');
      expect(rot6?.reasons[0]?.params?.rootDegree).toBe('♭3');
    });

    it('[0, 2, 3, 5, 7, 9, 10] da dórico como exacta y mayor como «mismas notas con otra raíz» (sobre ♭7)', () => {
      const res = identifyByFormula({ semitones: [0, 2, 3, 5, 7, 9, 10] });

      // Exacta: dórico
      const exactDorian = res.exact.find(
        (c) => c.value.kind === 'scale' && c.value.type === 'dorian',
      );
      expect(exactDorian).toBeDefined();
      expect(exactDorian?.value.name).toBe('Dórico');

      // Rotación: mayor sobre el ♭7 (10 semitonos)
      const rotMajor = res.rotations.find(
        (c) => c.value.kind === 'scale' && c.value.type === 'major',
      );
      expect(rotMajor).toBeDefined();
      expect(rotMajor?.value.name).toBe('Mayor');
      expect(rotMajor?.reasons[0]?.code).toBe('sameNotesOtherRoot');
      expect(rotMajor?.reasons[0]?.params?.rootDegree).toBe('♭7');
    });

    it('[0, 4, 7, 10, 14] da 9 como exacta y 7 entre las cercanas («quita 9»)', () => {
      const res = identifyByFormula({ semitones: [0, 4, 7, 10, 14] });

      // Exacta: 9
      const exact9 = res.exact.find(
        (c) => c.value.kind === 'chord' && c.value.quality === '9',
      );
      expect(exact9).toBeDefined();
      expect(exact9?.value.name).toBe('9');

      // Cercana: 7 (quita 9)
      const near7 = res.near.find(
        (c) => c.value.kind === 'chord' && c.value.quality === '7',
      );
      expect(near7).toBeDefined();
      expect(near7?.value.name).toBe('7');
      expect(near7?.reasons.some((r) => r.code === 'formulaMissingTone' && r.params?.degree === '9')).toBe(
        true,
      );
    });

    it('[0, 4, 7, 11] da maj7 como exacta y maj entre las cercanas («quita 7»)', () => {
      const res = identifyByFormula({ semitones: [0, 4, 7, 11] });

      // Exacta: maj7
      const exactMaj7 = res.exact.find(
        (c) => c.value.kind === 'chord' && c.value.quality === 'maj7',
      );
      expect(exactMaj7).toBeDefined();
      expect(exactMaj7?.value.name).toBe('maj7');

      // Cercana: maj (quita 7)
      const nearMaj = res.near.find(
        (c) => c.value.kind === 'chord' && c.value.quality === 'maj',
      );
      expect(nearMaj).toBeDefined();
      expect(nearMaj?.value.name).toBe('maj');
      expect(nearMaj?.reasons.some((r) => r.code === 'formulaMissingTone' && r.params?.degree === '7')).toBe(
        true,
      );
    });

    it('identificación con raíz concreta asigna nombres de acordes y notas reales', () => {
      // Am7 con raíz A (9)
      const res = identifyByFormula({ semitones: [0, 3, 7, 10], root: 9 });
      expect(res.exact[0]?.value.name).toBe('Am7');
      expect(res.exact[0]?.value.kind).toBe('chord');
      if (res.exact[0]?.value.kind === 'chord') {
        expect(res.exact[0]?.value.root).toBe(9);
      }

      // Rotación a C6
      const rotC6 = res.rotations.find(
        (c) => c.value.kind === 'chord' && c.value.quality === '6',
      );
      expect(rotC6?.value.name).toBe('C6');
      if (rotC6?.value.kind === 'chord') {
        expect(rotC6?.value.root).toBe(0); // C = 9 + 3 mod 12 = 0
      }
    });

    it('filtro kind: chord o scale restringe los resultados', () => {
      const chordsOnly = identifyByFormula({ semitones: [0, 2, 4, 5, 7, 9, 11], kind: 'chord' });
      expect(chordsOnly.exact.every((c) => c.value.kind === 'chord')).toBe(true);

      const scalesOnly = identifyByFormula({ semitones: [0, 2, 4, 5, 7, 9, 11], kind: 'scale' });
      expect(scalesOnly.exact.every((c) => c.value.kind === 'scale')).toBe(true);
      expect(scalesOnly.exact[0]?.value.name).toBe('Mayor');
    });

    it('cercanas detecta añadir notas (formulaAddsTone)', () => {
      // maj [0, 4, 7] → maj7 añade 7, 7 añade ♭7
      const res = identifyByFormula({ semitones: [0, 4, 7] });
      const addsMaj7 = res.near.find(
        (c) => c.value.kind === 'chord' && c.value.quality === 'maj7',
      );
      expect(addsMaj7).toBeDefined();
      expect(addsMaj7?.reasons.some((r) => r.code === 'formulaAddsTone' && r.params?.degree === '7')).toBe(
        true,
      );
    });
  });
});
