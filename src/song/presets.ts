import { importSongFromAlphaTex } from './importer';
import type { SongModel } from './types';

export interface PresetSong {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly description: string;
  readonly alphaTex: string;
}

/**
 * 1. Pop Diatónico en C/Am:
 * Progresión canónica I–V–vi–IV (Intro) y vi–IV–I–V (Estribillo), con dos pistas
 * (Guitarra rítmica en afinación estándar y Bajo eléctrico en afinación de 4 cuerdas),
 * acordes anotados y letra en el estribillo.
 */
const POP_DIATONICO_ALPHATEX = `\\title "Pop Diatónico en C/Am"
\\artist "Guitar Aid"
\\tempo 100
\\ks C
.
\\track "Guitarra Rítmica"
\\tuning (E4 B3 G3 D3 A2 E2)
\\section ("Intro")
\\ts 4 4
:4 (0.1 1.2 0.3 2.4 3.5) {ch "C"} :8 0.1 1.2 :4 (3.2 0.3 0.4 2.5 3.6) {ch "G"} :8 3.2 0.3 |
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
:4 (0.1 1.2 0.3 2.4 3.5) {ch "C"} :8 0.1 1.2 :4 (3.2 0.3 0.4 2.5 3.6) {ch "G"} :8 3.2 0.3 |
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
\\section ("Estribillo")
\\lyrics "Can - ta es - ta can - ción con fuer - za hoy / Si - gue el rit - mo sin fin"
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
:4 (0.1 1.2 0.3 2.4 3.5) {ch "C"} :8 0.1 1.2 :4 (3.2 0.3 0.4 2.5 3.6) {ch "G"} :8 3.2 0.3 |
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
:4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 :4 (3.2 0.3 0.4 2.5 3.6) {ch "G"} :8 3.2 0.3 |
\\track "Bajo Eléctrico"
\\tuning (G2 D2 A1 E1)
3.3 3.3 3.3 3.3 | 0.3 0.3 1.4 1.4 | 3.3 3.3 3.3 3.3 | 0.3 0.3 1.4 1.4 |
0.3 0.3 1.4 1.4 | 3.3 3.3 3.4 3.4 | 0.3 0.3 1.4 1.4 | 1.4 1.4 3.4 3.4 |
`;

/**
 * 2. Blues & Rock Riff en E:
 * Riff de rock en Mi con power chords (E5, A5, B5), acordes dominantes (E7, A7, B7),
 * notas de paso blues/pentatónicas, bends y ghost notes.
 */
const BLUES_ROCK_ALPHATEX = `\\title "Blues & Rock Riff en E"
\\artist "Guitar Aid"
\\tempo 116
\\ks E
.
\\track "Guitarra Lead"
\\tuning (E4 B3 G3 D3 A2 E2)
\\section ("Intro Riff")
\\ts 4 4
:8 0.6 0.6 3.6 0.6 :4 2.5 :8 0.5 2.5 |
:8 0.6 0.6 3.6 0.6 :4 2.5 :8 3.5{g} 2.5 |
:8 0.6 0.6 3.6 0.6 :4 2.5 :8 0.5 2.5 |
:8 0.6 0.6 3.6 0.6 :4 2.5 0.6 |
\\section ("Blues Solo & Chords")
:8 0.1 3.2 0.2 2.3{b bend (0 4)} :4 0.3 :8 2.4 0.4 |
:4 (0.1 0.2 1.3 0.4 2.5 0.6) {ch "E7"} :8 0.6 0.6 :4 (0.1 2.2 0.3 2.4 0.5) {ch "A7"} :8 0.5 0.5 |
:8 3.1 0.1 3.2 0.2 :4 2.3 :8 0.3 2.4 |
:4 (2.1 0.2 2.3 1.4 2.5) {ch "B7"} :8 2.5 2.5 :4 (0.1 0.2 1.3 0.4 2.5 0.6) {ch "E7"} |
\\track "Guitarra Rítmica"
\\tuning (E4 B3 G3 D3 A2 E2)
:4 (0.6 2.5) {ch "E5"} :8 (0.6 2.5) (0.6 4.5) :4 (0.6 2.5) :8 (0.6 4.5) (0.6 2.5) |
:4 (0.6 2.5) {ch "E5"} :8 (0.6 2.5) (0.6 4.5) :4 (0.6 2.5) :8 (0.6 4.5) (0.6 2.5) |
:4 (0.6 2.5) {ch "E5"} :8 (0.6 2.5) (0.6 4.5) :4 (0.6 2.5) :8 (0.6 4.5) (0.6 2.5) |
:4 (0.6 2.5) {ch "E5"} :8 (0.6 2.5) (0.6 4.5) :4 (0.6 2.5) :8 (0.6 4.5) (0.6 2.5) |
:4 (0.5 2.4) {ch "A5"} :8 (0.5 2.4) (0.5 4.4) :4 (0.6 2.5) {ch "E5"} :8 (0.6 4.5) (0.6 2.5) |
:4 (0.5 2.4) {ch "A5"} :8 (0.5 2.4) (0.5 4.4) :4 (0.6 2.5) {ch "E5"} :8 (0.6 4.5) (0.6 2.5) |
:4 (2.5 4.4) {ch "B5"} :8 (2.5 4.4) (2.5 4.4) :4 (0.5 2.4) {ch "A5"} :8 (0.5 2.4) (0.5 2.4) |
:4 (0.6 2.5) {ch "E5"} :8 (0.6 2.5) (0.6 4.5) :4 (0.6 2.5) (0.6 2.5) |
`;

/**
 * 3. Modulación y Menor Armónica en Am/C:
 * Sección A en La menor utilizando el dominante E7 (escala menor armónica con G♯),
 * y modulación en la Sección B a Do mayor con progresión completa (C–F–Dm–G7–C).
 */
const MODULACION_ALPHATEX = `\\title "Modulación y Menor Armónica en Am/C"
\\artist "Guitar Aid"
\\tempo 92
\\ks C
.
\\track "Guitarra Española"
\\tuning (E4 B3 G3 D3 A2 E2)
\\section ("Parte A (La menor)")
\\ts 4 4
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 3.2 2.3 0.4) {ch "Dm"} :8 1.1 3.2 |
:4 (0.1 0.2 1.3 0.4 2.5 0.6) {ch "E7"} :8 0.1 0.2 :4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 |
:4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 :4 (1.1 3.2 2.3 0.4) {ch "Dm"} :8 1.1 3.2 |
:4 (0.1 0.2 1.3 0.4 2.5 0.6) {ch "E7"} :8 0.1 0.2 :4 (0.1 1.2 2.3 2.4 0.5) {ch "Am"} :8 0.1 1.2 |
\\section ("Parte B (Do mayor)")
:4 (0.1 1.2 0.3 2.4 3.5) {ch "C"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
:4 (1.1 3.2 2.3 0.4) {ch "Dm"} :8 1.1 3.2 :4 (1.1 0.2 0.3 0.4 2.5 3.6) {ch "G7"} :8 1.1 0.2 |
:4 (0.1 1.2 0.3 2.4 3.5) {ch "C"} :8 0.1 1.2 :4 (1.1 1.2 2.3 3.4 3.5 1.6) {ch "F"} :8 1.1 1.2 |
:4 (1.1 0.2 0.3 0.4 2.5 3.6) {ch "G7"} :8 1.1 0.2 :2 (0.1 1.2 0.3 2.4 3.5) {ch "C"} |
`;

export const PRESET_POP_DIATONIC: PresetSong = {
  id: 'pop-diatonico-c-am',
  title: 'Pop Diatónico en C/Am',
  artist: 'Guitar Aid',
  description:
    'Progresiones pop estándar I–V–vi–IV y vi–IV–I–V en Do mayor y La menor, con letra, guitarra rítmica y bajo eléctrico.',
  alphaTex: POP_DIATONICO_ALPHATEX,
};

export const PRESET_BLUES_ROCK: PresetSong = {
  id: 'blues-rock-riff-e',
  title: 'Blues & Rock Riff en E',
  artist: 'Guitar Aid',
  description:
    'Riff de blues/rock en Mi con power chords (E5, A5, B5), acordes dominantes (E7, A7, B7), notas de paso pentatónicas y bends expresivos.',
  alphaTex: BLUES_ROCK_ALPHATEX,
};

export const PRESET_MODULATION: PresetSong = {
  id: 'modulacion-menor-armonica-am',
  title: 'Modulación y Menor Armónica en Am/C',
  artist: 'Guitar Aid',
  description:
    'Contraste entre La menor con dominante mayor E7 (escala menor armónica con G♯) y modulación a Do mayor con cadencia completa.',
  alphaTex: MODULACION_ALPHATEX,
};

export const PRESET_SONGS: readonly PresetSong[] = [
  PRESET_POP_DIATONIC,
  PRESET_BLUES_ROCK,
  PRESET_MODULATION,
];

/**
 * Busca una canción de ejemplo integrada por su identificador.
 */
export function getPresetSong(id: string): PresetSong | undefined {
  return PRESET_SONGS.find((p) => p.id === id);
}

/**
 * Carga el modelo SongModel de una canción de ejemplo integrada.
 */
export function loadPresetSongModel(id: string): SongModel {
  const preset = getPresetSong(id);
  if (!preset) {
    throw new Error(`Canción de ejemplo no encontrada: ${id}`);
  }
  return importSongFromAlphaTex(preset.alphaTex, {
    id: preset.id,
    title: preset.title,
    artist: preset.artist,
  });
}

/**
 * Carga los modelos SongModel de todas las canciones de ejemplo integradas.
 */
export function loadAllPresetSongModels(): SongModel[] {
  return PRESET_SONGS.map((p) =>
    importSongFromAlphaTex(p.alphaTex, {
      id: p.id,
      title: p.title,
      artist: p.artist,
    }),
  );
}
