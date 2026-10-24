import { degreeName } from '../core/interval';
import { hasPc, pcsToMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { SCALE_RANKING_SCORING, SCALE_TYPES } from '../data/scales';
import { allScales, catalogOrder, popcount, scaleRef } from './scaleUtils';
import type { AnalysisInput, Candidate, ScaleRef } from './types';

/**
 * Escalas que contienen todas las notas del acorde (`input.notes`). Orden: tónica igual a
 * `input.root`, peso de la escala en el catálogo, menos notas sobrantes. [] si ninguna encaja.
 */
export function rankScalesForChord(
  input: AnalysisInput,
  mode: NameMode = 'sharps',
): Candidate<ScaleRef>[] {
  const chordMask = pcsToMask(input.notes.map((n) => n.pc));
  const n = popcount(chordMask);
  if (n === 0) return [];

  const { ROOT_MATCH_BONUS, EXTRA_NOTE_PENALTY } = SCALE_RANKING_SCORING;
  const rows: { cand: Candidate<ScaleRef>; rootMatch: boolean; weight: number; extra: number }[] =
    [];
  for (const { tonic, type, mask } of allScales()) {
    if ((chordMask & mask) !== chordMask) continue;
    const extra = popcount(mask) - n;
    const rootMatch = input.root !== undefined && input.root === tonic;
    const reasons: Candidate<ScaleRef>['reasons'] = [
      { code: 'scaleContainsAllNotes', params: { n } },
    ];
    if (rootMatch) reasons.push({ code: 'tonicMatches', params: { tonic } });
    reasons.push({ code: 'scaleCommonness', params: { weight: type.weight } });
    reasons.push({ code: 'scaleExtraNotes', params: { count: extra } });
    rows.push({
      cand: {
        value: scaleRef(tonic, type, mode),
        score: (rootMatch ? ROOT_MATCH_BONUS : 0) + type.weight - extra * EXTRA_NOTE_PENALTY,
        reasons,
      },
      rootMatch,
      weight: type.weight,
      extra,
    });
  }
  rows.sort(
    (a, b) =>
      Number(b.rootMatch) - Number(a.rootMatch) ||
      b.weight - a.weight ||
      a.extra - b.extra ||
      catalogOrder(a.cand.value, b.cand.value),
  );
  return rows.map((r) => r.cand);
}

/** Escalas (cualquier tónica) que contienen la nota, de mayor a menor peso. */
export function scalesContaining(pc: PitchClass, mode: NameMode = 'sharps'): Candidate<ScaleRef>[] {
  const out: Candidate<ScaleRef>[] = [];
  for (const { tonic, type, mask } of allScales()) {
    if (!hasPc(mask, pc)) continue;
    out.push({
      value: scaleRef(tonic, type, mode),
      score: type.weight,
      reasons: [
        { code: 'scaleContainsNote', params: { pc, degree: degreeName(pc - tonic) } },
        { code: 'scaleCommonness', params: { weight: type.weight } },
      ],
    });
  }
  return out.sort((a, b) => b.score - a.score || catalogOrder(a.value, b.value));
}

/** Todas las escalas del catálogo con esa tónica, de mayor a menor peso. */
export function scalesOnTonic(pc: PitchClass, mode: NameMode = 'sharps'): Candidate<ScaleRef>[] {
  return SCALE_TYPES.map((type): Candidate<ScaleRef> => ({
    value: scaleRef(pc, type, mode),
    score: type.weight,
    reasons: [
      { code: 'tonicMatches', params: { tonic: pc } },
      { code: 'scaleCommonness', params: { weight: type.weight } },
    ],
  })).sort((a, b) => b.score - a.score || catalogOrder(a.value, b.value));
}
