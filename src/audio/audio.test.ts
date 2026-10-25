import { describe, expect, it, vi } from 'vitest';
import { getScaleType } from '../theory';
import {
  MAX_VOICES,
  PEAK_GAIN,
  arpeggioEvents,
  chordEvents,
  createAudioEngine,
  midiToFrequency,
  playEvents,
  scaleEvents,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type BiquadFilterNodeLike,
  type GainNodeLike,
  type OscillatorNodeLike,
} from './index';

interface MockParam extends AudioParamLike {
  setValues: { value: number; time: number }[];
  linearRamps: { value: number; time: number }[];
  expRamps: { value: number; time: number }[];
  cancelledAt: number[];
}

function createMockParam(initial = 0): MockParam {
  const param: MockParam = {
    value: initial,
    setValues: [],
    linearRamps: [],
    expRamps: [],
    cancelledAt: [],
    setValueAtTime(value: number, time: number) {
      param.value = value;
      param.setValues.push({ value, time });
    },
    linearRampToValueAtTime(value: number, time: number) {
      param.value = value;
      param.linearRamps.push({ value, time });
    },
    exponentialRampToValueAtTime(value: number, time: number) {
      param.expRamps.push({ value, time });
    },
    cancelScheduledValues(time: number) {
      param.cancelledAt.push(time);
    },
  };
  return param;
}

interface MockOscillator extends OscillatorNodeLike {
  frequency: MockParam;
  connectedTo: AudioNodeLike[];
  disconnected: boolean;
  startedAt: number | undefined;
  stoppedAt: number[];
  finish: () => void;
}

interface MockGain extends GainNodeLike {
  gain: MockParam;
  connectedTo: AudioNodeLike[];
  disconnected: boolean;
}

interface MockFilter extends BiquadFilterNodeLike {
  frequency: MockParam;
  connectedTo: AudioNodeLike[];
  disconnected: boolean;
}

function createSimulatedAudioContext(initialState: AudioContextState = 'running') {
  const oscillators: MockOscillator[] = [];
  const gains: MockGain[] = [];
  const filters: MockFilter[] = [];
  let currentTime = 0;
  let state: AudioContextState = initialState;

  const destination: AudioNodeLike = {
    connect: () => destination,
    disconnect: () => {},
  };

  const resume = vi.fn(() => {
    state = 'running';
    return Promise.resolve();
  });

  const ctx: AudioContextLike = {
    get currentTime() {
      return currentTime;
    },
    get state() {
      return state;
    },
    destination,
    resume,
    createOscillator() {
      const osc: MockOscillator = {
        type: 'sine',
        frequency: createMockParam(440),
        onended: null,
        connectedTo: [],
        disconnected: false,
        startedAt: undefined,
        stoppedAt: [],
        connect(target: AudioNodeLike) {
          osc.connectedTo.push(target);
          return target;
        },
        disconnect() {
          osc.disconnected = true;
        },
        start(when = currentTime) {
          osc.startedAt = when;
        },
        stop(when = currentTime) {
          osc.stoppedAt.push(when);
        },
        finish() {
          osc.onended?.();
        },
      };
      oscillators.push(osc);
      return osc;
    },
    createGain() {
      const gainNode: MockGain = {
        gain: createMockParam(1),
        connectedTo: [],
        disconnected: false,
        connect(target: AudioNodeLike) {
          gainNode.connectedTo.push(target);
          return target;
        },
        disconnect() {
          gainNode.disconnected = true;
        },
      };
      gains.push(gainNode);
      return gainNode;
    },
    createBiquadFilter() {
      const filterNode: MockFilter = {
        type: 'lowpass',
        frequency: createMockParam(1000),
        connectedTo: [],
        disconnected: false,
        connect(target: AudioNodeLike) {
          filterNode.connectedTo.push(target);
          return target;
        },
        disconnect() {
          filterNode.disconnected = true;
        },
      };
      filters.push(filterNode);
      return filterNode;
    },
  };

  return {
    ctx,
    oscillators,
    gains,
    filters,
    resume,
    setTime(t: number) {
      currentTime = t;
    },
  };
}

describe('audio — síntesis pluck, motor y planificación pura (U6)', () => {
  it('(a) arpeggioEvents ordena de grave a aguda y respeta el espaciado; chordEvents pone todas en el mismo instante y elimina duplicados', () => {
    const arpeggio = arpeggioEvents([67, 60, 64, 60], 0.15, 1.2);
    expect(arpeggio).toEqual([
      { midi: 60, start: 0, duration: 1.2 },
      { midi: 64, start: 0.15, duration: 1.2 },
      { midi: 67, start: 0.3, duration: 1.2 },
    ]);

    const chord = chordEvents([64, 60, 67, 64, 60], 1.5);
    expect(chord).toEqual([
      { midi: 60, start: 0, duration: 1.5 },
      { midi: 64, start: 0, duration: 1.5 },
      { midi: 67, start: 0, duration: 1.5 },
    ]);
  });

  it('(b) la escala de C empieza en C3 (48) y termina en C4 (60) con 8 notas; la de B va de B3 a B4', () => {
    const majorIntervals = getScaleType('major').intervals;

    const cMajor = scaleEvents(0, majorIntervals, 0.2);
    expect(cMajor).toHaveLength(8);
    expect(cMajor[0]?.midi).toBe(48); // C3
    expect(cMajor[7]?.midi).toBe(60); // C4
    expect(cMajor.map((e) => e.midi)).toEqual([48, 50, 52, 53, 55, 57, 59, 60]);
    expect(cMajor.map((e) => e.start)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4]);

    const bMajor = scaleEvents(11, majorIntervals, 0.2);
    expect(bMajor).toHaveLength(8);
    expect(bMajor[0]?.midi).toBe(59); // B3
    expect(bMajor[7]?.midi).toBe(71); // B4
    expect(bMajor.map((e) => e.midi)).toEqual([59, 61, 63, 64, 66, 68, 70, 71]);
  });

  it('(c) frecuencia: A4 = 440 Hz y E3 = 164,81 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(52)).toBeCloseTo(164.81, 2);
  });

  it('(d) con un AudioContext simulado, tocar una nota crea un oscilador con la frecuencia correcta y una ganancia escalada por el volumen, y el volumen 0 o el sonido desactivado no crean nodos', () => {
    const sim = createSimulatedAudioContext('suspended');
    const createContext = vi.fn(() => sim.ctx);

    const engine = createAudioEngine({
      createContext,
      initialVolume: 0.8,
      initialSoundEnabled: true,
    });

    // El AudioContext se crea de forma diferida (aún no existe antes del primer gesto)
    expect(createContext).not.toHaveBeenCalled();

    // Con el sonido desactivado o volumen 0 no se crean nodos ni el AudioContext
    engine.setSoundEnabled(false);
    expect(engine.playNote(69)).toBeNull();
    expect(createContext).not.toHaveBeenCalled();
    expect(sim.oscillators).toHaveLength(0);

    engine.setSoundEnabled(true);
    engine.setVolume(0);
    expect(engine.playNote(69)).toBeNull();
    expect(createContext).not.toHaveBeenCalled();
    expect(sim.oscillators).toHaveLength(0);

    // Con sonido activo y volumen 0.8: crea el contexto, lo reanuda si estaba suspended y toca A4 (440 Hz)
    engine.setVolume(0.8);
    const voiceA4 = engine.playNote(69);
    expect(voiceA4).not.toBeNull();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(sim.resume).toHaveBeenCalledTimes(1);

    // Primer oscilador: triangular a 440 Hz
    const fundamentalA4 = sim.oscillators[0]!;
    expect(fundamentalA4.type).toBe('triangle');
    expect(fundamentalA4.frequency.value).toBeCloseTo(440, 5);

    // La ganancia de la envolvente de la voz y la ganancia maestra están escaladas por el volumen (0.8)
    const masterGain = sim.gains[0]!;
    const envGainA4 = sim.gains[2]!;
    expect(masterGain.gain.value).toBeCloseTo(0.8, 5);
    expect(envGainA4.gain.value).toBeCloseTo(PEAK_GAIN * 0.8, 5);

    // Al bajar el volumen a la mitad (0.4), la ganancia de la siguiente nota (E3 = 52) se reduce a la mitad
    engine.setVolume(0.4);
    expect(masterGain.gain.value).toBeCloseTo(0.4, 5);

    const oscCountBeforeE3 = sim.oscillators.length;
    const gainCountBeforeE3 = sim.gains.length;
    engine.playNote(52);

    const fundamentalE3 = sim.oscillators[oscCountBeforeE3]!;
    const envGainE3 = sim.gains[gainCountBeforeE3 + 1]!;
    expect(fundamentalE3.frequency.value).toBeCloseTo(164.81, 2);
    expect(envGainE3.gain.value).toBeCloseTo(PEAK_GAIN * 0.4, 5);
    expect(envGainE3.gain.value).toBeCloseTo(envGainA4.gain.value / 2, 5);

    // Con volumen 0 o sonido desactivado ya con contexto creado, tampoco crea nuevos nodos
    const oscCountAfterE3 = sim.oscillators.length;
    const gainCountAfterE3 = sim.gains.length;
    engine.setVolume(0);
    engine.playNote(60);
    expect(sim.oscillators).toHaveLength(oscCountAfterE3);
    expect(sim.gains).toHaveLength(gainCountAfterE3);

    engine.setVolume(0.8);
    engine.setSoundEnabled(false);
    engine.playNote(60);
    expect(sim.oscillators).toHaveLength(oscCountAfterE3);
    expect(sim.gains).toHaveLength(gainCountAfterE3);

    // Si el navegador no tiene Web Audio (createContext devuelve null), todo falla en silencio
    const noAudioEngine = createAudioEngine({ createContext: () => null });
    expect(() => {
      noAudioEngine.playNote(60);
      playEvents(chordEvents([60, 64, 67]), noAudioEngine);
      noAudioEngine.setVolume(0.5);
      noAudioEngine.setSoundEnabled(false);
    }).not.toThrow();
  });

  it('(e) los nodos se desconectan al terminar y el límite de 16 voces se respeta', () => {
    const sim = createSimulatedAudioContext();
    const engine = createAudioEngine({
      createContext: () => sim.ctx,
      initialVolume: 0.8,
      initialSoundEnabled: true,
    });

    // Tocar una nota y simular que termina (onended del oscilador principal)
    engine.playNote(60);
    expect(engine.getActiveVoiceCount()).toBe(1);

    const firstFundamental = sim.oscillators[0]!;
    const firstHarmonic = sim.oscillators[1]!;
    const firstHarmonicGain = sim.gains[1]!; // gains[0] es masterGain
    const firstEnvGain = sim.gains[2]!;
    const firstFilter = sim.filters[0]!;

    expect(firstFundamental.disconnected).toBe(false);
    expect(firstHarmonic.disconnected).toBe(false);
    expect(firstHarmonicGain.disconnected).toBe(false);
    expect(firstEnvGain.disconnected).toBe(false);
    expect(firstFilter.disconnected).toBe(false);

    // Al terminar la nota se desconectan todos sus nodos y sale de las voces activas
    firstFundamental.finish();
    expect(firstFundamental.disconnected).toBe(true);
    expect(firstHarmonic.disconnected).toBe(true);
    expect(firstHarmonicGain.disconnected).toBe(true);
    expect(firstEnvGain.disconnected).toBe(true);
    expect(firstFilter.disconnected).toBe(true);
    expect(engine.getActiveVoiceCount()).toBe(0);

    // Disparar 20 notas seguidas sin que hayan terminado: el límite de 16 voces se respeta
    for (let i = 0; i < 20; i++) {
      engine.playNote(48 + i);
      expect(engine.getActiveVoiceCount()).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(engine.getActiveVoiceCount()).toBe(MAX_VOICES);

    // La primera de las 20 voces fue cortada suavemente sin chasquidos (cancelScheduledValues + rampa exponencial)
    const oldestOfBatchFundamental = sim.oscillators[2]!;
    const oldestOfBatchEnvGain = sim.gains[4]!;
    expect(oldestOfBatchEnvGain.gain.cancelledAt.length).toBeGreaterThan(0);
    expect(oldestOfBatchEnvGain.gain.expRamps.length).toBeGreaterThanOrEqual(2);
    expect(oldestOfBatchFundamental.stoppedAt.length).toBeGreaterThanOrEqual(2);

    // Cuando termina el corte de la voz desalojada, sus nodos quedan desconectados
    oldestOfBatchFundamental.finish();
    expect(oldestOfBatchFundamental.disconnected).toBe(true);
    expect(oldestOfBatchEnvGain.disconnected).toBe(true);
  });
});
