import { describe, it, expect } from 'vitest';
import {
  PRESET_SONGS,
  PRESET_POP_DIATONIC,
  PRESET_BLUES_ROCK,
  PRESET_MODULATION,
  getPresetSong,
  loadPresetSongModel,
  loadAllPresetSongModels,
} from './presets';

describe('presets — 3 canciones de ejemplo integradas en AlphaTex (Hito C2 / criterio e)', () => {
  it('contiene exactamente las 3 canciones de ejemplo con sus metadatos y descripciones', () => {
    expect(PRESET_SONGS).toHaveLength(3);

    const ids = PRESET_SONGS.map((p) => p.id);
    expect(ids).toEqual([
      'pop-diatonico-c-am',
      'blues-rock-riff-e',
      'modulacion-menor-armonica-am',
    ]);

    for (const preset of PRESET_SONGS) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.artist).toBe('Guitar Aid');
      expect(preset.description.length).toBeGreaterThan(20);
      expect(preset.alphaTex.trim().length).toBeGreaterThan(50);
    }
  });

  it('getPresetSong encuentra cada preset por su id y devuelve undefined para desconocidos', () => {
    expect(getPresetSong('pop-diatonico-c-am')).toBe(PRESET_POP_DIATONIC);
    expect(getPresetSong('blues-rock-riff-e')).toBe(PRESET_BLUES_ROCK);
    expect(getPresetSong('modulacion-menor-armonica-am')).toBe(PRESET_MODULATION);
    expect(getPresetSong('desconocido')).toBeUndefined();
  });

  it('loadPresetSongModel carga y lanza error ante id inexistente', () => {
    const song = loadPresetSongModel('pop-diatonico-c-am');
    expect(song.id).toBe('pop-diatonico-c-am');
    expect(song.title).toBe('Pop Diatónico en C/Am');

    expect(() => loadPresetSongModel('inexistente')).toThrow(
      /Canción de ejemplo no encontrada/,
    );
  });

  it('loadAllPresetSongModels carga los 3 modelos sin errores', () => {
    const models = loadAllPresetSongModels();
    expect(models).toHaveLength(3);
    expect(models.map((m) => m.title)).toEqual([
      'Pop Diatónico en C/Am',
      'Blues & Rock Riff en E',
      'Modulación y Menor Armónica en Am/C',
    ]);
  });

  describe('Canción 1: Pop Diatónico en C/Am', () => {
    it('incluye 2 pistas (Guitarra 6 cuerdas y Bajo 4 cuerdas), 8 compases, Intro/Estribillo, acordes y letra', () => {
      const song = loadPresetSongModel('pop-diatonico-c-am');

      expect(song.title).toBe('Pop Diatónico en C/Am');
      expect(song.initialTempoBpm).toBe(100);
      expect(song.tracks).toHaveLength(2);

      // Pista 1: Guitarra Rítmica
      const guitar = song.tracks[0]!;
      expect(guitar.name).toBe('Guitarra Rítmica');
      expect(guitar.stringCount).toBe(6);
      expect(guitar.tuning.id).toBe('standard');
      expect(guitar.bars).toHaveLength(8);

      // Secciones
      expect(guitar.bars[0]!.sectionMarker).toBe('Intro');
      expect(guitar.bars[3]!.sectionMarker).toBe('Intro');
      expect(guitar.bars[4]!.sectionMarker).toBe('Estribillo');
      expect(guitar.bars[7]!.sectionMarker).toBe('Estribillo');

      // Cifrados diatónicos anotados (I - V - vi - IV en C)
      expect(guitar.bars[0]!.beats[0]!.chordAnnotation).toBe('C');
      expect(guitar.bars[0]!.beats[3]!.chordAnnotation).toBe('G');
      expect(guitar.bars[1]!.beats[0]!.chordAnnotation).toBe('Am');
      expect(guitar.bars[1]!.beats[3]!.chordAnnotation).toBe('F');

      // Presencia de letra asociada a los pulsos
      const beatsWithLyrics = guitar.bars
        .flatMap((b) => b.beats)
        .filter((b) => b.lyrics && b.lyrics.length > 0);
      expect(beatsWithLyrics.length).toBeGreaterThan(0);

      // Pista 2: Bajo Eléctrico
      const bass = song.tracks[1]!;
      expect(bass.name).toBe('Bajo Eléctrico');
      expect(bass.stringCount).toBe(4);
      expect(bass.tuning.strings).toEqual([28, 33, 38, 43]); // E1, A1, D2, G2
      expect(bass.bars).toHaveLength(8);
    });
  });

  describe('Canción 2: Blues & Rock Riff en E', () => {
    it('incluye 2 pistas, afinación en Mi, riffs con power chords, acordes dominantes, bends y ghost notes', () => {
      const song = loadPresetSongModel('blues-rock-riff-e');

      expect(song.title).toBe('Blues & Rock Riff en E');
      expect(song.initialTempoBpm).toBe(116);
      expect(song.tracks).toHaveLength(2);

      const lead = song.tracks[0]!;
      expect(lead.name).toBe('Guitarra Lead');
      expect(lead.bars).toHaveLength(8);

      // Secciones
      expect(lead.bars[0]!.sectionMarker).toBe('Intro Riff');
      expect(lead.bars[4]!.sectionMarker).toBe('Blues Solo & Chords');

      // Presencia de bend en el solo
      const allNotes = lead.bars.flatMap((b) => b.beats.flatMap((bt) => bt.notes));
      const bentNotes = allNotes.filter((n) => (n.bendSemitones ?? 0) > 0);
      expect(bentNotes.length).toBeGreaterThan(0);
      expect(bentNotes[0]!.bendSemitones).toBe(2); // Full bend (1 tono)

      // Presencia de ghost notes
      const ghostNotes = allNotes.filter((n) => n.isGhost);
      expect(ghostNotes.length).toBeGreaterThan(0);

      // Acordes dominantes anotados en Solo (E7, A7, B7)
      const rhythm = song.tracks[1]!;
      expect(rhythm.name).toBe('Guitarra Rítmica');
      const rhythmChords = rhythm.bars
        .flatMap((b) => b.beats)
        .map((bt) => bt.chordAnnotation)
        .filter(Boolean);
      expect(rhythmChords).toContain('E5');
      expect(rhythmChords).toContain('A5');
      expect(rhythmChords).toContain('B5');
    });
  });

  describe('Canción 3: Modulación y Menor Armónica en Am/C', () => {
    it('incluye sección en La menor con dominante E7 (G♯ de menor armónica) y modulación a Do mayor', () => {
      const song = loadPresetSongModel('modulacion-menor-armonica-am');

      expect(song.title).toBe('Modulación y Menor Armónica en Am/C');
      expect(song.initialTempoBpm).toBe(92);
      expect(song.tracks).toHaveLength(1);

      const track = song.tracks[0]!;
      expect(track.bars).toHaveLength(8);

      // Sección A (La menor)
      expect(track.bars[0]!.sectionMarker).toBe('Parte A (La menor)');
      expect(track.bars[0]!.beats[0]!.chordAnnotation).toBe('Am');
      expect(track.bars[0]!.beats[3]!.chordAnnotation).toBe('Dm');
      expect(track.bars[1]!.beats[0]!.chordAnnotation).toBe('E7');

      // En el compás 2 (c.2 index 1) suena el acorde E7 que contiene G♯ (pc = 8),
      // nota característica de la escala menor armónica de La (criterios d y f)
      const e7BarNotes = track.bars[1]!.beats.flatMap((b) => b.notes);
      const hasGSharp = e7BarNotes.some((n) => n.pc === 8);
      expect(hasGSharp).toBe(true);

      // Sección B (Do mayor)
      expect(track.bars[4]!.sectionMarker).toBe('Parte B (Do mayor)');
      expect(track.bars[4]!.beats[0]!.chordAnnotation).toBe('C');
      expect(track.bars[4]!.beats[3]!.chordAnnotation).toBe('F');
      expect(track.bars[5]!.beats[0]!.chordAnnotation).toBe('Dm');
      expect(track.bars[5]!.beats[3]!.chordAnnotation).toBe('G7');
    });
  });
});
