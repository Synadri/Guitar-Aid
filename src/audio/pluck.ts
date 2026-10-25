/** Límite máximo de voces simultáneas activas. */
export const MAX_VOICES = 16;

/** Duración por defecto de la caída exponencial de una nota (en segundos). */
export const DEFAULT_NOTE_DURATION = 1.5;

/** Tiempo de ataque lineal rápido de la envolvente (en segundos). */
export const ATTACK_TIME = 0.008;

/** Rampa de liberación rápida sin chasquidos al cortar una voz (en segundos). */
export const STOP_RELEASE_TIME = 0.015;

/** Ganancia pico base de cada voz (escalada por el volumen 0..1). */
export const PEAK_GAIN = 0.35;

/** Nivel relativo del segundo armónico respecto a la fundamental. */
export const HARMONIC_GAIN_RATIO = 0.25;

/** Valor positivo mínimo para rampas exponenciales de Web Audio. */
export const MIN_EXPONENTIAL_GAIN = 0.0001;

/**
 * Convierte un número de nota MIDI en su frecuencia en hercios (A4 = 69 → 440 Hz).
 * Fórmula: 440 · 2^((midi − 69) / 12).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Subconjunto estructural de AudioParam compatible con Web Audio API y con dobles de prueba. */
export interface AudioParamLike {
  value: number;
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
  exponentialRampToValueAtTime?: (value: number, endTime: number) => void;
  cancelScheduledValues?: (startTime: number) => void;
}

/** Nodo conectable de Web Audio. */
export interface AudioNodeLike {
  connect: (destination: AudioNodeLike) => unknown;
  disconnect: () => void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  frequency: AudioParamLike;
  Q?: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  onended: (() => void) | null;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state?: AudioContextState;
  readonly destination: AudioNodeLike;
  resume?: () => Promise<void> | void;
  createOscillator: () => OscillatorNodeLike;
  createGain: () => GainNodeLike;
  createBiquadFilter: () => BiquadFilterNodeLike;
}

export interface PluckOptions {
  midi: number;
  /** Instante absoluto de inicio en el reloj del AudioContext (por defecto `ctx.currentTime`). */
  startTime?: number;
  /** Duración de la nota en segundos (por defecto ~1,5 s). */
  duration?: number;
  /** Volumen en 0..1 que escala la ganancia de la envolvente (por defecto 1). */
  volume?: number;
  /** Callback invocado cuando la voz termina y desconecta sus nodos. */
  onEnded?: (voice: PluckVoice) => void;
}

export interface PluckVoice {
  readonly midi: number;
  readonly frequency: number;
  readonly startTime: number;
  readonly stopTime: number;
  /** Corta la voz suavemente con una rampa corta sin chasquidos y desconecta al terminar. */
  stop: (now?: number) => void;
  /** Desconecta inmediatamente todos los nodos de la voz. */
  disconnect: () => void;
}

/**
 * Sintetiza una nota tipo cuerda pulsada (pluck):
 * - Oscilador principal triangular a la frecuencia fundamental `440 · 2^((midi − 69)/12)`.
 * - Segundo oscilador senoidal una octava por encima (2ª armónica) con ganancia reducida.
 * - Filtro paso bajo suave proporcional a la altura de la nota.
 * - Envolvente de ganancia con ataque rápido (`ATTACK_TIME`) escalado por `volume`
 *   y caída exponencial de ~1,5 s (`DEFAULT_NOTE_DURATION`).
 */
export function pluckNote(
  ctx: AudioContextLike,
  destination: AudioNodeLike,
  options: PluckOptions,
): PluckVoice | null {
  const volume = Math.max(0, Math.min(1, options.volume ?? 1));
  if (volume <= 0) return null;

  const frequency = midiToFrequency(options.midi);
  const startTime = Math.max(ctx.currentTime, options.startTime ?? ctx.currentTime);
  const duration = Math.max(
    ATTACK_TIME + STOP_RELEASE_TIME,
    options.duration ?? DEFAULT_NOTE_DURATION,
  );
  const stopTime = startTime + duration;
  const peakGain = Math.max(MIN_EXPONENTIAL_GAIN, PEAK_GAIN * volume);

  try {
    // 1. Oscilador principal (triangular en la frecuencia fundamental)
    const fundamentalOsc = ctx.createOscillator();
    fundamentalOsc.type = 'triangle';
    fundamentalOsc.frequency.value = frequency;
    fundamentalOsc.frequency.setValueAtTime?.(frequency, startTime);

    // 2. Segunda armónica (octava superior suave)
    const harmonicOsc = ctx.createOscillator();
    harmonicOsc.type = 'sine';
    const harmonicFreq = frequency * 2;
    harmonicOsc.frequency.value = harmonicFreq;
    harmonicOsc.frequency.setValueAtTime?.(harmonicFreq, startTime);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = HARMONIC_GAIN_RATIO;
    harmonicGain.gain.setValueAtTime?.(HARMONIC_GAIN_RATIO, startTime);

    // 3. Filtro paso bajo para redondear el timbre
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = Math.min(8000, Math.max(900, frequency * 4));
    filter.frequency.value = cutoff;
    filter.frequency.setValueAtTime?.(cutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime?.(Math.max(300, frequency * 1.5), stopTime);

    // 4. Envolvente de amplitud escalada por el volumen
    const envGain = ctx.createGain();
    envGain.gain.value = peakGain;
    envGain.gain.setValueAtTime?.(MIN_EXPONENTIAL_GAIN, startTime);
    envGain.gain.linearRampToValueAtTime?.(peakGain, startTime + ATTACK_TIME);
    envGain.gain.exponentialRampToValueAtTime?.(MIN_EXPONENTIAL_GAIN, stopTime);

    // Conexión del grafo: fundamental + (armónica -> harmonicGain) -> filter -> envGain -> destination
    fundamentalOsc.connect(filter);
    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(envGain);
    envGain.connect(destination);

    let disconnected = false;
    let stoppedEarly = false;

    const disconnectAll = () => {
      if (disconnected) return;
      disconnected = true;
      try {
        fundamentalOsc.disconnect();
        harmonicOsc.disconnect();
        harmonicGain.disconnect();
        filter.disconnect();
        envGain.disconnect();
      } catch {
        // Ignorar errores de desconexión en navegadores o mocks parciales
      }
      options.onEnded?.(voice);
    };

    fundamentalOsc.onended = () => {
      disconnectAll();
    };

    fundamentalOsc.start(startTime);
    harmonicOsc.start(startTime);
    fundamentalOsc.stop(stopTime);
    harmonicOsc.stop(stopTime);

    const voice: PluckVoice = {
      midi: options.midi,
      frequency,
      startTime,
      stopTime,
      stop: (now = ctx.currentTime) => {
        if (disconnected || stoppedEarly) return;
        stoppedEarly = true;
        const cutStart = Math.max(ctx.currentTime, now);
        const cutEnd = cutStart + STOP_RELEASE_TIME;
        try {
          envGain.gain.cancelScheduledValues?.(cutStart);
          envGain.gain.setValueAtTime?.(Math.max(MIN_EXPONENTIAL_GAIN, peakGain * 0.5), cutStart);
          envGain.gain.exponentialRampToValueAtTime?.(MIN_EXPONENTIAL_GAIN, cutEnd);
          fundamentalOsc.stop(cutEnd);
          harmonicOsc.stop(cutEnd);
        } catch {
          disconnectAll();
        }
      },
      disconnect: disconnectAll,
    };

    return voice;
  } catch {
    return null;
  }
}
