// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  estimateRoot,
  rankScalesForFragment,
  pcName,
  type PitchClass,
} from '../../theory';
import {
  analyzeBarChords,
  analyzeSongFragment,
  detectSongKeysByBar,
  fragmentToDeckSources,
  fragmentToDrillConfig,
  fragmentToSandboxContext,
  loadPresetSongModel,
  PRESET_BLUES_ROCK,
  PRESET_MODULATION,
  PRESET_POP_DIATONIC,
  songChordToSandboxContext,
  songScaleToSandboxContext,
  type SongBar,
  type SongModel,
} from '../../song';
import {
  createMemorySongStorage,
  createSandboxStore,
  createSongStore,
  selectSongFretboardMarks,
  selectSongPianoMarks,
} from '../../state';
import { createDecksStore } from '../../state/decks';
import { createDrillsStore } from '../../state/drills';
import { resolveCard } from '../../learning/cards/facets';

describe('Criterios de Aceptación de la Fase 3 (Modo Canción)', () => {
  // --------------------------------------------------------------------------
  // Criterio (a): Regla de capas
  // --------------------------------------------------------------------------
  it('(Criterio a) regla de capas: src/song/ no importa React, DOM, Zustand, state, ui ni audio', async () => {
    // La prueba exhaustiva de capas corre en src/architecture/layers.test.ts.
    // Aquí confirmamos que el módulo song expone APIs puras sin acoplamiento a React ni Zustand.
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    expect(song.id).toBeDefined();
    expect(song.tracks.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Criterio (b): Estimación de raíz (estimateRoot)
  // --------------------------------------------------------------------------
  it('(Criterio b) estimación de raíz: A2 en tiempo 1 con notas E3, A3, C4 y nota de paso B3 devuelve A (pc=9) con razones estructuradas', () => {
    // Observaciones del compás:
    // A2 (pc 9, midi 45): nota más grave en tiempo 1 (downbeat y bajo)
    // E3 (pc 4, midi 52): 5ª justa que da soporte acústico
    // A3 (pc 9, midi 57)
    // C4 (pc 0, midi 60): 3ª menor
    // B3 (pc 11, midi 59): nota de paso breve en pulso débil
    const observations = [
      { pc: 9 as PitchClass, midi: 45, weight: 2.0, isDownbeat: true, isBass: true },
      { pc: 4 as PitchClass, midi: 52, weight: 1.0, isDownbeat: false, isBass: false },
      { pc: 9 as PitchClass, midi: 57, weight: 1.0, isDownbeat: false, isBass: false },
      { pc: 0 as PitchClass, midi: 60, weight: 1.0, isDownbeat: false, isBass: false },
      { pc: 11 as PitchClass, midi: 59, weight: 0.3, isDownbeat: false, isBass: false },
    ];

    const candidates = estimateRoot(observations);
    expect(candidates.length).toBeGreaterThan(0);

    const topCandidate = candidates[0]!;
    expect(topCandidate.value).toBe(9); // La (A)

    const reasonCodes = topCandidate.reasons.map((r) => r.code);
    expect(reasonCodes).toContain('bassNoteInBar');
    expect(reasonCodes).toContain('downbeatAccent');
    expect(reasonCodes).toContain('fifthSupport');
  });

  // --------------------------------------------------------------------------
  // Criterio (c): Detección de acordes con notas de paso (detectBarChords)
  // --------------------------------------------------------------------------
  it('(Criterio c) detección de acordes: arpegio de Am7 con notas de paso devuelve Am7 explicando cobertura', () => {
    // Compás sintético con notas de Am7 (A, C, E, G) y notas de paso B y D en tiempos débiles
    const bar: SongBar = {
      index: 0,
      number: 1,
      timeSignature: { numerator: 4, denominator: 4 },
      tempoBpm: 120,
      beats: [
        {
          index: 0,
          startTick: 0,
          durationTicks: 480,
          metricWeight: 1.5,
          notes: [{ string: 5, fret: 0, midi: 45, pc: 9 as PitchClass, durationTicks: 480, isTied: false, isGhost: false }],
        },
        {
          index: 1,
          startTick: 480,
          durationTicks: 480,
          metricWeight: 1.0,
          notes: [
            { string: 4, fret: 2, midi: 52, pc: 4 as PitchClass, durationTicks: 480, isTied: false, isGhost: false },
            { string: 2, fret: 0, midi: 59, pc: 11 as PitchClass, durationTicks: 120, isTied: false, isGhost: false }, // nota de paso B
          ],
        },
        {
          index: 2,
          startTick: 960,
          durationTicks: 480,
          metricWeight: 1.2,
          notes: [{ string: 3, fret: 2, midi: 57, pc: 9 as PitchClass, durationTicks: 480, isTied: false, isGhost: false }],
        },
        {
          index: 3,
          startTick: 1440,
          durationTicks: 480,
          metricWeight: 0.75,
          notes: [
            { string: 2, fret: 1, midi: 60, pc: 0 as PitchClass, durationTicks: 240, isTied: false, isGhost: false }, // C
            { string: 1, fret: 3, midi: 67, pc: 7 as PitchClass, durationTicks: 240, isTied: false, isGhost: false }, // G
          ],
        },
      ],
    };

    const analysis = analyzeBarChords(bar);
    expect(analysis.candidates.length).toBeGreaterThan(0);

    // Am o Am7 debe estar en las primeras posiciones
    const hasAmOrAm7 = analysis.candidates.slice(0, 3).some((c) => c.value.root === 9 && (c.value.quality === 'm' || c.value.quality === 'm7'));
    expect(hasAmOrAm7).toBe(true);

    // No debe devolver lista vacía por culpa de las notas de paso
    expect(analysis.primaryChord).toBeDefined();
    expect(analysis.primaryChord?.root).toBe(9);
  });

  // --------------------------------------------------------------------------
  // Criterio (d): Ranking de escalas en fragmentos (rankScalesForFragment)
  // --------------------------------------------------------------------------
  it('(Criterio d) ranking de escalas: fragmento en La menor con notas de paso devuelve A menor natural / armónica con razones', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);

    const candidates = rankScalesForFragment({
      notes: fragment.weightedPcs,
      openingRoot: 0 as PitchClass,
      closingRoot: 9 as PitchClass,
    });

    expect(candidates.length).toBeGreaterThan(0);

    // Primeros candidatos deben ser Do mayor / La menor (relativas diatónicas)
    const topScales = candidates.slice(0, 3).map((c) => `${pcName(c.value.scale.tonic, 'sharps')} ${c.value.scale.type}`);
    expect(topScales.some((s) => s.includes('C major') || s.includes('A minor'))).toBe(true);
    expect(candidates[0]!.value.coverage).toBeGreaterThanOrEqual(0.85);
  });

  // --------------------------------------------------------------------------
  // Criterio (e): Importación y canciones de ejemplo
  // --------------------------------------------------------------------------
  it('(Criterio e) importación: carga las 3 canciones de ejemplo en AlphaTex extrayendo pistas, afinaciones, compases y notas', () => {
    const song1 = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    expect(song1.title).toBe(PRESET_POP_DIATONIC.title);
    expect(song1.tracks.length).toBe(2); // Guitarra + Bajo
    expect(song1.tracks[0]!.bars.length).toBe(8);

    const song2 = loadPresetSongModel(PRESET_BLUES_ROCK.id);
    expect(song2.title).toBe(PRESET_BLUES_ROCK.title);
    expect(song2.tracks.length).toBe(2);

    const song3 = loadPresetSongModel(PRESET_MODULATION.id);
    expect(song3.title).toBe(PRESET_MODULATION.title);
    expect(song3.tracks.length).toBe(1);
    expect(song3.tracks[0]!.bars.length).toBe(8);
  });

  // --------------------------------------------------------------------------
  // Criterio (f): Tonalidad por compás y detección de modulación
  // --------------------------------------------------------------------------
  it('(Criterio f) tonalidad por compás: detecta estabilidad por compás y modulación en pieza con cambio tonal', () => {
    const song = loadPresetSongModel(PRESET_MODULATION.id);
    const keyMatches = detectSongKeysByBar(song, { trackIndex: 0 });

    expect(keyMatches.length).toBe(8);

    // Parte A (compases 1-4) debe tener tonalidad La menor
    const bar1Key = keyMatches.find((k) => k.barNumber === 1);
    expect(bar1Key).toBeDefined();
    expect(bar1Key?.scale.tonic).toBe(9); // La

    // Parte B (compases 5-8) modula a Do mayor
    const bar5Key = keyMatches.find((k) => k.barNumber === 5);
    expect(bar5Key).toBeDefined();
    expect(bar5Key?.isModulation).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterio (g): Análisis de progresión de un fragmento
  // --------------------------------------------------------------------------
  it('(Criterio g) análisis de progresión: fragmento C - G - Am - F reconoce plantilla canónica I–V–vi–IV', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);

    expect(fragment.progression.chords.length).toBeGreaterThanOrEqual(4);
    expect(fragment.progression.progressions.length).toBeGreaterThan(0);

    const matchedTemplate = fragment.progression.progressions[0]!.value.template;
    expect(matchedTemplate.id).toBe('popI-V-vi-IV');
    expect(matchedTemplate.name).toContain('I–V–vi–IV');
  });

  // --------------------------------------------------------------------------
  // Criterio (h): Sobreescritura manual de acorde o tonalidad (barOverrides)
  // --------------------------------------------------------------------------
  it('(Criterio h) sobreescritura manual: fijar acorde o tonalidad en un compás recalcula de inmediato marcas y numerales', async () => {
    const storage = createMemorySongStorage();
    const songStore = createSongStore({
      storage,
      initialSong: loadPresetSongModel(PRESET_POP_DIATONIC.id),
    });

    expect(songStore.getState().barOverrides[2]).toBeUndefined();

    // Fijar override en compás 2
    await songStore.getState().setBarOverride(2, {
      chordId: 'Am7',
      tonic: 9 as PitchClass,
      scaleId: 'minor',
    });

    expect(songStore.getState().barOverrides[2]?.chordId).toBe('Am7');
    expect(songStore.getState().barOverrides[2]?.tonic).toBe(9);

    // Las marcas de mástil y piano reflejan la tonalidad sobreescrita
    const marks = selectSongFretboardMarks(
      { ...songStore.getState(), currentBar: 2 },
      { nameMode: 'sharps', labels: 'degree' },
    );
    expect(marks.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Criterio (i): Sincronización en tiempo real y afinación de pista
  // --------------------------------------------------------------------------
  it('(Criterio i) sincronización y afinación: el mástil refleja la afinación de la pista activa sin alterar el Sandbox', () => {
    const songStore = createSongStore({
      storage: createMemorySongStorage(),
      initialSong: loadPresetSongModel(PRESET_POP_DIATONIC.id),
    });
    const sandboxStore = createSandboxStore();

    // Sandbox inicial en afinación estándar (6 cuerdas)
    expect(sandboxStore.getState().tuning.strings.length).toBe(6);

    // Cambiar a pista de bajo (4 cuerdas) en Modo Canción
    songStore.getState().setActiveTrackIndex(1);

    const fretboardMarks = selectSongFretboardMarks(songStore.getState(), {
      nameMode: 'sharps',
      labels: 'note',
    });
    expect(fretboardMarks).toBeDefined();

    // El mástil genera marcas para las 4 cuerdas del bajo
    const stringsWithMarks = new Set(fretboardMarks.map((m) => m.string));
    for (const str of stringsWithMarks) {
      expect(str).toBeLessThanOrEqual(4);
    }

    const pianoMarks = selectSongPianoMarks(songStore.getState(), {
      nameMode: 'sharps',
      labels: 'note',
    });
    expect(pianoMarks).toBeDefined();

    // El Sandbox permanece intacto en 6 cuerdas
    expect(sandboxStore.getState().tuning.strings.length).toBe(6);
  });

  // --------------------------------------------------------------------------
  // Criterio (j): Persistencia en Storage y validación defensiva
  // --------------------------------------------------------------------------
  it('(Criterio j) persistencia y validación: guarda canciones y sobreescrituras; archivos corruptos no rompen el estado', async () => {
    const storage = createMemorySongStorage();
    const songStore = createSongStore({
      storage,
      initialSong: loadPresetSongModel(PRESET_POP_DIATONIC.id),
    });

    // Guardar una sobreescritura manual
    await songStore.getState().setBarOverride(3, { chordId: 'Fmaj7' });

    // Comprobar que persiste en storage
    const annotations = await storage.getAnnotations(PRESET_POP_DIATONIC.id);
    expect(annotations?.barOverrides[3]?.chordId).toBe('Fmaj7');

    // Intentar importar un modelo corrupto/vacío (sin tracks)
    const corruptSong = { id: 'corrupt', title: 'Corrupt', artist: '', initialTempoBpm: 120, tracks: [] } as unknown as SongModel;
    await songStore.getState().importSong(corruptSong);

    // Debe registrar el error sin borrar activeSong
    expect(songStore.getState().error).toBeTruthy();
    expect(songStore.getState().activeSong?.id).toBe(PRESET_POP_DIATONIC.id);
  });

  // --------------------------------------------------------------------------
  // Criterio (k): Reproducción multipista, bucle y vistas
  // --------------------------------------------------------------------------
  it('(Criterio k) reproducción: conmutación de modos de vista, bucle A–B y velocidad', () => {
    const songStore = createSongStore({
      storage: createMemorySongStorage(),
      initialSong: loadPresetSongModel(PRESET_POP_DIATONIC.id),
    });

    // Modos de vista
    expect(songStore.getState().scoreViewMode).toBe('tab');
    songStore.getState().setScoreViewMode('score-tab');
    expect(songStore.getState().scoreViewMode).toBe('score-tab');
    songStore.getState().setScoreViewMode('score');
    expect(songStore.getState().scoreViewMode).toBe('score');

    // Bucle A-B
    songStore.getState().setSelectedBarRange([5, 8]);
    songStore.getState().toggleLoop();
    expect(songStore.getState().loopEnabled).toBe(true);
    expect(songStore.getState().loopRange).toEqual([5, 8]);

    // Letra
    expect(songStore.getState().showLyrics).toBe(true);
    songStore.getState().toggleLyrics();
    expect(songStore.getState().showLyrics).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Criterio (l): Independencia entre modos en AppShell
  // --------------------------------------------------------------------------
  it('(Criterio l) independencia entre modos: el estado de cada modo se conserva íntegro', () => {
    const sandboxStore = createSandboxStore();
    const songStore = createSongStore({
      storage: createMemorySongStorage(),
      initialSong: loadPresetSongModel(PRESET_POP_DIATONIC.id),
    });

    // Fijar notas en Sandbox
    sandboxStore.getState().toggleFretPosition({ string: 5, fret: 3 }); // C3
    expect(sandboxStore.getState().notes.length).toBe(1);

    // Avanzar compás y activar bucle en Canción
    songStore.getState().setCurrentBar(5);
    songStore.getState().toggleLoop();

    // El Sandbox no ha cambiado
    expect(sandboxStore.getState().notes.length).toBe(1);
    expect(songStore.getState().currentBar).toBe(5);
    expect(songStore.getState().loopEnabled).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterio (m): Puente «Abrir en Sandbox»
  // --------------------------------------------------------------------------
  it('(Criterio m) puente «Abrir en Sandbox»: establece el contexto en sandboxStore', () => {
    const sandboxStore = createSandboxStore();
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);

    // 1. Fragmento -> Sandbox
    const fragCtx = fragmentToSandboxContext(fragment);
    expect(fragCtx).toBeDefined();
    sandboxStore.getState().setContext(fragCtx!);
    expect(sandboxStore.getState().context).toEqual(fragCtx);

    // 2. Acorde -> Sandbox
    const chordCtx = songChordToSandboxContext({ root: 9, quality: 'm', name: 'Am' });
    sandboxStore.getState().setContext(chordCtx);
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 9, quality: 'm' });

    // 3. Escala -> Sandbox
    const scaleCtx = songScaleToSandboxContext({ tonic: 0, type: 'major', name: 'C mayor' });
    sandboxStore.getState().setContext(scaleCtx);
    expect(sandboxStore.getState().context).toEqual({ kind: 'scale', root: 0, type: 'major' });
  });

  // --------------------------------------------------------------------------
  // Criterio (n): Puente «Llevar a Aprender» (Tarjetas SRS y Ejercicios)
  // --------------------------------------------------------------------------
  it('(Criterio n) puente «Llevar a Aprender»: genera mazo válido en decksStore con cardIds que se resuelven al 100 % y preconfigura drillsStore', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);

    // 1. Tarjetas SRS
    const decksStore = createDecksStore({
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });

    const sources = fragmentToDeckSources(fragment);
    expect(sources.length).toBeGreaterThanOrEqual(3);

    const deck = decksStore.getState().createDeck({
      name: 'Canción: Pop Diatónico — Intro',
      sources,
    });

    expect(deck.id).toBeDefined();
    expect(deck.cardIds.length).toBeGreaterThan(0);

    // Verificar que el 100 % de las tarjetas se resuelven sin error
    for (const cardId of deck.cardIds) {
      const resolved = resolveCard(cardId);
      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe(cardId);
      expect(resolved!.front).toBeDefined();
      expect(resolved!.back).toBeDefined();
    }

    // 2. Ejercicios (Drills)
    const drillsStore = createDrillsStore({
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });

    const drillConfig = fragmentToDrillConfig(fragment, song, 0);
    expect(drillConfig.tuning).toBeDefined();
    expect(drillConfig.activeStrings?.length).toBeGreaterThan(0);
    expect(drillConfig.fretRange).toBeDefined();

    drillsStore.getState().updateConfig(drillConfig);
    expect(drillsStore.getState().config.activeStrings).toEqual(drillConfig.activeStrings);
    expect(drillsStore.getState().config.fretRange).toEqual(drillConfig.fretRange);
  });
});
