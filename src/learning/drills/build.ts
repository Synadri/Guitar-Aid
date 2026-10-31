import {
  type ChordQualityId,
  type FretPosition,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
  type StringNumber,
  formatChordName,
  pcName,
  pitchClassOf,
  positionToMidi,
  SCALE_TYPES,
  STANDARD_TUNING,
  voicingsForChord,
} from '../../theory';
import type { Rng } from '../rng';
import { samePosition } from '../answers';
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
  voicingId: string;
  family: string;
  rootPosition: FretPosition;
  rootNoteName: string;
  string?: StringNumber;
  targetStrings: readonly StringNumber[];
  allVoicingPositions: readonly FretPosition[];
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

  // 1. Elige una raíz y calidad de forma adaptativa
  const roots: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const chosenRoot = adaptivePick(
    rng,
    roots,
    (r) => `root:${r}`,
    stats,
    config?.adaptive ?? true,
  );

  const chosenQuality = adaptivePick(
    rng,
    qualities,
    (q) => `quality:${q}`,
    stats,
    config?.adaptive ?? true,
  );

  // 2. Consulta los voicings disponibles para ese acorde en la afinación activa
  const allVoicings = voicingsForChord(chosenRoot, chosenQuality, tuning);

  // Filtra por rango de trastes y cuerdas activas (priorizando los que están completamente contenidos)
  let candidates = allVoicings.filter(
    (v) =>
      v.positions.length >= 3 &&
      v.positions.every((p) => p.fret >= minFret && p.fret <= maxFret) &&
      v.positions.every((p) => activeStrings.includes(p.string)),
  );

  if (candidates.length === 0) {
    candidates = allVoicings.filter(
      (v) =>
        v.positions.length >= 3 &&
        v.positions.every((p) => p.fret >= minFret && p.fret <= maxFret),
    );
  }

  if (candidates.length === 0) {
    candidates = allVoicings.filter((v) => v.positions.length >= 3);
  }

  // 3. Selecciona adaptativamente el voicing objetivo
  const chosenVoicing =
    candidates.length > 0
      ? adaptivePick(
          rng,
          candidates,
          (v) => `voicing:${v.id}`,
          stats,
          config?.adaptive ?? true,
        )
      : null;

  // 4. Determina la posición de la fundamental (anclaje de referencia)
  let rootPos: FretPosition;
  if (chosenVoicing) {
    const rootPosCandidate = chosenVoicing.positions.find(
      (p) =>
        p.string === chosenVoicing.rootString &&
        pitchClassOf(positionToMidi(tuning, p)) === chosenRoot,
    );
    rootPos = rootPosCandidate ?? chosenVoicing.positions[0]!;
  } else {
    // Fallback de reserva si no hubiera voicings disponibles
    rootPos = { string: 6, fret: 0 };
    for (let f = minFret; f <= maxFret; f++) {
      for (const s of activeStrings) {
        if (pitchClassOf(positionToMidi(tuning, { string: s, fret: f })) === chosenRoot) {
          rootPos = { string: s, fret: f };
          break;
        }
      }
    }
  }

  const allVoicingPositions = chosenVoicing ? chosenVoicing.positions : [rootPos];
  // Las posiciones que el usuario debe marcar son las demás notas de la digitación
  const expectedPositions = allVoicingPositions.filter((p) => !samePosition(p, rootPos));
  const chordName = formatChordName(chosenRoot, chosenQuality, nameMode);
  const rootNoteName = pcName(chosenRoot, nameMode);
  const title = `Construye el acorde ${chordName} desde la cuerda ${rootPos.string}, traste ${rootPos.fret}`;
  const qId = `c1-${chosenRoot}-${chosenQuality}-${chosenVoicing?.id ?? 'custom'}-${Math.floor(rng() * 1000000)}`;

  return {
    id: qId,
    drill: 'C1',
    itemKey: `chord:${chosenQuality}|root:${chosenRoot}`,
    prompt: {
      root: chosenRoot,
      quality: chosenQuality,
      chordName,
      voicingId: chosenVoicing?.id ?? 'custom',
      family: chosenVoicing?.family ?? 'open',
      rootPosition: rootPos,
      rootNoteName,
      string: rootPos.string,
      targetStrings: allVoicingPositions.map((p) => p.string),
      allVoicingPositions,
      title,
      eyebrow: 'C1 · CONSTRUYE EL ACORDE',
    },
    answerKind: 'positions',
    expected: {
      kind: 'positions',
      positions: expectedPositions,
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
