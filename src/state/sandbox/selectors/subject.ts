import {
  chordName,
  detectChords,
  getScaleType,
  midiToName,
  pcName,
  pitchClassOf,
  toWeightedPcs,
  type Candidate,
  type ChordRef,
  type NameMode,
  type PitchClass,
  type ScaleRef,
} from '../../../theory';
import { resolveFocus, type SandboxLayer, type SandboxState } from '../store';
import { contextTitle } from './info';
import { effectiveNotesRoot } from './marks';

interface SubjectBase {
  /** Capa analizada. */
  layer: SandboxLayer;
  origin: 'menu' | 'notes';
  /** Cabecera del panel, p. ej. "Analizando: A pentatónica menor (menú)". */
  description: string;
  /** Capas con contenido: si hay dos, la UI muestra pestañas. */
  availableLayers: SandboxLayer[];
}

export type SuggestionSubject =
  | { kind: 'none'; availableLayers: SandboxLayer[] }
  | (SubjectBase & { kind: 'note'; pc: PitchClass; midi: number })
  | (SubjectBase & {
      kind: 'chord';
      /** Menú: un único candidato. Notas: los candidatos de `detectChords` sin elegir. */
      candidates: Candidate<ChordRef>[];
    })
  | (SubjectBase & { kind: 'scale'; scale: ScaleRef })
  | (SubjectBase & { kind: 'unrecognized'; pcs: PitchClass[] });

type SubjectState = Pick<SandboxState, 'notes' | 'context' | 'focus' | 'rootOverride'>;

/** Qué debe analizar el panel de sugerencias: la última capa modificada. */
export function suggestionSubject(
  state: SubjectState,
  mode: NameMode = 'sharps',
): SuggestionSubject {
  const availableLayers: SandboxLayer[] = [];
  if (state.notes.length > 0) availableLayers.push('notes');
  if (state.context) availableLayers.push('context');

  const layer = resolveFocus(state);
  if (layer === null) return { kind: 'none', availableLayers };

  if (layer === 'context') {
    const ctx = state.context!;
    const description = `Analizando: ${contextTitle(ctx, mode)} (menú)`;
    const base = { layer, origin: 'menu' as const, description, availableLayers };
    if (ctx.kind === 'scale') {
      const scale: ScaleRef = {
        tonic: ctx.root,
        type: ctx.type,
        name: `${pcName(ctx.root, mode)} ${getScaleType(ctx.type).name}`,
      };
      return { ...base, kind: 'scale', scale };
    }
    const chord: ChordRef = {
      root: ctx.root,
      quality: ctx.quality,
      name: chordName(ctx, mode),
    };
    return { ...base, kind: 'chord', candidates: [{ value: chord, score: 1, reasons: [] }] };
  }

  const sorted = [...state.notes].sort((a, b) => a.midi - b.midi);
  const names = sorted.map((n) => midiToName(n.midi, mode)).join(' ');
  const base = {
    layer,
    origin: 'notes' as const,
    description: `Analizando: notas pulsadas ${names}`,
    availableLayers,
  };
  const pcs = [...new Set(sorted.map((n) => pitchClassOf(n.midi)))];

  if (pcs.length === 1) return { ...base, kind: 'note', pc: pcs[0]!, midi: sorted[0]!.midi };

  const candidates = detectChords(
    { notes: toWeightedPcs(pcs), root: effectiveNotesRoot(state) },
    mode,
  );
  if (candidates.length === 0) return { ...base, kind: 'unrecognized', pcs };
  return { ...base, kind: 'chord', candidates };
}
