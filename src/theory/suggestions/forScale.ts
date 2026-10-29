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

const SEVENTHS = CHORD_QUALITIES.filter(
  (q) =>
    q.intervals.length === 4 &&
    (q.id === 'maj7' ||
      q.id === 'm7' ||
      q.id === '7' ||
      q.id === 'm7b5' ||
      q.id === 'dim7' ||
      q.id === 'mMaj7' ||
      q.id === 'maj7#5'),
);

function romanForChordInScale(tonic: PitchClass, root: PitchClass, q: ChordQuality): string {
  const semitones = (root - tonic + 12) % 12;
  const base = CHROMATIC_ROMAN[semitones]!;
  const minorLike =
    q.id === 'm' ||
    q.id === 'm7' ||
    q.id === 'm6' ||
    q.id === 'dim' ||
    q.id === 'm7b5' ||
    q.id === 'dim7' ||
    q.id === 'mMaj7' ||
    q.id === 'madd9';
  const numeral = minorLike ? base.toLowerCase() : base;
  let suffix = '';
  if (q.id === 'dim') suffix = '°';
  else if (q.id === 'aug') suffix = '+';
  else if (q.id === 'm7') suffix = '7';
  else if (q.id === 'm6') suffix = '6';
  else if (q.id === 'm7b5') suffix = 'ø7';
  else if (q.id === 'dim7') suffix = '°7';
  else if (q.id === 'mMaj7') suffix = '(maj7)';
  else if (q.id === 'madd9') suffix = '(add9)';
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
export type DiatonicKind = 'triads' | 'sevenths';

/**
 * Acordes diatónicos (tríadas o cuatríadas apiladas en terceras sobre cada grado) de una escala
 * heptatónica (o derivada de una base heptatónica como las escalas Bebop), con numeración romana
 * (mayúscula = mayor/aumentado, minúscula = menor/disminuido, alteraciones ♭/♯ relativas a la
 * escala mayor, y sufijos de calidad apropiados: `°`/`+` en tríadas, `maj7`/`7`/`ø7`/`°7`/`(maj7)`/`maj7♯5`
 * en cuatríadas).
 *
 * Las escalas no heptatónicas y sin base heptatónica (pentatónicas, blues, disminuidas) usan
 * `chordsWithinScale`: todos los acordes del catálogo cuyas notas pertenecen a la escala,
 * ordenados por peso.
 */
export function diatonicChords(
  scale: ScaleRef,
  mode: NameMode = 'sharps',
  kind: DiatonicKind = 'triads',
): DiatonicChord[] {
  const type = getScaleType(scale.type);
  const effectiveType = type.baseScale ? getScaleType(type.baseScale) : type;
  if (effectiveType.intervals.length !== 7) {
    return chordsWithinScale(scale, mode);
  }
  const iv = effectiveType.intervals;
  const out: DiatonicChord[] = [];
  const qualitiesPool = kind === 'sevenths' ? SEVENTHS : TRIADS;

  for (let k = 0; k < 7; k++) {
    const rootInt = iv[k]!;
    const third = (iv[(k + 2) % 7]! - rootInt + 12) % 12;
    const fifth = (iv[(k + 4) % 7]! - rootInt + 12) % 12;
    const pcs: PitchClass[] = [0, third, fifth] as PitchClass[];
    if (kind === 'sevenths') {
      const seventh = (iv[(k + 6) % 7]! - rootInt + 12) % 12;
      pcs.push(seventh as PitchClass);
    }
    const mask: PcMask = pcsToMask(pcs);
    const quality = qualitiesPool.find((q) => q.requiredMask === mask);
    if (!quality) continue;
    const root = pitchClassOf(scale.tonic + rootInt);
    const diff = rootInt - MAJOR_OFFSETS[k]!;
    const accidental = diff < 0 ? '♭' : diff > 0 ? '♯' : '';
    let numeral: string;
    let suffix = '';

    if (kind === 'triads') {
      const minorLike = quality.id === 'm' || quality.id === 'dim';
      numeral = minorLike ? ROMAN[k]!.toLowerCase() : ROMAN[k]!;
      if (quality.id === 'dim') suffix = '°';
      else if (quality.id === 'aug') suffix = '+';
    } else {
      const minorLike =
        quality.id === 'm7' ||
        quality.id === 'm7b5' ||
        quality.id === 'dim7' ||
        quality.id === 'mMaj7';
      numeral = minorLike ? ROMAN[k]!.toLowerCase() : ROMAN[k]!;
      if (quality.id === 'm7' || quality.id === '7') suffix = '7';
      else if (quality.id === 'm7b5') suffix = 'ø7';
      else if (quality.id === 'dim7') suffix = '°7';
      else if (quality.id === 'mMaj7') suffix = '(maj7)';
      else if (quality.id === 'maj7#5') suffix = 'maj7♯5';
      else if (quality.id === 'maj7') suffix = 'maj7';
    }

    out.push({
      roman: `${accidental}${numeral}${suffix}`,
      chord: { root, quality: quality.id, name: `${pcName(root, mode)}${quality.symbol}` },
    });
  }
  return out;
}

export interface ScaleParentContext {
  parentScale: ScaleRef;
  degreeNumber: number;
  degreeRoman: string;
  isSelfParent: boolean;
  passingToneNote?: string;
  description: string;
}

/**
 * Calcula el contexto de la escala seleccionada respecto a su escala madre diatónica:
 * - Para modos heptatónicos (p. ej. D dórico → "II grado de C mayor", A menor → "VI grado de C mayor").
 * - Para escalas Bebop derivadas (p. ej. G bebop dominante → "V grado de C mayor (Mixolidio + F♯ de paso)").
 * Devuelve null para escalas simétricas o sin escala madre definida (blues, disminuidas).
 */
export function scaleParentContext(
  scale: ScaleRef,
  mode: NameMode = 'sharps',
): ScaleParentContext | null {
  const sel = getScaleType(scale.type);
  if (sel.parentOffset === undefined) return null;

  const parentType =
    SCALE_TYPES.find(
      (t) =>
        t.family === sel.family && t.parentOffset === 0 && !t.baseScale && t.intervals.length === 7,
    ) ?? sel;

  const parentTonic = pitchClassOf(scale.tonic - sel.parentOffset);
  const parentScale = scaleRef(parentTonic, parentType, mode);

  const idx = parentType.intervals.indexOf(sel.parentOffset);
  const degreeNumber = idx >= 0 ? idx + 1 : 1;
  const degreeRoman = ROMAN[degreeNumber - 1] ?? 'I';
  const isSelfParent = sel.id === parentType.id && scale.tonic === parentTonic;

  let passingToneNote: string | undefined;
  if (sel.baseScale) {
    const baseType = getScaleType(sel.baseScale);
    const passingInt = sel.intervals.find((iv) => !baseType.intervals.includes(iv));
    if (passingInt !== undefined) {
      passingToneNote = pcName(pitchClassOf(scale.tonic + passingInt), mode);
    }
  }

  const parentNameFormatted = `${pcName(parentTonic, mode)} ${parentType.name.toLowerCase()}`;
  let description = `${degreeRoman} grado de ${parentNameFormatted}`;
  if (sel.baseScale && passingToneNote) {
    const baseName = getScaleType(sel.baseScale).name;
    description += ` (${baseName} + ${passingToneNote} de paso)`;
  }

  return {
    parentScale,
    degreeNumber,
    degreeRoman,
    isSelfParent,
    passingToneNote,
    description,
  };
}

export interface RelativeScaleEntry {
  scale: ScaleRef;
  degreeNumber: number;
  degreeRoman: string;
}

export interface GroupedRelatedScales {
  relatives: RelativeScaleEntry[];
  byProximity: Candidate<ScaleRef>[];
}

/**
 * Agrupa las escalas sugeridas en dos bloques claramente diferenciados:
 * 1. `relatives`: todas las escalas que comparten las notas de la escala madre (los 7 modos diatónicos
 *    y pentatónicas relativas), ordenadas por su grado respecto a la madre (I, II, III, IV, V, VI, VII).
 * 2. `byProximity`: variantes cercanas en la misma tónica (diferencia de 1–2 notas), ordenadas por
 *    cercanía (menor número de alteraciones) y popularidad en el catálogo.
 */
export function groupedRelatedScales(
  scale: ScaleRef,
  mode: NameMode = 'sharps',
): GroupedRelatedScales {
  const sel = getScaleType(scale.type);
  const relatives: RelativeScaleEntry[] = [];

  if (sel.parentOffset !== undefined) {
    const parentTonic = pitchClassOf(scale.tonic - sel.parentOffset);
    const parentType =
      SCALE_TYPES.find(
        (t) =>
          t.family === sel.family &&
          t.parentOffset === 0 &&
          !t.baseScale &&
          t.intervals.length === 7,
      ) ?? sel;

    for (const t of SCALE_TYPES) {
      if (t.family !== sel.family || t.parentOffset === undefined || t.baseScale) continue;
      const tonic = pitchClassOf(parentTonic + t.parentOffset);
      const idx = parentType.intervals.indexOf(t.parentOffset);
      const degreeNumber = idx >= 0 ? idx + 1 : 1;
      const degreeRoman = ROMAN[degreeNumber - 1] ?? 'I';
      relatives.push({
        scale: scaleRef(tonic, t, mode),
        degreeNumber,
        degreeRoman,
      });
    }

    relatives.sort((a, b) => {
      if (a.degreeNumber !== b.degreeNumber) return a.degreeNumber - b.degreeNumber;
      const aType = getScaleType(a.scale.type);
      const bType = getScaleType(b.scale.type);
      return bType.intervals.length - aType.intervals.length || bType.weight - aType.weight;
    });
  } else if (sel.relative) {
    const rel = getScaleType(sel.relative.type);
    const relTonic = pitchClassOf(scale.tonic + sel.relative.offset);
    relatives.push({
      scale: scaleRef(relTonic, rel, mode),
      degreeNumber: 1,
      degreeRoman: 'I',
    });
  }

  const selMask = rotateMask(sel.mask, scale.tonic);
  const proximityRows: { candidate: Candidate<ScaleRef>; diff: number; weight: number }[] = [];

  for (const { tonic, type, mask } of allScales()) {
    if (tonic !== scale.tonic || type.id === scale.type) continue;
    const added = popcount(mask & ~selMask);
    const removed = popcount(selMask & ~mask);
    const diff = added + removed;
    if (diff > RELATED_SCALE_SCORING.CLOSE_VARIANT_MAX_DIFF) continue;

    proximityRows.push({
      candidate: {
        value: scaleRef(tonic, type, mode),
        score: (3 - diff) * 100 + type.weight,
        reasons: [
          { code: 'closeScaleVariant', params: { added, removed } },
          { code: 'scaleCommonness', params: { weight: type.weight } },
        ],
      },
      diff,
      weight: type.weight,
    });
  }

  proximityRows.sort(
    (a, b) =>
      a.diff - b.diff || b.weight - a.weight || catalogOrder(a.candidate.value, b.candidate.value),
  );
  const byProximity = proximityRows.map((r) => r.candidate);

  return { relatives, byProximity };
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
