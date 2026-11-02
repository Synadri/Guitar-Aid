import {
  analyzeBarChords,
  detectSongKeysByBar,
  type SongBar,
  type SongBeat,
  type SongTrack,
} from '../../../song';
import {
  DEFAULT_FRETS,
  chordPitchClasses,
  degreeName,
  intervalName,
  parseChordSymbol,
  pcInterval,
  pcName,
  pitchClassOf,
  positionToMidi,
  scalePitchClasses,
  type ChordQualityId,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
  type StringNumber,
  type Tuning,
} from '../../../theory';
import {
  DEFAULT_PIANO_RANGE,
  ROLE_PRIORITY,
  type FretMark,
  type KeyMark,
  type LabelMode,
  type MarkRole,
} from '../../shared/marks';
import type { ActiveHarmonyInfo, SongMarksOptions, SongState } from '../types';

export { DEFAULT_PIANO_RANGE, ROLE_PRIORITY };

function makeLabel(
  pc: PitchClass,
  root: PitchClass | undefined,
  labels: LabelMode,
  nameMode: NameMode,
): string | undefined {
  switch (labels) {
    case 'none':
      return undefined;
    case 'note':
      return pcName(pc, nameMode);
    case 'interval':
      return root === undefined ? undefined : intervalName(pcInterval(root, pc));
    case 'degree':
      return root === undefined ? undefined : degreeName(pcInterval(root, pc));
  }
}

function mergeIsRoot<T extends { role: MarkRole; isRoot?: boolean }>(
  winner: T,
  other?: { role: MarkRole; isRoot?: boolean },
): T {
  const hasRoot =
    winner.role === 'root' ||
    winner.isRoot === true ||
    other?.role === 'root' ||
    other?.isRoot === true;

  if (hasRoot && winner.role !== 'root') {
    return { ...winner, isRoot: true };
  }
  return winner;
}

function pushFret(into: Map<string, FretMark>, mark: FretMark): void {
  const key = `${mark.string}:${mark.fret}`;
  const prev = into.get(key);
  if (!prev) {
    into.set(key, mark);
    return;
  }
  const winner = ROLE_PRIORITY[mark.role] > ROLE_PRIORITY[prev.role] ? mark : prev;
  const loser = winner === mark ? prev : mark;
  into.set(key, mergeIsRoot(winner, loser));
}

function pushKey(into: Map<number, KeyMark>, mark: KeyMark): void {
  const prev = into.get(mark.midi);
  if (!prev) {
    into.set(mark.midi, mark);
    return;
  }
  const winner = ROLE_PRIORITY[mark.role] > ROLE_PRIORITY[prev.role] ? mark : prev;
  const loser = winner === mark ? prev : mark;
  into.set(mark.midi, mergeIsRoot(winner, loser));
}

/**
 * Resuelve la armonía activa del compás actual considerando afinación,
 * tonalidad/escala calculada o fijada y acorde detectado o sobreescrito.
 */
export function resolveActiveHarmony(
  state: SongState,
  options?: SongMarksOptions,
): ActiveHarmonyInfo | null {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return null;

  const track = song.tracks[state.activeTrackIndex] ?? song.tracks[0];
  if (!track || track.bars.length === 0) return null;

  const activeBar =
    track.bars.find((b) => b.number === state.currentBar) ??
    track.bars[state.currentBar - 1] ??
    track.bars[0];
  if (!activeBar) return null;

  const barNumber = activeBar.number;
  const override = state.barOverrides[barNumber];
  const nameMode = options?.nameMode ?? 'sharps';

  // 1. Tonalidad y escala del compás (override o calculada)
  let scaleTonic: PitchClass;
  let scaleType: ScaleTypeId;
  let hasScaleOverride = false;

  if (override?.tonic !== undefined && override?.scaleId) {
    scaleTonic = override.tonic;
    scaleType = override.scaleId as ScaleTypeId;
    hasScaleOverride = true;
  } else {
    const keysByBar = detectSongKeysByBar(song, {
      trackIndex: state.activeTrackIndex,
      allTracks: state.analysisSource === 'all-tracks',
      barOverrides: state.barOverrides,
      mode: nameMode,
    });
    const keyMatch = keysByBar.find((k) => k.barNumber === barNumber);
    scaleTonic = keyMatch?.scale.tonic ?? (0 as PitchClass);
    scaleType = (keyMatch?.scale.type as ScaleTypeId) ?? 'major';
  }

  const scalePcs = scalePitchClasses(scaleTonic, scaleType);

  // 2. Acorde del compás o del pulso actual (override manual o detectado dinámicamente)
  let chordRoot: PitchClass | undefined;
  let chordQuality: ChordQualityId | undefined;
  let hasChordOverride = false;

  if (override?.chordId) {
    const parsed = parseChordSymbol(override.chordId);
    if (parsed) {
      chordRoot = parsed.root;
      chordQuality = parsed.quality;
      hasChordOverride = true;
    }
  }

  // 2a. Si no hay override manual, buscar si el pulso actual (o anterior en el compás) tiene acorde anotado
  if (chordRoot === undefined && activeBar.beats.length > 0) {
    const curBeatIdx = Math.max(0, Math.min(activeBar.beats.length - 1, state.currentBeat ?? 0));
    let beatChordAnnotation: string | undefined;
    for (let i = curBeatIdx; i >= 0; i--) {
      const b = activeBar.beats[i];
      if (b?.chordAnnotation) {
        beatChordAnnotation = b.chordAnnotation;
        break;
      }
    }
    if (beatChordAnnotation) {
      const parsed = parseChordSymbol(beatChordAnnotation);
      if (parsed) {
        chordRoot = parsed.root;
        chordQuality = parsed.quality;
      }
    }
  }

  // 2b. Si no hay anotación en el pulso, usar el desglose armónico detectado (splitChords o primaryChord)
  if (chordRoot === undefined) {
    const barChords = analyzeBarChords(activeBar, {
      mode: nameMode,
      override,
    });
    const curBeatIdx = Math.max(0, Math.min(activeBar.beats.length - 1, state.currentBeat ?? 0));
    const isSecondHalf = curBeatIdx >= Math.floor(activeBar.beats.length / 2);

    if (isSecondHalf && barChords.splitChords?.secondHalf?.[0]) {
      chordRoot = barChords.splitChords.secondHalf[0].value.root;
      chordQuality = barChords.splitChords.secondHalf[0].value.quality;
    } else if (barChords.splitChords?.firstHalf?.[0]) {
      chordRoot = barChords.splitChords.firstHalf[0].value.root;
      chordQuality = barChords.splitChords.firstHalf[0].value.quality;
    } else if (barChords.primaryChord) {
      chordRoot = barChords.primaryChord.root;
      chordQuality = barChords.primaryChord.quality;
    }
  }

  // 3. Raíz de referencia según degreeReferenceMode
  let referenceRoot: PitchClass;
  if (state.degreeReferenceMode === 'chord' && chordRoot !== undefined) {
    referenceRoot = chordRoot;
  } else {
    referenceRoot = scaleTonic;
  }

  return {
    barNumber,
    scaleTonic,
    scaleType,
    scalePcs,
    chordRoot,
    chordQuality,
    referenceRoot,
    hasChordOverride,
    hasScaleOverride,
  };
}

interface FretBgCache {
  key: string;
  marks: Map<string, FretMark>;
}
let lastFretBgCache: FretBgCache | null = null;

interface PianoBgCache {
  key: string;
  marks: Map<number, KeyMark>;
}
let lastPianoBgCache: PianoBgCache | null = null;

/**
 * Genera las marcas para el Fretboard en el Modo Canción (plan_fase3.md §7 C4).
 * Incluye fondo de escala (`scale-bg`), notas del pulso activo (`pinned`) y previsualización.
 */
export function selectSongFretboardMarks(
  state: SongState,
  options?: SongMarksOptions,
): FretMark[] {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return [];

  const track: SongTrack = song.tracks[state.activeTrackIndex] ?? song.tracks[0]!;
  if (!track || track.bars.length === 0) return [];

  const harmony = resolveActiveHarmony(state, options);
  if (!harmony) return [];

  const opts = {
    nameMode: options?.nameMode ?? 'sharps',
    labels: options?.labels ?? 'note',
  } as const;

  const tuning: Tuning = track.tuning;

  // 1. Capa Fondo de escala ('scale-bg') memorizada para evitar 150 cálculos en cada pulso
  const bgKey = `${tuning.id ?? tuning.name}|${tuning.strings?.join(',') ?? ''}|${track.stringCount}|${harmony.referenceRoot}|${harmony.scalePcs.join(',')}|${opts.labels}|${opts.nameMode}`;
  let baseMarks: Map<string, FretMark>;

  if (lastFretBgCache && lastFretBgCache.key === bgKey) {
    baseMarks = lastFretBgCache.marks;
  } else {
    baseMarks = new Map<string, FretMark>();
    const scaleMask = harmony.scalePcs;
    for (let s = track.stringCount; s >= 1; s--) {
      for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
        const midi = positionToMidi(tuning, { string: s as StringNumber, fret });
        const pc = pitchClassOf(midi);
        if (scaleMask.includes(pc)) {
          const isRoot = pc === harmony.referenceRoot;
          const label = makeLabel(pc, harmony.referenceRoot, opts.labels, opts.nameMode);
          pushFret(baseMarks, {
            string: s as StringNumber,
            fret,
            role: 'scale-bg',
            isRoot,
            label,
          });
        }
      }
    }
    lastFretBgCache = { key: bgKey, marks: baseMarks };
  }

  const into = new Map<string, FretMark>(baseMarks);

  // 2. Capa Notas activas del pulso ('pinned')
  const activeBar: SongBar | undefined =
    track.bars.find((b) => b.number === state.currentBar) ??
    track.bars[state.currentBar - 1] ??
    track.bars[0];

  const activeBeat: SongBeat | undefined =
    activeBar?.beats.find((b) => b.index === state.currentBeat) ??
    activeBar?.beats[state.currentBeat] ??
    activeBar?.beats[0];

  if (activeBeat && activeBeat.notes.length > 0) {
    for (const note of activeBeat.notes) {
      const pc = note.pc;
      const isRoot = pc === harmony.referenceRoot;
      const label = makeLabel(pc, harmony.referenceRoot, opts.labels, opts.nameMode);
      pushFret(into, {
        string: note.string as StringNumber,
        fret: note.fret,
        role: 'pinned',
        isRoot,
        label,
      });
    }
  }

  // 3. Capa Previsualización ('preview') si hay contexto activo en hover
  const preview = state.previewContext;
  if (preview) {
    const previewPcs =
      preview.kind === 'chord'
        ? chordPitchClasses(preview.root, preview.quality)
        : scalePitchClasses(preview.root, preview.type);

    for (let s = track.stringCount; s >= 1; s--) {
      for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
        const midi = positionToMidi(tuning, { string: s as StringNumber, fret });
        const pc = pitchClassOf(midi);
        if (previewPcs.includes(pc)) {
          const isRoot = pc === preview.root;
          const label = makeLabel(pc, preview.root, opts.labels, opts.nameMode);
          pushFret(into, {
            string: s as StringNumber,
            fret,
            role: 'preview',
            isRoot,
            label,
          });
        }
      }
    }
  }

  return Array.from(into.values());
}

/**
 * Genera las marcas para el Piano en el Modo Canción (plan_fase3.md §7 C4).
 */
export function selectSongPianoMarks(
  state: SongState,
  options?: SongMarksOptions,
): KeyMark[] {
  const song = state.activeSong;
  if (!song || song.tracks.length === 0) return [];

  const track = song.tracks[state.activeTrackIndex] ?? song.tracks[0];
  if (!track || track.bars.length === 0) return [];

  const harmony = resolveActiveHarmony(state, options);
  if (!harmony) return [];

  const opts = {
    nameMode: options?.nameMode ?? 'sharps',
    labels: options?.labels ?? 'note',
    pianoRange: options?.pianoRange ?? DEFAULT_PIANO_RANGE,
  } as const;

  const { from, to } = opts.pianoRange;

  // 1. Capa Fondo de escala ('scale-bg') memorizada para evitar 40+ cálculos en cada pulso
  const bgKey = `${from}|${to}|${harmony.referenceRoot}|${harmony.scalePcs.join(',')}|${opts.labels}|${opts.nameMode}`;
  let baseMarks: Map<number, KeyMark>;

  if (lastPianoBgCache && lastPianoBgCache.key === bgKey) {
    baseMarks = lastPianoBgCache.marks;
  } else {
    baseMarks = new Map<number, KeyMark>();
    for (let midi = from; midi <= to; midi++) {
      const pc = pitchClassOf(midi);
      if (harmony.scalePcs.includes(pc)) {
        const isRoot = pc === harmony.referenceRoot;
        const label = makeLabel(pc, harmony.referenceRoot, opts.labels, opts.nameMode);
        pushKey(baseMarks, {
          midi,
          role: 'scale-bg',
          isRoot,
          label,
        });
      }
    }
    lastPianoBgCache = { key: bgKey, marks: baseMarks };
  }

  const into = new Map<number, KeyMark>(baseMarks);

  // 2. Capa Notas activas del pulso ('pinned')
  const activeBar =
    track.bars.find((b) => b.number === state.currentBar) ??
    track.bars[state.currentBar - 1] ??
    track.bars[0];

  const activeBeat =
    activeBar?.beats.find((b) => b.index === state.currentBeat) ??
    activeBar?.beats[state.currentBeat] ??
    activeBar?.beats[0];

  if (activeBeat && activeBeat.notes.length > 0) {
    for (const note of activeBeat.notes) {
      if (note.midi >= from && note.midi <= to) {
        const pc = note.pc;
        const isRoot = pc === harmony.referenceRoot;
        const label = makeLabel(pc, harmony.referenceRoot, opts.labels, opts.nameMode);
        pushKey(into, {
          midi: note.midi,
          role: 'pinned',
          isRoot,
          label,
        });
      }
    }
  }

  // 3. Capa Previsualización ('preview') si hay contexto activo en hover
  const preview = state.previewContext;
  if (preview) {
    const previewPcs =
      preview.kind === 'chord'
        ? chordPitchClasses(preview.root, preview.quality)
        : scalePitchClasses(preview.root, preview.type);

    for (let midi = from; midi <= to; midi++) {
      const pc = pitchClassOf(midi);
      if (previewPcs.includes(pc)) {
        const isRoot = pc === preview.root;
        const label = makeLabel(pc, preview.root, opts.labels, opts.nameMode);
        pushKey(into, {
          midi,
          role: 'preview',
          isRoot,
          label,
        });
      }
    }
  }

  return Array.from(into.values());
}
