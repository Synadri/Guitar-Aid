import { describe, expect, it } from 'vitest';
import { pcsToMask } from '../core/pcset';
import { type PitchClass, pitchClassOf } from '../core/pitch';
import { CHORD_QUALITIES, getChordQuality } from '../data/chords';
import { STANDARD_TUNING, type Tuning, getTuning } from '../data/tunings';
import {
  MOVABLE_VOICING_SHAPES,
  OPEN_VOICING_SHAPES,
  STANDARD_VOICING_SHAPES,
  inversionBassPitchClass,
} from '../data/voicings/standard';
import { DEFAULT_FRETS, type StringNumber, positionToMidi } from '../fretboard';
import { uniformSemitoneShift } from './adapt';
import {
  type Voicing,
  formatCompactFrets,
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

function verifyVoicingIntegrity(voicing: Voicing, tuning: Tuning = STANDARD_TUNING): void {
  const quality = getChordQuality(voicing.quality);

  // 1. Calcular las notas MIDI reales directamente con positionToMidi(tuning, ...) desde los trastes.
  const realMidis: number[] = [];
  for (let i = 0; i < voicing.frets.length; i++) {
    const fret = voicing.frets[i];
    if (typeof fret === 'number') {
      expect(fret).toBeGreaterThanOrEqual(0);
      expect(fret).toBeLessThanOrEqual(DEFAULT_FRETS);
      const string = (6 - i) as StringNumber;
      realMidis.push(positionToMidi(tuning, { string, fret }));
    }
  }

  expect(realMidis.length).toBeGreaterThanOrEqual(voicing.quality === '5' ? 2 : 3);
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

  // 3. Nota más grave según inversión:
  const lowestMidi = Math.min(...realMidis);
  const lowestPc = pitchClassOf(lowestMidi);
  if (voicing.inversion === 'root') {
    expect(lowestPc).toBe(voicing.root);
  } else {
    expect(realMidis.some((m) => pitchClassOf(m) === voicing.root)).toBe(true);
    const expectedPc = inversionBassPitchClass(voicing.root, voicing.quality, voicing.inversion);
    expect(lowestPc).toBe(expectedPc);
  }

  // 4. Abarca como máximo 4 trastes.
  const span = voicingFretSpan(voicing.frets);
  expect(
    span,
    `${voicing.id} (root=${voicing.root}) abarca ${span} trastes (> 4)`,
  ).toBeLessThanOrEqual(4);

  // 5. Digitación coherente calculada desde los trastes: como máximo 4 dedos (cejilla = 1).
  const fingers = requiredFingers(voicing.frets);
  expect(voicing.fingers).toBe(fingers);
  expect(fingers).toBeGreaterThanOrEqual(0);
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

describe('voicings/dictionary — integridad con positionToMidi y cobertura de las 19 calidades', () => {
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
        if (shape.family === 'barre-E' || shape.family === 'barre-A') {
          for (const f of voicing.frets) {
            if (typeof f === 'number') {
              expect(f).toBeGreaterThanOrEqual(1);
            }
          }
        } else {
          for (const f of voicing.frets) {
            if (typeof f === 'number') {
              expect(f).toBeGreaterThanOrEqual(0);
            }
          }
        }
        verifyVoicingIntegrity(voicing);
      }
    }
  });

  it('cada una de las 19 calidades en las 12 raíces (228 acordes) tiene al menos un voicing válido', () => {
    expect(CHORD_QUALITIES).toHaveLength(19);
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

  it('criterio (i): C mayor en cuerdas 1–3 incluye fundamental xxx553, 1ª inversión xxx988 y 2ª inversión xxx010', () => {
    const voicings = voicingsForChord(0, 'maj');
    const strings13 = voicings.filter((v) => v.family === 'strings-1-3');
    const compacts = strings13.map((v) => formatCompactFrets(v.frets));

    expect(compacts).toContain('xxx553');
    expect(compacts).toContain('xxx988');
    expect(compacts).toContain('xxx010');

    const rootVoicing = strings13.find((v) => formatCompactFrets(v.frets) === 'xxx553')!;
    expect(rootVoicing.inversion).toBe('root');
    expect(rootVoicing.rootString).toBe(3);

    const firstInvVoicing = strings13.find((v) => formatCompactFrets(v.frets) === 'xxx988')!;
    expect(firstInvVoicing.inversion).toBe('1st');
    expect(firstInvVoicing.rootString).toBe(1);

    const secondInvVoicing = strings13.find((v) => formatCompactFrets(v.frets) === 'xxx010')!;
    expect(secondInvVoicing.inversion).toBe('2nd');
    expect(secondInvVoicing.rootString).toBe(2);
  });

  it('las formas de cuerdas 1–4 incluyen posiciones fundamentales y Drop 2 en inversiones válidas', () => {
    const cMaj7Voicings = voicingsForChord(0, 'maj7').filter((v) => v.family === 'strings-1-4');
    expect(cMaj7Voicings.length).toBeGreaterThanOrEqual(3);

    const cMaj7Compacts = cMaj7Voicings.map((v) => formatCompactFrets(v.frets));
    // Fundamental (x-x-10-12-12-12), 1ª inv (xx2413), 2ª inv (xx5557), 3ª inv (xx9988)
    expect(cMaj7Compacts).toContain('x-x-10-12-12-12');
    expect(cMaj7Compacts).toContain('xx2413');
    expect(cMaj7Compacts).toContain('xx5557');
    expect(cMaj7Compacts).toContain('xx9988');
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

describe('voicings/adapt — adaptación a otras afinaciones (T4b)', () => {
  it('detecta el desplazamiento uniforme k comparando las cuerdas con la afinación estándar', () => {
    expect(uniformSemitoneShift(STANDARD_TUNING)).toBe(0);
    expect(uniformSemitoneShift(getTuning('halfDown')!)).toBe(1);
    expect(uniformSemitoneShift(getTuning('wholeDown')!)).toBe(2);
    expect(uniformSemitoneShift(getTuning('dropD')!)).toBeNull();
    expect(uniformSemitoneShift(getTuning('openG')!)).toBeNull();
  });

  it('en Eb (halfDown) y D (wholeDown), cada calidad × raíz tiene al menos un voicing y sus notas reales con positionToMidi son las del acorde', () => {
    for (const tuningId of ['halfDown', 'wholeDown'] as const) {
      const tuning = getTuning(tuningId)!;
      for (const quality of CHORD_QUALITIES) {
        for (const root of ALL_ROOTS) {
          const voicings = voicingsForChord({ root, quality: quality.id }, tuning);
          expect(
            voicings.length,
            `En ${tuningId}, root=${root} quality=${quality.id} se quedó sin voicing`,
          ).toBeGreaterThanOrEqual(1);
          for (const v of voicings) {
            verifyVoicingIntegrity(v, tuning);
          }
        }
      }
    }
  });

  it('en D (wholeDown), Re mayor incluye 022100 y en Eb (halfDown), Mi bemol mayor también', () => {
    const wholeDown = getTuning('wholeDown')!;
    const dMajorVoicings = voicingsForChord({ root: 2, quality: 'maj' }, wholeDown);
    expect(dMajorVoicings.map((v) => formatCompactFrets(v.frets))).toContain('022100');
    for (const v of dMajorVoicings) {
      verifyVoicingIntegrity(v, wholeDown);
    }

    const halfDown = getTuning('halfDown')!;
    const ebMajorVoicings = voicingsForChord({ root: 3, quality: 'maj' }, halfDown);
    expect(ebMajorVoicings.map((v) => formatCompactFrets(v.frets))).toContain('022100');
    for (const v of ebMajorVoicings) {
      verifyVoicingIntegrity(v, halfDown);
    }
  });

  it('en Drop D, Am sigue incluyendo x02210, E incluye 222100 y ningún voicing adaptado rompe una restricción', () => {
    const dropD = getTuning('dropD')!;

    const amVoicings = voicingsForChord({ root: 9, quality: 'm' }, dropD);
    expect(amVoicings.map((v) => formatCompactFrets(v.frets))).toContain('x02210');

    const eMajVoicings = voicingsForChord({ root: 4, quality: 'maj' }, dropD);
    expect(eMajVoicings.map((v) => formatCompactFrets(v.frets))).toContain('222100');

    let withoutVoicingCount = 0;
    for (const quality of CHORD_QUALITIES) {
      for (const root of ALL_ROOTS) {
        const dropVoicings = voicingsForChord({ root, quality: quality.id }, dropD);
        if (dropVoicings.length === 0) {
          withoutVoicingCount++;
        }
        for (const v of dropVoicings) {
          verifyVoicingIntegrity(v, dropD);
        }

        // Las formas estándar que no usan la cuerda 6 ('x') se mantienen idénticas.
        const stdVoicings = voicingsForChord({ root, quality: quality.id }, STANDARD_TUNING);
        for (const stdV of stdVoicings) {
          if (stdV.frets[0] === 'x') {
            const matching = dropVoicings.find((dv) => dv.id === stdV.id);
            expect(matching?.frets).toEqual(stdV.frets);
            expect(matching?.midis).toEqual(stdV.midis);
          }
        }
      }
    }

    console.info(
      `[Drop D] Combinaciones calidad × raíz sin voicing: ${withoutVoicingCount} / ${CHORD_QUALITIES.length * ALL_ROOTS.length}`,
    );
  });

  it('en las afinaciones abiertas (openG, openD, dadgad) devuelve []', () => {
    for (const tuningId of ['openG', 'openD', 'dadgad'] as const) {
      const tuning = getTuning(tuningId)!;
      for (const quality of CHORD_QUALITIES) {
        for (const root of ALL_ROOTS) {
          expect(voicingsForChord({ root, quality: quality.id }, tuning)).toEqual([]);
        }
      }
    }
  });
});
