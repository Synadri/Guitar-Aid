import {
  chordName,
  chordTones,
  degreeName,
  detectChords,
  getScaleType,
  intervalLongName,
  intervalName,
  midiInterval,
  midiToName,
  pcInterval,
  pcName,
  pitchClassOf,
  scalePitchClasses,
  toWeightedPcs,
  type Candidate,
  type ChordRef,
  type Degree,
  type IntervalLongName,
  type NameMode,
  type PitchClass,
  type Voicing,
} from '../../../theory';
import type { MenuContext, SandboxState } from '../store';
import { contextVoicings, effectiveNotesRoot } from './marks';

export interface IntervalInfo {
  /** Semitonos (puede superar 12 entre notas consecutivas). */
  semitones: number;
  short: string;
  long: IntervalLongName;
  degree: Degree;
}

export interface NoteRow {
  midi: number;
  pc: PitchClass;
  name: string;
  /** Intervalo con la nota anterior (de grave a aguda); null en la más grave. */
  fromPrevious: IntervalInfo | null;
  /** Intervalo de la clase de altura respecto a la raíz efectiva. */
  fromRoot: IntervalInfo | null;
}

export interface NotesInfo {
  /** Notas concretas de grave a aguda. */
  rows: NoteRow[];
  root: { pc: PitchClass; name: string } | null;
  /** 'manual' si la fijó el usuario; 'auto' = nota más grave. */
  rootMode: 'auto' | 'manual';
  /** Acordes candidatos ordenados (la raíz ordena, no filtra). Vacío = no reconocido. */
  chords: Candidate<ChordRef>[];
  chordRecognized: boolean;
}

export interface ContextTone {
  pc: PitchClass;
  name: string;
  interval: IntervalInfo;
}

export interface ContextInfo {
  context: MenuContext;
  /** Nombre legible, p. ej. "Am7" o "A pentatónica menor". */
  title: string;
  root: { pc: PitchClass; name: string };
  /** Clases de altura (no notas MIDI) con intervalo y grado respecto a la tónica. */
  tones: ContextTone[];
  /** Solo acordes: voicing elegido y cuántos hay (0 = mostrar el acorde en todo el mástil). */
  voicing: { index: number; count: number; current: Voicing | null } | null;
}

export interface InfoPanelModel {
  notes: NotesInfo | null;
  context: ContextInfo | null;
  /** Notas de la selección que no existen en la afinación actual (nombres). */
  unplayableNotes: string[];
}

type InfoState = Pick<
  SandboxState,
  'tuning' | 'notes' | 'context' | 'rootOverride' | 'voicingIndex' | 'unplayableMidis'
>;

function intervalInfo(semitones: number): IntervalInfo {
  return {
    semitones,
    short: intervalName(semitones),
    long: intervalLongName(semitones),
    degree: degreeName(semitones),
  };
}

/** Nombre legible de un acorde o escala de menú. */
export function contextTitle(ctx: MenuContext, mode: NameMode = 'sharps'): string {
  return ctx.kind === 'chord'
    ? chordName(ctx, mode)
    : `${pcName(ctx.root, mode)} ${getScaleType(ctx.type).name.toLowerCase()}`;
}

export function notesInfo(state: InfoState, mode: NameMode = 'sharps'): NotesInfo | null {
  if (state.notes.length === 0) return null;
  const sorted = [...state.notes].sort((a, b) => a.midi - b.midi);
  const root = effectiveNotesRoot(state)!;

  const rows: NoteRow[] = sorted.map((n, i) => {
    const pc = pitchClassOf(n.midi);
    const prev = sorted[i - 1];
    return {
      midi: n.midi,
      pc,
      name: midiToName(n.midi, mode),
      fromPrevious: prev ? intervalInfo(midiInterval(prev.midi, n.midi)) : null,
      fromRoot: intervalInfo(pcInterval(root, pc)),
    };
  });

  const uniquePcs = [...new Set(rows.map((r) => r.pc))];
  const chords = detectChords({ notes: toWeightedPcs(uniquePcs), root }, mode);
  return {
    rows,
    root: { pc: root, name: pcName(root, mode) },
    rootMode: state.rootOverride === null ? 'auto' : 'manual',
    chords,
    chordRecognized: chords.length > 0,
  };
}

export function contextInfo(state: InfoState, mode: NameMode = 'sharps'): ContextInfo | null {
  const ctx = state.context;
  if (!ctx) return null;

  const tones: ContextTone[] =
    ctx.kind === 'chord'
      ? chordTones(ctx.root, ctx.quality, mode).map((t) => ({
          pc: t.pc,
          name: t.name,
          interval: {
            semitones: t.semitones,
            short: t.interval,
            long: t.intervalLong,
            degree: t.degree,
          },
        }))
      : scalePitchClasses(ctx.root, ctx.type).map((pc) => ({
          pc,
          name: pcName(pc, mode),
          interval: intervalInfo(pcInterval(ctx.root, pc)),
        }));

  let voicing: ContextInfo['voicing'] = null;
  if (ctx.kind === 'chord') {
    const list = contextVoicings(state);
    const index = list.length === 0 ? 0 : Math.min(state.voicingIndex, list.length - 1);
    voicing = { index, count: list.length, current: list[index] ?? null };
  }

  return {
    context: ctx,
    title: contextTitle(ctx, mode),
    root: { pc: ctx.root, name: pcName(ctx.root, mode) },
    tones,
    voicing,
  };
}

/** Modelo del panel de información (ambas capas; la UI decide cómo mostrarlas). */
export function infoPanelModel(state: InfoState, mode: NameMode = 'sharps'): InfoPanelModel {
  const active = new Set(state.notes.map((n) => n.midi));
  return {
    notes: notesInfo(state, mode),
    context: contextInfo(state, mode),
    unplayableNotes: state.unplayableMidis
      .filter((m) => active.has(m))
      .map((m) => midiToName(m, mode)),
  };
}
