import {
  type ChordQualityId,
  type FretPosition,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
  type StringNumber,
  chordTones,
  formatChordName,
  pcName,
  pitchClassOf,
  positionToMidi,
  SCALE_TYPES,
  STANDARD_TUNING,
} from '../../theory';
import type { Rng } from '../rng';
import { adaptivePick, type DrillStatsMap } from './adaptive';
import type { DrillConfig, DrillQuestion } from './types';

const DEFAULT_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const DEFAULT_RANGE: readonly [number, number] = [0, 12];
const COMMON_QUALITIES: readonly ChordQualityId[] = ['maj', 'm', '7', 'm7', 'maj7'];
const COMMON_SCALES: readonly ScaleTypeId[] = [
  'major',
  'minor',
  'dorian',
  'mixolydian',
  'minorPentatonic',
];

function normalizeRange(fretRange?: readonly [number, number] | [number, number]): [number, number] {
  if (!fretRange) return [DEFAULT_RANGE[0], DEFAULT_RANGE[1]];
  return [Math.min(fretRange[0], fretRange[1]), Math.max(fretRange[0], fretRange[1])];
}

// -----------------------------------------------------------------------
// C1 · Construye el acorde
// -----------------------------------------------------------------------

export interface C1Prompt {
  root: PitchClass;
  quality: ChordQualityId;
  chordName: string;
  string?: StringNumber;
  targetStrings: readonly StringNumber[];
  title: string;
  eyebrow: string;
}

export function generateC1(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<C1Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const qualities = config?.qualities ?? COMMON_QUALITIES;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';
  const mode = config?.mode ?? 'all';

  // Elige una clase de altura de raíz
  const roots: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const chosenRoot = adaptivePick(
    rng,
    roots,
    (r) => `root:${r}`,
    stats,
    config?.adaptive ?? true,
  );

  // Elige calidad
  const chosenQuality = adaptivePick(
    rng,
    qualities,
    (q) => `quality:${q}`,
    stats,
    config?.adaptive ?? true,
  );

  // Determina si se practica sobre una sola cuerda (modo lineal) o en todas las activas
  // Por defecto, si hay más de 1 cuerda activa, alterna o permite cuerda única
  const singleString = adaptivePick(
    rng,
    activeStrings,
    (s) => `string:${s}`,
    stats,
    config?.adaptive ?? true,
  );

  const tones = chordTones(chosenRoot, chosenQuality);
  const chordPcs = tones.map((t) => t.pc);
  const chordName = formatChordName(chosenRoot, chosenQuality, nameMode);

  // Calcula todas las posiciones del acorde en la cuerda elegida dentro del rango
  const matchingPositions: FretPosition[] = [];
  for (let f = minFret; f <= maxFret; f++) {
    const pos: FretPosition = { string: singleString, fret: f };
    const midi = positionToMidi(tuning, pos);
    if (chordPcs.includes(pitchClassOf(midi))) {
      matchingPositions.push(pos);
    }
  }

  const title = `Construye el acorde ${chordName} en la cuerda ${singleString}`;
  const qId = `c1-${chosenRoot}-${chosenQuality}-s${singleString}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'C1',
    itemKey: `chord:${chosenQuality}|root:${chosenRoot}`,
    prompt: {
      root: chosenRoot,
      quality: chosenQuality,
      chordName,
      string: singleString,
      targetStrings: [singleString],
      title,
      eyebrow: 'C1 · CONSTRUYE EL ACORDE',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: matchingPositions,
    },
    mode,
  };
}

// -----------------------------------------------------------------------
// C2 · Escala en una cuerda
// -----------------------------------------------------------------------

export interface C2Prompt {
  root: PitchClass;
  scaleType: ScaleTypeId;
  scaleName: string;
  string: StringNumber;
  title: string;
  eyebrow: string;
}

export function generateC2(
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion<C2Prompt> {
  const tuning = config?.tuning ?? STANDARD_TUNING;
  const activeStrings = config?.activeStrings ?? DEFAULT_STRINGS;
  const [minFret, maxFret] = normalizeRange(config?.fretRange);
  const scaleTypeIds = config?.scaleTypes ?? COMMON_SCALES;
  const nameMode: NameMode = config?.nameMode ?? 'sharps';
  const mode = config?.mode ?? 'all';

  const roots: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const chosenRoot = adaptivePick(
    rng,
    roots,
    (r) => `root:${r}`,
    stats,
    config?.adaptive ?? true,
  );

  const chosenScaleId = adaptivePick(
    rng,
    scaleTypeIds,
    (s) => `scale:${s}`,
    stats,
    config?.adaptive ?? true,
  );

  const scaleDef = SCALE_TYPES.find((s) => s.id === chosenScaleId)!;
  const chosenString = adaptivePick(
    rng,
    activeStrings,
    (s) => `string:${s}`,
    stats,
    config?.adaptive ?? true,
  );

  const scalePcs = scaleDef.intervals.map((i) => ((chosenRoot + i) % 12) as PitchClass);
  const rootName = pcName(chosenRoot, nameMode);
  const scaleName = `${rootName} ${scaleDef.name.toLowerCase()}`;

  const matchingPositions: FretPosition[] = [];
  for (let f = minFret; f <= maxFret; f++) {
    const pos: FretPosition = { string: chosenString, fret: f };
    const midi = positionToMidi(tuning, pos);
    if (scalePcs.includes(pitchClassOf(midi))) {
      matchingPositions.push(pos);
    }
  }

  const title = `Toca la escala ${scaleName} en la cuerda ${chosenString}`;
  const qId = `c2-${chosenRoot}-${chosenScaleId}-s${chosenString}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'C2',
    itemKey: `scale:${chosenScaleId}|root:${chosenRoot}|string:${chosenString}`,
    prompt: {
      root: chosenRoot,
      scaleType: chosenScaleId,
      scaleName,
      string: chosenString,
      title,
      eyebrow: 'C2 · ESCALA EN UNA CUERDA',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: matchingPositions,
    },
    mode,
  };
}
