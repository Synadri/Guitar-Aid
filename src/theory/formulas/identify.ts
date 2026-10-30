import { degreeName } from '../core/interval';
import { pcsToMask, rotateMask } from '../core/pcset';
import { pitchClassOf, type PitchClass } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, type ChordQuality } from '../data/chords';
import { SCALE_TYPES, type ScaleType } from '../data/scales';
import { chordName } from '../analysis/detectChords';
import type { Candidate, Reason } from '../analysis/types';
import type {
  FormulaChordRef,
  FormulaItemRef,
  FormulaQuery,
  FormulaScaleRef,
  IdentifyFormulaResult,
} from './types';

function chordRefFromQuality(
  q: ChordQuality,
  root: PitchClass | undefined,
  mode: 'sharps' | 'flats',
): FormulaChordRef {
  if (root !== undefined) {
    return {
      kind: 'chord',
      quality: q.id,
      root,
      name: chordName({ root, quality: q.id }, mode),
    };
  }
  return {
    kind: 'chord',
    quality: q.id,
    name: q.symbol || q.id,
  };
}

function scaleRefFromType(
  s: ScaleType,
  tonic: PitchClass | undefined,
  mode: 'sharps' | 'flats',
): FormulaScaleRef {
  if (tonic !== undefined) {
    return {
      kind: 'scale',
      type: s.id,
      tonic,
      name: `${pcName(tonic, mode)} ${s.name}`,
    };
  }
  return {
    kind: 'scale',
    type: s.id,
    name: s.name,
  };
}

function itemKey(item: FormulaItemRef, extra: string = ''): string {
  if (item.kind === 'chord') {
    return `chord:${item.quality}:${item.root ?? ''}:${extra}`;
  }
  return `scale:${item.type}:${item.tonic ?? ''}:${extra}`;
}

/**
 * Identifica acordes y escalas a partir de una colección de semitonos desde la raíz.
 *
 * Devuelve:
 * - `exact`: candidatos cuya fórmula coincide exactamente sobre la raíz.
 * - `near`: candidatos a 1 nota de distancia (añadiendo o quitando una nota).
 * - `rotations`: candidatos con el mismo conjunto de clases de altura pero otra raíz (modos / inversiones).
 */
export function identifyByFormula(query: FormulaQuery): IdentifyFormulaResult {
  const mode = query.mode ?? 'sharps';
  const kind = query.kind ?? 'any';
  const includeChords = kind === 'any' || kind === 'chord';
  const includeScales = kind === 'any' || kind === 'scale';

  // Aseguramos que la raíz 0 siempre está presente y los semitonos están ordenados
  const rawTones = Array.from(new Set([0, ...query.semitones])).sort((a, b) => a - b);
  const inputPcs = Array.from(new Set(rawTones.map((s) => pitchClassOf(s))));
  const inputMask = pcsToMask(inputPcs);

  const exact: Candidate<FormulaItemRef>[] = [];
  const rotations: Candidate<FormulaItemRef>[] = [];
  const near: Candidate<FormulaItemRef>[] = [];

  const exactChordIds = new Set<string>();
  const exactScaleIds = new Set<string>();

  // 1. Coincidencias exactas
  if (includeChords) {
    for (const q of CHORD_QUALITIES) {
      const matches =
        (inputMask & q.requiredMask) === q.requiredMask && (inputMask & ~q.allowedMask) === 0;
      if (matches) {
        exactChordIds.add(q.id);
        const ref = chordRefFromQuality(q, query.root, mode);
        exact.push({
          value: ref,
          score: q.weight,
          reasons: [{ code: 'formulaExact' }],
        });
      }
    }
  }

  if (includeScales) {
    for (const s of SCALE_TYPES) {
      if (inputMask === s.mask) {
        exactScaleIds.add(s.id);
        const ref = scaleRefFromType(s, query.root, mode);
        exact.push({
          value: ref,
          score: s.weight,
          reasons: [{ code: 'formulaExact' }],
        });
      }
    }
  }

  // 2. Rotaciones (mismas notas con otra raíz)
  const seenRotationKeys = new Set<string>();

  for (const r of inputPcs) {
    if (r === 0) continue; // La raíz original no es una rotación

    const rotatedMask = rotateMask(inputMask, (12 - r) % 12);
    const rootDegree = degreeName(r);
    const rotationReasons: Reason[] = [
      { code: 'sameNotesOtherRoot', params: { rootDegree, degree: rootDegree } },
    ];

    if (includeChords) {
      for (const q of CHORD_QUALITIES) {
        const matches =
          (rotatedMask & q.requiredMask) === q.requiredMask &&
          (rotatedMask & ~q.allowedMask) === 0;
        if (matches) {
          const chordRoot =
            query.root !== undefined
              ? (((query.root + r) % 12) as PitchClass)
              : undefined;
          const ref = chordRefFromQuality(q, chordRoot, mode);
          const key = itemKey(ref, `deg:${rootDegree}`);
          if (!seenRotationKeys.has(key)) {
            seenRotationKeys.add(key);
            rotations.push({
              value: ref,
              score: q.weight,
              reasons: rotationReasons,
            });
          }
        }
      }
    }

    if (includeScales) {
      for (const s of SCALE_TYPES) {
        if (rotatedMask === s.mask) {
          const scaleTonic =
            query.root !== undefined
              ? (((query.root + r) % 12) as PitchClass)
              : undefined;
          const ref = scaleRefFromType(s, scaleTonic, mode);
          const key = itemKey(ref, `deg:${rootDegree}`);
          if (!seenRotationKeys.has(key)) {
            seenRotationKeys.add(key);
            rotations.push({
              value: ref,
              score: s.weight,
              reasons: rotationReasons,
            });
          }
        }
      }
    }
  }

  // 3. Cercanas (a 1 nota de distancia: quitando o añadiendo una nota)
  const seenNearKeys = new Set<string>();

  // 3a. Quitando 1 nota de la fórmula ("quita Y")
  for (const y of rawTones) {
    if (y === 0) continue; // No quitamos la raíz
    const subTones = rawTones.filter((t) => t !== y);
    const subPcs = Array.from(new Set(subTones.map((s) => pitchClassOf(s))));
    const subMask = pcsToMask(subPcs);
    const deg = degreeName(y);
    const missingReasons: Reason[] = [
      { code: 'formulaMissingTone', params: { degree: deg, tone: deg } },
    ];

    if (includeChords) {
      for (const q of CHORD_QUALITIES) {
        if (exactChordIds.has(q.id)) continue;
        const matches =
          (subMask & q.requiredMask) === q.requiredMask && (subMask & ~q.allowedMask) === 0;
        if (matches) {
          const ref = chordRefFromQuality(q, query.root, mode);
          const key = itemKey(ref, `missing:${deg}`);
          if (!seenNearKeys.has(key)) {
            seenNearKeys.add(key);
            near.push({
              value: ref,
              score: q.weight - 5,
              reasons: missingReasons,
            });
          }
        }
      }
    }

    if (includeScales) {
      for (const s of SCALE_TYPES) {
        if (exactScaleIds.has(s.id)) continue;
        if (subMask === s.mask) {
          const ref = scaleRefFromType(s, query.root, mode);
          const key = itemKey(ref, `missing:${deg}`);
          if (!seenNearKeys.has(key)) {
            seenNearKeys.add(key);
            near.push({
              value: ref,
              score: s.weight - 5,
              reasons: missingReasons,
            });
          }
        }
      }
    }
  }

  // 3b. Añadiendo 1 nota a la fórmula ("añade X")
  if (includeChords) {
    for (const q of CHORD_QUALITIES) {
      if (exactChordIds.has(q.id)) continue;
      const qPcs = Array.from(new Set(q.intervals.map((i) => pitchClassOf(i))));
      // Comprueba si todas las notas de input están en q, y q tiene exactamente 1 nota más
      if (qPcs.length === inputPcs.length + 1) {
        const containsAll = inputPcs.every((p) => qPcs.includes(p));
        if (containsAll) {
          // Encuentra el semitono añadido según la definición funcional de q
          const extraSemitone = q.intervals.find((i) => !inputPcs.includes(pitchClassOf(i)));
          if (extraSemitone !== undefined) {
            const deg = degreeName(extraSemitone);
            const ref = chordRefFromQuality(q, query.root, mode);
            const key = itemKey(ref, `adds:${deg}`);
            if (!seenNearKeys.has(key)) {
              seenNearKeys.add(key);
              near.push({
                value: ref,
                score: q.weight - 5,
                reasons: [{ code: 'formulaAddsTone', params: { degree: deg, tone: deg } }],
              });
            }
          }
        }
      }
    }
  }

  if (includeScales) {
    for (const s of SCALE_TYPES) {
      if (exactScaleIds.has(s.id)) continue;
      const sPcs = Array.from(new Set(s.intervals.map((i) => pitchClassOf(i))));
      if (sPcs.length === inputPcs.length + 1) {
        const containsAll = inputPcs.every((p) => sPcs.includes(p));
        if (containsAll) {
          const extraSemitone = s.intervals.find((i) => !inputPcs.includes(pitchClassOf(i)));
          if (extraSemitone !== undefined) {
            const deg = degreeName(extraSemitone);
            const ref = scaleRefFromType(s, query.root, mode);
            const key = itemKey(ref, `adds:${deg}`);
            if (!seenNearKeys.has(key)) {
              seenNearKeys.add(key);
              near.push({
                value: ref,
                score: s.weight - 5,
                reasons: [{ code: 'formulaAddsTone', params: { degree: deg, tone: deg } }],
              });
            }
          }
        }
      }
    }
  }

  // Ordenación determinista: score descendente y desempate por nombre
  const sortFn = (a: Candidate<FormulaItemRef>, b: Candidate<FormulaItemRef>) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.value.name.localeCompare(b.value.name);
  };

  exact.sort(sortFn);
  rotations.sort(sortFn);
  near.sort(sortFn);

  return { exact, near, rotations };
}
