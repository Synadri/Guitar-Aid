import { type PcMask, hasPc, rotateMask } from '../core/pcset';
import { type NameMode, type PitchClass, pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';
import { type ChordQualityId, getChordQuality } from '../data/chords';
import { PROGRESSIONS, type ProgressionStep } from '../data/progressions';
import { SCALE_WEIGHTS, type ScaleTypeId, getScaleType } from '../data/scales';
import { romanNumeral } from './roman';
import { scaleRef } from './scaleUtils';
import type { Candidate, ChordRef, KeyRef, ProgressionRef, Reason, ScaleRef } from './types';

/** Acorde de entrada de una secuencia (`null` = compás sin acorde reconocido o en silencio). */
export interface SequenceChordInput {
  root: PitchClass;
  quality: ChordQualityId;
}

/**
 * Función del acorde respecto a la tonalidad/escala activa:
 * - `diatonic`: todas sus notas pertenecen a la escala (`I`, `vi`, `♭VII` en menor…).
 * - `harmonicMinor`: en tonalidad menor, dominante procedente de la menor armónica (`V`, `V7`,
 *   `vii°`, `vii°7`).
 * - `secondaryDominant`: acorde mayor/dominante a una 5ª justa por encima de un acorde diatónico
 *   mayor o menor que no es la tónica (`V/vi`, `V7/V`).
 * - `borrowed`: préstamo modal de un modo paralelo (misma tónica), p. ej. `iv` o `♭VII` en mayor.
 * - `chromatic`: ninguna de las anteriores.
 * - `unrecognized`: compás sin acorde (entrada `null`).
 */
export type ChordFunctionKind =
  | 'diatonic'
  | 'harmonicMinor'
  | 'secondaryDominant'
  | 'borrowed'
  | 'chromatic'
  | 'unrecognized';

export interface ChordFunction {
  /** Índice en la secuencia de entrada. */
  index: number;
  chord: ChordRef | null;
  /** Numeral romano respecto a la tónica (`null` si no hay acorde). */
  roman: string | null;
  kind: ChordFunctionKind;
  reasons: Reason[];
}

export type ProgressionMatchKind = 'exact' | 'contains' | 'rotation';

export interface ProgressionSequenceMatch {
  template: ProgressionRef;
  key: KeyRef;
  /**
   * `exact`: la secuencia (sin repeticiones consecutivas ni silencios) es la plantilla;
   * `contains`: la plantilla aparece como subsecuencia contigua; `rotation`: aparece solo al leer
   * la secuencia como un bucle (p. ej. `C–G–Am–F` contiene `vi–IV–I–V` empezando en `Am`).
   */
  matchKind: ProgressionMatchKind;
  /** Índices de la entrada original que ocupan los pasos de la plantilla, en orden. */
  indices: number[];
}

export interface ChordSequenceAnalysis {
  scale: ScaleRef;
  chords: ChordFunction[];
  progressions: Candidate<ProgressionSequenceMatch>[];
}

/** Constantes de puntuación de la detección de plantillas en secuencias. */
export const SEQUENCE_PROGRESSION_SCORING = {
  /** Bono por tipo de coincidencia (separa niveles; el peso de la plantilla desempata). */
  EXACT_BONUS: 300,
  CONTAINS_BONUS: 200,
  ROTATION_BONUS: 100,
} as const;

/** Modos paralelos candidatos a préstamo modal, por peso en el catálogo. */
const BORROWING_SOURCES: readonly ScaleTypeId[] = (
  [
    'major',
    'minor',
    'dorian',
    'mixolydian',
    'lydian',
    'harmonicMinor',
    'melodicMinor',
    'phrygian',
  ] as const
)
  .slice()
  .sort((a, b) => SCALE_WEIGHTS[b] - SCALE_WEIGHTS[a]);

const DOMINANT_QUALITIES = new Set<ChordQualityId>(['maj', '7', '9']);
const SECONDARY_TARGET_QUALITIES: readonly ChordQualityId[] = ['maj', 'm'];

type TriadFamily = 'maj' | 'm' | 'dim' | 'power' | 'other';

const TRIAD_FAMILY: Readonly<Record<ChordQualityId, TriadFamily>> = {
  maj: 'maj',
  '7': 'maj',
  maj7: 'maj',
  '6': 'maj',
  '9': 'maj',
  add9: 'maj',
  m: 'm',
  m7: 'm',
  m6: 'm',
  madd9: 'm',
  mMaj7: 'm',
  dim: 'dim',
  m7b5: 'dim',
  dim7: 'dim',
  '5': 'power',
  aug: 'other',
  'maj7#5': 'other',
  sus2: 'other',
  sus4: 'other',
};

function chordMask(c: SequenceChordInput): PcMask {
  return rotateMask(getChordQuality(c.quality).requiredMask, c.root);
}

function chordRef(c: SequenceChordInput, mode: NameMode): ChordRef {
  return {
    root: c.root,
    quality: c.quality,
    name: `${pcName(c.root, mode)}${getChordQuality(c.quality).symbol}`,
  };
}

/**
 * Un acorde encaja en un paso de plantilla (definida en tríadas) si su fundamental cae en el
 * grado y su tríada base es de la misma familia (C7 y Cmaj7 valen por `I`; Am7 por `vi`). Los
 * power chords (`5`, sin tercera) valen por un paso mayor o menor.
 */
function stepMatches(tonic: PitchClass, step: ProgressionStep, c: SequenceChordInput): boolean {
  if (pitchClassOf(tonic + step.offset) !== c.root) return false;
  const fam = TRIAD_FAMILY[c.quality];
  if (fam === 'power') return step.quality === 'maj' || step.quality === 'm';
  return fam === TRIAD_FAMILY[step.quality];
}

function classify(
  c: SequenceChordInput,
  next: SequenceChordInput | null,
  tonic: PitchClass,
  scaleMask: PcMask,
  scaleType: ScaleTypeId,
): { roman: string; kind: ChordFunctionKind; reasons: Reason[] } {
  const q = getChordQuality(c.quality);
  const mask = chordMask(c);
  const roman = romanNumeral(tonic, c.root, q);
  const rel = (c.root - tonic + 12) % 12;

  if ((mask & scaleMask) === mask) {
    return { roman, kind: 'diatonic', reasons: [{ code: 'diatonicDegree', params: { degree: roman } }] };
  }

  const isMinorKey =
    hasPc(scaleMask, pitchClassOf(tonic + 3)) && !hasPc(scaleMask, pitchClassOf(tonic + 4));
  if (isMinorKey && (rel === 7 || rel === 11)) {
    const hm = rotateMask(getScaleType('harmonicMinor').mask, tonic);
    if ((mask & hm) === mask) {
      return {
        roman,
        kind: 'harmonicMinor',
        reasons: [{ code: 'harmonicMinorDegree', params: { degree: roman } }],
      };
    }
  }

  if (DOMINANT_QUALITIES.has(c.quality)) {
    const targetRoot = pitchClassOf(c.root + 5);
    if (targetRoot !== tonic) {
      const targetQ = SECONDARY_TARGET_QUALITIES.map(getChordQuality).find((tq) => {
        const m = rotateMask(tq.requiredMask, targetRoot);
        return (m & scaleMask) === m;
      });
      if (targetQ) {
        const target = romanNumeral(tonic, targetRoot, targetQ);
        const dominantSuffix = c.quality === 'maj' ? '' : q.symbol;
        const degree = `V${dominantSuffix}/${target}`;
        const resolves = next !== null && next.root === targetRoot ? 1 : 0;
        return {
          roman: degree,
          kind: 'secondaryDominant',
          reasons: [
            { code: 'secondaryDominant', params: { degree, target, targetRoot, resolves } },
          ],
        };
      }
    }
  }

  for (const source of BORROWING_SOURCES) {
    if (source === scaleType) continue;
    const m = rotateMask(getScaleType(source).mask, tonic);
    if ((mask & m) === mask) {
      return {
        roman,
        kind: 'borrowed',
        reasons: [{ code: 'modalBorrowing', params: { degree: roman, sourceType: source, tonic } }],
      };
    }
  }

  return { roman, kind: 'chromatic', reasons: [{ code: 'chromaticChord', params: { degree: roman } }] };
}

function keyRef(tonic: PitchClass, mode: KeyRef['mode'], nameMode: NameMode): KeyRef {
  return {
    tonic,
    mode,
    name: `${pcName(tonic, nameMode)} ${mode === 'major' ? 'mayor' : 'menor'}`,
  };
}

/**
 * Analiza una secuencia de acordes (p. ej. el acorde principal de cada compás de un fragmento)
 * respecto a una tonalidad/escala activa, que puede ser la detectada o la fijada por el usuario
 * (cualquier escala del catálogo: `C mayor`, `A menor`, `D dórico`…).
 *
 * 1. Asigna a cada acorde su numeral romano y su función (`ChordFunctionKind`) con razones.
 * 2. Busca las plantillas de `progressions.ts` sobre la tónica activa, tras ignorar silencios y
 *    fusionar acordes repetidos consecutivos (un acorde por compás `C C G G` cuenta como `C–G`).
 *    Devuelve candidatos ordenados por tipo de coincidencia (`exact` > `contains` > `rotation`)
 *    y peso de la plantilla; como mucho uno por plantilla (el primero/mejor).
 */
export function analyzeChordSequence(
  chords: readonly (SequenceChordInput | null)[],
  scale: { tonic: PitchClass; type: ScaleTypeId },
  mode: NameMode = 'sharps',
): ChordSequenceAnalysis {
  const type = getScaleType(scale.type);
  const scaleMask = rotateMask(type.mask, scale.tonic);
  const tonic = scale.tonic;

  const nextNonNull = (i: number): SequenceChordInput | null => {
    for (let j = i + 1; j < chords.length; j++) if (chords[j]) return chords[j]!;
    return null;
  };

  const functions: ChordFunction[] = chords.map((c, index) => {
    if (!c) return { index, chord: null, roman: null, kind: 'unrecognized', reasons: [] };
    const { roman, kind, reasons } = classify(c, nextNonNull(index), tonic, scaleMask, scale.type);
    return { index, chord: chordRef(c, mode), roman, kind, reasons };
  });

  // Secuencia compacta: sin silencios ni repeticiones consecutivas, con el índice original.
  const seq: { chord: SequenceChordInput; index: number }[] = [];
  chords.forEach((c, index) => {
    if (!c) return;
    const last = seq[seq.length - 1];
    if (last && last.chord.root === c.root && last.chord.quality === c.quality) return;
    seq.push({ chord: c, index });
  });
  const n = seq.length;

  const S = SEQUENCE_PROGRESSION_SCORING;
  const progressions: Candidate<ProgressionSequenceMatch>[] = [];
  for (const template of PROGRESSIONS) {
    const m = template.steps.length;
    if (n < m) continue;
    const matchesAt = (s: number): boolean =>
      template.steps.every((st, k) => stepMatches(tonic, st, seq[(s + k) % n]!.chord));

    let found: { kind: ProgressionMatchKind; start: number } | null = null;
    for (let s = 0; s + m <= n && !found; s++) {
      if (matchesAt(s)) found = { kind: n === m ? 'exact' : 'contains', start: s };
    }
    if (!found && n >= 2) {
      for (let s = n - m + 1; s < n && !found; s++) {
        if (matchesAt(s)) found = { kind: 'rotation', start: s };
      }
    }
    if (!found) continue;

    const bonus =
      found.kind === 'exact'
        ? S.EXACT_BONUS
        : found.kind === 'contains'
          ? S.CONTAINS_BONUS
          : S.ROTATION_BONUS;
    const start = found.start;
    progressions.push({
      value: {
        template: { id: template.id, name: template.name },
        key: keyRef(tonic, template.mode, mode),
        matchKind: found.kind,
        indices: template.steps.map((_, k) => seq[(start + k) % n]!.index),
      },
      score: bonus + template.weight,
      reasons: [
        { code: 'matchesProgression', params: { kind: found.kind, name: template.name } },
        { code: 'progressionCommonness', params: { weight: template.weight } },
      ],
    });
  }
  progressions.sort(
    (a, b) => b.score - a.score || a.value.indices[0]! - b.value.indices[0]!,
  );

  return { scale: scaleRef(tonic, type, mode), chords: functions, progressions };
}
