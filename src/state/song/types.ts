import type {
  BarOverride,
  SongBar,
  SongBeat,
  SongMenuContext,
  SongModel,
  SongNote,
  SongTrack,
  UserSongAnnotations,
} from '../../song';
import type { ChordQualityId, NameMode, PitchClass, ScaleTypeId } from '../../theory';
import type { LabelMode, MarksOptions } from '../shared/marks';

export type {
  BarOverride,
  SongBar,
  SongBeat,
  SongMenuContext,
  SongModel,
  SongNote,
  SongTrack,
  UserSongAnnotations,
};

/** Modo de visualización de la partitura / tablatura (plan_fase3.md §5.1). */
export type ScoreViewMode = 'tab' | 'score-tab' | 'score';

/**
 * Referencia de cálculo para etiquetas de intervalo y grado (plan_fase3.md §5.2).
 * - 'chord': respecto a la fundamental del acorde del compás (ej. Am → A = 1, C = ♭3, E = 5).
 * - 'key': respecto a la tónica de la tonalidad activa (ej. C mayor → C = 1, A = 6, E = 3).
 */
export type DegreeReferenceMode = 'key' | 'chord';

/** Fuente de notas para el análisis armónico del fragmento (plan_fase3.md §5.4). */
export type AnalysisSource = 'active-track' | 'all-tracks';

/** Estado del mezclador por pista (plan_fase3.md §7 C4). */
export interface TrackMixerState {
  muted: boolean;
  solo: boolean;
  volume: number; // 0..1
}

/** Canción persistida en el repositorio IndexedDB ('guitar-aid-songs-db'). */
export interface StoredSong {
  id: string;
  title: string;
  artist: string;
  model: SongModel;
  rawData?: Uint8Array | string;
  fileFormat?: string;
  fileSize?: number;
  importedAt: string;
  lastOpenedAt: string;
}

/** Interfaz del repositorio de almacenamiento para Modo Canción (plan_fase3.md §7 C4). */
export interface SongStorage {
  saveSong(song: StoredSong): Promise<void>;
  getSong(id: string): Promise<StoredSong | undefined>;
  listSongs(): Promise<StoredSong[]>;
  deleteSong(id: string): Promise<void>;

  saveAnnotations(annotations: UserSongAnnotations): Promise<void>;
  getAnnotations(songId: string): Promise<UserSongAnnotations | undefined>;
  deleteAnnotations(songId: string): Promise<void>;

  clear(): Promise<void>;
}

/** Opciones de cálculo de marcas para Fretboard y Piano. */
export interface SongMarksOptions extends MarksOptions {
  nameMode?: NameMode;
  labels?: LabelMode;
  pianoRange?: { from: number; to: number };
}

/** Información de armonía resuelta para el compás activo. */
export interface ActiveHarmonyInfo {
  barNumber: number;
  scaleTonic: PitchClass;
  scaleType: ScaleTypeId;
  scalePcs: PitchClass[];
  chordRoot?: PitchClass;
  chordQuality?: ChordQualityId;
  referenceRoot: PitchClass;
  hasChordOverride: boolean;
  hasScaleOverride: boolean;
}

/** Estado reactivo del Modo Canción (plan_fase3.md §7 C4). */
export interface SongState {
  /** Canción actualmente cargada en memoria. */
  activeSong: SongModel | null;
  /** Índice de la pista activa visualizada en tablatura y mástil (0..N-1). */
  activeTrackIndex: number;
  /** Número del compás activo de reproducción o inspección (1..N). */
  currentBar: number;
  /** Índice del pulso activo dentro del compás (0..). */
  currentBeat: number;
  /** Si la reproducción de audio está en curso. */
  isPlaying: boolean;
  /** Factor de velocidad de reproducción (0.25× .. 2.0×). */
  playbackSpeed: number;
  /** Metrónomo activo durante reproducción. */
  metronomeEnabled: boolean;
  /** Cuenta atrás previa de 1 compás al reproducir. */
  countInEnabled: boolean;
  /** Rango de compases del bucle [startBar, endBar] (1-based), o null si no hay. */
  loopRange: [number, number] | null;
  /** Si el bucle está actualmente activo. */
  loopEnabled: boolean;
  /** Rango de compases seleccionado por el usuario [startBar, endBar] (1-based). */
  selectedBarRange: [number, number] | null;
  /** Compás anclado para inspección en el panel de análisis, o null para seguir a currentBar. */
  inspectedBar: number | null;
  /** Sobreescrituras manuales de acorde o tonalidad por compás (key = bar.number). */
  barOverrides: Record<number, BarOverride>;
  /** Referencia para el cálculo de intervalos y grados: respecto a la tonalidad o al acorde. */
  degreeReferenceMode: DegreeReferenceMode;
  /** Vista de partitura: 'tab' | 'score-tab' | 'score'. */
  scoreViewMode: ScoreViewMode;
  /** Mostrar u ocultar la fila de letra. */
  showLyrics: boolean;
  /** Fuente de análisis: solo la pista activa o todas las pistas armónicas. */
  analysisSource: AnalysisSource;
  /** Estado del mezclador por índice de pista. */
  trackMixer: Record<number, TrackMixerState>;
  /** Contexto en previsualización (hover en análisis). */
  previewContext: SongMenuContext | null;
  /** Indicador de carga asíncrona de canciones o bibliotecas. */
  isLoading: boolean;
  /** Mensaje de error accesible si la importación o lectura falla. */
  error: string | null;
}

/** Acciones para modificar el estado del Modo Canción. */
export interface SongActions {
  setActiveSong: (song: SongModel | null) => Promise<void>;
  setActiveTrackIndex: (index: number) => void;
  setCurrentBar: (barNumber: number) => void;
  setCurrentBeat: (beatIndex: number) => void;
  setCurrentPosition: (barNumber: number, beatIndex: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  toggleMetronome: () => void;
  setCountInEnabled: (enabled: boolean) => void;
  toggleCountIn: () => void;
  setLoopRange: (range: [number, number] | null) => void;
  setLoopEnabled: (enabled: boolean) => void;
  toggleLoop: () => void;
  setSelectedBarRange: (range: [number, number] | null) => void;
  setInspectedBar: (barNumber: number | null) => void;
  setBarOverride: (barNumber: number, override: Partial<BarOverride>) => Promise<void>;
  clearBarOverride: (barNumber: number) => Promise<void>;
  clearBarScaleOverride: (barNumber: number) => Promise<void>;
  clearBarChordOverride: (barNumber: number) => Promise<void>;
  clearAllBarOverrides: () => Promise<void>;
  setDegreeReferenceMode: (mode: DegreeReferenceMode) => void;
  setScoreViewMode: (mode: ScoreViewMode) => void;
  setShowLyrics: (show: boolean) => void;
  toggleLyrics: () => void;
  setAnalysisSource: (source: AnalysisSource) => void;
  setTrackMixer: (trackIndex: number, partial: Partial<TrackMixerState>) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, solo: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  resetTrackMixer: () => void;
  setPreviewContext: (preview: SongMenuContext | null) => void;
  importSong: (
    model: SongModel,
    metadata?: { rawData?: Uint8Array | string; fileFormat?: string; fileSize?: number },
  ) => Promise<void>;
  loadSavedSong: (songId: string) => Promise<boolean>;
  deleteSavedSong: (songId: string) => Promise<void>;
  setError: (error: string | null) => void;
  resetSongState: () => void;
}

export type SongStore = SongState & SongActions;
