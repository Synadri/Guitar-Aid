import { describe, expect, it } from 'vitest';
import { getTuning, nameToMidi, positionToMidi, STANDARD_TUNING } from '../../theory';
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

function fresh() {
  const store = createSandboxStore();
  return { store, get: () => store.getState() };
}

describe('capa notes: clic en guitarra y piano', () => {
  it('criterio 1: cuerda 5, traste 7 → E3 fijada, el piano la marca y la etiqueta es E', () => {
    const { get } = fresh();
    get().toggleFretPosition(pos(5, 7));
    expect(get().notes).toEqual([{ midi: midi('E3'), pinned: [pos(5, 7)], origin: 'fretboard' }]);
    expect(pianoMarks(get())).toEqual([{ midi: midi('E3'), role: 'tone', label: 'E' }]);
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
      role: 'tone',
      label: 'D',
    });
    expect(pMarks.find((m) => m.midi === midi('C2'))).toMatchObject({
      midi: midi('C2'),
      role: 'tone',
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
