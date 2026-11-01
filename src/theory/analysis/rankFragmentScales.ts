import { type PcMask, hasPc, rotateMask } from '../core/pcset';
import type { NameMode, PitchClass } from '../core/pitch';
import { type ChordQualityId, getChordQuality } from '../data/chords';
import { allScales, catalogOrder, popcount, scaleRef } from './scaleUtils';
import type { Candidate, Reason, ScaleRef, WeightedPc } from './types';

/** Armadura declarada en el archivo (positivo = sostenidos, negativo = bemoles; −7..7). */
export interface KeySignatureHint {
  accidentalCount: number;
  mode: 'major' | 'minor';
}

/** Entrada de `rankScalesForFragment`: pesos acumulados del fragmento y pistas de contexto. */
export interface FragmentScaleInput {
  /** Pesos por clase de altura acumulados en el rango de compases (se suman los repetidos). */
  notes: readonly WeightedPc[];
  /** Raíz estimada del primer compás del fragmento (acorde de apertura). */
  openingRoot?: PitchClass;
  /** Raíz estimada del último compás del fragmento (acorde de resolución). */
  closingRoot?: PitchClass;
  /** Acordes principales detectados (o fijados) en el fragmento. */
  chords?: readonly { root: PitchClass; quality: ChordQualityId }[];
  /** Armadura del primer compás del fragmento, si el archivo la declara. */
  keySignature?: KeySignatureHint;
}

export interface FragmentScaleOptions {
  /**
   * Proporción máxima del peso total que puede quedar fuera de la escala (notas de paso) para
   * que la escala sea candidata. Si ninguna escala la cumple, no se filtra (nunca devuelve `[]`
   * con notas presentes). Por defecto `FRAGMENT_SCALE_SCORING.MAX_OUTSIDE_RATIO`.
   */
  maxOutsideRatio?: number;
}

/** Escala candidata para un fragmento con sus métricas de encaje. */
export interface FragmentScaleFit {
  scale: ScaleRef;
  /** Proporción (0..1) del peso del fragmento explicado por la escala. */
  coverage: number;
  /** Clases de altura presentes que no pertenecen a la escala, de mayor a menor peso. */
  passingTones: PitchClass[];
  /** Acordes del fragmento cuyas notas (requeridas) están todas en la escala. */
  chordsInScale: number;
  chordCount: number;
}

/**
 * Constantes de puntuación de `rankScalesForFragment` (centralizadas para ajuste). La puntuación
 * es una suma ponderada: la cobertura domina, y el resto de términos separan escalas con la misma
 * cobertura (relativas, modos) o penalizan las escalas que la «compran» con notas de más.
 */
export const FRAGMENT_SCALE_SCORING = {
  /** Proporción máxima de peso fuera de la escala para ser candidata (tolerancia por defecto). */
  MAX_OUTSIDE_RATIO: 0.2,
  /** Puntos por cada 1 % de cobertura ponderada. */
  COVERAGE_FACTOR: 1,
  /** Puntos por la proporción de acordes del fragmento que son de la escala (× 0..1). */
  CHORD_FIT_FACTOR: 10,
  /** Bono si la tónica coincide con la raíz del compás de apertura. */
  OPENING_TONIC_BONUS: 8,
  /** Bono si la tónica coincide con la raíz del compás de cierre. */
  CLOSING_TONIC_BONUS: 5,
  /** Bono si la escala coincide con la armadura declarada (tónica y modo). */
  KEY_SIGNATURE_BONUS: 4,
  /** Factor del peso de la escala en el catálogo (`SCALE_WEIGHTS`, 0–100). */
  COMMONNESS_FACTOR: 0.15,
  /** Penalización por cada nota de la escala que no suena en el fragmento. */
  UNUSED_NOTE_PENALTY: 3,
  /**
   * Penalización por cada nota por encima de 7 (Bebop, disminuidas): una escala de 8 notas debe
   * explicar bastante más peso que una heptatónica para justificar la nota añadida; si no, esa
   * nota se interpreta como nota de paso de la heptatónica.
   */
  EXTRA_SIZE_PENALTY: 12,
} as const;

/** Tónica de la armadura: mayor = 7·n mod 12 (n sostenidos/bemoles); menor = relativa (+9). */
export function keySignatureTonic(sig: KeySignatureHint): PitchClass {
  const major = (((7 * sig.accidentalCount) % 12) + 12) % 12;
  return (sig.mode === 'major' ? major : (major + 9) % 12) as PitchClass;
}

function coveragePct(coverage: number): number {
  if (coverage >= 1) return 100;
  return Math.min(99, Math.round(coverage * 100));
}

/**
 * Ranking de escalas (12 tónicas × catálogo) para un fragmento de canción, tolerante a notas de
 * paso. Para cada escala calcula la cobertura ponderada (`scaleCoverage`), las notas fuera
 * (`passingTones`), los acordes del fragmento que encajan (`fitsDetectedChords`), la coincidencia
 * de la tónica con los compases de apertura/cierre (`tonicMatches`) y con la armadura
 * (`matchesKeySignature`), las notas de la escala que no suenan (`scaleExtraNotes`) y su peso en
 * el catálogo (`scaleCommonness`). Ver `FRAGMENT_SCALE_SCORING` para la combinación.
 *
 * Devuelve `[]` si no hay notas con peso positivo.
 */
export function rankScalesForFragment(
  input: FragmentScaleInput,
  mode: NameMode = 'sharps',
  options: FragmentScaleOptions = {},
): Candidate<FragmentScaleFit>[] {
  const S = FRAGMENT_SCALE_SCORING;
  const weightByPc = new Float64Array(12);
  let totalWeight = 0;
  for (const n of input.notes) {
    if (!(n.weight > 0)) continue;
    weightByPc[n.pc]! += n.weight;
    totalWeight += n.weight;
  }
  if (totalWeight === 0) return [];

  const chordMasks: PcMask[] = (input.chords ?? []).map((c) =>
    rotateMask(getChordQuality(c.quality).requiredMask, c.root),
  );
  const sigTonic = input.keySignature ? keySignatureTonic(input.keySignature) : undefined;
  const maxOutside = options.maxOutsideRatio ?? S.MAX_OUTSIDE_RATIO;

  const rows: { cand: Candidate<FragmentScaleFit>; outside: number }[] = [];
  for (const { tonic, type, mask } of allScales()) {
    let covered = 0;
    let unused = 0;
    const outsidePcs: PitchClass[] = [];
    for (let p = 0; p < 12; p++) {
      const pc = p as PitchClass;
      const w = weightByPc[pc]!;
      if (hasPc(mask, pc)) {
        if (w > 0) covered += w;
        else unused++;
      } else if (w > 0) {
        outsidePcs.push(pc);
      }
    }
    outsidePcs.sort((a, b) => weightByPc[b]! - weightByPc[a]! || a - b);
    const coverage = covered / totalWeight;
    const chordsInScale = chordMasks.filter((m) => (m & mask) === m).length;
    const chordCount = chordMasks.length;
    const size = popcount(mask);

    const openingMatch = input.openingRoot === tonic;
    const closingMatch = input.closingRoot === tonic;
    let sigMatch = false;
    if (input.keySignature && sigTonic === tonic) {
      const hasMinor3 = hasPc(mask, ((tonic + 3) % 12) as PitchClass);
      const hasMajor3 = hasPc(mask, ((tonic + 4) % 12) as PitchClass);
      sigMatch = input.keySignature.mode === 'major' ? hasMajor3 : hasMinor3;
    }

    const score =
      coverage * 100 * S.COVERAGE_FACTOR +
      (chordCount > 0 ? (chordsInScale / chordCount) * S.CHORD_FIT_FACTOR : 0) +
      (openingMatch ? S.OPENING_TONIC_BONUS : 0) +
      (closingMatch ? S.CLOSING_TONIC_BONUS : 0) +
      (sigMatch ? S.KEY_SIGNATURE_BONUS : 0) +
      type.weight * S.COMMONNESS_FACTOR -
      unused * S.UNUSED_NOTE_PENALTY -
      Math.max(0, size - 7) * S.EXTRA_SIZE_PENALTY;

    const reasons: Reason[] = [{ code: 'scaleCoverage', params: { pct: coveragePct(coverage) } }];
    if (chordCount > 0) {
      reasons.push({ code: 'fitsDetectedChords', params: { n: chordsInScale, of: chordCount } });
    }
    if (openingMatch) reasons.push({ code: 'tonicMatches', params: { tonic, position: 'opening' } });
    if (closingMatch) reasons.push({ code: 'tonicMatches', params: { tonic, position: 'closing' } });
    if (sigMatch) reasons.push({ code: 'matchesKeySignature', params: { tonic } });
    if (outsidePcs.length > 0) {
      reasons.push({
        code: 'passingTones',
        params: { count: outsidePcs.length, pcs: outsidePcs.join(',') },
      });
    }
    reasons.push({ code: 'scaleExtraNotes', params: { count: unused } });
    reasons.push({ code: 'scaleCommonness', params: { weight: type.weight } });

    rows.push({
      cand: {
        value: {
          scale: scaleRef(tonic, type, mode),
          coverage,
          passingTones: outsidePcs,
          chordsInScale,
          chordCount,
        },
        score,
        reasons,
      },
      outside: 1 - coverage,
    });
  }

  const tolerated = rows.filter((r) => r.outside <= maxOutside + 1e-9);
  const pool = tolerated.length > 0 ? tolerated : rows;
  pool.sort(
    (a, b) => b.cand.score - a.cand.score || catalogOrder(a.cand.value.scale, b.cand.value.scale),
  );
  return pool.map((r) => r.cand);
}
