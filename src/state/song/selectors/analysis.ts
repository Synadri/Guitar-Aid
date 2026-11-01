import {
  analyzeBarChords,
  analyzeSongFragment,
  combineBarsForIndex,
  detectSongKeysByBar,
  type BarChordAnalysis,
  type SongFragmentAnalysis,
  type SongKeyByBar,
} from '../../../song';
import type { ChordSequenceAnalysis, NameMode } from '../../../theory';
import type { SongState, TrackMixerState } from '../types';

interface AnalysisCacheEntry {
  key: string;
  result: SongFragmentAnalysis;
}

let lastCache: AnalysisCacheEntry | null = null;

function computeCacheKey(
  state: SongState,
  startBar: number,
  endBar: number,
  mode: NameMode,
): string {
  const songId = state.activeSong?.id ?? 'no-song';
  const trackIdx = state.activeTrackIndex;
  const source = state.analysisSource;
  const overrides = JSON.stringify(state.barOverrides);
  return `${songId}|${startBar}|${endBar}|${trackIdx}|${source}|${overrides}|${mode}`;
}

/**
 * Selector memorizado del análisis integral del fragmento activo (plan_fase3.md §7 C4).
 * Si hay un rango de compases seleccionado, analiza ese rango [startBar, endBar];
 * si no hay selección, analiza el compás actual.
 */
export function selectActiveFragmentAnalysis(
  state: SongState,
  options?: { mode?: NameMode },
): SongFragmentAnalysis | null {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return null;

  const mode: NameMode = options?.mode ?? 'sharps';

  const [startBar, endBar] = state.selectedBarRange
    ? state.selectedBarRange
    : [state.currentBar, state.currentBar];

  const key = computeCacheKey(state, startBar, endBar, mode);
  if (lastCache && lastCache.key === key) {
    return lastCache.result;
  }

  const result = analyzeSongFragment(song, [startBar, endBar], {
    trackIndex: state.activeTrackIndex,
    allTracks: state.analysisSource === 'all-tracks',
    barOverrides: state.barOverrides,
    mode,
  });

  lastCache = { key, result };
  return result;
}

/**
 * Selector del análisis armónico del compás actualmente inspeccionado.
 * Inspecciona `state.inspectedBar` si el usuario ancló uno, o `state.currentBar` en caso contrario.
 */
export function selectActiveBarAnalysis(
  state: SongState,
  options?: { mode?: NameMode },
): BarChordAnalysis | null {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return null;

  const track = song.tracks[state.activeTrackIndex] ?? song.tracks[0];
  if (!track || track.bars.length === 0) return null;

  const targetBarNumber = state.inspectedBar ?? state.currentBar;
  const barIndex = targetBarNumber - 1;
  const mode = options?.mode ?? 'sharps';

  let bar = track.bars.find((b) => b.number === targetBarNumber);
  if (state.analysisSource === 'all-tracks') {
    const activeTracks = song.tracks.filter((t) => !t.isPercussion);
    bar = combineBarsForIndex(activeTracks, barIndex) ?? bar;
  }

  if (!bar) return null;

  return analyzeBarChords(bar, {
    mode,
    override: state.barOverrides[targetBarNumber],
  });
}

/**
 * Selector de la tonalidad local de cada compás de la canción con detección de modulación.
 */
export function selectSongKeys(
  state: SongState,
  options?: { mode?: NameMode },
): SongKeyByBar[] {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return [];

  return detectSongKeysByBar(song, {
    trackIndex: state.activeTrackIndex,
    allTracks: state.analysisSource === 'all-tracks',
    barOverrides: state.barOverrides,
    mode: options?.mode ?? 'sharps',
  });
}

/**
 * Selector del análisis de progresión del fragmento activo en números romanos.
 */
export function selectBarProgression(
  state: SongState,
  options?: { mode?: NameMode },
): ChordSequenceAnalysis | null {
  const fragment = selectActiveFragmentAnalysis(state, options);
  return fragment ? fragment.progression : null;
}

/**
 * Obtiene el número de compás actualmente bajo foco de inspección (1..N).
 */
export function selectInspectedBarNumber(state: SongState): number {
  return state.inspectedBar ?? state.currentBar;
}

/**
 * Obtiene el estado del mezclador para una pista concreta con valores de reserva seguros.
 */
export function selectTrackMixerState(state: SongState, trackIndex: number): TrackMixerState {
  return (
    state.trackMixer[trackIndex] ?? {
      muted: false,
      solo: false,
      volume: 1.0,
    }
  );
}
