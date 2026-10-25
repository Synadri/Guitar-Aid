import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  STANDARD_TUNING,
  relocatePosition,
  positionToMidi,
  midiToPositions,
  type FretPosition,
  type PitchClass,
  type ChordQualityId,
  type ScaleTypeId,
  type Tuning,
} from '../../theory';

/** Origen de una nota concreta: de dónde llegó a la selección. */
export type NoteOrigin = 'fretboard' | 'piano';

/** Nota concreta (con octava). `pinned` son las posiciones fijadas en el mástil. */
export interface SelectedNote {
  midi: number;
  pinned: FretPosition[];
  origin: NoteOrigin;
}

/** Acorde o escala de menú: clase de altura de la raíz + tipo (nunca notas MIDI). */
export type MenuContext =
  | { kind: 'chord'; root: PitchClass; quality: ChordQualityId }
  | { kind: 'scale'; root: PitchClass; type: ScaleTypeId };

export type SandboxLayer = 'notes' | 'context';

export interface SandboxState {
  tuning: Tuning;
  /** Modo "mostrar todas las posiciones" (activado por defecto). */
  showAllPositions: boolean;
  /** Capa `notes`, ordenada por inserción. Sin duplicados de `midi`. */
  notes: SelectedNote[];
  /** Capa `context`: acorde o escala del menú. */
  context: MenuContext | null;
  /** Índice del voicing elegido en `voicingsForChord(context, tuning)` (solo acordes). */
  voicingIndex: number;
  /** Capa `preview`: sugerencia temporal. */
  preview: MenuContext | null;
  /** Raíz fijada por el usuario (solo afecta a `notes`) o null = automática. */
  rootOverride: PitchClass | null;
  /** Última capa modificada o elegida con las pestañas. */
  focus: SandboxLayer | null;
  /** Notas que no existen en ninguna posición de la afinación actual (aviso). */
  unplayableMidis: number[];
}

export interface SandboxActions {
  /** Clic en una posición del mástil: la fija si estaba hueca/ausente; la desfija si estaba llena. */
  toggleFretPosition: (pos: FretPosition) => void;
  /** Clic en una tecla: la quita (con todas sus posiciones) si estaba activa; si no, la añade. */
  togglePianoKey: (midi: number) => void;
  setContext: (context: MenuContext | null) => void;
  setVoicingIndex: (index: number) => void;
  setPreview: (preview: MenuContext | null) => void;
  /** Convierte la previsualización en contexto. */
  applyPreview: () => void;
  setRootOverride: (pc: PitchClass | null) => void;
  /** Cambia la capa que analiza el panel de sugerencias (pestañas). */
  setFocus: (layer: SandboxLayer) => void;
  setShowAllPositions: (value: boolean) => void;
  /** Cambia de afinación conservando las notas y recolocando las posiciones fijadas. */
  setTuning: (tuning: Tuning) => void;
  /** Vacía todas las capas y la raíz fijada. */
  clear: () => void;
}

export type SandboxStore = SandboxState & SandboxActions;

const samePos = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;

/** Elimina posiciones repetidas conservando el orden. */
function uniquePositions(list: FretPosition[]): FretPosition[] {
  const out: FretPosition[] = [];
  for (const p of list) if (!out.some((q) => samePos(p, q))) out.push(p);
  return out;
}

/** Elige la capa de foco válida: si la preferida está vacía, la otra. */
export function resolveFocus(
  state: Pick<SandboxState, 'notes' | 'context' | 'focus'>,
): SandboxLayer | null {
  const hasNotes = state.notes.length > 0;
  const hasContext = state.context !== null;
  if (hasNotes && hasContext) return state.focus ?? 'context';
  if (hasNotes) return 'notes';
  if (hasContext) return 'context';
  return null;
}

export function initialSandboxState(overrides: Partial<SandboxState> = {}): SandboxState {
  return {
    tuning: STANDARD_TUNING,
    showAllPositions: true,
    notes: [],
    context: null,
    voicingIndex: 0,
    preview: null,
    rootOverride: null,
    focus: null,
    unplayableMidis: [],
    ...overrides,
  };
}

/** Crea un store independiente (útil en tests). La app usa `sandboxStore`. */
export function createSandboxStore(overrides: Partial<SandboxState> = {}): StoreApi<SandboxStore> {
  return createStore<SandboxStore>()((set) => ({
    ...initialSandboxState(overrides),

    toggleFretPosition: (pos) =>
      set((s) => {
        const midi = positionToMidi(s.tuning, pos);
        const existing = s.notes.find((n) => n.midi === midi);

        if (!existing) {
          return {
            notes: [...s.notes, { midi, pinned: [pos], origin: 'fretboard' }],
            focus: 'notes',
          };
        }
        if (!existing.pinned.some((p) => samePos(p, pos))) {
          return {
            notes: s.notes.map((n) => (n === existing ? { ...n, pinned: [...n.pinned, pos] } : n)),
            focus: 'notes',
          };
        }
        // Desfijar: si se queda sin posiciones y no vino del piano, sale de la selección.
        const pinned = existing.pinned.filter((p) => !samePos(p, pos));
        const notes =
          pinned.length === 0 && existing.origin === 'fretboard'
            ? s.notes.filter((n) => n !== existing)
            : s.notes.map((n) => (n === existing ? { ...n, pinned } : n));
        return { notes, focus: 'notes' };
      }),

    togglePianoKey: (midi) =>
      set((s) => {
        const exists = s.notes.some((n) => n.midi === midi);
        const notes: SelectedNote[] = exists
          ? s.notes.filter((n) => n.midi !== midi)
          : [...s.notes, { midi, pinned: [], origin: 'piano' }];
        const unplayableMidis = notes
          .filter((n) => midiToPositions(s.tuning, n.midi).length === 0)
          .map((n) => n.midi);
        return {
          notes,
          unplayableMidis,
          focus: 'notes',
        };
      }),

    setContext: (context) =>
      set({ context, voicingIndex: 0, ...(context ? { focus: 'context' as const } : {}) }),

    setVoicingIndex: (voicingIndex) => set({ voicingIndex: Math.max(0, voicingIndex) }),

    setPreview: (preview) => set({ preview }),

    applyPreview: () =>
      set((s) =>
        s.preview ? { context: s.preview, voicingIndex: 0, preview: null, focus: 'context' } : s,
      ),

    setRootOverride: (rootOverride) => set({ rootOverride }),

    setFocus: (focus) => set({ focus }),

    setShowAllPositions: (showAllPositions) => set({ showAllPositions }),

    setTuning: (tuning) =>
      set((s) => {
        const unplayable: number[] = [];
        const notes = s.notes.map((n) => {
          if (midiToPositions(tuning, n.midi).length === 0) unplayable.push(n.midi);
          const pinned = n.pinned.flatMap((p) => {
            const moved = relocatePosition(tuning, n.midi, p);
            return moved ? [moved] : [];
          });
          return { ...n, pinned: uniquePositions(pinned) };
        });
        return { tuning, notes, voicingIndex: 0, unplayableMidis: unplayable };
      }),

    clear: () =>
      set({
        notes: [],
        context: null,
        preview: null,
        rootOverride: null,
        focus: null,
        voicingIndex: 0,
        unplayableMidis: [],
      }),
  }));
}

/** Store singleton de la aplicación. En React: `useStore(sandboxStore, selector)`. */
export const sandboxStore = createSandboxStore();
