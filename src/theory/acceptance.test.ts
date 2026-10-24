import { describe, expect, it } from 'vitest';
import { rankScalesForChord } from './analysis/rankScales';
import { detectChords, toWeightedPcs } from './analysis/detectChords';
import { maskToPcs, rotateMask } from './core/pcset';
import { type PitchClass, pitchClassOf } from './core/pitch';
import { midiToName, nameToMidi, pcName } from './core/spelling';
import { chordTones } from './data/chords';
import { STANDARD_TUNING } from './data/tunings';
import { getScaleType, scalePitchClasses } from './data/scales';
import { midiToPositions, positionToMidi } from './fretboard';
import { diatonicChords, relatedScales } from './suggestions/forScale';

/**
 * Criterios de aceptación de la Fase 1 que cubre la capa de teoría (criterios 1 a 6 del
 * documento de requisitos, sección 8). Comprueban códigos de razón, no texto.
 */
const pcs = (names: string[]): PitchClass[] => names.map((n) => pitchClassOf(nameToMidi(n + '4')!));

describe('criterios de aceptación (teoría)', () => {
  it('1. cuerda 5, traste 7 en afinación estándar → E3, etiqueta E', () => {
    const midi = positionToMidi(STANDARD_TUNING, { string: 5, fret: 7 });
    expect(midiToName(midi)).toBe('E3');
    expect(pcName(pitchClassOf(midi))).toBe('E');
  });

  it('2. una nota del piano → todas sus posiciones equivalentes en el mástil', () => {
    const e3 = nameToMidi('E3')!;
    const positions = midiToPositions(STANDARD_TUNING, e3);
    expect(positions).toEqual(
      expect.arrayContaining([
        { string: 6, fret: 12 },
        { string: 5, fret: 7 },
        { string: 4, fret: 2 },
      ]),
    );
    expect(positions).toHaveLength(3);
  });

  it('3. Am7 → A, C, E, G con fundamental, 3ª menor, 5ª justa, 7ª menor', () => {
    const tones = chordTones(9, 'm7');
    expect(tones.map((t) => t.name)).toEqual(['A', 'C', 'E', 'G']);
    expect(tones.map((t) => t.intervalLong)).toEqual([
      'fundamental',
      '3ª menor',
      '5ª justa',
      '7ª menor',
    ]);
  });

  it('4. C, E, G → C mayor', () => {
    const res = detectChords({ notes: toWeightedPcs(pcs(['C', 'E', 'G'])) });
    expect(res[0]!.value).toMatchObject({ root: 0, quality: 'maj' });
    expect(res[0]!.reasons.map((r) => r.code)).toContain('containsChordTones');
  });

  it('5. C, E, G, A → C6 y Am7 sin elegir una (ambas candidatas)', () => {
    const res = detectChords({ notes: toWeightedPcs(pcs(['C', 'E', 'G', 'A'])) });
    const names = res.map((c) => `${c.value.root}-${c.value.quality}`);
    expect(names).toHaveLength(2);
    expect(names).toEqual(expect.arrayContaining(['0-6', '9-m7']));
  });

  it('6. La pentatónica menor: A C D E G, y sugiere acordes y escalas relacionadas', () => {
    const notes = scalePitchClasses(9, 'minorPentatonic');
    expect(maskToPcs(rotateMask(getScaleType('minorPentatonic').mask, 9))).toEqual([0, 2, 4, 7, 9]);
    expect(notes.map((n) => pcName(n))).toEqual(['A', 'C', 'D', 'E', 'G']);

    const scale = {
      tonic: 9 as PitchClass,
      type: 'minorPentatonic' as const,
      name: 'A Pentatónica menor',
    };
    const chords = diatonicChords(scale);
    const chordNames = chords.map((d) => d.chord.name);
    expect(chordNames).toEqual(expect.arrayContaining(['Am', 'Am7', 'C6', 'Asus4']));
    expect(chordNames).not.toContain('Em');
    expect(chords.map((d) => d.roman)).toContain('♭III');

    const related = relatedScales(scale);
    expect(related.length).toBeGreaterThan(0);
    expect(related[0]!.reasons.map((r) => r.code)).toContain('relativeScale');

    // Y sobre un acorde, la pentatónica entra en el ranking de escalas con sus razones.
    const ranked = rankScalesForChord({ notes: toWeightedPcs(pcs(['A', 'C', 'E', 'G'])), root: 9 });
    expect(ranked.slice(0, 3).map((c) => c.value.type)).toContain('minorPentatonic');
  });
});
