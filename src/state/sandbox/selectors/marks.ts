import {
  DEFAULT_FRETS,
  chordPitchClasses,
  degreeName,
  intervalName,
  pcInterval,
  pcName,
  pcsToMask,
  pitchClassOf,
  positionToMidi,
  scalePitchClasses,
  voicingsForChord,
  type FretPosition,
  type NameMode,
  type PitchClass,
  type StringNumber,
  type Tuning,
  type Voicing,
} from '../../../theory';
import type { ChordFocus, MenuContext, SandboxState, SelectedNote } from '../store';
import {
  DEFAULT_PIANO_RANGE,
  ROLE_PRIORITY,
  type FretMark,
  type KeyMark,
  type LabelMode,
  type MarksOptions,
  type MarkRole,
} from '../../shared/marks';

export {
  DEFAULT_PIANO_RANGE,
  ROLE_PRIORITY,
  type FretMark,
  type KeyMark,
  type LabelMode,
  type MarksOptions,
  type MarkRole,
};

type SandboxView = Pick<
  SandboxState,
  'tuning' | 'showAllPositions' | 'notes' | 'context' | 'voicingIndex' | 'preview' | 'rootOverride'
> & {
  chordFocus?: ChordFocus | null;
};

/** Raíz efectiva de la capa `notes`: la fijada por el usuario o la nota más grave. */
export function effectiveNotesRoot(
  state: Pick<SandboxState, 'notes' | 'rootOverride'>,
): PitchClass | undefined {
  if (state.rootOverride !== null) return state.rootOverride;
  if (state.notes.length === 0) return undefined;
  return pitchClassOf(Math.min(...state.notes.map((n) => n.midi)));
}

/** Clases de altura de un contexto de menú. */
export function contextPitchClasses(ctx: MenuContext): PitchClass[] {
  return ctx.kind === 'chord'
    ? chordPitchClasses(ctx.root, ctx.quality)
    : scalePitchClasses(ctx.root, ctx.type);
}

/** Voicings del acorde de menú en la afinación actual ([] si no es acorde o no hay ninguno). */
export function contextVoicings(state: Pick<SandboxState, 'context' | 'tuning'>): Voicing[] {
  const ctx = state.context;
  if (!ctx || ctx.kind !== 'chord') return [];
  return voicingsForChord({ root: ctx.root, quality: ctx.quality }, state.tuning);
}

/** Voicing elegido (índice acotado) o null si no hay ninguno válido en esta afinación. */
export function selectedVoicing(
  state: Pick<SandboxState, 'context' | 'tuning' | 'voicingIndex'>,
): Voicing | null {
  const list = contextVoicings(state);
  if (list.length === 0) return null;
  return list[Math.min(state.voicingIndex, list.length - 1)] ?? null;
}

/** Voicings del acorde en foco en la afinación actual ([] si no hay foco o no hay ninguno). */
export function chordFocusVoicings(state: {
  chordFocus?: ChordFocus | null;
  tuning: Tuning;
}): Voicing[] {
  const cf = state.chordFocus;
  if (!cf) return [];
  return voicingsForChord(cf.chord, state.tuning);
}

/** Voicing elegido del acorde en foco (índice acotado) o null si no hay ninguno válido. */
export function selectedChordFocusVoicing(state: {
  chordFocus?: ChordFocus | null;
  tuning: Tuning;
}): Voicing | null {
  const cf = state.chordFocus;
  if (!cf) return null;
  const list = chordFocusVoicings(state);
  if (list.length === 0) return null;
  const index = Math.max(0, Math.min(cf.voicingIndex, list.length - 1));
  return list[index] ?? null;
}

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

function allPositionsOf(tuning: Tuning, pcs: readonly PitchClass[]): FretPosition[] {
  const mask = pcsToMask(pcs);
  const out: FretPosition[] = [];
  for (let s = tuning.strings.length; s >= 1; s--) {
    for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
      const midi = positionToMidi(tuning, { string: s as StringNumber, fret });
      if (mask & (1 << pitchClassOf(midi))) out.push({ string: s as StringNumber, fret });
    }
  }
  return out;
}

function keysOf(pcs: readonly PitchClass[], range: { from: number; to: number }): number[] {
  const mask = pcsToMask(pcs);
  const out: number[] = [];
  for (let m = range.from; m <= range.to; m++) if (mask & (1 << pitchClassOf(m))) out.push(m);
  return out;
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

const withLabel = <T extends object>(mark: T, label: string | undefined): T =>
  label === undefined ? mark : { ...mark, label };

const withRootFlag = <T extends object>(mark: T, isRoot: boolean): T =>
  isRoot ? { ...mark, isRoot: true } : mark;

function noteMarksFret(
  note: SelectedNote,
  state: SandboxView,
  root: PitchClass | undefined,
  explicitRootPc: PitchClass | undefined,
  opts: Required<Pick<MarksOptions, 'nameMode' | 'labels'>>,
  into: Map<string, FretMark>,
): void {
  const pc = pitchClassOf(note.midi);
  const label = makeLabel(pc, root, opts.labels, opts.nameMode);
  const isRoot = explicitRootPc !== undefined && pc === explicitRootPc;
  for (const p of note.pinned) {
    pushFret(
      into,
      withRootFlag(
        withLabel({ string: p.string, fret: p.fret, role: 'pinned' as const }, label),
        isRoot,
      ),
    );
  }
  if (!state.showAllPositions) return;
  for (let s = state.tuning.strings.length; s >= 1; s--) {
    const fret = note.midi - positionToMidi(state.tuning, { string: s as StringNumber, fret: 0 });
    if (fret < 0 || fret > DEFAULT_FRETS) continue;
    pushFret(
      into,
      withLabel({ string: s as StringNumber, fret, role: 'equivalent' as const }, label),
    );
  }
}

/** Marcas del mástil (todas las capas superpuestas, sin posiciones duplicadas). */
export function fretboardMarks(state: SandboxView, options: MarksOptions = {}): FretMark[] {
  const opts = {
    nameMode: options.nameMode ?? 'sharps',
    labels: options.labels ?? 'note',
  } as const;
  const into = new Map<string, FretMark>();

  // Capa notes.
  const notesRoot = effectiveNotesRoot(state);
  const explicitRootPc: PitchClass | undefined =
    state.chordFocus?.chord.root ??
    state.context?.root ??
    (state.rootOverride !== null ? state.rootOverride : undefined);
  for (const n of state.notes) noteMarksFret(n, state, notesRoot, explicitRootPc, opts, into);

  // Capa context.
  const ctx = state.context;
  const cf = state.chordFocus;

  if (ctx) {
    const pcs = contextPitchClasses(ctx);
    if (ctx.kind === 'scale') {
      const label = (pc: PitchClass) => makeLabel(pc, ctx.root, opts.labels, opts.nameMode);
      for (const p of allPositionsOf(state.tuning, pcs)) {
        const pc = pitchClassOf(positionToMidi(state.tuning, p));
        const role: MarkRole = cf ? 'scale-bg' : pc === ctx.root ? 'root' : 'tone';
        pushFret(into, withLabel({ string: p.string, fret: p.fret, role }, label(pc)));
      }
    } else if (ctx.kind === 'chord') {
      if (!cf) {
        const voicing = selectedVoicing(state);
        const label = (pc: PitchClass) => makeLabel(pc, ctx.root, opts.labels, opts.nameMode);
        const positions = voicing ? voicing.positions : allPositionsOf(state.tuning, pcs);
        for (const p of positions) {
          const pc = pitchClassOf(positionToMidi(state.tuning, p));
          const role: MarkRole = pc === ctx.root ? 'root' : 'tone';
          pushFret(into, withLabel({ string: p.string, fret: p.fret, role }, label(pc)));
        }
      }
    }
  }

  // Capa chordFocus (si existe).
  if (cf) {
    const chordPcs = chordPitchClasses(cf.chord.root, cf.chord.quality);
    const label = (pc: PitchClass) => makeLabel(pc, cf.chord.root, opts.labels, opts.nameMode);
    if (cf.mode === 'voicing') {
      const voicing = selectedChordFocusVoicing(state);
      const positions = voicing ? voicing.positions : allPositionsOf(state.tuning, chordPcs);
      for (const p of positions) {
        const pc = pitchClassOf(positionToMidi(state.tuning, p));
        const role: MarkRole = pc === cf.chord.root ? 'root' : 'tone';
        pushFret(into, withLabel({ string: p.string, fret: p.fret, role }, label(pc)));
      }
    } else {
      const positions = allPositionsOf(state.tuning, chordPcs);
      for (const p of positions) {
        const pc = pitchClassOf(positionToMidi(state.tuning, p));
        const role: MarkRole = pc === cf.chord.root ? 'root' : 'tone';
        pushFret(into, withLabel({ string: p.string, fret: p.fret, role }, label(pc)));
      }
    }
  }

  // Capa preview.
  if (state.preview) {
    const pv = state.preview;
    for (const p of allPositionsOf(state.tuning, contextPitchClasses(pv))) {
      const pc = pitchClassOf(positionToMidi(state.tuning, p));
      pushFret(
        into,
        withLabel(
          { string: p.string, fret: p.fret, role: 'preview' as const },
          makeLabel(pc, pv.root, opts.labels, opts.nameMode),
        ),
      );
    }
  }

  return [...into.values()];
}

/** Marcas del piano (todas las capas superpuestas, sin teclas duplicadas). */
export function pianoMarks(state: SandboxView, options: MarksOptions = {}): KeyMark[] {
  const opts = {
    nameMode: options.nameMode ?? 'sharps',
    labels: options.labels ?? 'note',
  } as const;
  const range = options.pianoRange ?? DEFAULT_PIANO_RANGE;
  const into = new Map<number, KeyMark>();

  const notesRoot = effectiveNotesRoot(state);
  const explicitRootPc: PitchClass | undefined =
    state.chordFocus?.chord.root ??
    state.context?.root ??
    (state.rootOverride !== null ? state.rootOverride : undefined);
  for (const n of state.notes) {
    const pc = pitchClassOf(n.midi);
    const isRoot = explicitRootPc !== undefined && pc === explicitRootPc;
    pushKey(
      into,
      withRootFlag(
        withLabel(
          { midi: n.midi, role: 'pinned' as const },
          makeLabel(pc, notesRoot, opts.labels, opts.nameMode),
        ),
        isRoot,
      ),
    );
  }

  const ctx = state.context;
  const cf = state.chordFocus;

  if (ctx) {
    if (ctx.kind === 'scale') {
      const pcs = contextPitchClasses(ctx);
      const label = (pc: PitchClass) => makeLabel(pc, ctx.root, opts.labels, opts.nameMode);
      for (const midi of keysOf(pcs, range)) {
        const pc = pitchClassOf(midi);
        const role: MarkRole = cf ? 'scale-bg' : pc === ctx.root ? 'root' : 'tone';
        pushKey(into, withLabel({ midi, role }, label(pc)));
      }
    } else if (ctx.kind === 'chord') {
      if (!cf) {
        const voicing = selectedVoicing(state);
        const midis = voicing ? voicing.midis : keysOf(contextPitchClasses(ctx), range);
        for (const midi of midis) {
          const pc = pitchClassOf(midi);
          pushKey(
            into,
            withLabel(
              { midi, role: pc === ctx.root ? ('root' as const) : ('tone' as const) },
              makeLabel(pc, ctx.root, opts.labels, opts.nameMode),
            ),
          );
        }
      }
    }
  }

  // Capa chordFocus (si existe).
  if (cf) {
    const chordPcs = chordPitchClasses(cf.chord.root, cf.chord.quality);
    const label = (pc: PitchClass) => makeLabel(pc, cf.chord.root, opts.labels, opts.nameMode);
    if (cf.mode === 'voicing') {
      const voicing = selectedChordFocusVoicing(state);
      const midis = voicing ? voicing.midis : keysOf(chordPcs, range);
      for (const midi of midis) {
        const pc = pitchClassOf(midi);
        pushKey(
          into,
          withLabel(
            { midi, role: pc === cf.chord.root ? ('root' as const) : ('tone' as const) },
            label(pc),
          ),
        );
      }
    } else {
      for (const midi of keysOf(chordPcs, range)) {
        const pc = pitchClassOf(midi);
        pushKey(
          into,
          withLabel(
            { midi, role: pc === cf.chord.root ? ('root' as const) : ('tone' as const) },
            label(pc),
          ),
        );
      }
    }
  }

  if (state.preview) {
    const pv = state.preview;
    for (const midi of keysOf(contextPitchClasses(pv), range)) {
      pushKey(
        into,
        withLabel(
          { midi, role: 'preview' as const },
          makeLabel(pitchClassOf(midi), pv.root, opts.labels, opts.nameMode),
        ),
      );
    }
  }

  return [...into.values()].sort((a, b) => a.midi - b.midi);
}
