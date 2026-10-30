import {
  type ChordQualityId,
  type Degree,
  type FretPosition,
  type PitchClass,
  type SixStringFrets,
  type StringNumber,
  chordTones,
  formatChordName,
  OPEN_VOICING_SHAPES,
  type OpenVoicingShape,
  pcDegree,
  pitchClassOf,
  positionToMidi,
  STANDARD_TUNING,
} from '../../theory';
import type { Rng } from '../rng';
import { adaptivePick, type DrillStatsMap } from './adaptive';
import type { DrillConfig, DrillQuestion } from './types';

export interface B5Prompt {
  voicingId: string;
  chordName: string;
  root: PitchClass;
  frets: SixStringFrets;
  positions: FretPosition[];
  rootPosition: FretPosition;
  title: string;
  eyebrow: string;
}

export interface B5LabelExpected {
  position: FretPosition;
  degree: Degree;
  label: string;
}

/**
 * Resuelve las posiciones activas y los grados armónicos de un voicing.
 * Ordena las posiciones de la cuerda más grave (6) a la más aguda (1),
 * excluyendo las cuerdas muteadas ('x').
 */
export function resolveVoicingLabels(
  shape: Pick<OpenVoicingShape, 'root' | 'quality' | 'frets' | 'rootString'>,
  tuning = STANDARD_TUNING,
): {
  positions: FretPosition[];
  labels: B5LabelExpected[];
  rootPosition: FretPosition;
} {
  const tones = chordTones(shape.root, shape.quality as ChordQualityId);
  const positions: FretPosition[] = [];
  const labels: B5LabelExpected[] = [];
  let rootPosition: FretPosition | null = null;

  // frets va de cuerda 6 (índice 0) a cuerda 1 (índice 5)
  for (let i = 0; i < shape.frets.length; i++) {
    const fVal = shape.frets[i]!;
    if (fVal === 'x') continue;

    const stringNum = (6 - i) as StringNumber;
    const pos: FretPosition = { string: stringNum, fret: fVal };
    positions.push(pos);

    const midi = positionToMidi(tuning, pos);
    const pc = pitchClassOf(midi);

    // Determina el grado buscando en los tonos funcionales del acorde, o por pcDegree como fallback
    const matchedTone = tones.find((t) => t.pc === pc);
    const degree: Degree = matchedTone ? matchedTone.degree : pcDegree(shape.root, pc);

    labels.push({
      position: pos,
      degree,
      label: degree,
    });

    if (stringNum === shape.rootString && rootPosition === null) {
      rootPosition = pos;
    }
  }

  if (rootPosition === null) {
    rootPosition = positions[0]!;
  }

  return { positions, labels, rootPosition };
}

/**
 * Generador para B5 · Etiqueta la forma.
 * Muestra las marcas de un acorde o voicing conocido en el mástil y exige identificar
 * el grado de cada una respecto a la fundamental.
 */
export function generateB5(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<B5Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const nameMode = config?.nameMode ?? 'sharps';

  // Selecciona un voicing abierto conocido
  const chosenShape = adaptivePick(
    rng,
    OPEN_VOICING_SHAPES,
    (s) => `voicing:${s.id}`,
    stats,
    config?.adaptive ?? true,
  );

  const { positions, labels, rootPosition } = resolveVoicingLabels(chosenShape, tuning);
  const chordName = formatChordName(chosenShape.root, chosenShape.quality as ChordQualityId, nameMode);
  const title = `Asigna el grado de cada nota del voicing de ${chordName}`;
  const qId = `b5-${chosenShape.id}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'B5',
    itemKey: `voicing:${chosenShape.id}`,
    prompt: {
      voicingId: chosenShape.id,
      chordName,
      root: chosenShape.root,
      frets: chosenShape.frets,
      positions,
      rootPosition,
      title,
      eyebrow: 'B5 · ETIQUETA LA FORMA',
    },
    answerKind: 'labels',
    expected: {
      kind: 'labels',
      labels,
    },
    mode: 'all',
  };
}
