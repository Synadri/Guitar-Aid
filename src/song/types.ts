import type { PitchClass, Tuning } from '../theory';

/**
 * Modelo intermedio puro de canción (docs/Fase-3/plan_fase3.md §3.1).
 * Desacopla la aplicación de las estructuras mutables de alphaTab.
 */

export interface SongNote {
  /** 1 = cuerda más aguda .. N = más grave (según la afinación de la pista). */
  string: number;
  /** 0..24+ */
  fret: number;
  /** Altura MIDI real sonando. */
  midi: number;
  /** Clase de altura (0..11). */
  pc: PitchClass;
  /** Duración en ticks rítmicos (960 ticks = 1 negra). */
  durationTicks: number;
  /** Nota ligada desde el pulso anterior. */
  isTied: boolean;
  /** Nota fantasma / de adorno (menor peso armónico). */
  isGhost: boolean;
  /** Semitonos de bend si aplica (para reflejar la altura destino). */
  bendSemitones?: number;
}

export interface SongBeat {
  /** Índice del pulso dentro del compás (0..). */
  index: number;
  /** Posición de inicio relativa al compás (ticks). */
  startTick: number;
  /** Duración del pulso (ticks). */
  durationTicks: number;
  /** Peso métrico precalculado (1.5 tiempo 1, 1.2 fuerte secundario, 1.0 a tierra, 0.75 contratiempo). */
  metricWeight: number;
  /** Cifrado de acorde anotado en la partitura, si el archivo lo trae (p. ej. "Am7"). */
  chordAnnotation?: string;
  /** Sílaba o texto de letra asociado al tiempo. */
  lyrics?: string;
  notes: readonly SongNote[];
}

export interface SongBar {
  /** Índice 0-based (compás 1 = index 0). */
  index: number;
  /** Número de compás visible (1..N). */
  number: number;
  timeSignature: { numerator: number; denominator: number };
  /** Tempo vigente en este compás. */
  tempoBpm: number;
  /** Armadura declarada en el archivo. */
  keySignature?: { accidentalCount: number; mode: 'major' | 'minor' };
  /** Nombre de sección si comienza o rige aquí (p. ej. "Intro", "Estribillo"). */
  sectionMarker?: string;
  beats: readonly SongBeat[];
}

export interface SongTrack {
  index: number;
  name: string;
  /** true en pistas de batería (excluidas del análisis armónico). */
  isPercussion: boolean;
  /** Número de cuerdas del instrumento. */
  stringCount: number;
  /** Afinación resuelta (catálogo o personalizada de la pista). */
  tuning: Tuning;
  /** Traste de cejilla (0 si no hay). */
  capoFret: number;
  bars: readonly SongBar[];
}

export interface SongModel {
  id: string;
  title: string;
  artist: string;
  album?: string;
  initialTempoBpm: number;
  tracks: readonly SongTrack[];
}
