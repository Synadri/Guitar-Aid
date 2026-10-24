import { type PcMask, rotateMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { pcName } from '../core/spelling';
import { SCALE_TYPES, type ScaleType } from '../data/scales';
import type { ScaleRef } from './types';

/** Utilidades internas compartidas por los rankings y sugerencias de escalas (no públicas). */

export const ALL_PCS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function popcount(mask: PcMask): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

export function scaleRef(tonic: PitchClass, type: ScaleType, mode: NameMode): ScaleRef {
  return { tonic, type: type.id, name: `${pcName(tonic, mode)} ${type.name}` };
}

/** Todas las escalas (catálogo × 12 tónicas) con su máscara transpuesta. */
export function allScales(): { tonic: PitchClass; type: ScaleType; mask: PcMask }[] {
  const out: { tonic: PitchClass; type: ScaleType; mask: PcMask }[] = [];
  for (const type of SCALE_TYPES) {
    for (const tonic of ALL_PCS) out.push({ tonic, type, mask: rotateMask(type.mask, tonic) });
  }
  return out;
}

/** Desempate determinista: tipo en el orden del catálogo y luego tónica. */
export function catalogOrder(a: ScaleRef, b: ScaleRef): number {
  const ia = SCALE_TYPES.findIndex((t) => t.id === a.type);
  const ib = SCALE_TYPES.findIndex((t) => t.id === b.type);
  return ia - ib || a.tonic - b.tonic;
}
