import type { Degree, IntervalLongName } from '../core/interval';
import type { NameMode, PitchClass } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, chordTones } from '../data/chords';
import type { Candidate, ChordRef, Reason } from '../analysis/types';

export { scalesContaining, scalesOnTonic } from '../analysis/rankScales';

/** Papel armónico agrupado de una nota dentro de un acorde. */
export type NoteRoleCategory = 'fundamental' | '3ª' | '5ª' | '7ª' | 'extensión';

export interface ChordContainingMatch {
  chord: ChordRef;
  /** Grado respecto a la fundamental ('1', '♭3', '3', '5', '♭5', '♯5', '♭7', '7', '6', '9', '2', '4'). */
  role: Degree;
  /** Papel armónico agrupado ('fundamental', '3ª', '5ª', '7ª', 'extensión'). */
  category: NoteRoleCategory;
  /** Nombre descriptivo del intervalo ('fundamental', '3ª menor', '5ª justa', '7ª menor', '9ª mayor', etc.). */
  intervalLong: IntervalLongName;
}

/** Bonificación (< 1 punto de peso) cuando la nota actúa como fundamental del acorde. */
export const CHORD_CONTAINING_ROOT_BONUS = 0.5;

function roleCategory(semitones: number): NoteRoleCategory {
  if (semitones === 0) return 'fundamental';
  if (semitones === 3 || semitones === 4) return '3ª';
  if (semitones === 6 || semitones === 7 || semitones === 8) return '5ª';
  if (semitones === 10 || semitones === 11) return '7ª';
  return 'extensión';
}

/**
 * Acordes del catálogo (en las 12 raíces) que contienen la clase de altura `pc`, indicando el
 * papel de la nota (fundamental, 3ª, 5ª, 7ª o extensión).
 *
 * Orden: peso de la calidad en el catálogo y, a igualdad de peso, primero los acordes donde la
 * nota es la fundamental antes que como otro grado (desempate determinista por orden de catálogo
 * y clase de altura de la raíz).
 */
export function chordsContaining(
  pc: PitchClass,
  mode: NameMode = 'sharps',
): Candidate<ChordContainingMatch>[] {
  const rows: {
    cand: Candidate<ChordContainingMatch>;
    weight: number;
    isRoot: boolean;
    qi: number;
    root: PitchClass;
  }[] = [];

  CHORD_QUALITIES.forEach((q, qi) => {
    for (let r = 0; r < 12; r++) {
      const root = r as PitchClass;
      const tone = chordTones(root, q.id, mode).find((t) => t.pc === pc);
      if (!tone) continue;

      const isRoot = root === pc;
      const category = roleCategory(tone.semitones);
      const chord: ChordRef = {
        root,
        quality: q.id,
        name: `${pcName(root, mode)}${q.symbol}`,
      };
      const reasons: Reason[] = [
        {
          code: 'noteRoleInChord',
          params: {
            pc,
            role: tone.degree,
            degree: tone.degree,
            category,
            interval: tone.intervalLong,
          },
        },
      ];
      if (isRoot) {
        reasons.push({ code: 'rootMatches', params: { root } });
      }

      rows.push({
        cand: {
          value: {
            chord,
            role: tone.degree,
            category,
            intervalLong: tone.intervalLong,
          },
          score: q.weight + (isRoot ? CHORD_CONTAINING_ROOT_BONUS : 0),
          reasons,
        },
        weight: q.weight,
        isRoot,
        qi,
        root,
      });
    }
  });

  rows.sort(
    (a, b) =>
      b.weight - a.weight || Number(b.isRoot) - Number(a.isRoot) || a.qi - b.qi || a.root - b.root,
  );

  return rows.map((r) => r.cand);
}
