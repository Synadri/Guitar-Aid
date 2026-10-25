import { getChordQuality, toMidi, type ChordQualityId, type PitchClass } from '../theory';
import { audioEngine, type AudioEngine } from './engine';
import { DEFAULT_NOTE_DURATION, type PluckVoice } from './pluck';

/** Evento puro de planificación musical (sin dependencia de AudioContext). */
export interface NoteEvent {
  midi: number;
  /** Instante relativo de inicio en segundos desde el comienzo de la reproducción (`>= 0`). */
  start: number;
  /** Duración de la nota en segundos. */
  duration: number;
}

/** Espaciado por defecto entre notas consecutivas de un arpegio (en segundos). */
export const DEFAULT_ARPEGGIO_SPACING = 0.12;

/** Espaciado por defecto entre notas consecutivas de una escala (en segundos). */
export const DEFAULT_SCALE_SPACING = 0.22;

/** Duración por defecto de cada nota al reproducir una escala (en segundos). */
export const DEFAULT_SCALE_NOTE_DURATION = 0.65;

/** Octava base para reproducir escalas y acordes sin digitación (C3–B3 = 48..59). */
export const PLAYBACK_BASE_OCTAVE = 3;

/** Elimina alturas MIDI duplicadas y las ordena de grave a aguda. */
function uniqueSortedMidis(midis: readonly number[]): number[] {
  return [...new Set(midis)].sort((a, b) => a - b);
}

/**
 * Planifica un acorde: todas las notas suenan a la vez (`start: 0`),
 * sin duplicar alturas y ordenadas de grave a aguda.
 */
export function chordEvents(
  midis: readonly number[],
  duration: number = DEFAULT_NOTE_DURATION,
): NoteEvent[] {
  return uniqueSortedMidis(midis).map((midi) => ({
    midi,
    start: 0,
    duration,
  }));
}

/**
 * Planifica un arpegio de grave a aguda sin duplicar alturas,
 * separando cada nota por `spacing` segundos.
 */
export function arpeggioEvents(
  midis: readonly number[],
  spacing: number = DEFAULT_ARPEGGIO_SPACING,
  duration: number = DEFAULT_NOTE_DURATION,
): NoteEvent[] {
  const safeSpacing = Math.max(0, spacing);
  return uniqueSortedMidis(midis).map((midi, index) => ({
    midi,
    start: Number((index * safeSpacing).toFixed(6)),
    duration,
  }));
}

/**
 * Planifica una escala ascendente de una octava desde la tónica en la octava 3
 * hasta la tónica superior (C3–C4 = 48..60; con la tónica más alta, B3–B4 = 59..71).
 */
export function scaleEvents(
  tonicPc: PitchClass,
  intervals: readonly number[],
  spacing: number = DEFAULT_SCALE_SPACING,
  duration: number = DEFAULT_SCALE_NOTE_DURATION,
): NoteEvent[] {
  if (intervals.length === 0) return [];
  const baseMidi = toMidi(tonicPc, PLAYBACK_BASE_OCTAVE);
  const safeSpacing = Math.max(0, spacing);

  const offsets = [...new Set([...intervals.filter((i) => i >= 0 && i < 12), 12])].sort(
    (a, b) => a - b,
  );

  return offsets.map((semitones, index) => ({
    midi: baseMidi + semitones,
    start: Number((index * safeSpacing).toFixed(6)),
    duration,
  }));
}

/**
 * Alturas MIDI por defecto en la octava 3 para un acorde del menú cuando no hay
 * digitación disponible en la afinación actual (p. ej. afinaciones abiertas).
 */
export function chordFallbackMidis(root: PitchClass, quality: ChordQualityId): number[] {
  const rootMidi = toMidi(root, PLAYBACK_BASE_OCTAVE);
  return getChordQuality(quality).intervals.map((semitones) => rootMidi + semitones);
}

/** Envía una lista de eventos planificados al motor de audio. */
export function playEvents(
  events: readonly NoteEvent[],
  engine: AudioEngine = audioEngine,
): PluckVoice[] {
  return engine.playEvents(events);
}
