import { describe, it, expect } from 'vitest';
import {
  computeMetricWeight,
  importSongFromAlphaTex,
  importSongFromBytes,
  importSong,
  exportAlphaTexToGp7Bytes,
} from './importer';
import { STANDARD_TUNING } from '../theory';

describe('importer — computeMetricWeight (docs/Fase-3/plan_fase3.md §3.1 y §3.2)', () => {
  it('asigna 1.5 al primer pulso (downbeat, tick 0) en cualquier compás', () => {
    expect(computeMetricWeight(0, 4, 4)).toBe(1.5);
    expect(computeMetricWeight(0, 3, 4)).toBe(1.5);
    expect(computeMetricWeight(0, 6, 8)).toBe(1.5);
    expect(computeMetricWeight(0, 2, 4)).toBe(1.5);
  });

  it('en 4/4 asigna acento secundario 1.2 en tiempo 3, 1.0 en tiempos 2 y 4, y 0.75 en contratiempos', () => {
    const quarter = 960;
    expect(computeMetricWeight(0 * quarter, 4, 4)).toBe(1.5); // Tiempo 1
    expect(computeMetricWeight(1 * quarter, 4, 4)).toBe(1.0); // Tiempo 2
    expect(computeMetricWeight(2 * quarter, 4, 4)).toBe(1.2); // Tiempo 3 (fuerte secundario)
    expect(computeMetricWeight(3 * quarter, 4, 4)).toBe(1.0); // Tiempo 4
    expect(computeMetricWeight(480, 4, 4)).toBe(0.75); // Corchea a contratiempo
    expect(computeMetricWeight(240, 4, 4)).toBe(0.75); // Semicorchea
  });

  it('en 6/8 asigna acento secundario 1.2 en tiempo 4 de corchea (mitad de compás)', () => {
    const eighth = 480;
    expect(computeMetricWeight(0, 6, 8)).toBe(1.5); // Corchea 1
    expect(computeMetricWeight(1 * eighth, 6, 8)).toBe(1.0); // Corchea 2
    expect(computeMetricWeight(2 * eighth, 6, 8)).toBe(1.0); // Corchea 3
    expect(computeMetricWeight(3 * eighth, 6, 8)).toBe(1.2); // Corchea 4 (pulso 2 del compás compuesto)
    expect(computeMetricWeight(4 * eighth, 6, 8)).toBe(1.0); // Corchea 5
    expect(computeMetricWeight(5 * eighth, 6, 8)).toBe(1.0); // Corchea 6
    expect(computeMetricWeight(240, 6, 8)).toBe(0.75); // Subdivisión débil
  });

  it('en 3/4 asigna 1.0 a los tiempos 2 y 3 y 0.75 a contratiempos', () => {
    const quarter = 960;
    expect(computeMetricWeight(0, 3, 4)).toBe(1.5);
    expect(computeMetricWeight(quarter, 3, 4)).toBe(1.0);
    expect(computeMetricWeight(2 * quarter, 3, 4)).toBe(1.0);
    expect(computeMetricWeight(quarter + 480, 3, 4)).toBe(0.75);
  });
});

describe('importer — importSongFromAlphaTex (Hito C2)', () => {
  it('importa metadatos básicos, tempo inicial y pistas', () => {
    const tex = `
\\title "Canción de Prueba"
\\artist "Músico Ejemplo"
\\album "Disco Demo"
\\tempo 135
.
:4 0.1 1.2 0.3 2.4
`;
    const song = importSongFromAlphaTex(tex);

    expect(song.title).toBe('Canción de Prueba');
    expect(song.artist).toBe('Músico Ejemplo');
    expect(song.album).toBe('Disco Demo');
    expect(song.initialTempoBpm).toBe(135);
    expect(song.tracks).toHaveLength(1);

    const track = song.tracks[0]!;
    expect(track.stringCount).toBe(6);
    expect(track.tuning.id).toBe(STANDARD_TUNING.id);
    expect(track.capoFret).toBe(0);
    expect(track.isPercussion).toBe(false);
    expect(track.bars).toHaveLength(1);
  });

  it('invierte la numeración de cuerdas a la convención Guitar Aid (1 = aguda, 6 = grave)', () => {
    // En AlphaTex: 0.1 = cuerda 1 (E4 aguda), 0.6 = cuerda 6 (E2 grave)
    const tex = `
\\title "Strings"
.
:4 0.1 0.6
`;
    const song = importSongFromAlphaTex(tex);
    const beats = song.tracks[0]!.bars[0]!.beats;

    const noteAguda = beats[0]!.notes[0]!;
    expect(noteAguda.string).toBe(1);
    expect(noteAguda.fret).toBe(0);
    expect(noteAguda.midi).toBe(64); // E4
    expect(noteAguda.pc).toBe(4); // E

    const noteGrave = beats[1]!.notes[0]!;
    expect(noteGrave.string).toBe(6);
    expect(noteGrave.fret).toBe(0);
    expect(noteGrave.midi).toBe(40); // E2
    expect(noteGrave.pc).toBe(4); // E
  });

  it('resuelve afinaciones del catálogo (Drop D) e identifica afinaciones personalizadas', () => {
    const dropDTex = `
\\title "Drop D"
\\tuning (E4 B3 G3 D3 A2 D2)
.
0.6
`;
    const songDropD = importSongFromAlphaTex(dropDTex);
    expect(songDropD.tracks[0]!.tuning.id).toBe('dropD');
    expect(songDropD.tracks[0]!.tuning.strings[0]).toBe(38); // D2

    const customTex = `
\\title "Custom 7 String"
\\tuning (E4 B3 G3 D3 A2 E2 B1)
.
0.7
`;
    const songCustom = importSongFromAlphaTex(customTex);
    expect(songCustom.tracks[0]!.stringCount).toBe(7);
    expect(songCustom.tracks[0]!.tuning.id).toContain('custom-');
    expect(songCustom.tracks[0]!.tuning.strings[0]).toBe(35); // B1
  });

  it('resuelve cejilla (capo) y calcula la altura MIDI real sonando', () => {
    // Con capo 2, traste 0 en cuerda 1 (E4 = 64) suena F#4 (66)
    const tex = `
\\title "Capo"
\\capo 2
.
0.1
`;
    const song = importSongFromAlphaTex(tex);
    expect(song.tracks[0]!.capoFret).toBe(2);
    const note = song.tracks[0]!.bars[0]!.beats[0]!.notes[0]!;
    expect(note.fret).toBe(0);
    expect(note.midi).toBe(66); // F#4
    expect(note.pc).toBe(6); // F#
  });

  it('detecta notas ligadas (isTied) y notas fantasma (isGhost)', () => {
    const tex = `
\\title "Articulaciones"
.
0.1 | 0.1{t} 0.1{g}
`;
    const song = importSongFromAlphaTex(tex);
    const bar1Beats = song.tracks[0]!.bars[1]!.beats;

    const tiedNote = bar1Beats[0]!.notes[0]!;
    expect(tiedNote.isTied).toBe(true);
    expect(tiedNote.isGhost).toBe(false);

    const ghostNote = bar1Beats[1]!.notes[0]!;
    expect(ghostNote.isTied).toBe(false);
    expect(ghostNote.isGhost).toBe(true);
  });

  it('detecta bends y extrae los semitonos de destino (bendSemitones)', () => {
    // En AlphaTex {b bend (0 4)}: valor 4 cuartos de tono = 2 semitonos (full bend)
    // {b bend (0 2)}: valor 2 cuartos de tono = 1 semitono (half bend)
    const tex = `
\\title "Bends"
.
:4 2.3{b bend (0 4)} 2.3{b bend (0 2)} 2.3
`;
    const song = importSongFromAlphaTex(tex);
    const beats = song.tracks[0]!.bars[0]!.beats;

    expect(beats[0]!.notes[0]!.bendSemitones).toBe(2);
    expect(beats[1]!.notes[0]!.bendSemitones).toBe(1);
    expect(beats[2]!.notes[0]!.bendSemitones).toBeUndefined();
  });

  it('propaga marcadores de sección a lo largo de los compases de la misma', () => {
    const tex = `
\\title "Secciones"
.
\\section ("Intro")
0.1 | 0.1 |
\\section ("Estribillo")
0.1 | 0.1
`;
    const song = importSongFromAlphaTex(tex);
    const bars = song.tracks[0]!.bars;

    expect(bars[0]!.sectionMarker).toBe('Intro');
    expect(bars[1]!.sectionMarker).toBe('Intro');
    expect(bars[2]!.sectionMarker).toBe('Estribillo');
    expect(bars[3]!.sectionMarker).toBe('Estribillo');
  });

  it('extrae cifrados de acordes anotados y letras', () => {
    const tex = `
\\title "Chords and Lyrics"
.
\\lyrics "Hola mun - do"
(0.1 1.2 0.3 2.4 3.5) {ch "C"} (0.1 1.2 2.3 2.4 0.5) {ch "Am"}
`;
    const song = importSongFromAlphaTex(tex);
    const beats = song.tracks[0]!.bars[0]!.beats;

    expect(beats[0]!.chordAnnotation).toBe('C');
    expect(beats[0]!.lyrics).toBe('Hola');
    expect(beats[1]!.chordAnnotation).toBe('Am');
    expect(beats[1]!.lyrics).toBe('mun');
  });

  it('gestiona compases con silencios preservando la cuadrícula rítmica', () => {
    const tex = `
\\title "Rests"
.
:4 0.1 r 0.1 r
`;
    const song = importSongFromAlphaTex(tex);
    const beats = song.tracks[0]!.bars[0]!.beats;

    expect(beats).toHaveLength(4);
    expect(beats[0]!.notes).toHaveLength(1);
    expect(beats[1]!.notes).toHaveLength(0); // Silencio
    expect(beats[1]!.durationTicks).toBe(960);
    expect(beats[2]!.notes).toHaveLength(1);
    expect(beats[3]!.notes).toHaveLength(0); // Silencio
  });

  it('importa partituras multipista (Guitarra y Bajo)', () => {
    const tex = `
\\title "Multipista"
.
\\track "Guitarra"
\\tuning (E4 B3 G3 D3 A2 E2)
0.1 0.1
\\track "Bajo"
\\tuning (G2 D2 A1 E1)
0.4 0.4
`;
    const song = importSongFromAlphaTex(tex);
    expect(song.tracks).toHaveLength(2);

    expect(song.tracks[0]!.name).toBe('Guitarra');
    expect(song.tracks[0]!.stringCount).toBe(6);
    expect(song.tracks[0]!.tuning.id).toBe('standard');

    expect(song.tracks[1]!.name).toBe('Bajo');
    expect(song.tracks[1]!.stringCount).toBe(4);
    expect(song.tracks[1]!.tuning.strings).toEqual([28, 33, 38, 43]);
  });

  it('falla con mensaje descriptivo si el texto está vacío o es inválido', () => {
    expect(() => importSongFromAlphaTex('')).toThrow(
      'El contenido de la tablatura está vacío.',
    );
    expect(() => importSongFromAlphaTex('   \n  ')).toThrow(
      'El contenido de la tablatura está vacío.',
    );
    expect(() => importSongFromAlphaTex('\\\\comandoInvalidoErroneo')).toThrow(
      /No se pudo importar la canción en formato AlphaTex/,
    );
  });
});

describe('importer — importSongFromBytes y formatos binarios (Hito C2)', () => {
  it('importa archivos binarios de Guitar Pro 7 (.gp) exportados', () => {
    const tex = `
\\title "Binario GP7"
\\artist "Tester"
\\tempo 128
.
(0.1 1.2 0.3 2.4 3.5) {ch "C"} (3.2 0.3 0.4 2.5 3.6) {ch "G"}
`;
    const gpBytes = exportAlphaTexToGp7Bytes(tex);

    expect(gpBytes).toBeInstanceOf(Uint8Array);
    expect(gpBytes.byteLength).toBeGreaterThan(0);

    const song = importSongFromBytes(gpBytes, { fileName: 'cancion.gp' });
    expect(song.title).toBe('Binario GP7');
    expect(song.artist).toBe('Tester');
    expect(song.initialTempoBpm).toBe(128);
    expect(song.tracks[0]!.bars[0]!.beats).toHaveLength(2);
  });

  it('importa archivos MusicXML en formato texto y bytes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>MusicXML Test</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Guitar</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

    // Como string mediante importSong
    const songFromStr = importSong(xml);
    expect(songFromStr.tracks).toHaveLength(1);
    expect(songFromStr.tracks[0]!.bars).toHaveLength(1);

    // Como bytes mediante importSongFromBytes
    const bytes = new TextEncoder().encode(xml);
    const songFromBytes = importSongFromBytes(bytes);
    expect(songFromBytes.tracks).toHaveLength(1);
  });

  it('soporta AlphaTex codificado en bytes como fallback defensivo', () => {
    const tex = `\\title "AlphaTex en Bytes" . 0.1 1.2`;
    const bytes = new TextEncoder().encode(tex);

    const song = importSongFromBytes(bytes);
    expect(song.title).toBe('AlphaTex en Bytes');
    expect(song.tracks[0]!.bars[0]!.beats).toHaveLength(2);
  });

  it('acepta ArrayBuffer nativo además de Uint8Array', () => {
    const tex = `\\title "Buffer Test" . 0.1`;
    const gpBytes = exportAlphaTexToGp7Bytes(tex);
    const arrayBuffer = gpBytes.buffer.slice(
      gpBytes.byteOffset,
      gpBytes.byteOffset + gpBytes.byteLength,
    );

    const song = importSongFromBytes(arrayBuffer);
    expect(song.title).toBe('Buffer Test');
  });

  it('lanza error accesible si los bytes están vacíos o corruptos', () => {
    expect(() => importSongFromBytes(new Uint8Array(0))).toThrow(
      'El archivo está vacío o no contiene datos musicales.',
    );
    expect(() => importSongFromBytes(new Uint8Array([0, 1, 2, 3, 4]))).toThrow(
      'No se pudo importar la canción: formato no soportado o archivo corrupto.',
    );
  });
});
