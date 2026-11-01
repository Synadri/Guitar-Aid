import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetronomeAudio } from './metronomeAudio';

interface MockOscillatorNode {
  type: string;
  frequency: {
    setValueAtTime: (f: number) => void;
    exponentialRampToValueAtTime: (f: number) => void;
  };
  connect: () => void;
  start: () => void;
  stop: () => void;
  startFreq?: number;
  targetFreq?: number;
}

interface MockGainNode {
  gain: {
    setValueAtTime: (g: number) => void;
    exponentialRampToValueAtTime: () => void;
  };
  connect: () => void;
  gainValue?: number;
}

describe('MetronomeAudio — motor Web Audio para metrónomo y subdivisiones', () => {
  let createdNodes: {
    startFreq?: number;
    targetFreq?: number;
  }[];
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    createdNodes = [];

    mockAudioContext = {
      currentTime: 10.0,
      state: 'running',
      destination: {} as AudioDestinationNode,
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn(() => {
        const osc: MockOscillatorNode = {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn((f: number) => {
              osc.startFreq = f;
            }),
            exponentialRampToValueAtTime: vi.fn((f: number) => {
              osc.targetFreq = f;
            }),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        createdNodes.push(osc);
        return osc as unknown as OscillatorNode;
      }),
      createGain: vi.fn(() => {
        const gain: MockGainNode = {
          gain: {
            setValueAtTime: vi.fn((g: number) => {
              gain.gainValue = g;
            }),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        return gain as unknown as GainNode;
      }),
    } as unknown as AudioContext;
  });

  it('no emite sonido si el volumen es 0', () => {
    const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });
    metronome.playClick(true, false, 0);
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it('emite clic acentuado (primer pulso) a 1600 Hz', () => {
    const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });
    metronome.playClick(true, false, 0.8);

    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    const osc = createdNodes[0];
    expect(osc?.startFreq).toBe(1600);
    expect(osc?.targetFreq).toBe(800);
  });

  it('emite clic de pulso regular a 1000 Hz', () => {
    const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });
    metronome.playClick(false, false, 0.8);

    const osc = createdNodes[0];
    expect(osc?.startFreq).toBe(1000);
    expect(osc?.targetFreq).toBe(500);
  });

  it('emite clic de subdivisión (contratiempo) a 750 Hz', () => {
    const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });
    metronome.playClick(false, true, 0.8);

    const osc = createdNodes[0];
    expect(osc?.startFreq).toBe(750);
    expect(osc?.targetFreq).toBe(375);
  });

  describe('scheduleBeat según subdivisión', () => {
    it('subdivisión 1: solo emite clic en el pulso 1 (numerator === 0)', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 500, '1', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);

      metronome.scheduleBeat(1, 500, '1', 0.8);
      metronome.scheduleBeat(2, 500, '1', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('subdivisión 1/4: emite clic en cada tiempo', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 500, '1/4', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);

      metronome.scheduleBeat(1, 500, '1/4', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('subdivisión 1/8: emite clic en el tiempo y programa subdivisión a mitad de tiempo', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 500, '1/8', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1); // Clic inicial

      // Avanzar temporizadores
      vi.advanceTimersByTime(250);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2); // Clic subdivisión
    });

    it('subdivisión 1/16: programa 3 subdivisiones intermedias', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 400, '1/16', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);

      vi.advanceTimersByTime(100);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
    });

    it('subdivisión 1/3: programa 2 clics de tresillo', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 300, '1/3', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('stop cancela los clics programados en cola', () => {
      const metronome = new MetronomeAudio({ createContext: () => mockAudioContext });

      metronome.scheduleBeat(0, 500, '1/8', 0.8);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);

      metronome.stop();
      vi.advanceTimersByTime(500);

      // No debe sonar la subdivisión tras stop
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    });
  });
});
