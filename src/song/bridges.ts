import type {
  ChordsDeckSource,
  DeckSource,
  DegreesDeckSource,
  DrillConfig,
  ProgressionsDeckSource,
  ScalesDeckSource,
  VoicingsDeckSource,
} from '../learning';
import type {
  ChordQualityId,
  ChordRef,
  KeyRef,
  PitchClass,
  ScaleRef,
  ScaleTypeId,
  StringNumber,
  Tuning,
} from '../theory';
import { STANDARD_TUNING } from '../theory/data/tunings';
import type {
  BridgeDeckOptions,
  SongFragmentAnalysis,
  SongMenuContext,
  SongModel,
  SongNote,
} from './types';

// ============================================================================
// 1. Puentes con el Modo Sandbox (MenuContext) (plan_fase3.md §4.4 y §5.4)
// ============================================================================

/**
 * Transforma un acorde analizado o detectado en un contexto puro de menú
 * para el Sandbox (`sandboxStore.setContext`).
 */
export function songChordToSandboxContext(
  chord: ChordRef | { root: PitchClass; quality: ChordQualityId },
): SongMenuContext {
  return {
    kind: 'chord',
    root: chord.root,
    quality: chord.quality,
  };
}

/**
 * Transforma una escala analizada o detectada en un contexto puro de menú
 * para el Sandbox (`sandboxStore.setContext`).
 */
export function songScaleToSandboxContext(
  scale: ScaleRef | { tonic: PitchClass; type: ScaleTypeId },
): SongMenuContext {
  return {
    kind: 'scale',
    root: scale.tonic,
    type: scale.type,
  };
}

/**
 * Transforma una tonalidad (tónica + modo mayor/menor) en un contexto de escala para el Sandbox.
 */
export function songKeyToSandboxContext(
  key: KeyRef | { tonic: PitchClass; mode: 'major' | 'minor' },
): SongMenuContext {
  return {
    kind: 'scale',
    root: key.tonic,
    type: key.mode === 'minor' ? 'minor' : 'major',
  };
}

/**
 * Obtiene el contexto de Sandbox predeterminado para un fragmento analizado
 * (prioriza la escala principal o, si no la hay, el primer acorde del fragmento).
 */
export function fragmentToSandboxContext(
  fragment: SongFragmentAnalysis,
): SongMenuContext | null {
  if (fragment.primaryScale) {
    return songScaleToSandboxContext(fragment.primaryScale);
  }
  const firstChord = fragment.barChords.find((bc) => bc.primaryChord)?.primaryChord;
  if (firstChord) {
    return songChordToSandboxContext(firstChord);
  }
  return null;
}

// ============================================================================
// 2. Puente con Modo Aprender (Tarjetas SRS / DeckSource[]) (plan_fase3.md §5.4)
// ============================================================================

/**
 * Genera un conjunto declarativo de fuentes de mazo (`DeckSource[]`) a partir
 * de los acordes, digitaciones, escala y progresión identificados en el fragmento.
 */
export function fragmentToDeckSources(
  fragment: SongFragmentAnalysis,
  options?: BridgeDeckOptions,
): DeckSource[] {
  const sources: DeckSource[] = [];

  const includeChords = options?.includeChords ?? true;
  const includeVoicings = options?.includeVoicings ?? true;
  const includeScales = options?.includeScales ?? true;
  const includeProgressions = options?.includeProgressions ?? true;
  const includeDegrees = options?.includeDegrees ?? true;

  // Extraer acordes únicos del fragmento
  const uniqueChordMap = new Map<string, { root: PitchClass; quality: ChordQualityId }>();
  for (const bc of fragment.barChords) {
    if (bc.primaryChord) {
      const key = `${bc.primaryChord.root}:${bc.primaryChord.quality}`;
      if (!uniqueChordMap.has(key)) {
        uniqueChordMap.set(key, {
          root: bc.primaryChord.root,
          quality: bc.primaryChord.quality,
        });
      }
    }
  }

  const chords = Array.from(uniqueChordMap.values());
  const roots = Array.from(new Set(chords.map((c) => c.root)));
  const qualities = Array.from(new Set(chords.map((c) => c.quality)));

  // 1. Tarjetas de acordes (nombre ↔ notas, nombre ↔ fórmula)
  if (includeChords && chords.length > 0) {
    const chordsSource: ChordsDeckSource = {
      type: 'chords',
      qualities,
      roots,
      facets: ['name>notes', 'notes>name', 'name>formula'],
    };
    sources.push(chordsSource);
  }

  // 2. Tarjetas de digitaciones (voicings) en el mástil
  if (includeVoicings && chords.length > 0) {
    const voicingsSource: VoicingsDeckSource = {
      type: 'voicings',
      qualities,
      families: ['open', 'barre-E', 'barre-A'],
      roots,
      facets: ['name>shape', 'shape>name'],
    };
    sources.push(voicingsSource);
  }

  // 3. Tarjeta de la escala / tonalidad del fragmento
  if (includeScales && fragment.primaryScale) {
    const scalesSource: ScalesDeckSource = {
      type: 'scales',
      scaleTypes: [fragment.primaryScale.type],
      tonics: [fragment.primaryScale.tonic],
      facets: ['name>notes', 'notes>name', 'name>formula'],
    };
    sources.push(scalesSource);
  }

  // 4. Tarjetas de progresión si encaja con una plantilla conocida
  if (includeProgressions && fragment.progression.progressions.length > 0) {
    const topMatch = fragment.progression.progressions[0]!;
    const progSource: ProgressionsDeckSource = {
      type: 'progressions',
      progressionIds: [topMatch.value.template.id],
      tonics: [topMatch.value.key.tonic],
      facets: ['roman>chords', 'chords>roman'],
    };
    sources.push(progSource);
  }

  // 5. Tarjetas de grados de la tonalidad
  if (includeDegrees && fragment.primaryKey) {
    const degreesSource: DegreesDeckSource = {
      type: 'degrees',
      tonics: [fragment.primaryKey.tonic],
      modes: [fragment.primaryKey.mode],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      chordKinds: ['triads', 'sevenths'],
      facets: ['roman>chord', 'chord>roman'],
    };
    sources.push(degreesSource);
  }

  return sources;
}

// ============================================================================
// 3. Puente con Modo Aprender (Ejercicios / DrillConfig) (plan_fase3.md §5.4)
// ============================================================================

/**
 * Preconfigura una sesión de práctica interactiva en Ejercicios delimitando
 * el rango de trastes, cuerdas activas, afinación y acordes/escalas del fragmento.
 */
export function fragmentToDrillConfig(
  fragment: SongFragmentAnalysis,
  song?: SongModel,
  trackIndex?: number,
): DrillConfig {
  let tuning: Tuning = STANDARD_TUNING;
  const notesPlayed: SongNote[] = [];

  if (song && song.tracks.length > 0) {
    const activeTrack =
      trackIndex !== undefined && song.tracks[trackIndex]
        ? song.tracks[trackIndex]!
        : song.tracks.find((t) => !t.isPercussion) ?? song.tracks[0]!;

    tuning = activeTrack.tuning;

    const startIdx = fragment.range.startBarIndex;
    const endIdx = fragment.range.endBarIndex;

    for (let i = startIdx; i <= endIdx && i < activeTrack.bars.length; i++) {
      const bar = activeTrack.bars[i];
      if (bar) {
        for (const beat of bar.beats) {
          notesPlayed.push(...beat.notes);
        }
      }
    }
  }

  // Cuerdas activas
  const stringsSet = new Set<StringNumber>();
  for (const n of notesPlayed) {
    if (n.string >= 1 && n.string <= 6) {
      stringsSet.add(n.string as StringNumber);
    }
  }

  const activeStrings =
    stringsSet.size > 0
      ? (Array.from(stringsSet).sort((a, b) => a - b) as StringNumber[])
      : ([1, 2, 3, 4, 5, 6] as StringNumber[]);

  // Rango de trastes
  const frets = notesPlayed.map((n) => n.fret).filter((f) => f >= 0);
  let fretRange: [number, number];

  if (frets.length === 0) {
    fretRange = [0, 12];
  } else {
    const minF = Math.min(...frets);
    const maxF = Math.max(...frets);
    const clampedMin = Math.max(0, Math.min(20, minF));
    const clampedMax = Math.max(clampedMin + 4, Math.min(24, maxF));
    fretRange = [clampedMin, clampedMax];
  }

  // Calidades y tipos de escala
  const qualitySet = new Set<ChordQualityId>();
  for (const bc of fragment.barChords) {
    if (bc.primaryChord) {
      qualitySet.add(bc.primaryChord.quality);
    }
  }
  const qualities = Array.from(qualitySet);
  const scaleTypes = fragment.primaryScale ? [fragment.primaryScale.type] : undefined;

  return {
    tuning,
    activeStrings,
    fretRange,
    qualities: qualities.length > 0 ? qualities : undefined,
    scaleTypes,
    mode: 'all',
  };
}
