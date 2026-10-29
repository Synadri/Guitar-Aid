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
import {
  diatonicChords,
  groupedRelatedScales,
  relatedScales,
  scaleParentContext,
} from './suggestions/forScale';

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

  it('Fase 1.1 criterio (b): D dórico muestra que es el II grado de C mayor', () => {
    const ctx = scaleParentContext({
      tonic: 2 as PitchClass,
      type: 'dorian',
      name: 'D Dórico',
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.description).toBe('II grado de C mayor');
    expect(ctx!.parentScale).toMatchObject({ tonic: 0, type: 'major' });
    expect(ctx!.degreeNumber).toBe(2);
    expect(ctx!.degreeRoman).toBe('II');
    expect(ctx!.isSelfParent).toBe(false);
  });

  it('Fase 1.1 criterio (c): C mayor en cuatríadas (7ª): Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5', () => {
    const chords = diatonicChords(
      { tonic: 0 as PitchClass, type: 'major', name: 'C Mayor' },
      'sharps',
      'sevenths',
    );
    expect(chords.map((d) => d.chord.name)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7♭5',
    ]);
    expect(chords.map((d) => d.roman)).toEqual([
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viiø7',
    ]);
  });

  it('Fase 1.1 criterio (d): A menor armónica en cuatríadas (7ª): Am(maj7), Bm7♭5, Cmaj7♯5, Dm7, E7, Fmaj7, G♯dim7', () => {
    const chords = diatonicChords(
      { tonic: 9 as PitchClass, type: 'harmonicMinor', name: 'A Menor armónica' },
      'sharps',
      'sevenths',
    );
    expect(chords.map((d) => d.chord.name)).toEqual([
      'Am(maj7)',
      'Bm7♭5',
      'Cmaj7♯5',
      'Dm7',
      'E7',
      'Fmaj7',
      'G♯dim7',
    ]);
    expect(chords.map((d) => d.roman)).toEqual([
      'i(maj7)',
      'iiø7',
      '♭IIImaj7♯5',
      'iv7',
      'V7',
      '♭VImaj7',
      'vii°7',
    ]);
  });

  it('Fase 1.1 criterio (j): C mayor agrupa escalas relativas mostrando cada una con su grado (I..VII)', () => {
    const grouped = groupedRelatedScales({
      tonic: 0 as PitchClass,
      type: 'major',
      name: 'C Mayor',
    });
    const romans = [...new Set(grouped.relatives.map((r) => r.degreeRoman))];
    expect(romans).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
    expect(grouped.relatives.find((r) => r.scale.type === 'dorian')).toMatchObject({
      degreeRoman: 'II',
      scale: { tonic: 2 },
    });
    expect(grouped.relatives.find((r) => r.scale.type === 'minor')).toMatchObject({
      degreeRoman: 'VI',
      scale: { tonic: 9 },
    });
    expect(grouped.byProximity.length).toBeGreaterThan(0);
    expect(grouped.byProximity.every((c) => c.value.tonic === 0)).toBe(true);
  });
});
