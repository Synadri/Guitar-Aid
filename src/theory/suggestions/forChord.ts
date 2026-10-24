import { pcsToMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';
import { type ChordQualityId, getChordQuality } from '../data/chords';
import { PROGRESSIONS, type ProgressionStep, type ProgressionTemplate } from '../data/progressions';
import { getScaleType } from '../data/scales';
import type { Candidate, ChordRef, KeyRef, ProgressionRef } from '../analysis/types';

export interface ProgressionMatch {
  key: KeyRef;
  /** Numeración romana que ocupa el acorde en la progresión (p. ej. "vi", "ii", "V"). */
  degree: string;
  template: ProgressionRef;
}

const MAJOR_INTERVALS = getScaleType('major').intervals;
const MINOR_INTERVALS = getScaleType('minor').intervals;
const HARMONIC_MINOR_INTERVALS = getScaleType('harmonicMinor').intervals;

function keyRef(tonic: PitchClass, mode: KeyRef['mode'], nameMode: NameMode): KeyRef {
  return {
    tonic,
    mode,
    name: `${pcName(tonic, nameMode)} ${mode === 'major' ? 'mayor' : 'menor'}`,
  };
}

function scaleIntervalsForStep(mode: 'major' | 'minor', step: ProgressionStep): readonly number[] {
  if (mode === 'major') return MAJOR_INTERVALS;
  // En modo menor, el grado V mayor (dominante) procede de la escala menor armónica.
  if (step.offset === 7 && step.quality === 'maj') return HARMONIC_MINOR_INTERVALS;
  return MINOR_INTERVALS;
}

/**
 * Comprueba si el acorde de calidad `chordQuality` coincide con el acorde diatónico que se forma
 * apilando terceras (tríada 1–3–5, cuatríada 1–3–5–7, novena 1–3–5–7–9 o sexta 1–3–5–6) sobre el
 * grado `step` de la escala de la tonalidad. Así, p. ej., C7 encaja como V de Fa mayor pero no
 * como I de Do mayor (donde la cuatríada diatónica es Cmaj7).
 */
function stepMatchesChord(
  mode: 'major' | 'minor',
  step: ProgressionStep,
  chordQuality: ChordQualityId,
): boolean {
  const iv = scaleIntervalsForStep(mode, step);
  const k = iv.indexOf(step.offset);
  if (k === -1) return false;

  const rootInt = iv[k]!;
  const deg = (d: number): PitchClass => ((iv[(k + d) % 7]! - rootInt + 12) % 12) as PitchClass;
  const third = deg(2);
  const fifth = deg(4);

  let stackedPcs: PitchClass[];
  if (chordQuality === '7' || chordQuality === 'maj7' || chordQuality === 'm7') {
    stackedPcs = [0, third, fifth, deg(6)];
  } else if (chordQuality === '9') {
    stackedPcs = [0, third, fifth, deg(6), deg(1)];
  } else if (chordQuality === '6' || chordQuality === 'm6') {
    stackedPcs = [0, third, fifth, deg(5)];
  } else {
    stackedPcs = [0, third, fifth];
  }

  return getChordQuality(chordQuality).allowedMask === pcsToMask(stackedPcs);
}

/**
 * Progresiones de la tabla de plantillas que incluyen el acorde en cada una de las 12 tonalidades
 * donde es diatónico al grado de la plantilla (comparando sus notas con las terceras apiladas
 * sobre los intervalos de la escala en ese grado).
 *
 * Orden: popularidad de la plantilla (`progressionCommonness`); a igualdad de plantilla, primero
 * la tonalidad cuya tónica coincide con la fundamental del acorde (`I`/`i`), luego la aparición
 * más temprana dentro de la progresión y por último la clase de altura de la tónica (0..11).
 * Razones: `appearsInKey` (`{ tonic, mode, degree }`) y `progressionCommonness` (`{ weight }`).
 */
export function progressionsFor(
  chord: { root: PitchClass; quality: ChordQualityId },
  mode: NameMode = 'sharps',
): Candidate<ProgressionMatch>[] {
  const rows: {
    cand: Candidate<ProgressionMatch>;
    weight: number;
    isTonicOfKey: boolean;
    stepIndex: number;
    tonic: PitchClass;
  }[] = [];

  for (const template of PROGRESSIONS) {
    for (let t = 0; t < 12; t++) {
      const tonic = t as PitchClass;
      const seen = new Set<string>();
      template.steps.forEach((step, stepIndex) => {
        if (pitchClassOf(tonic + step.offset) !== chord.root) return;
        if (!stepMatchesChord(template.mode, step, chord.quality)) return;
        if (seen.has(step.roman)) return;
        seen.add(step.roman);
        rows.push({
          cand: {
            value: {
              key: keyRef(tonic, template.mode, mode),
              degree: step.roman,
              template: { id: template.id, name: template.name },
            },
            score: template.weight,
            reasons: [
              { code: 'appearsInKey', params: { tonic, mode: template.mode, degree: step.roman } },
              { code: 'progressionCommonness', params: { weight: template.weight } },
            ],
          },
          weight: template.weight,
          isTonicOfKey: tonic === chord.root,
          stepIndex,
          tonic,
        });
      });
    }
  }

  rows.sort(
    (a, b) =>
      b.weight - a.weight ||
      Number(b.isTonicOfKey) - Number(a.isTonicOfKey) ||
      a.stepIndex - b.stepIndex ||
      a.tonic - b.tonic ||
      a.cand.value.degree.localeCompare(b.cand.value.degree),
  );

  return rows.map((r) => r.cand);
}

/** Acordes concretos de una plantilla de progresión en una tonalidad (en orden de la progresión). */
export function progressionChords(
  template: ProgressionTemplate,
  tonic: PitchClass,
  mode: NameMode = 'sharps',
): { roman: string; chord: ChordRef }[] {
  return template.steps.map((s) => {
    const root = pitchClassOf(tonic + s.offset);
    return {
      roman: s.roman,
      chord: {
        root,
        quality: s.quality,
        name: `${pcName(root, mode)}${getChordQuality(s.quality).symbol}`,
      },
    };
  });
}
