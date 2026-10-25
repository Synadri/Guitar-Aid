/** Límite máximo de voces simultáneas activas. */
export const MAX_VOICES = 16;

/** Duración por defecto de la caída exponencial de una nota (en segundos). */
export const DEFAULT_NOTE_DURATION = 1.5;

/** Tiempo de ataque lineal rápido de la envolvente (en segundos). */
export const ATTACK_TIME = 0.008;

/** Rampa de liberación rápida sin chasquidos al cortar una voz (en segundos). */
export const STOP_RELEASE_TIME = 0.015;

/**
 * ── Equilibrio de volumen y timbre (afinables de oído) ──────────────────────
 * Todas las constantes de esta sección se pueden retocar sin tocar la lógica.
 */

/**
 * Ganancia pico base de cada voz en C4 (escalada por el volumen 0..1 y por
 * `loudnessGain`). Con el máximo refuerzo grave (×~2,8 en C2) la pico queda
 * en ~0,42, por debajo de 0,5.
 */
export const PEAK_GAIN = 0.15;

/** Nota MIDI de referencia de la compensación (C4): ganancia 1,0. */
export const LOUDNESS_REF_MIDI = 60;
/** Nota MIDI del extremo grave de la compensación (C2). */
export const LOUDNESS_LOW_MIDI = 36;
/** Nota MIDI del extremo agudo de la compensación (C7). */
export const LOUDNESS_HIGH_MIDI = 96;
/** Refuerzo en dB en C2 (el oído oye muy poco por debajo de ~100 Hz). */
export const LOUDNESS_LOW_DB = 9;
/** Atenuación en dB en C7 (negativa; los agudos resultan molestos). */
export const LOUDNESS_HIGH_DB = -10;
/** Cota inferior de `loudnessGain`. */
export const LOUDNESS_MIN_GAIN = 0.2;
/** Cota superior de `loudnessGain`. */
export const LOUDNESS_MAX_GAIN = 4;

/** Nivel relativo del segundo armónico en el registro medio (G4 = 67). */
export const HARMONIC_GAIN_RATIO = 0.25;
/** Nivel relativo del segundo armónico en graves (≤ `BASS_MIDI`, ~200 Hz). */
export const BASS_HARMONIC_GAIN_RATIO = 0.7;
/** Nivel relativo del segundo armónico en agudos (≥ `TREBLE_MIDI`): casi puros. */
export const TREBLE_HARMONIC_GAIN_RATIO = 0.05;
/** Nota MIDI (G3 ≈ 196 Hz) por debajo de la cual la nota es "grave". */
export const BASS_MIDI = 55;
/** Nota MIDI del registro medio donde el armónico vale `HARMONIC_GAIN_RATIO`. */
export const MID_MIDI = 67;
/** Nota MIDI (C6) a partir de la cual la nota es "aguda y pura". */
export const TREBLE_MIDI = 84;
/** Margen de la ganancia maestra (máx. 0,7): `volumen × MASTER_HEADROOM`. */
export const MASTER_HEADROOM = 0.7;
/** Umbral del limitador (dB): bajo, para que actúe en acordes densos. */
export const LIMITER_THRESHOLD_DB = -12;
/** Rodilla del limitador (dB): 0 = dura. */
export const LIMITER_KNEE_DB = 0;
/** Relación de compresión del limitador (alta ≈ limitador). */
export const LIMITER_RATIO = 20;
/** Ataque del limitador (s): rápido. */
export const LIMITER_ATTACK = 0.003;
/** Liberación del limitador (s). */
export const LIMITER_RELEASE = 0.1;
/** Frecuencia (Hz) por debajo de la cual el oscilador principal es diente de sierra. */
export const SAWTOOTH_BELOW_HZ = 200;

/** Corte del filtro = frecuencia × multiplicador; multiplicador en C2 (grave). */
export const CUTOFF_MULT_LOW = 6;
/** Multiplicador del corte en C7 (agudo). Interpolado linealmente por semitonos. */
export const CUTOFF_MULT_HIGH = 10;
/** Cota inferior del corte del filtro (Hz). */
export const CUTOFF_MIN_HZ = 800;
/** Cota superior del corte del filtro (Hz). */
export const CUTOFF_MAX_HZ = 8000;

/** Valor positivo mínimo para rampas exponenciales de Web Audio. */
export const MIN_EXPONENTIAL_GAIN = 0.0001;

/**
 * Convierte un número de nota MIDI en su frecuencia en hercios (A4 = 69 → 440 Hz).
 * Fórmula: 440 · 2^((midi − 69) / 12).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ganancia lineal de compensación por nota (1,0 en C4).
 *
 * Razón: la sensibilidad del oído depende de la frecuencia (curvas isofónicas,
 * de las que deriva la ponderación A): a volumen moderado, los graves
 * (C2 ≈ 65 Hz) se perciben decenas de dB más flojos que los medios, mientras
 * que la zona de 2–5 kHz es la más sensible y resulta estridente. Se aplica
 * solo en parte (una fracción de la ponderación A, interpolando linealmente
 * en dB por semitono) para no deformar la dinámica: +9 dB en C2 y −10 dB en C7.
 * Queda acotada entre `LOUDNESS_MIN_GAIN` y `LOUDNESS_MAX_GAIN`.
 */
export function loudnessGain(midi: number): number {
  const m = Number.isFinite(midi) ? midi : LOUDNESS_REF_MIDI;
  let db: number;
  if (m <= LOUDNESS_REF_MIDI) {
    const t = (LOUDNESS_REF_MIDI - m) / (LOUDNESS_REF_MIDI - LOUDNESS_LOW_MIDI);
    db = lerp(0, LOUDNESS_LOW_DB, Math.min(1, t));
  } else {
    const t = (m - LOUDNESS_REF_MIDI) / (LOUDNESS_HIGH_MIDI - LOUDNESS_REF_MIDI);
    db = lerp(0, LOUDNESS_HIGH_DB, Math.min(1, t));
  }
  const gain = Math.pow(10, db / 20);
  return Math.min(LOUDNESS_MAX_GAIN, Math.max(LOUDNESS_MIN_GAIN, gain));
}

/**
 * Corte del filtro paso bajo (Hz) según la altura: entre 6 y 10 veces la
 * frecuencia (crece con la altura), acotado entre 800 y 8000 Hz.
 */
export function cutoffHz(midi: number): number {
  const t = Math.min(
    1,
    Math.max(0, (midi - LOUDNESS_LOW_MIDI) / (LOUDNESS_HIGH_MIDI - LOUDNESS_LOW_MIDI)),
  );
  const cutoff = midiToFrequency(midi) * lerp(CUTOFF_MULT_LOW, CUTOFF_MULT_HIGH, t);
  return Math.min(CUTOFF_MAX_HZ, Math.max(CUTOFF_MIN_HZ, cutoff));
}

/**
 * Nivel relativo de la 2ª armónica según la altura: más rica en graves (para
 * que se oigan en altavoces pequeños) y casi pura en agudos.
 */
export function harmonicGainRatio(midi: number): number {
  if (midi <= BASS_MIDI) return BASS_HARMONIC_GAIN_RATIO;
  if (midi >= TREBLE_MIDI) return TREBLE_HARMONIC_GAIN_RATIO;
  if (midi <= MID_MIDI) {
    return lerp(
      BASS_HARMONIC_GAIN_RATIO,
      HARMONIC_GAIN_RATIO,
      (midi - BASS_MIDI) / (MID_MIDI - BASS_MIDI),
    );
  }
  return lerp(
    HARMONIC_GAIN_RATIO,
    TREBLE_HARMONIC_GAIN_RATIO,
    (midi - MID_MIDI) / (TREBLE_MIDI - MID_MIDI),
  );
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

export interface DynamicsCompressorNodeLike extends AudioNodeLike {
  threshold: AudioParamLike;
  knee: AudioParamLike;
  ratio: AudioParamLike;
  attack: AudioParamLike;
  release: AudioParamLike;
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
  /** Opcional: si falta, el motor conecta la ganancia maestra directamente al destino. */
  createDynamicsCompressor?: () => DynamicsCompressorNodeLike;
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
  const peakGain = Math.max(MIN_EXPONENTIAL_GAIN, PEAK_GAIN * volume * loudnessGain(options.midi));

  try {
    // 1. Oscilador principal (triangular en la frecuencia fundamental)
    const fundamentalOsc = ctx.createOscillator();
    fundamentalOsc.type = frequency < SAWTOOTH_BELOW_HZ ? 'sawtooth' : 'triangle';
    fundamentalOsc.frequency.value = frequency;
    fundamentalOsc.frequency.setValueAtTime?.(frequency, startTime);

    // 2. Segunda armónica (octava superior suave)
    const harmonicOsc = ctx.createOscillator();
    harmonicOsc.type = 'sine';
    const harmonicFreq = frequency * 2;
    harmonicOsc.frequency.value = harmonicFreq;
    harmonicOsc.frequency.setValueAtTime?.(harmonicFreq, startTime);

    const harmonicGain = ctx.createGain();
    const harmonicRatio = harmonicGainRatio(options.midi);
    harmonicGain.gain.value = harmonicRatio;
    harmonicGain.gain.setValueAtTime?.(harmonicRatio, startTime);

    // 3. Filtro paso bajo para redondear el timbre
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = cutoffHz(options.midi);
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
