import type { NameMode, PitchClass } from '../core/pitch';
import { pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';
import { type ChordQualityId, getChordQuality } from '../data/chords';
import { PROGRESSIONS, type ProgressionTemplate } from '../data/progressions';
import type { Candidate, ChordRef, KeyRef, ProgressionRef } from '../analysis/types';

export interface ProgressionMatch {
  key: KeyRef;
  /** Numeración romana que ocupa el acorde en la progresión (p. ej. "vi", "V7"). */
  degree: string;
  template: ProgressionRef;
}

function keyRef(tonic: PitchClass, mode: KeyRef['mode'], nameMode: NameMode): KeyRef {
  return {
    tonic,
    mode,
    name: `${pcName(tonic, nameMode)} ${mode === 'major' ? 'mayor' : 'menor'}`,
  };
}

/**
 * Progresiones de la tabla de plantillas que incluyen el acorde (misma fundamental y calidad),
 * en cada una de las 12 tonalidades donde aparece. Orden: popularidad de la plantilla
 * (`progressionCommonness`), luego la tónica de la tonalidad (determinista). Razones:
 * `appearsInKey` (`{ tonic, mode, degree }`) y `progressionCommonness` (`{ weight }`).
 * Para los acordes que la acompañan, ver `progressionChords`.
 */
export function progressionsFor(
  chord: { root: PitchClass; quality: ChordQualityId },
  mode: NameMode = 'sharps',
): Candidate<ProgressionMatch>[] {
  const out: Candidate<ProgressionMatch>[] = [];
  for (const template of PROGRESSIONS) {
    for (let t = 0; t < 12; t++) {
      const tonic = t as PitchClass;
      const seen = new Set<string>();
      for (const step of template.steps) {
        if (step.quality !== chord.quality) continue;
        if (pitchClassOf(tonic + step.offset) !== chord.root) continue;
        if (seen.has(step.roman)) continue;
        seen.add(step.roman);
        out.push({
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
        });
      }
    }
  }
  return out.sort(
    (a, b) =>
      b.score - a.score ||
      a.value.key.tonic - b.value.key.tonic ||
      a.value.degree.localeCompare(b.value.degree),
  );
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
