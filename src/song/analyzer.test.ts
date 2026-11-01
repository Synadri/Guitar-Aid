import { describe, expect, it } from 'vitest';
import {
  PRESET_BLUES_ROCK,
  PRESET_MODULATION,
  PRESET_POP_DIATONIC,
  loadPresetSongModel,
} from './presets';
import {
  analyzeBarChords,
  analyzeSongFragment,
  computeBarWeightedPcs,
  computeNoteWeight,
  computeRangeWeightedPcs,
  detectBarChords,
  detectSongKeysByBar,
  extractRootObservations,
} from './analyzer';
import type { SongBar, SongBeat, SongNote } from './types';
import type { PitchClass } from '../theory';

describe('src/song/analyzer — ponderación métrica y rítmica (§3.2)', () => {
  it('aplica los factores de duración, acento métrico, registro de bajo y articulación', () => {
    const downbeatBeat: SongBeat = {
      index: 0,
      startTick: 0,
      durationTicks: 960,
      metricWeight: 1.5,
      notes: [],
    };

    const regularNote: SongNote = {
      string: 6,
      fret: 0,
      midi: 40,
      pc: 4,
      durationTicks: 960, // 1 negra
      isTied: false,
      isGhost: false,
    };

    // Bajo en downbeat (startTick === 0): 1.0 (duración) * 1.5 (metric) * 1.5 (bass downbeat) * 1.0 = 2.25
    const bassDownbeatWeight = computeNoteWeight(regularNote, downbeatBeat, 40);
    expect(bassDownbeatWeight).toBeCloseTo(2.25, 4);

    // Nota no grave en downbeat: 1.0 * 1.5 * 1.0 * 1.0 = 1.5
    const trebleDownbeatWeight = computeNoteWeight(regularNote, downbeatBeat, 30);
    expect(trebleDownbeatWeight).toBeCloseTo(1.5, 4);

    const offbeatBeat: SongBeat = {
      index: 1,
      startTick: 480,
      durationTicks: 480,
      metricWeight: 0.75,
      notes: [],
    };

    // Bajo en offbeat: 0.5 (duración corchea) * 0.75 (metric) * 1.35 (bass) * 1.0 = 0.50625
    const bassOffbeatWeight = computeNoteWeight(
      { ...regularNote, durationTicks: 480 },
      offbeatBeat,
      40,
    );
    expect(bassOffbeatWeight).toBeCloseTo(0.50625, 4);

    // Nota fantasma (ghost note): multiplicador de articulación 0.35
    const ghostWeight = computeNoteWeight(
      { ...regularNote, isGhost: true },
      downbeatBeat,
      30,
    );
    expect(ghostWeight).toBeCloseTo(1.5 * 0.35, 4);

    // Nota ultra-breve (grace note < 120 ticks): articulación 0.35
    const graceWeight = computeNoteWeight(
      { ...regularNote, durationTicks: 60 },
      downbeatBeat,
      30,
    );
    expect(graceWeight).toBeCloseTo((60 / 960) * 1.5 * 1.0 * 0.35, 4);
  });

  it('extrae observaciones de raíz y acumula pesos por compás y rango', () => {
    const bar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          notes: [
            { string: 6, fret: 5, midi: 45, pc: 9, durationTicks: 960, isTied: false, isGhost: false }, // A2 (bajo)
            { string: 5, fret: 7, midi: 52, pc: 4, durationTicks: 960, isTied: false, isGhost: false }, // E3
            { string: 4, fret: 7, midi: 57, pc: 9, durationTicks: 960, isTied: false, isGhost: false }, // A3
            { string: 3, fret: 5, midi: 60, pc: 0, durationTicks: 960, isTied: false, isGhost: false }, // C4
          ],
        },
      ],
    };

    const obs = extractRootObservations(bar);
    expect(obs.length).toBe(4);
    const bassObs = obs.find((o) => o.pc === 9 && o.isBass);
    expect(bassObs).toBeDefined();
    expect(bassObs!.isDownbeat).toBe(true);

    const weightedPcs = computeBarWeightedPcs(bar);
    expect(weightedPcs.length).toBe(3); // A (9), E (4), C (0)

    const rangePcs = computeRangeWeightedPcs([bar, bar]);
    const aPc = rangePcs.find((wp) => wp.pc === 9);
    const singleAPc = weightedPcs.find((wp) => wp.pc === 9);
    expect(aPc!.weight).toBeCloseTo(singleAPc!.weight * 2, 4);
  });
});

describe('src/song/analyzer — detección de acordes por compás (`detectBarChords`)', () => {
  it('criterio (c): en un arpegio de Am7 con notas de paso no devuelve [] y Am7 figura entre los primeros candidatos', () => {
    // Compás de 4/4 con arpegio de Am7 (A2, C3, E3, G3) y una corchea de paso B3 en subdivisión débil
    const bar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          notes: [
            { string: 5, fret: 0, midi: 45, pc: 9, durationTicks: 960, isTied: false, isGhost: false }, // A2 (bajo downbeat)
            { string: 4, fret: 2, midi: 52, pc: 4, durationTicks: 960, isTied: false, isGhost: false }, // E3
          ],
        },
        {
          index: 1,
          startTick: 960,
          durationTicks: 960,
          metricWeight: 1.0,
          notes: [
            { string: 3, fret: 2, midi: 57, pc: 9, durationTicks: 960, isTied: false, isGhost: false }, // A3
            { string: 2, fret: 1, midi: 60, pc: 0, durationTicks: 960, isTied: false, isGhost: false }, // C4
          ],
        },
        {
          index: 2,
          startTick: 1920,
          durationTicks: 960,
          metricWeight: 1.2,
          notes: [
            { string: 1, fret: 3, midi: 67, pc: 7, durationTicks: 960, isTied: false, isGhost: false }, // G4 (7ª menor)
          ],
        },
        {
          index: 3,
          startTick: 2880,
          durationTicks: 480,
          metricWeight: 1.0,
          notes: [
            { string: 4, fret: 2, midi: 52, pc: 4, durationTicks: 480, isTied: false, isGhost: false }, // E3
          ],
        },
        {
          index: 4,
          startTick: 3360,
          durationTicks: 480,
          metricWeight: 0.75, // corchea débil de paso
          notes: [
            { string: 2, fret: 0, midi: 59, pc: 11, durationTicks: 480, isTied: false, isGhost: false }, // B3 (nota de paso)
          ],
        },
      ],
    };

    const candidates = detectBarChords(bar);
    expect(candidates.length).toBeGreaterThan(0);

    // Am7 debe ser el candidato principal o estar entre los mejores
    const am7 = candidates.find((c) => c.value.root === 9 && c.value.quality === 'm7');
    expect(am7).toBeDefined();
    expect(candidates.indexOf(am7!)).toBeLessThanOrEqual(1);

    // Debe explicar la cobertura de notas del acorde
    const toneReason = am7!.reasons.find((r) => r.code === 'containsChordTones');
    expect(toneReason).toBeDefined();
    expect(Number(toneReason!.params?.pct)).toBeGreaterThanOrEqual(70);

    // Debe contener la razón de coincidencia de raíz con el bajo
    const rootReason = am7!.reasons.find((r) => r.code === 'rootMatches');
    expect(rootReason).toBeDefined();
  });

  it('un compás en silencio o con una sola nota aislada no inventa un acorde falso', () => {
    const silentBar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [],
    };
    expect(detectBarChords(silentBar)).toEqual([]);

    const singleNoteBar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          notes: [
            { string: 6, fret: 0, midi: 40, pc: 4, durationTicks: 960, isTied: false, isGhost: false }, // solo E2
          ],
        },
      ],
    };
    // Sin cifrado anotado, una sola nota aislada no es suficiente para inventar un acorde
    expect(detectBarChords(singleNoteBar)).toEqual([]);
  });

  it('reconoce díadas de quinta como power chord (5)', () => {
    const powerBar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          notes: [
            { string: 6, fret: 0, midi: 40, pc: 4, durationTicks: 960, isTied: false, isGhost: false }, // E2
            { string: 5, fret: 2, midi: 47, pc: 11, durationTicks: 960, isTied: false, isGhost: false }, // B2
          ],
        },
      ],
    };

    const candidates = detectBarChords(powerBar);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.value.root).toBe(4);
    expect(candidates[0]!.value.quality).toBe('5');
    expect(candidates[0]!.value.name).toContain('5');
  });

  it('da prioridad y razón annotatedInScore a acordes anotados en la partitura', () => {
    const annotatedBar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          chordAnnotation: 'C',
          notes: [
            { string: 5, fret: 3, midi: 48, pc: 0, durationTicks: 960, isTied: false, isGhost: false },
            { string: 4, fret: 2, midi: 52, pc: 4, durationTicks: 960, isTied: false, isGhost: false },
            { string: 3, fret: 0, midi: 55, pc: 7, durationTicks: 960, isTied: false, isGhost: false },
          ],
        },
      ],
    };

    const candidates = detectBarChords(annotatedBar);
    expect(candidates[0]!.value.root).toBe(0);
    expect(candidates[0]!.value.quality).toBe('maj');
    const annotatedReason = candidates[0]!.reasons.find((r) => r.code === 'annotatedInScore');
    expect(annotatedReason).toBeDefined();
  });

  it('detecta splitChords cuando un compás largo contiene dos acordes claramente diferenciados', () => {
    // Compás 1 de Pop Diatónico: primera mitad Do mayor, segunda mitad Sol mayor
    const bar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        // Mitad 1: Do mayor (C, E, G)
        {
          index: 0,
          startTick: 0,
          durationTicks: 960,
          metricWeight: 1.5,
          chordAnnotation: 'C',
          notes: [
            { string: 5, fret: 3, midi: 48, pc: 0, durationTicks: 960, isTied: false, isGhost: false },
            { string: 4, fret: 2, midi: 52, pc: 4, durationTicks: 960, isTied: false, isGhost: false },
            { string: 3, fret: 0, midi: 55, pc: 7, durationTicks: 960, isTied: false, isGhost: false },
          ],
        },
        // Mitad 2: Sol mayor (G, B, D)
        {
          index: 1,
          startTick: 1920,
          durationTicks: 960,
          metricWeight: 1.2,
          chordAnnotation: 'G',
          notes: [
            { string: 6, fret: 3, midi: 43, pc: 7, durationTicks: 960, isTied: false, isGhost: false },
            { string: 5, fret: 2, midi: 47, pc: 11, durationTicks: 960, isTied: false, isGhost: false },
            { string: 4, fret: 0, midi: 50, pc: 2, durationTicks: 960, isTied: false, isGhost: false },
          ],
        },
      ],
    };

    const analysis = analyzeBarChords(bar);
    expect(analysis.splitChords).toBeDefined();
    expect(analysis.splitChords!.firstHalf[0]!.value.root).toBe(0); // C
    expect(analysis.splitChords!.secondHalf[0]!.value.root).toBe(7); // G
  });
});

describe('src/song/analyzer — tonalidad por compás y modulación (`detectSongKeysByBar`)', () => {
  it('criterio (f): en la canción con modulación mantiene estabilidad dentro de cada sección y detecta el cambio de tonalidad', () => {
    const song = loadPresetSongModel(PRESET_MODULATION.id);
    const keysByBar = detectSongKeysByBar(song);
    expect(keysByBar.length).toBe(8);

    // Sección A (compases 1 a 4): La menor (con dominante E7 / escala menor armónica)
    for (let i = 0; i < 4; i++) {
      const barKey = keysByBar[i]!;
      expect(barKey.key.tonic).toBe(9); // A
      expect(barKey.key.mode).toBe('minor');
      // Dentro de la sección A no debe haber saltos erráticos ni falsas modulaciones
      if (i > 0) {
        expect(barKey.isModulation).toBe(false);
      }
    }

    // Sección B (compases 5 a 8): Modula a Do mayor (cadencia C–F–Dm–G7–C)
    const bar5Key = keysByBar[4]!;
    expect(bar5Key.key.tonic).toBe(0); // C
    expect(bar5Key.key.mode).toBe('major');
    expect(bar5Key.isModulation).toBe(true); // Modulación detectada al inicio de la Sección B

    // Compases 6 a 8 deben continuar estables en Do mayor
    for (let i = 5; i < 8; i++) {
      const barKey = keysByBar[i]!;
      expect(barKey.key.tonic).toBe(0);
      expect(barKey.key.mode).toBe('major');
      expect(barKey.isModulation).toBe(false);
    }
  });

  it('mantiene la tonalidad de Do mayor en Pop Diatónico a lo largo de las dos secciones', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const keysByBar = detectSongKeysByBar(song);
    expect(keysByBar.length).toBe(8);

    for (let i = 0; i < 8; i++) {
      const barKey = keysByBar[i]!;
      // Do mayor (o su relativo menor La) domina la obra
      expect(barKey.scale.tonic === 0 || barKey.scale.tonic === 9).toBe(true);
    }
  });
});

describe('src/song/analyzer — análisis de fragmento y overrides manuales (`analyzeSongFragment`)', () => {
  it('criterio (g): al seleccionar compases de la progresión devuelve grados romanos coherentes y reconoce la plantilla', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const songFragment = analyzeSongFragment(song, [1, 2]);

    expect(songFragment.barChords.length).toBe(2);
    expect(songFragment.primaryKey.tonic).toBe(0); // C
    expect(songFragment.primaryKey.mode).toBe('major');

    // Los 2 compases contienen 4 acordes (C, G, Am, F) que corresponden a I–V–vi–IV
    expect(songFragment.progression.chords.length).toBe(4);
    const romans = songFragment.progression.chords.map((c) => c.roman);
    expect(romans).toEqual(['I', 'V', 'vi', 'IV']);

    // Reconoce la plantilla canónica I–V–vi–IV
    const topProg = songFragment.progression.progressions[0];
    expect(topProg).toBeDefined();
    expect(topProg!.value.template.name).toContain('I–V–vi–IV');

    // Comprobamos la detección sobre los compases 5 a 8 (Estribillo: 4 compases, 8 acordes por división en mitades)
    const chorusFragment = analyzeSongFragment(song, [5, 8]);
    expect(chorusFragment.barChords.length).toBe(4);
    expect(chorusFragment.progression.chords.length).toBe(8);
  });

  it('criterio (h): respeta los overrides manuales de acorde y tonalidad recalculando los numerales romanos', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);

    // Sin override: compás 1 de Pop Diatónico
    const defaultAnalysis = analyzeSongFragment(song, [1, 2]);
    expect(defaultAnalysis.barChords[0]!.hasOverride).toBe(false);

    // Con override de acorde en compás 1 (forzamos Dm) y tonalidad (forzamos D dórico)
    const overriddenAnalysis = analyzeSongFragment(song, [1, 2], {
      barOverrides: {
        1: {
          chordId: 'Dm',
          tonic: 2,
          scaleId: 'dorian',
        },
      },
    });

    const bar1 = overriddenAnalysis.barChords[0]!;
    expect(bar1.hasOverride).toBe(true);
    expect(bar1.primaryChord!.root).toBe(2); // D
    expect(bar1.primaryChord!.quality).toBe('m'); // Dm

    // Tonalidad principal recalculada a D dórico
    expect(overriddenAnalysis.primaryScale.tonic).toBe(2);
    expect(overriddenAnalysis.primaryScale.type).toBe('dorian');

    // En D dórico, Dm debe ser el grado diatónico i
    const chord1Func = overriddenAnalysis.progression.chords[0]!;
    expect(chord1Func.roman).toBe('i');
    expect(chord1Func.kind).toBe('diatonic');
  });

  it('analiza correctamente el fragmento de blues con acordes dominantes E7, A7, B7', () => {
    const song = loadPresetSongModel(PRESET_BLUES_ROCK.id);
    const soloFragment = analyzeSongFragment(song, [6, 8]);
    expect(soloFragment.barChords.length).toBe(3);

    // Los acordes dominantes deben detectarse
    const chordRoots = soloFragment.barChords
      .map((b) => b.primaryChord?.root)
      .filter((r): r is PitchClass => r !== undefined);

    expect(chordRoots.includes(4) || chordRoots.includes(9) || chordRoots.includes(11)).toBe(true);
  });
});
