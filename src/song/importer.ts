import {
  importer,
  exporter,
  Logger,
  LogLevel,
  type model,
} from '@coderline/alphatab';
import { TUNINGS, STANDARD_TUNING, type Tuning, type PitchClass } from '../theory';
import type { SongModel, SongTrack, SongBar, SongBeat, SongNote } from './types';

type Score = model.Score;
type Bar = model.Bar;
type Note = model.Note;

const { ScoreLoader } = importer;

/**
 * Calcula el peso métrico predeterminado para un pulso según el compás y su posición en ticks.
 * Regla docs/Fase-3/plan_fase3.md §3.1 y §3.2:
 *  - 1.5 en el primer pulso del compás (downbeat, startTick === 0).
 *  - 1.2 en el pulso fuerte secundario (tiempo 3 en 4/4, tiempo 4 en 6/8, tiempo 7 en 12/8).
 *  - 1.0 en los restantes tiempos a tierra (múltiplos de la unidad de pulso).
 *  - 0.75 en contratiempos y subdivisiones débiles (off-beats).
 */
export function computeMetricWeight(
  startTick: number,
  numerator: number,
  denominator: number,
): number {
  if (startTick === 0) return 1.5;

  const quarterTicks = 960;
  // Duración de un pulso de denominador en ticks
  const beatTicks = Math.round((4 / (denominator || 4)) * quarterTicks);

  if (beatTicks <= 0) return 1.0;

  // Acento secundario intermedio en métricas comunes
  if (numerator === 4 && denominator === 4 && startTick === 2 * beatTicks) {
    return 1.2;
  }
  if (numerator === 6 && denominator === 8 && startTick === 3 * beatTicks) {
    return 1.2;
  }
  if (numerator === 12 && denominator === 8 && startTick === 6 * beatTicks) {
    return 1.2;
  }

  // Tiempos a tierra enteros
  if (startTick % beatTicks === 0) {
    return 1.0;
  }

  // Subdivisiones débiles / contratiempos
  return 0.75;
}

/**
 * Resuelve la afinación de la pista comparando las notas al aire con el catálogo de Guitar Aid.
 * En alphaTab, `staff.stringTuning.tunings` viene ordenado de la cuerda más aguda a la más grave.
 * En Guitar Aid, `tuning.strings` va de la cuerda más grave a la más aguda.
 */
function resolveTuning(
  rawTunings: readonly number[] | undefined,
  trackName: string,
  isPercussion: boolean,
): { tuning: Tuning; stringCount: number } {
  if (isPercussion) {
    return {
      tuning: { id: 'percussion', name: 'Percusión', strings: [] },
      stringCount: 0,
    };
  }

  if (!rawTunings || rawTunings.length === 0) {
    return {
      tuning: STANDARD_TUNING,
      stringCount: STANDARD_TUNING.strings.length,
    };
  }

  // Invertir de aguda->grave a grave->aguda
  const stringsGraveToAcute = [...rawTunings].reverse();
  const stringCount = stringsGraveToAcute.length;

  // Buscar coincidencia en el catálogo
  const matched = TUNINGS.find(
    (t) =>
      t.strings.length === stringCount &&
      t.strings.every((val, idx) => val === stringsGraveToAcute[idx]),
  );

  if (matched) {
    return { tuning: matched, stringCount };
  }

  // Afinación personalizada
  const safeName = trackName?.trim() ? `Afinación ${trackName.trim()}` : 'Personalizada';
  const customId = `custom-${stringsGraveToAcute.join('-')}`;

  return {
    tuning: {
      id: customId,
      name: safeName,
      strings: stringsGraveToAcute,
    },
    stringCount,
  };
}

/**
 * Transforma una nota de alphaTab en nuestro SongNote puro e inmutable.
 */
function convertNote(note: Note, beatPlaybackDuration: number, stringCount: number): SongNote {
  // En alphaTab, note.string va de 1 (más grave) a N (más aguda).
  // En Guitar Aid, 1 es la cuerda más aguda y N la más grave.
  const stringNumber = stringCount > 0 ? stringCount - note.string + 1 : note.string;

  // Bend: si tiene puntos de bend, el valor máximo dividido entre 2 da los semitonos
  let bendSemitones: number | undefined;
  if (note.hasBend && note.maxBendPoint && note.maxBendPoint.value > 0) {
    bendSemitones = note.maxBendPoint.value / 2;
  }

  const midi = note.realValue;
  const pc = (((midi % 12) + 12) % 12) as PitchClass;
  const durationTicks = Math.round(beatPlaybackDuration * (note.durationPercent ?? 1));

  return {
    string: stringNumber,
    fret: note.fret,
    midi,
    pc,
    durationTicks,
    isTied: Boolean(note.isTieDestination),
    isGhost: Boolean(note.isGhost),
    ...(bendSemitones !== undefined ? { bendSemitones } : {}),
  };
}

interface GroupedBeat {
  playbackStart: number;
  playbackDuration: number;
  chordAnnotation?: string;
  lyrics?: string;
  notes: SongNote[];
}

/**
 * Extrae y ordena los pulsos de un compás, combinando voces simultáneas si existen.
 */
function extractBarBeats(
  bar: Bar | undefined,
  numerator: number,
  denominator: number,
  stringCount: number,
): readonly SongBeat[] {
  if (!bar || !bar.voices || bar.voices.length === 0) {
    return [];
  }

  const beatsByStart = new Map<number, GroupedBeat>();

  for (const voice of bar.voices) {
    if (!voice.beats) continue;

    for (const beat of voice.beats) {
      const startTick = beat.playbackStart;
      const durationTicks = beat.playbackDuration;

      const chord = beat.chord?.name?.trim() || beat.text?.trim() || undefined;

      let lyrics: string | undefined;
      if (Array.isArray(beat.lyrics) && beat.lyrics.length > 0) {
        lyrics = beat.lyrics.join(' ').trim() || undefined;
      }

      const notes: SongNote[] = [];
      if (beat.notes && beat.notes.length > 0) {
        for (const n of beat.notes) {
          notes.push(convertNote(n, durationTicks, stringCount));
        }
      }

      const existing = beatsByStart.get(startTick);
      if (existing) {
        existing.playbackDuration = Math.max(existing.playbackDuration, durationTicks);
        if (!existing.chordAnnotation && chord) existing.chordAnnotation = chord;
        if (!existing.lyrics && lyrics) existing.lyrics = lyrics;
        existing.notes.push(...notes);
      } else {
        beatsByStart.set(startTick, {
          playbackStart: startTick,
          playbackDuration: durationTicks,
          chordAnnotation: chord,
          lyrics,
          notes,
        });
      }
    }
  }

  // Ordenar cronológicamente por startTick
  const sorted = Array.from(beatsByStart.values()).sort(
    (a, b) => a.playbackStart - b.playbackStart,
  );

  return sorted.map((g, index) => ({
    index,
    startTick: g.playbackStart,
    durationTicks: g.playbackDuration,
    metricWeight: computeMetricWeight(g.playbackStart, numerator, denominator),
    ...(g.chordAnnotation ? { chordAnnotation: g.chordAnnotation } : {}),
    ...(g.lyrics ? { lyrics: g.lyrics } : {}),
    notes: Object.freeze(g.notes),
  }));
}

/**
 * Transforma una partitura parseada de alphaTab en nuestro modelo puro SongModel.
 */
export function scoreToSongModel(
  score: Score,
  options?: { id?: string; fileName?: string },
): SongModel {
  if (!score.tracks || score.tracks.length === 0 || !score.masterBars || score.masterBars.length === 0) {
    throw new Error('La partitura no contiene pistas ni compases legibles.');
  }

  const fallbackTitle = options?.fileName
    ? options.fileName.replace(/\.[^/.]+$/, '').trim()
    : 'Sin título';
  const title = score.title?.trim() || fallbackTitle;
  const artist = score.artist?.trim() || 'Desconocido';
  const album = score.album?.trim() || undefined;
  const initialTempoBpm = score.tempo > 0 ? score.tempo : 120;

  const id =
    options?.id ||
    `song-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`;

  const tracks: SongTrack[] = score.tracks.map((track, trackIndex) => {
    const staff = track.staves?.[0];
    const isPercussion = Boolean(
      staff?.isPercussion || track.playbackInfo?.primaryChannel === 9,
    );
    const capoFret = staff?.capo || 0;
    const { tuning, stringCount } = resolveTuning(
      staff?.stringTuning?.tunings,
      track.name,
      isPercussion,
    );

    let currentTempo = initialTempoBpm;
    let currentSection: string | undefined = undefined;

    const bars: SongBar[] = score.masterBars.map((masterBar, barIndex) => {
      if (masterBar.tempoAutomations && masterBar.tempoAutomations.length > 0) {
        currentTempo = masterBar.tempoAutomations[0]!.value;
      }
      if (masterBar.section?.text?.trim()) {
        currentSection = masterBar.section.text.trim();
      }

      const numerator = masterBar.timeSignatureNumerator || 4;
      const denominator = masterBar.timeSignatureDenominator || 4;
      const bar = staff?.bars?.[barIndex];

      const beats = extractBarBeats(bar, numerator, denominator, stringCount);

      return {
        index: barIndex,
        number: barIndex + 1,
        timeSignature: { numerator, denominator },
        tempoBpm: currentTempo,
        keySignature: {
          accidentalCount: masterBar.keySignature ?? 0,
          mode: masterBar.keySignatureType === 1 ? 'minor' : 'major',
        },
        ...(currentSection ? { sectionMarker: currentSection } : {}),
        beats,
      };
    });

    const trackName =
      track.name?.trim() || (isPercussion ? 'Batería' : `Pista ${trackIndex + 1}`);

    return {
      index: trackIndex,
      name: trackName,
      isPercussion,
      stringCount,
      tuning,
      capoFret,
      bars: Object.freeze(bars),
    };
  });

  return {
    id,
    title,
    artist,
    ...(album ? { album } : {}),
    initialTempoBpm,
    tracks: Object.freeze(tracks),
  };
}

/**
 * Importa una canción a partir de una cadena de texto en formato AlphaTex.
 */
export function importSongFromAlphaTex(
  alphaTex: string,
  options?: { id?: string; title?: string; artist?: string },
): SongModel {
  if (!alphaTex || typeof alphaTex !== 'string' || alphaTex.trim().length === 0) {
    throw new Error('El contenido de la tablatura está vacío.');
  }

  const previousLogLevel = Logger.logLevel;
  try {
    Logger.logLevel = LogLevel.Warning;
    const score = ScoreLoader.loadAlphaTex(alphaTex);
    if (options?.title) score.title = options.title;
    if (options?.artist) score.artist = options.artist;
    return { ...scoreToSongModel(score, options), alphaTex, rawData: alphaTex };
  } catch (err) {
    if (err instanceof Error && err.message.includes('La partitura no contiene')) {
      throw err;
    }
    throw new Error(
      `No se pudo importar la canción en formato AlphaTex: ${err instanceof Error ? err.message : 'formato no válido'}`,
    );
  } finally {
    Logger.logLevel = previousLogLevel;
  }
}

/**
 * Comprueba si un búfer de bytes parece texto plano imprimible (UTF-8/ASCII)
 * y no binario arbitrario.
 */
function isLikelyText(data: Uint8Array): boolean {
  const checkLen = Math.min(data.length, 512);
  for (let i = 0; i < checkLen; i++) {
    const byte = data[i]!;
    // Permitir tabulación (9), salto de línea (10), retorno de carro (13) y caracteres imprimibles (>= 32)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      return false;
    }
  }
  return true;
}

/**
 * Importa una canción a partir de bytes binarios (.gp, .gp3–.gp5, .gpx, .tg, MusicXML o AlphaTex en bytes).
 */
export function importSongFromBytes(
  bytes: Uint8Array | ArrayBufferLike,
  options?: { id?: string; fileName?: string },
): SongModel {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (!data || data.byteLength === 0) {
    throw new Error('El archivo está vacío o no contiene datos musicales.');
  }

  const previousLogLevel = Logger.logLevel;
  try {
    Logger.logLevel = LogLevel.None;
    const score = ScoreLoader.loadScoreFromBytes(data);
    return { ...scoreToSongModel(score, options), rawData: data };
  } catch (scoreErr) {
    // Si la lectura binaria falló, comprobar si los bytes corresponden a un texto UTF-8 (AlphaTex plano)
    if (isLikelyText(data)) {
      try {
        const text = new TextDecoder('utf-8').decode(data).trim();
        if (text.length > 0 && !text.startsWith('<')) {
          const score = ScoreLoader.loadAlphaTex(text);
          return { ...scoreToSongModel(score, options), alphaTex: text, rawData: text };
        }
      } catch {
        // Ignorar fallo de decodificación de texto
      }
    }

    if (scoreErr instanceof Error && scoreErr.message.includes('La partitura no contiene')) {
      throw scoreErr;
    }
    throw new Error('No se pudo importar la canción: formato no soportado o archivo corrupto.');
  } finally {
    Logger.logLevel = previousLogLevel;
  }
}

/**
 * Función polimórfica que importa una canción desde un texto (AlphaTex o XML) o desde bytes binarios.
 */
export function importSong(
  input: string | Uint8Array | ArrayBufferLike,
  options?: { id?: string; fileName?: string },
): SongModel {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('<')) {
      const bytes = new TextEncoder().encode(input);
      return importSongFromBytes(bytes, options);
    }
    return importSongFromAlphaTex(input, options);
  }
  return importSongFromBytes(input, options);
}

/**
 * Utilidad de interoperabilidad y pruebas: convierte una partitura en formato AlphaTex a bytes binarios de Guitar Pro 7 (.gp).
 */
export function exportAlphaTexToGp7Bytes(alphaTex: string): Uint8Array {
  const score = ScoreLoader.loadAlphaTex(alphaTex);
  const exp = new exporter.Gp7Exporter();
  return exp.export(score);
}

