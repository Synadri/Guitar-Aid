import {
  DEFAULT_NOTE_DURATION,
  MAX_VOICES,
  pluckNote,
  type AudioContextLike,
  type GainNodeLike,
  type PluckVoice,
} from './pluck';
import type { NoteEvent } from './playback';

export interface AudioEngineOptions {
  /** Fábrica opcional para inyectar un AudioContext simulado en tests. */
  createContext?: () => AudioContextLike | null;
  /** Volumen maestro inicial en 0..1 (por defecto 0.8). */
  initialVolume?: number;
  /** Estado inicial del interruptor de sonido (por defecto true). */
  initialSoundEnabled?: boolean;
  /** Límite de voces simultáneas (por defecto 16). */
  maxVoices?: number;
}

export interface PlayNoteScheduleOptions {
  /** Desplazamiento en segundos respecto a `ctx.currentTime` (por defecto 0). */
  startOffset?: number;
  /** Duración en segundos (por defecto `DEFAULT_NOTE_DURATION`). */
  duration?: number;
}

export interface AudioEngine {
  /** Toca una nota MIDI inmediatamente (o con desplazamiento opcional). */
  playNote: (midi: number, options?: PlayNoteScheduleOptions) => PluckVoice | null;
  /** Planifica una secuencia de eventos `{ midi, start, duration }` en el motor. */
  playEvents: (events: readonly NoteEvent[]) => PluckVoice[];
  /** Fija el volumen maestro en el rango `0..1`. */
  setVolume: (volume: number) => void;
  /** Devuelve el volumen maestro actual (`0..1`). */
  getVolume: () => number;
  /** Activa o desactiva globalmente el sonido. */
  setSoundEnabled: (enabled: boolean) => void;
  /** Indica si el sonido está activado. */
  isSoundEnabled: () => boolean;
  /** Número de voces activas actualmente. */
  getActiveVoiceCount: () => number;
  /** Detiene suavemente todas las voces activas. */
  stopAll: () => void;
}

function clampVolume(volume: number, fallback = 0.8): number {
  if (!Number.isFinite(volume)) return fallback;
  return Math.max(0, Math.min(1, volume));
}

/** Resuelve el constructor de AudioContext del navegador (si existe). */
export function defaultCreateAudioContext(): AudioContextLike | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Crea una instancia del motor de audio.
 * - Crea el `AudioContext` de forma diferida en el primer gesto que produce sonido.
 * - Reanuda el contexto si está `'suspended'`.
 * - Mantiene un límite de `maxVoices` (16) voces simultáneas cortando la más antigua sin chasquidos.
 * - Si el navegador no soporta Web Audio, falla en silencio.
 */
export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const createContext = options.createContext ?? defaultCreateAudioContext;
  const maxVoices = Math.max(1, options.maxVoices ?? MAX_VOICES);

  let volume = clampVolume(options.initialVolume ?? 0.8);
  let soundEnabled = options.initialSoundEnabled ?? true;
  let ctx: AudioContextLike | null = null;
  let masterGain: GainNodeLike | null = null;
  const activeVoices: PluckVoice[] = [];

  const removeVoice = (voice: PluckVoice) => {
    const idx = activeVoices.indexOf(voice);
    if (idx !== -1) activeVoices.splice(idx, 1);
  };

  const ensureContext = (): { ctx: AudioContextLike; masterGain: GainNodeLike } | null => {
    if (!ctx) {
      try {
        ctx = createContext();
      } catch {
        ctx = null;
      }
      if (!ctx) return null;
      try {
        masterGain = ctx.createGain();
        masterGain.gain.value = volume;
        masterGain.gain.setValueAtTime?.(volume, ctx.currentTime);
        masterGain.connect(ctx.destination);
      } catch {
        ctx = null;
        masterGain = null;
        return null;
      }
    }

    if (ctx.state === 'suspended') {
      try {
        void ctx.resume?.();
      } catch {
        // Ignorar errores al reanudar
      }
    }

    if (!masterGain) return null;
    return { ctx, masterGain };
  };

  const evictOldestIfNeeded = (currentCtx: AudioContextLike) => {
    while (activeVoices.length >= maxVoices) {
      const oldest = activeVoices.shift();
      if (oldest) {
        oldest.stop(currentCtx.currentTime);
      }
    }
  };

  const playNote = (
    midi: number,
    scheduleOptions: PlayNoteScheduleOptions = {},
  ): PluckVoice | null => {
    if (!soundEnabled || volume <= 0) return null;

    const ready = ensureContext();
    if (!ready) return null;

    evictOldestIfNeeded(ready.ctx);

    const startOffset = Math.max(0, scheduleOptions.startOffset ?? 0);
    const startTime = ready.ctx.currentTime + startOffset;
    const duration = scheduleOptions.duration ?? DEFAULT_NOTE_DURATION;

    const voice = pluckNote(ready.ctx, ready.masterGain, {
      midi,
      startTime,
      duration,
      volume,
      onEnded: removeVoice,
    });

    if (voice) {
      activeVoices.push(voice);
    }

    return voice;
  };

  const playEvents = (events: readonly NoteEvent[]): PluckVoice[] => {
    if (!soundEnabled || volume <= 0 || events.length === 0) return [];
    const voices: PluckVoice[] = [];
    for (const ev of events) {
      const v = playNote(ev.midi, { startOffset: ev.start, duration: ev.duration });
      if (v) voices.push(v);
    }
    return voices;
  };

  const stopAll = () => {
    const toStop = activeVoices.splice(0, activeVoices.length);
    const now = ctx?.currentTime ?? 0;
    for (const v of toStop) {
      v.stop(now);
    }
  };

  const setVolume = (nextVolume: number) => {
    volume = clampVolume(nextVolume, volume);
    if (ctx && masterGain) {
      try {
        masterGain.gain.value = volume;
        masterGain.gain.setValueAtTime?.(volume, ctx.currentTime);
      } catch {
        // Fallo silencioso
      }
    }
    if (volume <= 0) {
      stopAll();
    }
  };

  const setSoundEnabled = (enabled: boolean) => {
    soundEnabled = Boolean(enabled);
    if (!soundEnabled) {
      stopAll();
    }
  };

  return {
    playNote,
    playEvents,
    setVolume,
    getVolume: () => volume,
    setSoundEnabled,
    isSoundEnabled: () => soundEnabled,
    getActiveVoiceCount: () => activeVoices.length,
    stopAll,
  };
}

/** Instancia singleton del motor de audio para la aplicación. */
export const audioEngine: AudioEngine = createAudioEngine();
