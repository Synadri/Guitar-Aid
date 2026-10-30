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
  midiToPositions,
  pcInterval,
  pcName,
  pitchClassOf,
  scaleParentContext,
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
import type { ChordFocus, MenuContext, SandboxState } from '../store';
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
  /** Subtítulo con relación de escala madre, relativa o simetría (solo escalas). */
  subtitle?: string;
  root: { pc: PitchClass; name: string };
  /** Clases de altura (no notas MIDI) con intervalo y grado respecto a la tónica. */
  tones: ContextTone[];
  /** Solo acordes: voicing elegido y cuántos hay (0 = mostrar el acorde en todo el mástil). */
  voicing: { index: number; count: number; current: Voicing | null } | null;
}

export interface ChordFocusInfo {
  title: string;
  degree?: string;
  root: { pc: PitchClass; name: string };
  tones: ContextTone[];
}

export interface InfoPanelModel {
  notes: NotesInfo | null;
  context: ContextInfo | null;
  /** Información del acorde enfocado sobre una escala o progresión (si está activo). */
  chordFocus?: ChordFocusInfo | null;
  /** Notas de la selección que no existen en la afinación actual (nombres). */
  unplayableNotes: string[];
}

type InfoState = Pick<
  SandboxState,
  'tuning' | 'notes' | 'context' | 'rootOverride' | 'voicingIndex' | 'unplayableMidis'
> & {
  chordFocus?: ChordFocus | null;
};

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
  let subtitle: string | undefined;

  if (ctx.kind === 'chord') {
    const list = contextVoicings(state);
    const index = list.length === 0 ? 0 : Math.min(state.voicingIndex, list.length - 1);
    voicing = { index, count: list.length, current: list[index] ?? null };
  } else {
    const title = contextTitle(ctx, mode);
    const parentCtx = scaleParentContext({ tonic: ctx.root, type: ctx.type, name: title }, mode);
    const scaleType = getScaleType(ctx.type);
    if (parentCtx) {
      subtitle = parentCtx.description;
    } else if (scaleType.family === 'diminished') {
      const symNotes = [0, 3, 6, 9]
        .map((off) => pcName(pitchClassOf(ctx.root + off), mode))
        .join(', ');
      subtitle = `Simétrica (${symNotes}: las 4 tónicas a 3 semitonos comparten las 8 notas)`;
    } else if (scaleType.relative) {
      const relTonic = pcName(pitchClassOf(ctx.root + scaleType.relative.offset), mode);
      const relName = getScaleType(scaleType.relative.type).name.toLowerCase();
      subtitle = `Relativa de ${relTonic} ${relName}`;
    }
  }

  return {
    context: ctx,
    title: contextTitle(ctx, mode),
    ...(subtitle ? { subtitle } : {}),
    root: { pc: ctx.root, name: pcName(ctx.root, mode) },
    tones,
    voicing,
  };
}

/** Modelo del panel de información (ambas capas; la UI decide cómo mostrarlas). */
export function infoPanelModel(state: InfoState, mode: NameMode = 'sharps'): InfoPanelModel {
  const active = new Set(state.notes.map((n) => n.midi));
  const unplayableSet = new Set(state.unplayableMidis.filter((m) => active.has(m)));
  for (const n of state.notes) {
    if (midiToPositions(state.tuning, n.midi).length === 0) {
      unplayableSet.add(n.midi);
    }
  }

  let chordFocus: ChordFocusInfo | null = null;
  if (state.chordFocus) {
    const cf = state.chordFocus;
    chordFocus = {
      title: chordName(cf.chord, mode),
      ...(cf.degree ? { degree: cf.degree } : {}),
      root: { pc: cf.chord.root, name: pcName(cf.chord.root, mode) },
      tones: chordTones(cf.chord.root, cf.chord.quality, mode).map((t) => ({
        pc: t.pc,
        name: t.name,
        interval: {
          semitones: t.semitones,
          short: t.interval,
          long: t.intervalLong,
          degree: t.degree,
        },
      })),
    };
  }

  return {
    notes: notesInfo(state, mode),
    context: contextInfo(state, mode),
    chordFocus,
    unplayableNotes: [...unplayableSet].map((m) => midiToName(m, mode)),
  };
}
