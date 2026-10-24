import { describe, expect, it } from 'vitest';
import { getTuning, STANDARD_TUNING, TUNINGS } from '../data/tunings';
import { midiToName, nameToMidi } from '../core/spelling';
import { equivalentPositions, midiToPositions, positionToMidi, relocatePosition } from '.';

const dropD = getTuning('dropD')!;

describe('afinaciones', () => {
  it('todas tienen 6 cuerdas estrictamente ascendentes en el rango del piano C2–C7', () => {
    for (const t of TUNINGS) {
      expect(t.strings).toHaveLength(6);
      for (let i = 0; i < t.strings.length - 1; i++) {
        expect(t.strings[i + 1]!).toBeGreaterThan(t.strings[i]!);
      }
      expect(Math.min(...t.strings)).toBeGreaterThanOrEqual(nameToMidi('C2')!);
      expect(Math.max(...t.strings) + 24).toBeLessThanOrEqual(nameToMidi('C7')!);
    }
  });
  it('compara las siete afinaciones de la cuerda 6 a la 1 usando nameToMidi', () => {
    const expected: Record<string, string[]> = {
      standard: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      dropD: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
      dadgad: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
      openG: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
      openD: ['D2', 'A2', 'D3', 'F♯3', 'A3', 'D4'],
      halfDown: ['E♭2', 'A♭2', 'D♭3', 'G♭3', 'B♭3', 'E♭4'],
      wholeDown: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
    };
    expect(TUNINGS.map((t) => t.id)).toEqual(Object.keys(expected));
    for (const [id, noteNames] of Object.entries(expected)) {
      const tuning = getTuning(id)!;
      expect(tuning.strings).toEqual(noteNames.map((n) => nameToMidi(n)!));
    }
  });
});

describe('(cuerda, traste) ↔ midi', () => {
  it('criterio 1: cuerda 5, traste 7 → E3', () => {
    const midi = positionToMidi(STANDARD_TUNING, { string: 5, fret: 7 });
    expect(midiToName(midi)).toBe('E3');
  });
  it('cuerda 1 es la aguda, 6 la grave', () => {
    expect(positionToMidi(STANDARD_TUNING, { string: 1, fret: 0 })).toBe(64);
    expect(positionToMidi(STANDARD_TUNING, { string: 6, fret: 0 })).toBe(40);
  });
  it('mástil completo: E2–E6 en estándar con 24 trastes', () => {
    expect(positionToMidi(STANDARD_TUNING, { string: 1, fret: 24 })).toBe(88);
  });
  it('ida y vuelta', () => {
    for (const s of [1, 2, 3, 4, 5, 6] as const) {
      for (let fret = 0; fret <= 24; fret++) {
        const midi = positionToMidi(STANDARD_TUNING, { string: s, fret });
        expect(midiToPositions(STANDARD_TUNING, midi)).toContainEqual({ string: s, fret });
      }
    }
  });
});

describe('equivalentes (criterio 2, teoría)', () => {
  it('E3 en estándar: varias posiciones', () => {
    expect(midiToPositions(STANDARD_TUNING, 52)).toEqual([
      { string: 6, fret: 12 },
      { string: 5, fret: 7 },
      { string: 4, fret: 2 },
    ]);
  });
  it('equivalentes excluyen la propia posición', () => {
    const eq = equivalentPositions(STANDARD_TUNING, { string: 5, fret: 7 });
    expect(eq).toEqual([
      { string: 6, fret: 12 },
      { string: 4, fret: 2 },
    ]);
  });
  it('una nota fuera del mástil no tiene posiciones', () => {
    expect(midiToPositions(STANDARD_TUNING, 30)).toEqual([]);
    expect(midiToPositions(STANDARD_TUNING, 100)).toEqual([]);
  });
});

describe('recolocación (criterio 7, teoría)', () => {
  it('Drop D: la cuerda 6 baja dos tonos y la nota se mantiene en su cuerda si cabe', () => {
    // E2 era (6, 0); en Drop D es (6, 2).
    expect(relocatePosition(dropD, 40, { string: 6, fret: 0 })).toEqual({ string: 6, fret: 2 });
    // Las cuerdas no afectadas no cambian.
    expect(relocatePosition(dropD, 52, { string: 5, fret: 7 })).toEqual({ string: 5, fret: 7 });
  });
  it('una nota que no existe en la nueva afinación devuelve null', () => {
    // D2 (38) solo existe en la cuerda 6 de Drop D; en estándar no existe: null.
    expect(relocatePosition(STANDARD_TUNING, 38, { string: 6, fret: 0 })).toBeNull();
    // E3 estaba en (6, 12): en cuerda 6 sigue existiendo (traste 14 en Drop D).
    expect(relocatePosition(dropD, 52, { string: 6, fret: 12 })).toEqual({ string: 6, fret: 14 });
  });
  it('cae a otra cuerda cuando la original ya no llega', () => {
    // Nota 90 solo alcanzable... fuera de rango en todas: null
    expect(relocatePosition(dropD, 90, { string: 1, fret: 24 })).toBeNull();
    // Con pocos trastes, E3 en cuerda 6 (traste 14) no cabe en 12 trastes: pasa a la 5.
    expect(relocatePosition(dropD, 52, { string: 6, fret: 12 }, 12)).toEqual({
      string: 5,
      fret: 7,
    });
  });
});
