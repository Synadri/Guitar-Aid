import { describe, expect, it } from 'vitest';
import { buildDeckCardIds } from '../learning/cards/builder';
import { analyzeSongFragment } from './analyzer';
import {
  fragmentToDeckSources,
  fragmentToDrillConfig,
  fragmentToSandboxContext,
  songChordToSandboxContext,
  songKeyToSandboxContext,
  songScaleToSandboxContext,
} from './bridges';
import {
  PRESET_MODULATION,
  PRESET_POP_DIATONIC,
  loadPresetSongModel,
} from './presets';

describe('src/song/bridges — puentes con Sandbox (`MenuContext`)', () => {
  it('convierte acordes, escalas y tonalidades al modelo puro MenuContext', () => {
    const chordCtx = songChordToSandboxContext({ root: 0, quality: 'maj', name: 'C' });
    expect(chordCtx).toEqual({ kind: 'chord', root: 0, quality: 'maj' });

    const scaleCtx = songScaleToSandboxContext({ tonic: 9, type: 'minor', name: 'A Menor' });
    expect(scaleCtx).toEqual({ kind: 'scale', root: 9, type: 'minor' });

    const majorKeyCtx = songKeyToSandboxContext({ tonic: 0, mode: 'major', name: 'C mayor' });
    expect(majorKeyCtx).toEqual({ kind: 'scale', root: 0, type: 'major' });

    const minorKeyCtx = songKeyToSandboxContext({ tonic: 9, mode: 'minor', name: 'A menor' });
    expect(minorKeyCtx).toEqual({ kind: 'scale', root: 9, type: 'minor' });
  });

  it('obtiene el contexto predeterminado de Sandbox para un fragmento analizado', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);
    const ctx = fragmentToSandboxContext(fragment);
    expect(ctx).toBeDefined();
    expect(ctx!.kind).toBe('scale');
    expect(ctx!.root).toBe(0); // Do
  });
});

describe('src/song/bridges — puente con Aprender / Tarjetas SRS (`fragmentToDeckSources`)', () => {
  it('criterio (n): genera fuentes de mazo (DeckSource[]) que se resuelven en cardIds válidos al 100 %', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);
    const sources = fragmentToDeckSources(fragment);

    expect(sources.length).toBeGreaterThanOrEqual(3);

    // Debe incluir fuentes de acordes, voicings y escalas
    const hasChords = sources.some((s) => s.type === 'chords');
    const hasVoicings = sources.some((s) => s.type === 'voicings');
    const hasScales = sources.some((s) => s.type === 'scales');

    expect(hasChords).toBe(true);
    expect(hasVoicings).toBe(true);
    expect(hasScales).toBe(true);

    // Verificamos que builder.ts (buildDeckCardIds) expanda todas las fuentes sin errores
    const cardIds = buildDeckCardIds(sources);
    expect(cardIds.length).toBeGreaterThan(0);

    // Cada ID de tarjeta debe tener formato subject:facet válido
    for (const id of cardIds) {
      expect(id).toContain(':');
      const parts = id.split(':');
      expect(parts[0]!.length).toBeGreaterThan(0);
      expect(parts[1]!.length).toBeGreaterThan(0);
    }
  });

  it('permite filtrar qué tipos de fuentes incluir mediante opciones', () => {
    const song = loadPresetSongModel(PRESET_MODULATION.id);
    const fragment = analyzeSongFragment(song, [1, 4]);
    const sources = fragmentToDeckSources(fragment, {
      includeChords: true,
      includeVoicings: false,
      includeScales: false,
      includeProgressions: false,
      includeDegrees: false,
    });

    expect(sources.length).toBe(1);
    expect(sources[0]!.type).toBe('chords');
  });
});

describe('src/song/bridges — puente con Aprender / Ejercicios (`fragmentToDrillConfig`)', () => {
  it('preconfigura la afinación, cuerdas activas, rango de trastes y calidades según el fragmento', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 2]);
    const drillConfig = fragmentToDrillConfig(fragment, song);

    expect(drillConfig.tuning).toBeDefined();
    expect(drillConfig.tuning?.id).toBe('standard');

    // Cuerdas activas deben estar presentes
    expect(drillConfig.activeStrings).toBeDefined();
    expect(drillConfig.activeStrings!.length).toBeGreaterThan(0);

    // Rango de trastes debe ser válido [min, max]
    expect(drillConfig.fretRange).toBeDefined();
    expect(drillConfig.fretRange![0]).toBeLessThanOrEqual(drillConfig.fretRange![1]);
    expect(drillConfig.fretRange![0]).toBeGreaterThanOrEqual(0);
    expect(drillConfig.fretRange![1]).toBeLessThanOrEqual(24);

    // Calidades de acordes deben incluir 'maj' o 'm'
    expect(drillConfig.qualities).toBeDefined();
    expect(drillConfig.qualities!.length).toBeGreaterThan(0);
    expect(drillConfig.qualities!.includes('maj') || drillConfig.qualities!.includes('m')).toBe(
      true,
    );

    expect(drillConfig.mode).toBe('all');
  });

  it('proporciona valores por defecto defensivos cuando el fragmento o canción no tiene notas', () => {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const emptyFragment = analyzeSongFragment(song, [1, 1]);
    const fallbackConfig = fragmentToDrillConfig(emptyFragment);

    expect(fallbackConfig.activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fallbackConfig.fretRange).toEqual([0, 12]);
    expect(fallbackConfig.mode).toBe('all');
  });
});
