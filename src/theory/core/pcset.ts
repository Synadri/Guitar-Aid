import type { PitchClass } from './pitch';

/** Conjunto de clases de altura como máscara de 12 bits (bit n = clase n). */
export type PcMask = number;

export function pcsToMask(pcs: Iterable<PitchClass>): PcMask {
  let mask = 0;
  for (const pc of pcs) mask |= 1 << pc;
  return mask;
}

export function maskToPcs(mask: PcMask): PitchClass[] {
  const out: PitchClass[] = [];
  for (let i = 0; i < 12; i++) if (mask & (1 << i)) out.push(i as PitchClass);
  return out;
}

export function hasPc(mask: PcMask, pc: PitchClass): boolean {
  return (mask & (1 << pc)) !== 0;
}

/** Transpone el conjunto n semitonos hacia arriba. */
export function rotateMask(mask: PcMask, n: number): PcMask {
  const k = ((n % 12) + 12) % 12;
  return ((mask << k) | (mask >> (12 - k))) & 0xfff;
}
