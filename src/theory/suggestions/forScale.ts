import { type PcMask, pcsToMask, rotateMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, type ChordQuality } from '../data/chords';
import { RELATED_SCALE_SCORING, SCALE_TYPES, type ScaleType, getScaleType } from '../data/scales';
import { allScales, catalogOrder, popcount, scaleRef } from '../analysis/scaleUtils';
import type { Candidate, DiatonicChord, Reason, ScaleRef } from '../analysis/types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const CHROMATIC_ROMAN = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '♭V',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII',
] as const;
/** Intervalos de la escala mayor: referencia para la alteración de cada grado (♭III, ♭VII…). */
const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const;

const TRIADS = CHORD_QUALITIES.filter(
  (q) =>
    q.intervals.length === 3 &&
    (q.id === 'maj' || q.id === 'm' || q.id === 'dim' || q.id === 'aug'),
);

function romanForChordInScale(tonic: PitchClass, root: PitchClass, q: ChordQuality): string {
  const semitones = (root - tonic + 12) % 12;
  const base = CHROMATIC_ROMAN[semitones]!;
  const minorLike = q.id === 'm' || q.id === 'm7' || q.id === 'm6' || q.id === 'dim';
  const numeral = minorLike ? base.toLowerCase() : base;
  let suffix = '';
  if (q.id === 'dim') suffix = '°';
  else if (q.id === 'aug') suffix = '+';
  else if (q.id === 'm7') suffix = '7';
  else if (q.id === 'm6') suffix = '6';
  else if (q.id !== 'maj' && q.id !== 'm') suffix = q.symbol;
  return `${numeral}${suffix}`;
}

/**
 * Acordes del catálogo, en cualquier raíz, cuyas notas estén todas contenidas en la escala,
 * ordenados por el peso de su calidad en el catálogo (a igualdad de peso: primero la tónica de
 * la escala como raíz, luego orden de catálogo y grado relativo a la tónica).
 */
export function chordsWithinScale(scale: ScaleRef, mode: NameMode = 'sharps'): DiatonicChord[] {
  const type = getScaleType(scale.type);
  const scaleMask = rotateMask(type.mask, scale.tonic);
  const rows: {
    entry: DiatonicChord;
    weight: number;
    onTonic: boolean;
    qi: number;
    relOffset: number;
  }[] = [];

  CHORD_QUALITIES.forEach((q, qi) => {
    for (let r = 0; r < 12; r++) {
      const root = r as PitchClass;
      const chordMask = rotateMask(q.allowedMask, root);
      if ((chordMask & scaleMask) !== chordMask) continue;
      rows.push({
        entry: {
          roman: romanForChordInScale(scale.tonic, root, q),
          chord: { root, quality: q.id, name: `${pcName(root, mode)}${q.symbol}` },
        },
        weight: q.weight,
        onTonic: root === scale.tonic,
        qi,
        relOffset: (root - scale.tonic + 12) % 12,
      });
    }
  });

  rows.sort(
    (a, b) =>
      b.weight - a.weight ||
      Number(b.onTonic) - Number(a.onTonic) ||
      a.qi - b.qi ||
      a.relOffset - b.relOffset,
  );

  return rows.map((r) => r.entry);
}

/**
 * Acordes diatónicos (tríadas apiladas en terceras sobre cada grado) de una escala heptatónica,
 * con numeración romana (mayúscula = mayor/aumentado, minúscula = menor/disminuido, `°` y `+`,
 * y ♭/♯ cuando el grado se aleja de la escala mayor). Las escalas no heptatónicas (pentatónicas y
 * blues) usan `chordsWithinScale`: todos los acordes del catálogo cuyas notas pertenecen a la
 * escala, ordenados por peso.
 *
 * En escalas heptatónicas se devuelven solo tríadas porque las séptimas diatónicas (m7♭5, mMaj7,
 * dim7) no están en el catálogo de acordes de la Fase 1.
 */
export function diatonicChords(scale: ScaleRef, mode: NameMode = 'sharps'): DiatonicChord[] {
  const type = getScaleType(scale.type);
  if (type.intervals.length !== 7) {
    return chordsWithinScale(scale, mode);
  }
  const iv = type.intervals;
  const out: DiatonicChord[] = [];
  for (let k = 0; k < 7; k++) {
    const rootInt = iv[k]!;
    const third = (iv[(k + 2) % 7]! - rootInt + 12) % 12;
    const fifth = (iv[(k + 4) % 7]! - rootInt + 12) % 12;
    const mask: PcMask = pcsToMask([0, third, fifth] as PitchClass[]);
    const quality = TRIADS.find((q) => q.requiredMask === mask);
    if (!quality) continue;
    const root = pitchClassOf(scale.tonic + rootInt);
    const diff = rootInt - MAJOR_OFFSETS[k]!;
    const accidental = diff < 0 ? '♭' : diff > 0 ? '♯' : '';
    const minorLike = quality.id === 'm' || quality.id === 'dim';
    const numeral = minorLike ? ROMAN[k]!.toLowerCase() : ROMAN[k]!;
    const suffix = quality.id === 'dim' ? '°' : quality.id === 'aug' ? '+' : '';
    out.push({
      roman: `${accidental}${numeral}${suffix}`,
      chord: { root, quality: quality.id, name: `${pcName(root, mode)}${quality.symbol}` },
    });
  }
  return out;
}

interface Acc {
  tonic: PitchClass;
  type: ScaleType;
  reasons: Reason[];
  score: number;
}

/**
 * Escalas relacionadas con la seleccionada:
 * - `relativeScale`: la relativa mayor/menor (mismas notas, otra tónica);
 * - `sharedParentScale`: modos (y pentatónicas) de la misma escala madre;
 * - `closeScaleVariant`: misma tónica y diferencia de pocas notas (`added`/`removed`).
 * Una misma escala puede acumular varias razones. Orden: nivel de relación, luego peso del
 * catálogo (`scaleCommonness`).
 */
export function relatedScales(scale: ScaleRef, mode: NameMode = 'sharps'): Candidate<ScaleRef>[] {
  const sel = getScaleType(scale.type);
  const found = new Map<string, Acc>();

  const add = (tonic: PitchClass, type: ScaleType, reason: Reason, bonus: number): void => {
    if (tonic === scale.tonic && type.id === scale.type) return;
    const key = `${tonic}-${type.id}`;
    const acc = found.get(key) ?? { tonic, type, reasons: [], score: type.weight };
    acc.reasons.push(reason);
    acc.score += bonus;
    found.set(key, acc);
  };

  if (sel.relative) {
    const rel = getScaleType(sel.relative.type);
    add(
      pitchClassOf(scale.tonic + sel.relative.offset),
      rel,
      { code: 'relativeScale', params: { type: rel.id } },
      RELATED_SCALE_SCORING.RELATIVE_BONUS,
    );
  }

  if (sel.parentOffset !== undefined && sel.family !== 'blues') {
    const parentTonic = pitchClassOf(scale.tonic - sel.parentOffset);
    for (const t of SCALE_TYPES) {
      if (t.family !== sel.family || t.parentOffset === undefined) continue;
      add(
        pitchClassOf(parentTonic + t.parentOffset),
        t,
        { code: 'sharedParentScale', params: { family: sel.family, parentTonic } },
        RELATED_SCALE_SCORING.SHARED_PARENT_BONUS,
      );
    }
  }

  const selMask = rotateMask(sel.mask, scale.tonic);
  for (const { tonic, type, mask } of allScales()) {
    if (tonic !== scale.tonic || type.id === scale.type) continue;
    const added = popcount(mask & ~selMask);
    const removed = popcount(selMask & ~mask);
    if (added + removed > RELATED_SCALE_SCORING.CLOSE_VARIANT_MAX_DIFF) continue;
    add(
      tonic,
      type,
      { code: 'closeScaleVariant', params: { added, removed } },
      RELATED_SCALE_SCORING.CLOSE_VARIANT_BONUS,
    );
  }

  return [...found.values()]
    .map((a) => ({
      value: scaleRef(a.tonic, a.type, mode),
      score: a.score,
      reasons: [
        ...a.reasons,
        { code: 'scaleCommonness' as const, params: { weight: a.type.weight } },
      ],
    }))
    .sort((a, b) => b.score - a.score || catalogOrder(a.value, b.value));
}
