import { describe, expect, it } from 'vitest';
import type { PitchClass } from '../core/pitch';
import { type RootObservation, estimateRoot } from './estimateRoot';

/**
 * Observación ponderada según plan_fase3 §3.2:
 * peso = duración/960 × acento métrico × w_bajo × w_articulación.
 */
function obs(
  midi: number,
  durationTicks: number,
  metricWeight: number,
  opts: { isBass?: boolean; isDownbeat?: boolean; ghost?: boolean } = {},
): RootObservation {
  const isBass = opts.isBass ?? false;
  const isDownbeat = opts.isDownbeat ?? false;
  const bassW = isBass ? (isDownbeat ? 1.5 : 1.35) : 1;
  const artW = opts.ghost || durationTicks < 120 ? 0.35 : 1;
  return {
    pc: (midi % 12) as PitchClass,
    midi,
    weight: (durationTicks / 960) * metricWeight * bassW * artW,
    isBass,
    isDownbeat,
  };
}

const codes = (reasons: { code: string }[]) => reasons.map((r) => r.code);

describe('estimateRoot', () => {
  it('criterio (b): A2 en el bajo del tiempo 1 con E3, A3, C4 y B3 de paso → A primero', () => {
    // Compás 4/4: acorde Am (A2 E3 A3 C4) en el tiempo 1 (blanca), B3 corchea a contratiempo
    // (única nota de su pulso, por tanto también es la más grave de ese pulso) y C4 en el tiempo 3.
    const bar: RootObservation[] = [
      obs(45, 1920, 1.5, { isBass: true, isDownbeat: true }), // A2
      obs(52, 1920, 1.5, { isDownbeat: true }), // E3
      obs(57, 1920, 1.5, { isDownbeat: true }), // A3
      obs(60, 1920, 1.5, { isDownbeat: true }), // C4
      obs(59, 480, 0.75, { isBass: true }), // B3 de paso
      obs(60, 960, 1.2, { isBass: true }), // C4 en el tiempo 3
    ];
    const ranked = estimateRoot(bar);
    expect(ranked[0]!.value).toBe(9);
    expect(codes(ranked[0]!.reasons)).toEqual(
      expect.arrayContaining(['bassNoteInBar', 'downbeatAccent', 'fifthSupport']),
    );
    const fifth = ranked[0]!.reasons.find((r) => r.code === 'fifthSupport');
    expect(fifth?.params?.fifth).toBe(4);
    // La nota de paso queda al final y sin soporte de 5ª (F♯ no suena).
    const b = ranked.find((c) => c.value === 11)!;
    expect(ranked.indexOf(b)).toBe(ranked.length - 1);
    expect(codes(b.reasons)).not.toContain('fifthSupport');
  });

  it('la 5ª solo refuerza si tiene peso significativo (una nota de paso breve no basta)', () => {
    // C y E con el mismo peso; B (5ª de E) apenas es una semicorchea débil.
    const ranked = estimateRoot([
      obs(48, 960, 1.0),
      obs(52, 960, 1.0),
      obs(59, 240, 0.75),
    ]);
    const e = ranked.find((c) => c.value === 4)!;
    expect(codes(e.reasons)).not.toContain('fifthSupport');
  });

  it('el bajo pesa más que la duración: Am7/G con G en el bajo estima G', () => {
    const ranked = estimateRoot([
      obs(43, 3840, 1.5, { isBass: true, isDownbeat: true }), // G2 redonda en el bajo
      obs(57, 960, 1.5, { isDownbeat: true }), // A3
      obs(60, 960, 1.0), // C4
      obs(64, 960, 1.2), // E4
      obs(57, 960, 1.0), // A3
    ]);
    expect(ranked[0]!.value).toBe(7);
  });

  it('la soporte de 5ª desempata un power chord sin tercera (E5: E y B → E)', () => {
    const ranked = estimateRoot([obs(40, 960, 1.0), obs(47, 960, 1.0)]);
    expect(ranked[0]!.value).toBe(4);
    expect(codes(ranked[0]!.reasons)).toContain('fifthSupport');
  });

  it('marca longestDuration en la clase con más peso total', () => {
    const ranked = estimateRoot([obs(60, 3840, 1.0), obs(64, 480, 0.75)]);
    expect(ranked[0]!.value).toBe(0);
    expect(codes(ranked[0]!.reasons)).toContain('longestDuration');
    expect(codes(ranked[1]!.reasons)).not.toContain('longestDuration');
  });

  it('solo devuelve clases que suenan y [] si no hay notas con peso', () => {
    expect(estimateRoot([])).toEqual([]);
    expect(estimateRoot([{ pc: 0, midi: 60, weight: 0, isBass: true, isDownbeat: true }])).toEqual(
      [],
    );
    const ranked = estimateRoot([obs(60, 960, 1.0), obs(64, 960, 1.0), obs(67, 960, 1.0)]);
    expect(ranked.map((c) => c.value).sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('es determinista e independiente del orden de las observaciones', () => {
    const bar = [obs(45, 960, 1.5, { isBass: true, isDownbeat: true }), obs(52, 960, 1.0), obs(60, 960, 1.2)];
    const a = estimateRoot(bar).map((c) => c.value);
    const b = estimateRoot([...bar].reverse()).map((c) => c.value);
    expect(a).toEqual(b);
  });
});
