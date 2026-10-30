import { type NameMode, type PitchClass, pitchClassOf } from '../core/pitch';
import { pcName } from '../core/spelling';
import { CHORD_QUALITIES, type ChordQualityId, chordTones, getChordQuality } from '../data/chords';
import { STANDARD_TUNING, type Tuning } from '../data/tunings';
import {
  type FretValue,
  MOVABLE_VOICING_SHAPES,
  type MovableVoicingShape,
  OPEN_VOICING_SHAPES,
  type OpenVoicingShape,
  type SixStringFrets,
  type VoicingFamily,
  type VoicingInversion,
} from '../data/voicings/standard';
import { type FretPosition, type StringNumber, positionToMidi } from '../fretboard';
import {
  adaptVoicingToTuning,
  isOpenTuning,
  rebindVoicingToTuning,
  uniformSemitoneShift,
} from './adapt';

export interface ChordVoicingTarget {
  root: PitchClass;
  quality: ChordQualityId;
}

export interface Voicing {
  /** Identificador de la plantilla de origen. */
  id: string;
  /** Clase de altura de la fundamental (0 = C … 11 = B). */
  root: PitchClass;
  /** Calidad del acorde. */
  quality: ChordQualityId;
  /** Familia del voicing ('open', 'barre-E', 'barre-A', 'strings-1-4', 'strings-1-3'). */
  family: VoicingFamily;
  /** Inversión del voicing ('root', '1st', '2nd', '3rd'). */
  inversion: VoicingInversion;
  /** Cuerda de referencia de la raíz (6 = más grave, 1 = más aguda). */
  rootString: StringNumber;
  /** Trastes absolutos de la cuerda 6 a la 1 ('x' = muteada, 0 = al aire). */
  frets: SixStringFrets;
  /** Posiciones activas en el mástil (de cuerda 6 a 1, omitiendo cuerdas muteadas). */
  positions: FretPosition[];
  /** Notas MIDI reales calculadas con `positionToMidi` para cada posición activa. */
  midis: number[];
  /** Dedos necesarios calculados desde `frets` (1 por nota pulsada; 1 sola cejilla agrupa su tramo). */
  fingers: number;
}

/**
 * Calcula el número de dedos requeridos directamente desde los trastes:
 * - Cuerdas al aire (0) o muteadas ('x') requieren 0 dedos.
 * - Cada cuerda pulsada (> 0) requiere 1 dedo, salvo que forme parte de una cejilla.
 * - Un único dedo puede hacer cejilla en un traste `b > 0` entre dos cuerdas si ninguna
 *   cuerda intermedia que suene tiene un traste `< b` (incluida cuerda al aire 0).
 */
export function requiredFingers(frets: SixStringFrets): number {
  const frettedIndices: number[] = [];
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i];
    if (typeof f === 'number' && f > 0) {
      frettedIndices.push(i);
    }
  }
  if (frettedIndices.length === 0) return 0;

  let maxSavedByBarre = 0;

  for (let start = 0; start < frets.length; start++) {
    const b = frets[start];
    if (typeof b !== 'number' || b <= 0) continue;

    let countAtB = 1;
    for (let end = start + 1; end < frets.length; end++) {
      const current = frets[end];
      if (typeof current === 'number' && current < b) {
        // Una cuerda intermedia suena en un traste inferior (o al aire): la cejilla no puede cruzarla.
        break;
      }
      if (current === b) {
        countAtB++;
        const saved = countAtB - 1;
        if (saved > maxSavedByBarre) {
          maxSavedByBarre = saved;
        }
      }
    }
  }

  return frettedIndices.length - maxSavedByBarre;
}

/**
 * Número de trastes que abarca la mano (entre las cuerdas pulsadas con traste > 0).
 * Devuelve 0 si solo hay cuerdas al aire. Ejemplo: trastes 1..3 → abarca 3 trastes.
 */
export function voicingFretSpan(frets: SixStringFrets): number {
  const fretted = frets.filter((f): f is number => typeof f === 'number' && f > 0);
  if (fretted.length === 0) return 0;
  return Math.max(...fretted) - Math.min(...fretted) + 1;
}

function minFrettedFret(frets: SixStringFrets): number {
  const fretted = frets.filter((f): f is number => typeof f === 'number' && f > 0);
  return fretted.length === 0 ? 0 : Math.min(...fretted);
}

function buildVoicing(
  meta: {
    id: string;
    root: PitchClass;
    quality: ChordQualityId;
    family: VoicingFamily;
    inversion?: VoicingInversion;
    rootString: StringNumber;
    frets: SixStringFrets;
  },
  tuning: Tuning = STANDARD_TUNING,
): Voicing {
  const positions: FretPosition[] = [];
  const midis: number[] = [];

  for (let i = 0; i < meta.frets.length; i++) {
    const fret = meta.frets[i];
    if (typeof fret === 'number') {
      const string = (6 - i) as StringNumber;
      const pos: FretPosition = { string, fret };
      positions.push(pos);
      midis.push(positionToMidi(tuning, pos));
    }
  }

  return {
    ...meta,
    inversion: meta.inversion ?? 'root',
    positions,
    midis,
    fingers: requiredFingers(meta.frets),
  };
}

/** Resuelve una forma abierta en la afinación indicada (por defecto estándar). */
export function resolveOpenShape(
  shape: OpenVoicingShape,
  tuning: Tuning = STANDARD_TUNING,
): Voicing {
  return buildVoicing(
    {
      id: shape.id,
      root: shape.root,
      quality: shape.quality,
      family: shape.family,
      inversion: shape.inversion ?? 'root',
      rootString: shape.rootString,
      frets: shape.frets,
    },
    tuning,
  );
}

/**
 * Transpone una forma móvil a la raíz `root` en la afinación indicada.
 * Para cejillas (barre-E y barre-A), las cuerdas pulsadas se sitúan en traste >= 1.
 * Para cuerdas 1–4 y 1–3, se permiten posiciones en traste >= 0.
 */
export function resolveMovableShape(
  shape: MovableVoicingShape,
  root: PitchClass,
  tuning: Tuning = STANDARD_TUNING,
): Voicing {
  const openRootStringMidi = positionToMidi(tuning, { string: shape.rootString, fret: 0 });
  const openPc = pitchClassOf(openRootStringMidi);
  const baseFret = (root - openPc + 12) % 12;

  const numericOffsets = shape.frets.filter((f): f is number => typeof f === 'number');
  const minOffset = Math.min(...numericOffsets);
  const minAllowedFret = shape.family === 'barre-E' || shape.family === 'barre-A' ? 1 : 0;
  const rootFret = baseFret + minOffset >= minAllowedFret ? baseFret : baseFret + 12;

  const resolvedFrets = shape.frets.map((f): FretValue =>
    typeof f === 'number' ? rootFret + f : 'x',
  ) as unknown as SixStringFrets;

  return buildVoicing(
    {
      id: shape.id,
      root,
      quality: shape.quality,
      family: shape.family,
      inversion: shape.inversion ?? 'root',
      rootString: shape.rootString,
      frets: resolvedFrets,
    },
    tuning,
  );
}

const FAMILY_ORDER: Readonly<Record<VoicingFamily, number>> = {
  open: 0,
  'barre-E': 1,
  'barre-A': 1,
  'strings-1-4': 2,
  'strings-1-3': 3,
};

function standardVoicingsForChord(root: PitchClass, quality: ChordQualityId): Voicing[] {
  const openVoicings = OPEN_VOICING_SHAPES.filter(
    (s) => s.root === root && s.quality === quality,
  ).map((s) => resolveOpenShape(s, STANDARD_TUNING));

  const movableVoicings = MOVABLE_VOICING_SHAPES.filter((s) => s.quality === quality)
    .map((s) => resolveMovableShape(s, root, STANDARD_TUNING))
    .sort((a, b) => {
      const famDiff = FAMILY_ORDER[a.family] - FAMILY_ORDER[b.family];
      if (famDiff !== 0) return famDiff;
      const diff = minFrettedFret(a.frets) - minFrettedFret(b.frets);
      if (diff !== 0) return diff;
      return b.rootString - a.rootString;
    });

  return [...openVoicings, ...movableVoicings];
}

/**
 * Devuelve todos los voicings disponibles para un acorde en la afinación indicada
 * (por defecto `STANDARD_TUNING`).
 *
 * - En afinaciones con desplazamiento uniforme de `k` semitonos hacia abajo (`standard`, `halfDown`, `wholeDown`),
 *   reutiliza los trastes del acorde `k` semitonos más agudo y recalcula sus notas MIDI en `tuning`.
 * - En `dropD`, adapta cada voicing estándar sumando la diferencia por cuerda y conserva solo los que
 *   cumplen todas las restricciones del diccionario.
 * - En afinaciones abiertas (`openG`, `openD`, `dadgad`), devuelve `[]`.
 *
 * Acepta tanto `voicingsForChord(chord, tuning)` como `voicingsForChord(root, quality, tuning)`.
 */
export function voicingsForChord(chord: ChordVoicingTarget, tuning?: Tuning): Voicing[];
export function voicingsForChord(
  root: PitchClass,
  quality: ChordQualityId,
  tuning?: Tuning,
): Voicing[];
export function voicingsForChord(
  rootOrChord: PitchClass | ChordVoicingTarget,
  qualityOrTuning?: ChordQualityId | Tuning,
  maybeTuning?: Tuning,
): Voicing[] {
  const root: PitchClass = typeof rootOrChord === 'number' ? rootOrChord : rootOrChord.root;
  const quality: ChordQualityId =
    typeof rootOrChord === 'number' ? (qualityOrTuning as ChordQualityId) : rootOrChord.quality;
  const tuning: Tuning =
    typeof rootOrChord === 'number'
      ? (maybeTuning ?? STANDARD_TUNING)
      : ((qualityOrTuning as Tuning | undefined) ?? STANDARD_TUNING);

  const uniformShift = uniformSemitoneShift(tuning, STANDARD_TUNING);
  if (uniformShift !== null) {
    if (uniformShift === 0) {
      return standardVoicingsForChord(root, quality);
    }
    const shapeRoot = pitchClassOf(root + uniformShift);
    return standardVoicingsForChord(shapeRoot, quality).map((v) =>
      rebindVoicingToTuning(v, root, tuning),
    );
  }

  if (isOpenTuning(tuning, STANDARD_TUNING)) {
    return [];
  }

  const adapted: Voicing[] = [];
  for (const stdVoicing of standardVoicingsForChord(root, quality)) {
    const candidate = adaptVoicingToTuning(stdVoicing, tuning, STANDARD_TUNING);
    if (candidate !== null) {
      adapted.push(candidate);
    }
  }
  return adapted;
}

/** Formatea los 6 trastes de forma consistente separados por guiones (ej. `x-0-2-0-1-0`, `x-x-10-12-11-12`). */
export function formatCompactFrets(frets: SixStringFrets): string {
  return frets.map(String).join('-');
}

/**
 * Nombres de las clases de altura presentes realmente en el voicing (calculadas desde `voicing.midis`),
 * ordenadas según la estructura funcional del acorde desde la raíz (1, 3, 5, 7, 9…).
 */
export function voicingNoteNames(voicing: Voicing, mode: NameMode = 'sharps'): string[] {
  const presentPcs = new Set<PitchClass>(voicing.midis.map(pitchClassOf));
  const tones = chordTones(voicing.root, voicing.quality, mode);
  const ordered = tones.filter((t) => presentPcs.has(t.pc)).map((t) => t.name);

  // Si hubiera alguna nota fuera del catálogo (en tests de validación), añadirla al final.
  for (const pc of presentPcs) {
    const name = pcName(pc, mode);
    if (!ordered.includes(name)) {
      ordered.push(name);
    }
  }
  return ordered;
}

/**
 * Formatea un voicing en una línea resumen:
 * Ejemplo: `x02010 · A C E G · open`
 */
export function formatVoicingLine(voicing: Voicing, mode: NameMode = 'sharps'): string {
  const compact = formatCompactFrets(voicing.frets);
  const notes = voicingNoteNames(voicing, mode).join(' ');
  return `${compact} · ${notes} · ${voicing.family}`;
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const;

/**
 * Formatea uno o varios voicings como tablatura ASCII de 6 cuerdas (de 1ª cuerda `e` a 6ª cuerda `E`).
 */
export function formatVoicingsAsTab(voicings: readonly Voicing[]): string {
  if (voicings.length === 0) return '';
  const columns = voicings.map((v) => {
    const width = Math.max(1, ...v.frets.map((f) => String(f).length));
    // Cuerda 1 está en el índice 5 de `frets`; cuerda 6 en el índice 0.
    return STRING_LABELS.map((_, lineIdx) => {
      const fretVal = String(v.frets[5 - lineIdx]);
      return `-${fretVal.padStart(width, '-')}-`;
    });
  });

  return STRING_LABELS.map((label, lineIdx) => {
    const row = columns.map((col) => col[lineIdx]).join('|');
    return `${label}|${row}|`;
  }).join('\n');
}

const ROOT_TOKEN_RE = /^([A-Ga-g])([#♯b♭]?)(.*)$/;
const NATURAL_PCS: Readonly<Record<string, PitchClass>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parsea el cifrado de un acorde (p. ej. "Am7", "C", "F#m6", "Bb9", "Ddim").
 * Devuelve `null` si la raíz o la calidad no existen en el catálogo.
 */
export function parseChordSymbol(
  input: string,
): { root: PitchClass; quality: ChordQualityId; mode: NameMode } | null {
  const trimmed = input.trim();
  const match = ROOT_TOKEN_RE.exec(trimmed);
  if (!match) return null;

  const letter = match[1]!.toUpperCase();
  const acc = match[2] ?? '';
  const rest = match[3]!.trim();

  const basePc = NATURAL_PCS[letter];
  if (basePc === undefined) return null;

  const delta = acc === '#' || acc === '♯' ? 1 : acc === 'b' || acc === '♭' ? -1 : 0;
  const root = pitchClassOf(basePc + delta);
  const mode: NameMode =
    acc === 'b' || acc === '♭'
      ? 'flats'
      : acc === '#' || acc === '♯'
        ? 'sharps'
        : root === 5 || root === 10 || root === 3 || root === 8 || root === 1
          ? 'flats'
          : 'sharps';

  const qualityObj = CHORD_QUALITIES.find((q) => q.symbol === rest || q.id === rest);
  if (!qualityObj) return null;

  return { root, quality: qualityObj.id, mode };
}

/** Nombre completo del acorde (p. ej. `root = 9, quality = 'm7'` → `"Am7"`). */
export function formatChordName(
  root: PitchClass,
  quality: ChordQualityId,
  mode: NameMode = 'sharps',
): string {
  return `${pcName(root, mode)}${getChordQuality(quality).symbol}`;
}

/**
 * Genera el contenido completo de `docs/voicings.md` con todas las formas abiertas y móviles
 * como tablatura y la lista completa de voicings para los 228 acordes del catálogo.
 */
export function generateVoicingsMarkdown(): string {
  const lines: string[] = [
    '# Catálogo de Voicings — Afinación Estándar (Fase 1.1)',
    '',
    'Generado automáticamente con `pnpm voicings:print`. Incluye todas las formas abiertas (`open`), de cejilla (`barre-E`, `barre-A`), cuerdas 1–4 (`strings-1-4`) y cuerdas 1–3 (`strings-1-3`) para las 19 calidades del catálogo.',
    '',
    '## 1. Plantillas por calidad (con tablatura)',
    '',
  ];

  for (const quality of CHORD_QUALITIES) {
    const title = `${quality.symbol || quality.id} (${quality.name})`;
    lines.push(`### Calidad: ${title}`);
    lines.push('');

    const openForQuality = OPEN_VOICING_SHAPES.filter((s) => s.quality === quality.id).map((s) =>
      resolveOpenShape(s, STANDARD_TUNING),
    );
    // Para mostrar las formas móviles en una posición ergonómica de ejemplo, usamos F (traste 1) en barre-E y C (traste 3) en barre-A.
    const movableExamples = MOVABLE_VOICING_SHAPES.filter((s) => s.quality === quality.id).map(
      (s) => resolveMovableShape(s, s.rootString === 6 ? 5 : 0, STANDARD_TUNING),
    );

    const sampleVoicings = [...openForQuality, ...movableExamples];
    for (const v of sampleVoicings) {
      const chordLabel = formatChordName(v.root, v.quality);
      lines.push(
        `- **${chordLabel}** (\`${v.id}\`, ${v.fingers} ${v.fingers === 1 ? 'dedo' : 'dedos'}): \`${formatVoicingLine(v)}\``,
      );
    }
    lines.push('');
    lines.push('```text');
    lines.push(
      sampleVoicings.map((v) => `${formatChordName(v.root, v.quality)} (${v.family})`).join('   '),
    );
    lines.push(formatVoicingsAsTab(sampleVoicings));
    lines.push('```');
    lines.push('');
  }

  lines.push('## 2. Lista completa por acorde (19 calidades × 12 raíces = 228 acordes)');
  lines.push('');

  for (const quality of CHORD_QUALITIES) {
    const title = `${quality.symbol || quality.id} (${quality.name})`;
    lines.push(`### ${title}`);
    lines.push('');
    for (let r = 0; r < 12; r++) {
      const root = r as PitchClass;
      const chordLabel = formatChordName(root, quality.id);
      const voicings = voicingsForChord(root, quality.id);
      lines.push(`#### ${chordLabel}`);
      lines.push('');
      for (const v of voicings) {
        lines.push(`- \`${formatVoicingLine(v)}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
