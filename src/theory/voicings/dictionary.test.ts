import { describe, expect, it } from 'vitest';
import { pcsToMask } from '../core/pcset';
import { type PitchClass, pitchClassOf } from '../core/pitch';
import { CHORD_QUALITIES, getChordQuality } from '../data/chords';
import { STANDARD_TUNING } from '../data/tunings';
import {
  MOVABLE_VOICING_SHAPES,
  OPEN_VOICING_SHAPES,
  STANDARD_VOICING_SHAPES,
} from '../data/voicings/standard';
import { DEFAULT_FRETS, type StringNumber, positionToMidi } from '../fretboard';
import {
  type Voicing,
  formatVoicingLine,
  formatVoicingsAsTab,
  generateVoicingsMarkdown,
  parseChordSymbol,
  requiredFingers,
  resolveMovableShape,
  resolveOpenShape,
  voicingFretSpan,
  voicingsForChord,
} from './dictionary';

const ALL_ROOTS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function verifyVoicingIntegrity(voicing: Voicing): void {
  const quality = getChordQuality(voicing.quality);

  // 1. Calcular las notas MIDI reales directamente con positionToMidi desde los trastes.
  const realMidis: number[] = [];
  for (let i = 0; i < voicing.frets.length; i++) {
    const fret = voicing.frets[i];
    if (typeof fret === 'number') {
      expect(fret).toBeGreaterThanOrEqual(0);
      expect(fret).toBeLessThanOrEqual(DEFAULT_FRETS);
      const string = (6 - i) as StringNumber;
      realMidis.push(positionToMidi(STANDARD_TUNING, { string, fret }));
    }
  }

  expect(realMidis.length).toBeGreaterThanOrEqual(3);
  expect(voicing.midis).toEqual(realMidis);

  // 2. Comprobar intervalos requeridos y ausencia de notas ajenas al acorde.
  const relPcs = realMidis.map((midi) => pitchClassOf(midi - voicing.root));
  const relMask = pcsToMask(relPcs);

  expect(
    relMask & quality.requiredMask,
    `${voicing.id} (root=${voicing.root}) no contiene todos los intervalos requeridos`,
  ).toBe(quality.requiredMask);

  expect(
    relMask & ~quality.allowedMask,
    `${voicing.id} (root=${voicing.root}) contiene notas ajenas al acorde`,
  ).toBe(0);

  // 3. La nota más grave que suena es la raíz del acorde.
  const lowestMidi = Math.min(...realMidis);
  expect(pitchClassOf(lowestMidi)).toBe(voicing.root);

  // 4. Abarca como máximo 4 trastes.
  const span = voicingFretSpan(voicing.frets);
  expect(
    span,
    `${voicing.id} (root=${voicing.root}) abarca ${span} trastes (> 4)`,
  ).toBeLessThanOrEqual(4);

  // 5. Digitación coherente calculada desde los trastes: como máximo 4 dedos (cejilla = 1).
  const fingers = requiredFingers(voicing.frets);
  expect(voicing.fingers).toBe(fingers);
  expect(fingers).toBeGreaterThanOrEqual(1);
  expect(
    fingers,
    `${voicing.id} (root=${voicing.root}) requiere ${fingers} dedos (> 4)`,
  ).toBeLessThanOrEqual(4);
}

describe('voicings/dictionary — formato de datos y cálculo de dedos (T4a)', () => {
  it('las plantillas de datos no almacenan el campo fingers', () => {
    for (const shape of STANDARD_VOICING_SHAPES) {
      expect('fingers' in shape).toBe(false);
    }
  });

  it('calcula los dedos desde los trastes detectando cejillas válidas y bloqueos por cuerdas más graves', () => {
    // Abierto Am7 (x02010): 2 notas pulsadas, sin cejilla → 2 dedos
    expect(requiredFingers(['x', 0, 2, 0, 1, 0])).toBe(2);
    // F mayor cejilla E (133211): cejilla en traste 1 (3 cuerdas = 1 dedo) + 3 notas → 4 dedos
    expect(requiredFingers([1, 3, 3, 2, 1, 1])).toBe(4);
    // Cmaj7 cejilla A (x35453): cejilla en traste 3 (1 dedo) + 3 notas (traste 4 impide cejilla en 5) → 4 dedos
    expect(requiredFingers(['x', 3, 5, 4, 5, 3])).toBe(4);
    // C6 cejilla A (x35555): traste 3 (1 dedo) + cejilla en traste 5 (4 cuerdas = 1 dedo) → 2 dedos
    expect(requiredFingers(['x', 3, 5, 5, 5, 5])).toBe(2);
    // C9 móvil (x32333): traste 3 en 5ª (1 dedo), traste 2 en 4ª (1 dedo), cejilla traste 3 en 3ª–1ª (1 dedo) → 3 dedos
    expect(requiredFingers(['x', 3, 2, 3, 3, 3])).toBe(3);
    // B7 abierto (x21202): cuerdas en traste 2 separadas por traste 1 y cuerda 0 al aire → sin cejilla, 4 dedos
    expect(requiredFingers(['x', 2, 1, 2, 0, 2])).toBe(4);
  });
});

describe('voicings/dictionary — integridad con positionToMidi y cobertura de las 12 calidades', () => {
  it('todas las formas abiertas cumplen las restricciones de integridad reales con positionToMidi', () => {
    for (const shape of OPEN_VOICING_SHAPES) {
      const voicing = resolveOpenShape(shape);
      // Toda forma abierta usa al menos una cuerda al aire (0)
      expect(voicing.frets.includes(0)).toBe(true);
      verifyVoicingIntegrity(voicing);
    }
  });

  it('cada forma móvil transpuesta a las 12 raíces cumple las restricciones de integridad con positionToMidi', () => {
    for (const shape of MOVABLE_VOICING_SHAPES) {
      for (const root of ALL_ROOTS) {
        const voicing = resolveMovableShape(shape, root);
        // Toda forma de cejilla transpuesta tiene sus cuerdas pulsadas en traste >= 1
        for (const f of voicing.frets) {
          if (typeof f === 'number') {
            expect(f).toBeGreaterThanOrEqual(1);
          }
        }
        verifyVoicingIntegrity(voicing);
      }
    }
  });

  it('cada una de las 12 calidades en las 12 raíces (144 acordes) tiene al menos un voicing válido', () => {
    expect(CHORD_QUALITIES).toHaveLength(12);
    for (const quality of CHORD_QUALITIES) {
      for (const root of ALL_ROOTS) {
        const voicings = voicingsForChord(root, quality.id);
        expect(
          voicings.length,
          `El acorde root=${root} quality=${quality.id} se quedó sin digitación`,
        ).toBeGreaterThanOrEqual(1);
        for (const v of voicings) {
          verifyVoicingIntegrity(v);
        }
      }
    }
  });
});

describe('voicings/dictionary — impresión de formas y tablatura', () => {
  it('formatea Am7 con x02010 · A C E G · open en primer lugar', () => {
    const parsed = parseChordSymbol('Am7');
    expect(parsed).toEqual({ root: 9, quality: 'm7', mode: 'sharps' });

    const voicings = voicingsForChord(parsed!.root, parsed!.quality);
    const lines = voicings.map((v) => formatVoicingLine(v, parsed!.mode));

    expect(lines[0]).toBe('x02010 · A C E G · open');
    expect(lines).toContain('575555 · A C E G · barre-E');
    expect(lines).toContain('x-12-14-12-13-12 · A C E G · barre-A');
  });

  it('genera tablatura ASCII de 6 cuerdas y el documento markdown completo', () => {
    const voicings = voicingsForChord(9, 'm7');
    const tab = formatVoicingsAsTab([voicings[0]!]);
    expect(tab.split('\n')).toEqual(['e|-0-|', 'B|-1-|', 'G|-0-|', 'D|-2-|', 'A|-0-|', 'E|-x-|']);

    const md = generateVoicingsMarkdown();
    expect(md).toContain('x02010 · A C E G · open');
    for (const q of CHORD_QUALITIES) {
      expect(md).toContain(`(${q.name})`);
    }
  });
});
