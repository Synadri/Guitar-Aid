/**
 * Motor de síntesis y programación del metrónomo por Web Audio API.
 * Soporta subdivisiones rítmicas precisas:
 *  - '1': 1 clic por compás (en el primer tiempo / downbeat).
 *  - '1/3': tresillos (3 clics por tiempo).
 *  - '1/4': negras (1 clic por tiempo, estándar).
 *  - '1/8': corcheas (2 clics por tiempo: tiempo a tierra y contratiempo).
 *  - '1/16': semicorcheas (4 clics por tiempo).
 *
 * Regla de capas: Capa audio (sin dependencias de learning, state ni ui).
 */

import type { MetronomeSubdivision } from './alphaSynthController';

export interface MetronomeAudioOptions {
  createContext?: () => AudioContext | null;
}

export class MetronomeAudio {
  private ctx: AudioContext | null = null;
  private timeouts: Array<ReturnType<typeof setTimeout>> = [];
  private createContextFn: () => AudioContext | null;

  constructor(options: MetronomeAudioOptions = {}) {
    this.createContextFn =
      options.createContext ??
      (() => {
        if (typeof window === 'undefined') return null;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        try {
          return new AudioCtx();
        } catch {
          return null;
        }
      });
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = this.createContextFn();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Emite un clic sintético percusivo tipo bloque de madera / metrónomo analógico.
   */
  playClick(isAccent: boolean, isSubdivision: boolean, volume: number): void {
    if (volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Frecuencias:
      // Acento (primer pulso del compás): 1600 Hz -> 800 Hz
      // Pulso normal (tiempos 2, 3, 4): 1000 Hz -> 500 Hz
      // Subdivisión (contratiempos / tresillos): 750 Hz -> 375 Hz
      const startFreq = isAccent ? 1600 : isSubdivision ? 750 : 1000;
      const duration = isSubdivision ? 0.022 : isAccent ? 0.038 : 0.03;

      // Nivel de ganancia pico adaptativo
      const level = Math.max(0, Math.min(1, volume));
      const peak = level * (isAccent ? 0.35 : isSubdivision ? 0.16 : 0.25);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, now + duration);

      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignorar errores en entornos sin soporte de audio
    }
  }

  /**
   * Planifica los clics correspondientes al pulso actual según la subdivisión activa.
   *
   * @param numerator Índice del pulso dentro del compás (0 = downbeat / tiempo 1).
   * @param beatDurationMs Duración del tiempo actual en milisegundos.
   * @param subdivision Subdivisión activa ('1' | '1/3' | '1/4' | '1/8' | '1/16').
   * @param volume Nivel de volumen (0..1).
   */
  scheduleBeat(
    numerator: number,
    beatDurationMs: number,
    subdivision: MetronomeSubdivision,
    volume: number,
  ): void {
    if (volume <= 0) return;
    const isFirstBeatOfBar = numerator === 0;

    switch (subdivision) {
      case '1':
        // Clic solo en el primer pulso del compás
        if (isFirstBeatOfBar) {
          this.playClick(true, false, volume);
        }
        break;

      case '1/4':
        // Clic en cada tiempo (acento en el primer tiempo)
        this.playClick(isFirstBeatOfBar, false, volume);
        break;

      case '1/8': {
        // Clic en el tiempo y contratiempo a la mitad
        this.playClick(isFirstBeatOfBar, false, volume);
        const sub1 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, beatDurationMs * 0.5));
        this.timeouts.push(sub1);
        break;
      }

      case '1/16': {
        // Clic en el tiempo + 3 subdivisiones (1/4, 2/4, 3/4)
        this.playClick(isFirstBeatOfBar, false, volume);
        const s1 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, beatDurationMs * 0.25));
        const s2 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, beatDurationMs * 0.5));
        const s3 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, beatDurationMs * 0.75));
        this.timeouts.push(s1, s2, s3);
        break;
      }

      case '1/3': {
        // Clic en el tiempo + 2 tresillos (1/3 y 2/3)
        this.playClick(isFirstBeatOfBar, false, volume);
        const t1 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, beatDurationMs / 3));
        const t2 = setTimeout(() => {
          this.playClick(false, true, volume);
        }, Math.max(10, (beatDurationMs * 2) / 3));
        this.timeouts.push(t1, t2);
        break;
      }
    }
  }

  /** Detiene y cancela cualquier clic pendiente. */
  stop(): void {
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts = [];
  }
}

export const metronomeAudio: MetronomeAudio = new MetronomeAudio();
