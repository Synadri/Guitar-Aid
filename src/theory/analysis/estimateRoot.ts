import type { PitchClass } from '../core/pitch';
import type { Candidate, Reason } from './types';

/**
 * Observación de una nota dentro de un compás o segmento, ya ponderada por la capa `song`
 * (duración × acento métrico × registro × articulación, plan_fase3 §3.2).
 */
export interface RootObservation {
  pc: PitchClass;
  /** Altura MIDI real (desempate: a igualdad, gana la clase que suena más grave). */
  midi: number;
  /** Peso rítmico/métrico de la nota (> 0; las notas con peso ≤ 0 se ignoran). */
  weight: number;
  /** La nota se ataca en el primer tiempo del compás o del cambio armónico. */
  isDownbeat: boolean;
  /** La nota es la más grave que suena en su pulso. */
  isBass: boolean;
}

/**
 * Constantes de puntuación de `estimateRoot` (centralizadas para ajuste; no tocar el algoritmo).
 * Cada componente se normaliza por el peso total del segmento, de modo que la puntuación no
 * depende de la duración del compás y es comparable entre compases.
 */
export const ROOT_ESTIMATION_SCORING = {
  /** Factor de la proporción de peso que la clase acumula sonando como bajo. */
  BASS_FACTOR: 3,
  /** Factor de la proporción de peso atacada en el tiempo 1. */
  DOWNBEAT_FACTOR: 1.5,
  /** Factor de la proporción de peso total (duración ponderada) de la clase. */
  TOTAL_FACTOR: 1,
  /** Factor de la proporción de peso de la 5ª justa cuando cuenta como soporte. */
  FIFTH_SUPPORT_FACTOR: 1,
  /**
   * Peso mínimo de la 5ª, relativo a la clase de altura con más peso del segmento, para contar
   * como soporte acústico (evita que una nota de paso breve refuerce una raíz falsa).
   */
  FIFTH_MIN_RATIO: 0.25,
} as const;

const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/**
 * Estima la raíz (fundamental armónica) de un compás o segmento a partir de sus notas ponderadas.
 *
 * Para cada clase de altura presente suma (normalizado por el peso total):
 * 1. peso sonando en el bajo (`bassNoteInBar`),
 * 2. peso atacado en el tiempo 1 (`downbeatAccent`),
 * 3. peso de su 5ª justa si está presente con peso significativo (`fifthSupport`),
 * 4. peso rítmico global; la clase con más peso recibe además `longestDuration`.
 *
 * Solo son candidatas las clases que suenan (no se infieren fundamentales ausentes). Orden:
 * puntuación, peso total, nota MIDI más grave y clase de altura (determinista). `[]` si no hay
 * notas con peso positivo.
 */
export function estimateRoot(observations: readonly RootObservation[]): Candidate<PitchClass>[] {
  const total = new Float64Array(12);
  const bass = new Float64Array(12);
  const downbeat = new Float64Array(12);
  const lowestMidi = new Array<number>(12).fill(Infinity);
  let totalWeight = 0;
  let totalBass = 0;
  let totalDownbeat = 0;

  for (const o of observations) {
    if (!(o.weight > 0)) continue;
    total[o.pc]! += o.weight;
    totalWeight += o.weight;
    if (o.isBass) {
      bass[o.pc]! += o.weight;
      totalBass += o.weight;
    }
    if (o.isDownbeat) {
      downbeat[o.pc]! += o.weight;
      totalDownbeat += o.weight;
    }
    if (o.midi < lowestMidi[o.pc]!) lowestMidi[o.pc] = o.midi;
  }
  if (totalWeight === 0) return [];

  const S = ROOT_ESTIMATION_SCORING;
  let maxPcWeight = 0;
  for (let pc = 0; pc < 12; pc++) maxPcWeight = Math.max(maxPcWeight, total[pc]!);

  const rows: { cand: Candidate<PitchClass>; total: number; lowest: number }[] = [];
  for (let r = 0; r < 12; r++) {
    const w = total[r]!;
    if (w === 0) continue;
    const root = r as PitchClass;
    const fifth = ((r + 7) % 12) as PitchClass;
    const fifthWeight = total[fifth]!;
    const fifthSupported = fifthWeight >= maxPcWeight * S.FIFTH_MIN_RATIO;

    const score =
      (S.BASS_FACTOR * bass[r]! +
        S.DOWNBEAT_FACTOR * downbeat[r]! +
        S.TOTAL_FACTOR * w +
        (fifthSupported ? S.FIFTH_SUPPORT_FACTOR * fifthWeight : 0)) /
      totalWeight;

    const reasons: Reason[] = [];
    if (bass[r]! > 0) reasons.push({ code: 'bassNoteInBar', params: { pct: pct(bass[r]!, totalBass) } });
    if (downbeat[r]! > 0) {
      reasons.push({ code: 'downbeatAccent', params: { pct: pct(downbeat[r]!, totalDownbeat) } });
    }
    if (fifthSupported) reasons.push({ code: 'fifthSupport', params: { fifth } });
    if (w === maxPcWeight) reasons.push({ code: 'longestDuration', params: { pct: pct(w, totalWeight) } });

    rows.push({ cand: { value: root, score, reasons }, total: w, lowest: lowestMidi[r]! });
  }

  rows.sort(
    (a, b) =>
      b.cand.score - a.cand.score ||
      b.total - a.total ||
      a.lowest - b.lowest ||
      a.cand.value - b.cand.value,
  );
  return rows.map((r) => r.cand);
}
