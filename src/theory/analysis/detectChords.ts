import { type PcMask, rotateMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, type ChordQualityId, getChordQuality } from '../data/chords';
import type { AnalysisInput, Candidate, ChordRef, Reason, WeightedPc } from './types';

function popcount12(mask: PcMask): number {
  let count = 0;
  let m = mask & 0xfff;
  while (m !== 0) {
    m &= m - 1;
    count++;
  }
  return count;
}

/** Convierte una lista de clases de altura en `WeightedPc[]` con el mismo peso (por defecto 1). */
export function toWeightedPcs(pcs: Iterable<PitchClass>, weight: number = 1): WeightedPc[] {
  const out: WeightedPc[] = [];
  for (const pc of pcs) out.push({ pc, weight });
  return out;
}

/** Nombre base de un acorde según el modo de enarmonía (p. ej. "C", "Am7", "B♭maj7"). */
export function chordName(
  chord: { root: PitchClass; quality: ChordQualityId },
  mode: NameMode = 'sharps',
): string {
  const q = getChordQuality(chord.quality);
  return `${pcName(chord.root, mode)}${q.symbol}`;
}

/**
 * Nombre completo del acorde incluyendo el bajo si es una inversión
 * (p. ej. "C6", "Am7/C").
 */
export function chordDisplayName(
  chord: { root: PitchClass; quality: ChordQualityId; bass?: PitchClass },
  mode: NameMode = 'sharps',
): string {
  const base = chordName(chord, mode);
  if (chord.bass !== undefined && chord.bass !== chord.root) {
    return `${base}/${pcName(chord.bass, mode)}`;
  }
  return base;
}

/**
 * Detecta todos los acordes del catálogo compatibles con las clases de altura de entrada.
 *
 * - Coincide cuando están todos los intervalos requeridos y no sobra ninguna nota
 *   fuera de requeridos ∪ opcionales.
 * - La raíz de entrada ordena los candidatos pero no los filtra (p. ej. C-E-G-A → [C6, Am7]).
 * - Devuelve `[]` si ningún acorde del catálogo explica el conjunto de notas.
 */
export function detectChords(
  input: AnalysisInput,
  mode: NameMode = 'sharps',
): Candidate<ChordRef>[] {
  let inputMask: PcMask = 0;
  const weightByPc = new Float64Array(12);
  const firstIndexByPc = new Int32Array(12).fill(Number.MAX_SAFE_INTEGER);

  input.notes.forEach((n, idx) => {
    if (n.weight <= 0) return;
    inputMask |= 1 << n.pc;
    weightByPc[n.pc] = (weightByPc[n.pc] ?? 0) + n.weight;
    if (idx < (firstIndexByPc[n.pc] ?? Number.MAX_SAFE_INTEGER)) {
      firstIndexByPc[n.pc] = idx;
    }
  });

  if (inputMask === 0) return [];

  const presentTones = popcount12(inputMask);
  const candidates: Array<{ candidate: Candidate<ChordRef>; firstIdx: number }> = [];

  for (let r = 0; r < 12; r++) {
    const root = r as PitchClass;
    for (const q of CHORD_QUALITIES) {
      const reqMask = rotateMask(q.requiredMask, root);
      if ((inputMask & reqMask) !== reqMask) continue;

      const allowMask = rotateMask(q.allowedMask, root);
      if ((inputMask & ~allowMask) !== 0) continue;

      const totalTones = q.intervals.length;
      const omittedOptional = totalTones - presentTones;

      const reasons: Reason[] = [
        { code: 'containsChordTones', params: { n: presentTones, of: totalTones } },
      ];

      let rootMatchBonus = 0;
      let bass: PitchClass | undefined;

      if (input.root !== undefined) {
        if (root === input.root) {
          rootMatchBonus = 1000;
          reasons.push({ code: 'rootMatches', params: { root } });
        } else {
          bass = input.root;
          reasons.push({ code: 'invertedBass', params: { root, bass: input.root } });
        }
      }

      if (omittedOptional > 0) {
        reasons.push({ code: 'omitsOptionalTones', params: { count: omittedOptional } });
      }

      const rootWeight = weightByPc[root] ?? 1;
      const score = rootMatchBonus - omittedOptional * 200 + q.weight + (rootWeight - 1) * 10;

      const ref: ChordRef = {
        root,
        quality: q.id,
        name: `${pcName(root, mode)}${q.symbol}`,
        ...(bass !== undefined ? { bass } : {}),
      };

      candidates.push({
        candidate: { value: ref, score, reasons },
        firstIdx: firstIndexByPc[root] ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.candidate.score !== a.candidate.score) {
      return b.candidate.score - a.candidate.score;
    }
    if (a.firstIdx !== b.firstIdx) {
      return a.firstIdx - b.firstIdx;
    }
    return a.candidate.value.root - b.candidate.value.root;
  });

  return candidates.map((c) => c.candidate);
}
