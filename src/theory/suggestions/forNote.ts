import type { Degree, IntervalLongName } from '../core/interval';
import { pcsToMask, rotateMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, chordTones } from '../data/chords';
import { popcount } from '../analysis/scaleUtils';
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

/** Constantes de puntuación para `chordsContainingAll`. */
export const CHORDS_CONTAINING_ALL_SCORING = {
  ROOT_MATCH_BONUS: 10000,
  EXTRA_NOTE_PENALTY: 100,
} as const;

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

/**
 * Acordes del catálogo (en las 12 raíces) que contienen todas las clases de altura dadas en `pcs`.
 *
 * Orden:
 * 1. la raíz del acorde coincide con `root` (si se proporciona);
 * 2. menos notas sobrantes en el acorde (`extra = totalTones - presentTones`);
 * 3. peso de la calidad en el catálogo;
 * 4. desempate determinista por orden de catálogo y clase de altura de la raíz.
 *
 * Devuelve `[]` si `pcs` está vacío o si ningún acorde del catálogo contiene todas las notas.
 */
export function chordsContainingAll(
  pcs: readonly PitchClass[],
  root?: PitchClass,
  mode: NameMode = 'sharps',
): Candidate<ChordRef>[] {
  const inputMask = pcsToMask(pcs);
  const n = popcount(inputMask);
  if (n === 0) return [];

  const rows: {
    cand: Candidate<ChordRef>;
    rootMatch: boolean;
    extra: number;
    weight: number;
    qi: number;
    chordRoot: PitchClass;
  }[] = [];

  CHORD_QUALITIES.forEach((q, qi) => {
    for (let r = 0; r < 12; r++) {
      const chordRoot = r as PitchClass;
      const chordMask = rotateMask(q.allowedMask, chordRoot);
      if ((inputMask & chordMask) !== inputMask) continue;

      const totalTones = q.intervals.length;
      const extra = totalTones - n;
      const rootMatch = root !== undefined && chordRoot === root;

      const reasons: Reason[] = [{ code: 'containsChordTones', params: { n, of: totalTones } }];

      if (n === 1) {
        const singlePc = pcs.find((p) => (inputMask & (1 << p)) !== 0)!;
        const tone = chordTones(chordRoot, q.id, mode).find((t) => t.pc === singlePc);
        if (tone) {
          reasons.push({
            code: 'noteRoleInChord',
            params: {
              pc: singlePc,
              role: tone.degree,
              degree: tone.degree,
              category: roleCategory(tone.semitones),
              interval: tone.intervalLong,
            },
          });
        }
      }

      if (rootMatch) {
        reasons.push({ code: 'rootMatches', params: { root: chordRoot } });
      }
      reasons.push({ code: 'chordExtraNotes', params: { count: extra } });

      const score =
        (rootMatch ? CHORDS_CONTAINING_ALL_SCORING.ROOT_MATCH_BONUS : 0) -
        extra * CHORDS_CONTAINING_ALL_SCORING.EXTRA_NOTE_PENALTY +
        q.weight;

      rows.push({
        cand: {
          value: {
            root: chordRoot,
            quality: q.id,
            name: `${pcName(chordRoot, mode)}${q.symbol}`,
          },
          score,
          reasons,
        },
        rootMatch,
        extra,
        weight: q.weight,
        qi,
        chordRoot,
      });
    }
  });

  rows.sort(
    (a, b) =>
      Number(b.rootMatch) - Number(a.rootMatch) ||
      a.extra - b.extra ||
      b.weight - a.weight ||
      a.qi - b.qi ||
      a.chordRoot - b.chordRoot,
  );

  return rows.map((r) => r.cand);
}
