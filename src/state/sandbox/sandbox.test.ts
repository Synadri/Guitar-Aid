import { describe, expect, it } from 'vitest';
import {
  chordName,
  getTuning,
  nameToMidi,
  positionToMidi,
  STANDARD_TUNING,
  type ChordQualityId,
  type ChordRef,
  type PitchClass,
} from '../../theory';
import {
  createSandboxStore,
  contextVoicings,
  fretboardMarks,
  infoPanelModel,
  pianoMarks,
  suggestionSubject,
} from '.';

const midi = (n: string) => nameToMidi(n)!;
const dropD = getTuning('dropD')!;
const pos = (string: 1 | 2 | 3 | 4 | 5 | 6, fret: number) => ({ string, fret });
const chord = (
  root: PitchClass,
  quality: ChordQualityId,
  name = chordName({ root, quality }),
): ChordRef => ({
  root,
  quality,
  name,
});

function fresh() {
  const store = createSandboxStore();
  return { store, get: () => store.getState() };
}

describe('capa notes: clic en guitarra y piano', () => {
  it('criterio 1: cuerda 5, traste 7 → E3 fijada, el piano la marca y la etiqueta es E', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7));
    expect(get().notes).toEqual([{ midi: midi('E3'), pinned: [pos(5, 7)], origin: 'fretboard' }]);
    expect(pianoMarks(get())).toEqual([{ midi: midi('E3'), role: 'pinned', label: 'E' }]);
    const fret = fretboardMarks(get()).find((m) => m.string === 5 && m.fret === 7);
    expect(fret).toMatchObject({ role: 'pinned', label: 'E' });
  });

  it('fijar una posición hueca la pasa a llena y desfijarla vuelve a hueca/quita la nota', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('E3')); // viene del piano: solo huecas
    expect(fretboardMarks(get()).every((m) => m.role === 'equivalent')).toBe(true);
    get().toggleFretPosition(pos(5, 7));
    expect(fretboardMarks(get()).filter((m) => m.role === 'pinned')).toHaveLength(1);
    get().toggleFretPosition(pos(4, 2)); // otra posición de E3, también se fija
    expect(get().notes[0]!.pinned).toHaveLength(2);
    get().toggleFretPosition(pos(5, 7));
    get().toggleFretPosition(pos(4, 2));
    // sin posiciones fijadas pero originada en el piano: sigue seleccionada
    expect(get().notes).toEqual([{ midi: midi('E3'), pinned: [], origin: 'piano' }]);
  });

  it('una nota originada en la guitarra sale al desfijar su última posición', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7));
    get().toggleFretPosition(pos(5, 7));
    expect(get().notes).toEqual([]);
  });

  it('clic en una tecla activa quita la nota con todas sus posiciones', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7));
    get().toggleFretPosition(pos(4, 2));
    get().togglePianoKey(midi('E3'));
    expect(get().notes).toEqual([]);
    expect(fretboardMarks(get())).toEqual([]);
  });

  it('criterio 2: con "mostrar todas" las equivalentes salen huecas; sin él, solo las fijadas', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('E3'));
    const all = fretboardMarks(get());
    // E3 en estándar: cuerda 5 traste 7, cuerda 4 traste 2, cuerda 6 traste 12
    expect(all.map((m) => `${m.string}:${m.fret}`).sort()).toEqual(['4:2', '5:7', '6:12']);
    expect(all.every((m) => m.role === 'equivalent')).toBe(true);
    get().setShowAllPositions(false);
    expect(fretboardMarks(get())).toEqual([]);
    get().toggleFretPosition(pos(5, 7));
    expect(fretboardMarks(get())).toHaveLength(1);
  });
});

describe('capa context y preview', () => {
  it('criterio 6: la escala ilumina todo el mástil con la tónica como raíz', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 9, type: 'minorPentatonic' });
    const marks = fretboardMarks(get());
    const pcs = new Set(marks.map((m) => positionToMidi(STANDARD_TUNING, m) % 12));
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
    expect(marks.find((m) => m.string === 6 && m.fret === 5)).toMatchObject({ role: 'root' });
    // 5 clases de altura, no 35 notas: el panel lista 5
    expect(infoPanelModel(get()).context!.tones).toHaveLength(5);
    expect(get().notes).toEqual([]);
  });

  it('criterio 3: Am7 muestra A C E G en ambos instrumentos con sus intervalos', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    const info = infoPanelModel(get()).context!;
    expect(info.tones.map((t) => [t.name, t.interval.long])).toEqual([
      ['A', 'fundamental'],
      ['C', '3ª menor'],
      ['E', '5ª justa'],
      ['G', '7ª menor'],
    ]);
    expect(info.voicing!.count).toBeGreaterThan(0);
    const keyPcs = new Set(pianoMarks(get()).map((m) => m.midi % 12));
    expect([...keyPcs].sort((a, b) => a - b)).toEqual([0, 4, 7, 9]);
    const fretPcs = new Set(
      fretboardMarks(get()).map((m) => positionToMidi(STANDARD_TUNING, m) % 12),
    );
    expect([...fretPcs].sort((a, b) => a - b)).toEqual([0, 4, 7, 9]);
  });

  it('con un voicing elegido solo se dibuja su forma, aunque "mostrar todas" esté activo', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    expect(get().showAllPositions).toBe(true);
    const voicing = contextVoicings(get())[0]!;
    const marks = fretboardMarks(get());
    expect(marks.map((m) => `${m.string}:${m.fret}`).sort()).toEqual(
      voicing.positions.map((p) => `${p.string}:${p.fret}`).sort(),
    );
    expect(marks.some((m) => m.role === 'equivalent')).toBe(false);
  });

  it('el voicing elegido cambia las marcas y se reinicia al cambiar de acorde', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    get().setShowAllPositions(false);
    const first = fretboardMarks(get());
    get().setVoicingIndex(1);
    expect(fretboardMarks(get())).not.toEqual(first);
    get().setContext({ kind: 'chord', root: 0, quality: 'maj' });
    expect(get().voicingIndex).toBe(0);
  });

  it('en una afinación abierta (sin voicings) el acorde se muestra en todo el mástil', () => {
    const { get } = fresh();
    get().setTuning(getTuning('openG')!);
    get().setContext({ kind: 'chord', root: 0, quality: 'maj' });
    expect(infoPanelModel(get()).context!.voicing).toMatchObject({ count: 0, current: null });
    expect(fretboardMarks(get()).length).toBeGreaterThan(6);
  });

  it('preview se dibuja con su rol y no pisa las marcas reales; applyPreview lo convierte en contexto', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7)); // E3
    get().setPreview({ kind: 'scale', root: 4, type: 'minor' });
    const marks = fretboardMarks(get());
    expect(marks.find((m) => m.string === 5 && m.fret === 7)!.role).toBe('pinned');
    expect(marks.some((m) => m.role === 'preview')).toBe(true);
    expect(pianoMarks(get()).some((m) => m.role === 'preview')).toBe(true);
    get().applyPreview();
    expect(get().preview).toBeNull();
    expect(get().context).toEqual({ kind: 'scale', root: 4, type: 'minor' });
  });
  it('criterio (a) Fase 1.1: en piano y mástil se distinguen pinned, tone y root, y cuando una nota pulsada coincide con la tónica conserva pinned + isRoot', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 0, type: 'major' });
    // Pulsamos C4 (tónica de C mayor, MIDI 60) y F#4 (ajena, MIDI 66) en el piano, y C3 (5, 3) en guitarra
    get().togglePianoKey(midi('C4'));
    get().togglePianoKey(midi('F#4'));
    get().toggleFretPosition(pos(5, 3)); // C3

    const pMarks = pianoMarks(get());
    const c4Mark = pMarks.find((m) => m.midi === midi('C4'))!;
    const fSharp4Mark = pMarks.find((m) => m.midi === midi('F#4'))!;
    const e4Mark = pMarks.find((m) => m.midi === midi('E4'))!;
    const c5Mark = pMarks.find((m) => m.midi === midi('C5'))!;

    // C4 fue pulsada y además es la tónica de C mayor: role 'pinned' + isRoot: true
    expect(c4Mark).toMatchObject({ midi: midi('C4'), role: 'pinned', isRoot: true });
    // F#4 fue pulsada y no es tónica: role 'pinned' sin isRoot
    expect(fSharp4Mark).toMatchObject({ midi: midi('F#4'), role: 'pinned' });
    expect(fSharp4Mark.isRoot).toBeUndefined();
    // E4 pertenece a la escala pero no fue pulsada: role 'tone'
    expect(e4Mark).toMatchObject({ midi: midi('E4'), role: 'tone' });
    // C5 es la tónica de la escala pero no fue pulsada: role 'root'
    expect(c5Mark).toMatchObject({ midi: midi('C5'), role: 'root' });

    // En el mástil, (5, 3) es C3 fijada y tónica: role 'pinned' + isRoot: true
    const fMarks = fretboardMarks(get());
    const pos53Mark = fMarks.find((m) => m.string === 5 && m.fret === 3)!;
    expect(pos53Mark).toMatchObject({ string: 5, fret: 3, role: 'pinned', isRoot: true });
  });
});

describe('raíz', () => {
  it('automática = nota más grave; el desplegable la fija aunque no esté pulsada', () => {
    const { get } = fresh();
    for (const n of ['G3', 'C3', 'E3']) get().togglePianoKey(midi(n));
    expect(infoPanelModel(get()).notes).toMatchObject({ rootMode: 'auto', root: { name: 'C' } });
    get().setRootOverride(9);
    expect(infoPanelModel(get()).notes).toMatchObject({ rootMode: 'manual', root: { name: 'A' } });
    get().setRootOverride(null);
    expect(infoPanelModel(get()).notes!.root!.name).toBe('C');
  });

  it('el panel lista notas de grave a aguda con intervalos consecutivos y respecto a la raíz', () => {
    const { get } = fresh();
    for (const n of ['G3', 'C3', 'E3']) get().togglePianoKey(midi(n));
    const rows = infoPanelModel(get()).notes!.rows;
    expect(rows.map((r) => r.name)).toEqual(['C3', 'E3', 'G3']);
    expect(rows.map((r) => r.fromPrevious?.semitones ?? null)).toEqual([null, 4, 3]);
    expect(rows.map((r) => r.fromRoot!.long)).toEqual(['fundamental', '3ª mayor', '5ª justa']);
  });

  it('criterio 4: C E G → C mayor', () => {
    const { get } = fresh();
    for (const n of ['C3', 'E3', 'G3']) get().togglePianoKey(midi(n));
    const info = infoPanelModel(get()).notes!;
    expect(info.chordRecognized).toBe(true);
    expect(info.chords[0]!.value).toMatchObject({ root: 0, quality: 'maj' });
  });

  it('criterio 5: C E G A con raíz C → C6 primero y Am7/C, sin filtrar', () => {
    const { get } = fresh();
    for (const n of ['C3', 'E3', 'G3', 'A3']) get().togglePianoKey(midi(n));
    const chords = infoPanelModel(get()).notes!.chords.map((c) => [c.value.root, c.value.quality]);
    expect(chords).toEqual([
      [0, '6'],
      [9, 'm7'],
    ]);
  });

  it('un conjunto sin acorde se indica como no reconocido', () => {
    const { get } = fresh();
    for (const n of ['C3', 'C♯3', 'D3', 'D♯3', 'E3'])
      get().togglePianoKey(midi(n.replace('♯', '#')));
    const info = infoPanelModel(get()).notes!;
    expect(info.chordRecognized).toBe(false);
    expect(info.chords).toEqual([]);
    expect(suggestionSubject(get()).kind).toBe('unrecognized');
  });
});

describe('sujeto de las sugerencias', () => {
  it('sin nada no hay sujeto', () => {
    expect(suggestionSubject(fresh().get())).toEqual({ kind: 'none', availableLayers: [] });
  });

  it('analiza la última capa modificada e indica qué analiza', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 9, type: 'minorPentatonic' });
    let s = suggestionSubject(get());
    expect(s).toMatchObject({
      kind: 'scale',
      layer: 'context',
      description: 'Analizando: A pentatónica menor (menú)',
    });
    for (const n of ['C3', 'E3', 'G3']) get().togglePianoKey(midi(n));
    s = suggestionSubject(get());
    expect(s).toMatchObject({
      kind: 'chord',
      layer: 'notes',
      description: 'Analizando: notas pulsadas C3 E3 G3',
      availableLayers: ['notes', 'context'],
    });
    get().setFocus('context'); // pestaña
    expect(suggestionSubject(get()).kind).toBe('scale');
    get().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    expect(suggestionSubject(get())).toMatchObject({ kind: 'chord', layer: 'context' });
  });

  it('con una sola nota el sujeto es una nota; si una capa se vacía, cae a la otra', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 0, quality: 'maj' });
    get().togglePianoKey(midi('E3'));
    expect(suggestionSubject(get())).toMatchObject({ kind: 'note', pc: 4 });
    get().togglePianoKey(midi('E3'));
    expect(suggestionSubject(get())).toMatchObject({ kind: 'chord', layer: 'context' });
  });

  it('limpiar vacía todas las capas y la raíz', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('E3'));
    get().setContext({ kind: 'chord', root: 0, quality: 'maj' });
    get().setPreview({ kind: 'chord', root: 2, quality: 'm' });
    get().setRootOverride(5);
    get().clear();
    expect(get()).toMatchObject({
      notes: [],
      context: null,
      preview: null,
      rootOverride: null,
      focus: null,
    });
    expect(suggestionSubject(get()).kind).toBe('none');
  });
});

describe('cambio de afinación', () => {
  it('test de ida y vuelta: fijar E3 en estándar, pasar a Drop D, volver a estándar y comprobar que la posición original se conserva', () => {
    const { get } = fresh();
    // Fijamos E3 en cuerda 5 traste 7 (criterio 1) y en cuerda 6 traste 12
    get().toggleFretPosition(pos(5, 7));
    get().toggleFretPosition(pos(6, 12));
    expect(get().notes[0]!.pinned).toEqual([pos(5, 7), pos(6, 12)]);

    // Pasar a Drop D: la 5ª cuerda no cambia; en la 6ª pasa al traste 14
    get().setTuning(dropD);
    expect(get().tuning.id).toBe('dropD');
    expect(get().notes[0]!.pinned).toEqual([pos(5, 7), pos(6, 14)]);

    // Volver a estándar: ambas posiciones vuelven exactamente a la posición original
    get().setTuning(STANDARD_TUNING);
    expect(get().tuning.id).toBe('standard');
    expect(get().notes[0]!.pinned).toEqual([pos(5, 7), pos(6, 12)]);
  });

  it('test de la nota imposible: una nota que no existe en la nueva afinación sigue en pianoMarks y aparece en unplayableNotes', () => {
    const { get } = fresh();
    // En Drop D la cuerda 6 es D2 (MIDI 38). C2 (MIDI 36) no existe en ninguna afinación de guitarra.
    get().setTuning(dropD);
    get().togglePianoKey(midi('C2')); // C2 desde piano (primera inserción)
    get().toggleFretPosition(pos(6, 0)); // D2 fijada en mástil (traste 0 de cuerda 6, segunda inserción)

    // Pasar a estándar (la nota más grave del mástil es E2 = 40): D2 y C2 son imposibles
    get().setTuning(STANDARD_TUNING);

    // 1. Aparecen exactamente ['C2', 'D2'] en unplayableNotes (fijando lista exacta, sin arrayContaining)
    const model = infoPanelModel(get());
    expect(model.unplayableNotes).toEqual(['C2', 'D2']);

    // 2. Siguen presentes en pianoMarks
    const pMarks = pianoMarks(get());
    expect(pMarks.find((m) => m.midi === midi('D2'))).toMatchObject({
      midi: midi('D2'),
      role: 'pinned',
      label: 'D',
    });
    expect(pMarks.find((m) => m.midi === midi('C2'))).toMatchObject({
      midi: midi('C2'),
      role: 'pinned',
      label: 'C',
    });

    // 3. Con solo esas dos notas seleccionadas, el mástil debe quedar completamente vacío (sin depender de etiquetas)
    expect(fretboardMarks(get())).toEqual([]);

    // 4. Volver a Drop D: demuestra que el aviso se calcula dinámicamente y no se guarda
    // D2 deja de aparecer en unplayableNotes y reaparece en el mástil (cuerda 6, traste 0)
    get().setTuning(dropD);
    expect(infoPanelModel(get()).unplayableNotes).toEqual(['C2']);
    expect(fretboardMarks(get())).toEqual([{ string: 6, fret: 0, role: 'equivalent', label: 'D' }]);
  });

  it('criterio 7: Drop D mantiene las notas y recoloca las posiciones fijadas', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(6, 5)); // A2
    get().toggleFretPosition(pos(4, 2)); // E3
    const before = get().notes.map((n) => n.midi);
    get().setTuning(dropD);
    expect(get().notes.map((n) => n.midi)).toEqual(before);
    expect(get().notes[0]!.pinned).toEqual([pos(6, 7)]); // misma cuerda, A2 en Drop D = traste 7
    expect(get().notes[1]!.pinned).toEqual([pos(4, 2)]);
    for (const n of get().notes) {
      for (const p of n.pinned) expect(positionToMidi(get().tuning, p)).toBe(n.midi);
    }
  });

  it('una nota inexistente en la nueva afinación se conserva y se avisa', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('C2')); // por debajo de D2: no existe en Drop D
    get().toggleFretPosition(pos(6, 0)); // E2 fijada
    get().setTuning(dropD);
    expect(get().notes).toHaveLength(2);
    expect(infoPanelModel(get()).unplayableNotes).toEqual(['C2']);
    expect(get().notes.find((n) => n.midi === midi('E2'))!.pinned).toEqual([pos(6, 2)]);
  });

  it('volver a una afinación sin la nota deja de avisar de las notas quitadas', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('C2'));
    get().setTuning(dropD);
    get().togglePianoKey(midi('C2'));
    expect(infoPanelModel(get()).unplayableNotes).toEqual([]);
  });

  it('cambiar de afinación no toca el contexto ni la raíz', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 2, type: 'dorian' });
    get().setRootOverride(7);
    get().setTuning(dropD);
    expect(get().context).toEqual({ kind: 'scale', root: 2, type: 'dorian' });
    expect(get().rootOverride).toBe(7);
  });
});

describe('etiquetas', () => {
  it('las marcas admiten nombre, intervalo, grado o nada', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    get().setShowAllPositions(false);
    const g = (labels: 'note' | 'interval' | 'degree' | 'none') =>
      new Set(pianoMarks(get(), { labels, nameMode: 'flats' }).map((m) => m.label));
    expect(g('note')).toEqual(new Set(['A', 'C', 'E', 'G']));
    expect(g('interval')).toEqual(new Set(['P1', 'm3', 'P5', 'm7']));
    expect(g('degree')).toEqual(new Set(['1', '♭3', '5', '♭7']));
    expect(g('none')).toEqual(new Set([undefined]));
  });

  it('A♯ y B♭ según el modo de nombres', () => {
    const { get } = fresh();
    get().togglePianoKey(midi('A#3'));
    expect(pianoMarks(get(), { nameMode: 'flats' })[0]!.label).toBe('B♭');
    expect(pianoMarks(get(), { nameMode: 'sharps' })[0]!.label).toBe('A♯');
  });
});

describe('Hito H4: chordFocus, armonía y reglas de reinicio', () => {
  it('estado inicial: chordFocus null, harmonyMode triads y harmonyProgression vacía', () => {
    const { get } = fresh();
    expect(get().chordFocus).toBeNull();
    expect(get().harmonyMode).toBe('triads');
    expect(get().harmonyProgression).toEqual([]);
  });

  it('acciones de armonía: setHarmonyMode, addToHarmonyProgression, clearHarmonyProgression y setHarmonyProgression', () => {
    const { get } = fresh();
    get().setHarmonyMode('sevenths');
    expect(get().harmonyMode).toBe('sevenths');

    get().addToHarmonyProgression({ roman: 'Imaj7', chord: chord(0, 'maj7') });
    get().addToHarmonyProgression({ roman: 'V7', chord: chord(7, '7') });
    expect(get().harmonyProgression).toEqual([
      { roman: 'Imaj7', chord: chord(0, 'maj7') },
      { roman: 'V7', chord: chord(7, '7') },
    ]);

    get().clearHarmonyProgression();
    expect(get().harmonyProgression).toEqual([]);

    get().setHarmonyProgression([{ roman: 'ii7', chord: chord(2, 'm7') }]);
    expect(get().harmonyProgression).toHaveLength(1);
  });

  it('acciones de chordFocus: setChordFocus, setChordFocusVoicingIndex, setChordFocusMode y toggleChordFocus', () => {
    const { get } = fresh();
    const g7Focus = {
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 0,
      mode: 'voicing' as const,
    };
    get().setChordFocus(g7Focus);
    expect(get().chordFocus).toEqual(g7Focus);

    get().setChordFocusVoicingIndex(2);
    expect(get().chordFocus?.voicingIndex).toBe(2);

    // setVoicingIndex también actualiza chordFocus si está activo
    get().setVoicingIndex(1);
    expect(get().chordFocus?.voicingIndex).toBe(1);

    get().setChordFocusMode('tones');
    expect(get().chordFocus?.mode).toBe('tones');

    // toggle con el mismo acorde desactiva el foco
    get().toggleChordFocus(g7Focus);
    expect(get().chordFocus).toBeNull();

    // toggle con un acorde lo activa
    get().toggleChordFocus(g7Focus);
    expect(get().chordFocus).toEqual(g7Focus);
  });

  it('regla de reinicio 1: setContext y applyPreview reinician chordFocus a null y vacían harmonyProgression', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 0, type: 'major' });
    get().setChordFocus({
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 2,
      mode: 'voicing',
    });
    get().addToHarmonyProgression({ roman: 'V7', chord: chord(7, '7') });

    // Cambio de contexto vía setContext
    get().setContext({ kind: 'scale', root: 9, type: 'minor' });
    expect(get().chordFocus).toBeNull();
    expect(get().harmonyProgression).toEqual([]);

    // Configurar de nuevo para probar applyPreview
    get().setChordFocus({
      chord: chord(2, 'm7'),
      voicingIndex: 1,
      mode: 'voicing',
    });
    get().addToHarmonyProgression({ roman: 'ii', chord: chord(2, 'm') });
    get().setPreview({ kind: 'scale', root: 2, type: 'dorian' });
    get().applyPreview();

    expect(get().context).toEqual({ kind: 'scale', root: 2, type: 'dorian' });
    expect(get().chordFocus).toBeNull();
    expect(get().harmonyProgression).toEqual([]);
  });

  it('regla de reinicio 2: setTuning conserva chord, degree y mode pero reinicia voicingIndex a 0', () => {
    const { get } = fresh();
    get().setChordFocus({
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 3,
      mode: 'voicing',
    });

    get().setTuning(dropD);

    expect(get().chordFocus).toEqual({
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 0,
      mode: 'voicing',
    });

    // Si chordFocus era null, sigue siendo null al cambiar de afinación
    get().clearChordFocus();
    get().setTuning(STANDARD_TUNING);
    expect(get().chordFocus).toBeNull();
  });

  it('regla de reinicio 3: clearChordFocus restaura la visualización del contexto principal', () => {
    const { get } = fresh();
    // Caso escala: C mayor
    get().setContext({ kind: 'scale', root: 0, type: 'major' });
    get().setChordFocus({
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 0,
      mode: 'voicing',
    });

    // Con foco, hay marcas en scale-bg (la escala atenuada)
    expect(fretboardMarks(get()).some((m) => m.role === 'scale-bg')).toBe(true);

    get().clearChordFocus();
    expect(get().chordFocus).toBeNull();
    // Tras clearChordFocus, se restaura la escala principal: no hay marcas en scale-bg
    expect(fretboardMarks(get()).some((m) => m.role === 'scale-bg')).toBe(false);
    expect(
      fretboardMarks(get()).some(
        (m) => m.role === 'root' && positionToMidi(STANDARD_TUNING, m) % 12 === 0,
      ),
    ).toBe(true);
  });

  it('regla de reinicio 4: clear vacía todo incluyendo chordFocus y harmonyProgression', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7));
    get().setContext({ kind: 'scale', root: 0, type: 'major' });
    get().setRootOverride(0);
    get().setChordFocus({
      chord: chord(7, '7'),
      voicingIndex: 1,
      mode: 'voicing',
    });
    get().addToHarmonyProgression({ roman: 'I', chord: chord(0, 'maj') });

    get().clear();

    expect(get().notes).toEqual([]);
    expect(get().context).toBeNull();
    expect(get().preview).toBeNull();
    expect(get().rootOverride).toBeNull();
    expect(get().chordFocus).toBeNull();
    expect(get().harmonyProgression).toEqual([]);
  });

  it('criterio (e): C mayor con chordFocus en G7 mantiene la escala en scale-bg y resalta G7 (modo voicing y tones)', () => {
    const { get } = fresh();
    get().setContext({ kind: 'scale', root: 0, type: 'major' });
    get().setChordFocus({
      chord: chord(7, '7'),
      degree: 'V7',
      voicingIndex: 0,
      mode: 'voicing',
    });

    const marks = fretboardMarks(get());
    const pMarks = pianoMarks(get());

    // 1. Hay marcas con role 'scale-bg' tanto en mástil como en piano
    const scaleBgFret = marks.filter((m) => m.role === 'scale-bg');
    const scaleBgKeys = pMarks.filter((m) => m.role === 'scale-bg');
    expect(scaleBgFret.length).toBeGreaterThan(0);
    expect(scaleBgKeys.length).toBeGreaterThan(0);

    // 2. Las notas del voicing de G7 resaltan con root (G) y tone (B, D, F)
    const g7FretRoots = marks.filter((m) => m.role === 'root');
    expect(g7FretRoots.length).toBeGreaterThan(0);
    for (const r of g7FretRoots) {
      expect(positionToMidi(STANDARD_TUNING, r) % 12).toBe(7); // G
    }

    // 3. En modo 'tones': todas las posiciones de las notas de G7 (G, B, D, F) tienen root o tone
    get().setChordFocusMode('tones');
    const tonesMarks = fretboardMarks(get());
    const g7Pcs = new Set([7, 11, 2, 5]); // G, B, D, F
    for (const m of tonesMarks) {
      const pc = positionToMidi(STANDARD_TUNING, m) % 12;
      if (g7Pcs.has(pc)) {
        expect(['root', 'tone']).toContain(m.role);
        if (pc === 7) expect(m.role).toBe('root');
      } else {
        // Notas de C mayor que no están en G7 (C=0, E=4, A=9) están en scale-bg
        expect(m.role).toBe('scale-bg');
      }
    }

    // 4. Segundo clic (toggle) o clearChordFocus restaura la escala sin scale-bg
    get().clearChordFocus();
    const restored = fretboardMarks(get());
    expect(restored.some((m) => m.role === 'scale-bg')).toBe(false);
    expect(restored.find((m) => m.string === 5 && m.fret === 3)?.role).toBe('root'); // C en (5, 3) es root
  });

  it('criterio (f) en estado: con acorde Dm de contexto, chordFocus en G muestra G sin cambiar context', () => {
    const { get } = fresh();
    get().setContext({ kind: 'chord', root: 2, quality: 'm' }); // Dm
    expect(get().context).toEqual({ kind: 'chord', root: 2, quality: 'm' });

    // Clic en G (V) activa chordFocus
    get().setChordFocus({
      chord: chord(7, 'maj'),
      degree: 'V',
      voicingIndex: 0,
      mode: 'voicing',
    });

    // El contexto principal sigue siendo Dm
    expect(get().context).toEqual({ kind: 'chord', root: 2, quality: 'm' });
    expect(get().chordFocus?.chord).toEqual(chord(7, 'maj'));

    // Las marcas muestran G (raíz 7)
    const marks = fretboardMarks(get());
    const roots = marks.filter((m) => m.role === 'root');
    expect(roots.length).toBeGreaterThan(0);
    for (const r of roots) {
      expect(positionToMidi(STANDARD_TUNING, r) % 12).toBe(7);
    }

    // "Volver a Dm" (clearChordFocus) restaura Dm
    get().clearChordFocus();
    expect(get().context).toEqual({ kind: 'chord', root: 2, quality: 'm' });
    const restoredRoots = fretboardMarks(get()).filter((m) => m.role === 'root');
    for (const r of restoredRoots) {
      expect(positionToMidi(STANDARD_TUNING, r) % 12).toBe(2); // D
    }
  });
});
