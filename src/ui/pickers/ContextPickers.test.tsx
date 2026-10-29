// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES,
  DEFAULT_FRETS,
  SCALE_TYPES,
  STANDARD_TUNING,
  chordPitchClasses,
  getTuning,
  pitchClassOf,
  positionToMidi,
  scalePitchClasses,
  voicingsForChord,
  type StringNumber,
} from '../../theory';
import {
  DEFAULT_PIANO_RANGE,
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  type MemoryStorage,
} from '../../state';
import { SandboxView } from '../sandbox/SandboxView';
import { EMPTY_VOICINGS_MESSAGE } from './VoicingNavigator';

afterEach(() => {
  cleanup();
});

function createIsolatedStores(storage: MemoryStorage = createMemoryStorage()) {
  const sandboxStore = createSandboxStore();
  const settingsStore = createSettingsStore({
    storage,
    syncWithSandbox: sandboxStore,
  });
  return { sandboxStore, settingsStore, storage };
}

describe('Selectores de acorde y escala y navegador de voicings (U4)', () => {
  it('(a) criterio 3: elegir A + m7 → el mástil muestra la primera digitación (x02010) y el piano A, C, E, G, y el panel indica fundamental, 3ª menor, 5ª justa y 7ª menor', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const chordRootSelect = screen.getByLabelText('Tónica del acorde');
    const chordQualitySelect = screen.getByLabelText('Calidad del acorde');

    fireEvent.change(chordRootSelect, { target: { value: '9' } });
    fireEvent.change(chordQualitySelect, { target: { value: 'm7' } });

    // Navegador de voicings muestra la primera digitación: x02010 (abierta)
    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 1 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x02010');
    expect(within(navigator).getByTestId('voicing-family').textContent).toBe('abierta');

    // El mástil dibuja solo las 5 posiciones de x02010 (sin equivalentes)
    const fretMarks = container.querySelectorAll('[data-string][data-role]');
    expect(fretMarks).toHaveLength(5);
    expect(container.querySelectorAll('[data-string][data-role="equivalent"]')).toHaveLength(0);
    expect(
      container.querySelector('[data-string="5"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBe('root');
    expect(
      container.querySelector('[data-string="4"][data-fret="2"]')?.getAttribute('data-role'),
    ).toBe('tone');
    expect(
      container.querySelector('[data-string="3"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBe('tone');
    expect(
      container.querySelector('[data-string="2"][data-fret="1"]')?.getAttribute('data-role'),
    ).toBe('tone');
    expect(
      container.querySelector('[data-string="1"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBe('tone');

    // El piano muestra las notas del voicing (clases de altura A, C, E, G)
    const keyMarks = [...container.querySelectorAll('[data-midi] [data-mark-role]')];
    expect(keyMarks).toHaveLength(5);
    const activePianoNoteLabels = new Set(keyMarks.map((el) => el.textContent));
    expect(activePianoNoteLabels).toEqual(new Set(['A', 'C', 'E', 'G']));

    // El panel indica fundamental, 3ª menor, 5ª justa y 7ª menor
    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    expect(within(panel).getByTestId('context-title').textContent).toBe('Am7');
    const tones = within(panel).getAllByTestId('context-tone');
    expect(tones).toHaveLength(4);

    const expected: [string, string, string][] = [
      ['A', 'fundamental', 'Grado 1'],
      ['C', '3ª menor', 'Grado ♭3'],
      ['E', '5ª justa', 'Grado 5'],
      ['G', '7ª menor', 'Grado ♭7'],
    ];

    expected.forEach(([note, intervalLong, degree], idx) => {
      expect(tones[idx]?.textContent).toContain(note);
      expect(tones[idx]?.textContent).toContain(intervalLong);
      expect(tones[idx]?.textContent).toContain(degree);
    });
  });

  it('(b) siguiente y anterior recorren las digitaciones en bucle y el indicador y las marcas cambian', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });

    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    const prevBtn = within(navigator).getByRole('button', { name: 'Anterior' });
    const nextBtn = within(navigator).getByRole('button', { name: 'Siguiente' });

    // Digitación 1 de 3: x02010 (abierta)
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 1 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x02010');
    expect(within(navigator).getByTestId('voicing-family').textContent).toBe('abierta');
    expect(
      container.querySelector('[data-string="5"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBe('root');

    // Siguiente → Digitación 2 de 3: 575555 (cejilla en 6ª)
    fireEvent.click(nextBtn);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 2 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('575555');
    expect(within(navigator).getByTestId('voicing-family').textContent).toBe('cejilla en 6ª');
    expect(
      container.querySelector('[data-string="5"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBeNull();
    expect(
      container.querySelector('[data-string="6"][data-fret="5"]')?.getAttribute('data-role'),
    ).toBe('root');
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(6);

    // Siguiente → Digitación 3 de 3: x-12-14-12-13-12 (cejilla en 5ª)
    fireEvent.click(nextBtn);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 3 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x-12-14-12-13-12');
    expect(within(navigator).getByTestId('voicing-family').textContent).toBe('cejilla en 5ª');
    expect(
      container.querySelector('[data-string="5"][data-fret="12"]')?.getAttribute('data-role'),
    ).toBe('root');
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(5);

    // Siguiente desde la última → bucle hacia la 1ª digitación
    fireEvent.click(nextBtn);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 1 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x02010');

    // Anterior desde la 1ª → bucle hacia la última digitación (3 de 3)
    fireEvent.click(prevBtn);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 3 de 3',
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x-12-14-12-13-12');

    // Navegación con teclado (ArrowRight vuelve a 1 de 3, ArrowLeft vuelve a 3 de 3)
    fireEvent.keyDown(navigator, { key: 'ArrowRight' });
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 1 de 3',
    );
    fireEvent.keyDown(navigator, { key: 'ArrowLeft' });
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      'Digitación 3 de 3',
    );
  });

  it('(c) en Drop D hay digitaciones para Am7', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });
    fireEvent.change(screen.getByLabelText('Afinación'), { target: { value: 'dropD' } });

    const dropDVoicings = voicingsForChord(9, 'm7', getTuning('dropD')!);
    expect(dropDVoicings.length).toBeGreaterThan(0);

    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    expect(within(navigator).queryByTestId('voicing-empty')).toBeNull();
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toBe(
      `Digitación 1 de ${dropDVoicings.length}`,
    );
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('x02010');

    // La segunda digitación adaptada a Drop D tiene el bajo en el traste 7 de la 6ª cuerda (775555)
    fireEvent.click(within(navigator).getByRole('button', { name: 'Siguiente' }));
    expect(within(navigator).getByTestId('voicing-shape').textContent).toBe('775555');
    expect(within(navigator).getByTestId('voicing-family').textContent).toBe('cejilla en 6ª');
  });

  it('(d) en Open G sale el mensaje y el mástil ilumina todas las notas del acorde', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });
    fireEvent.change(screen.getByLabelText('Afinación'), { target: { value: 'openG' } });

    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    expect(within(navigator).getByTestId('voicing-empty').textContent).toBe(EMPTY_VOICINGS_MESSAGE);
    expect(within(navigator).queryByTestId('voicing-indicator')).toBeNull();

    // Calculado con la teoría: todas las posiciones de A, C, E, G en Open G (6 cuerdas × 25 trastes)
    const openGTuning = getTuning('openG')!;
    const chordPcs = new Set(chordPitchClasses(9, 'm7'));
    let expectedPositionsCount = 0;
    for (let s = 1; s <= openGTuning.strings.length; s++) {
      for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
        const midi = positionToMidi(openGTuning, { string: s as StringNumber, fret });
        if (chordPcs.has(pitchClassOf(midi))) {
          expectedPositionsCount++;
        }
      }
    }

    const fretMarks = container.querySelectorAll('[data-string][data-role]');
    expect(fretMarks).toHaveLength(expectedPositionsCount);
  });

  it('(e) cambiar de acorde o de afinación vuelve a la primera digitación', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });

    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    fireEvent.click(within(navigator).getByRole('button', { name: 'Siguiente' }));
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toMatch(
      /^Digitación 2 de /,
    );
    expect(sandboxStore.getState().voicingIndex).toBe(1);

    // Cambiar de acorde reinicia a la primera digitación
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'maj7' } });
    expect(sandboxStore.getState().voicingIndex).toBe(0);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toMatch(
      /^Digitación 1 de /,
    );

    // Avanzar a la 2ª digitación y cambiar de afinación reinicia a la primera digitación
    fireEvent.click(within(navigator).getByRole('button', { name: 'Siguiente' }));
    expect(sandboxStore.getState().voicingIndex).toBe(1);

    fireEvent.change(screen.getByLabelText('Afinación'), { target: { value: 'dropD' } });
    expect(sandboxStore.getState().voicingIndex).toBe(0);
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toMatch(
      /^Digitación 1 de /,
    );
  });

  it('(f) elegir la pentatónica menor de La → el número de marcas del mástil coincide con las posiciones de sus notas (calcúlalo con la teoría, no a mano) y el piano ilumina sus teclas', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), {
      target: { value: 'minorPentatonic' },
    });

    const scalePcs = new Set(scalePitchClasses(9, 'minorPentatonic'));

    // Cálculo con la teoría de todas las posiciones de la escala en el mástil
    let expectedFretMarks = 0;
    for (let s = 1; s <= STANDARD_TUNING.strings.length; s++) {
      for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
        const midi = positionToMidi(STANDARD_TUNING, { string: s as StringNumber, fret });
        if (scalePcs.has(pitchClassOf(midi))) {
          expectedFretMarks++;
        }
      }
    }

    // Cálculo con la teoría de todas las teclas de la escala en el rango del piano
    let expectedPianoMarks = 0;
    for (let midi = DEFAULT_PIANO_RANGE.from; midi <= DEFAULT_PIANO_RANGE.to; midi++) {
      if (scalePcs.has(pitchClassOf(midi))) {
        expectedPianoMarks++;
      }
    }

    const fretMarks = container.querySelectorAll('[data-string][data-role]');
    const keyMarks = container.querySelectorAll('[data-midi][data-role]');

    expect(fretMarks).toHaveLength(expectedFretMarks);
    expect(keyMarks).toHaveLength(expectedPianoMarks);

    // La tónica A tiene papel root y el resto (C, D, E, G) papel tone
    expect(screen.getByRole('button', { name: 'A3' }).getAttribute('data-role')).toBe('root');
    expect(screen.getByRole('button', { name: 'C3' }).getAttribute('data-role')).toBe('tone');
    expect(screen.getByRole('button', { name: 'D3' }).getAttribute('data-role')).toBe('tone');
    expect(screen.getByRole('button', { name: 'E3' }).getAttribute('data-role')).toBe('tone');
    expect(screen.getByRole('button', { name: 'G3' }).getAttribute('data-role')).toBe('tone');
    expect(screen.getByRole('button', { name: 'F3' }).getAttribute('data-role')).toBeNull();
  });

  it('(g) elegir una escala reemplaza un acorde', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Elegir acorde Am7
    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });

    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 9,
      quality: 'm7',
    });
    expect(screen.getByRole('region', { name: 'Navegador de digitaciones' })).toBeDefined();

    // Elegir escala pentatónica menor de La reemplaza el acorde
    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), {
      target: { value: 'minorPentatonic' },
    });

    expect(sandboxStore.getState().context).toEqual({
      kind: 'scale',
      root: 9,
      type: 'minorPentatonic',
    });
    expect(screen.queryByRole('region', { name: 'Navegador de digitaciones' })).toBeNull();
    expect(screen.getByTestId('context-title').textContent).toBe('A pentatónica menor');
  });

  it('(h) pulsar notas con un contexto activo no lo borra, y “Quitar” lo borra sin tocar las notas', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Activar contexto Am7
    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });
    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 9,
      quality: 'm7',
    });

    // Pulsar notas a mano en guitarra (E3 en cuerda 5, traste 7) y en piano (F♯4)
    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    const keyFs4 = screen.getByRole('button', { name: 'F♯4' });
    fireEvent.click(pos57);
    fireEvent.click(keyFs4);

    // El contexto sigue activo y las notas pulsadas conviven con él
    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 9,
      quality: 'm7',
    });
    expect(sandboxStore.getState().notes).toHaveLength(2);
    expect(pos57.getAttribute('data-role')).toBe('pinned');
    expect(keyFs4.getAttribute('data-role')).toBe('pinned');

    // “Quitar” borra solo el contexto y conserva las notas pulsadas
    const removeBtn = screen.getByRole('button', { name: 'Quitar' });
    fireEvent.click(removeBtn);

    expect(sandboxStore.getState().context).toBeNull();
    expect(screen.queryByRole('region', { name: 'Navegador de digitaciones' })).toBeNull();
    expect(sandboxStore.getState().notes).toHaveLength(2);
    expect(pos57.getAttribute('data-role')).toBe('pinned');
    expect(keyFs4.getAttribute('data-role')).toBe('pinned');

    // “Limpiar” vacía todo
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(sandboxStore.getState().notes).toHaveLength(0);
    expect(sandboxStore.getState().context).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role]')).toHaveLength(0);
  });

  it('(i) el selector de calidades tiene 12 opciones y el de escalas 13', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const qualitySelect = screen.getByLabelText<HTMLSelectElement>('Calidad del acorde');
    const scaleSelect = screen.getByLabelText<HTMLSelectElement>('Tipo de escala');

    expect(qualitySelect.options).toHaveLength(12);
    expect(qualitySelect.options).toHaveLength(CHORD_QUALITIES.length);

    expect(scaleSelect.options).toHaveLength(13);
    expect(scaleSelect.options).toHaveLength(SCALE_TYPES.length);

    const scaleOptionTexts = [...scaleSelect.options].map((o) => o.textContent);
    expect(scaleOptionTexts).toContain('Mayor / Jónico');
    expect(scaleOptionTexts).toContain('Menor natural / Eólico');
  });

  it('(j) con Bemoles, la tónica A♯ se muestra como B♭ y el acorde se llama B♭m7', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Cambiar ortografía a Bemoles
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'flats' } });

    const chordRootSelect = screen.getByLabelText<HTMLSelectElement>('Tónica del acorde');
    const option10 = [...chordRootSelect.options].find((o) => o.value === '10');
    expect(option10?.textContent).toBe('B♭');

    // Elegir tónica 10 (B♭) y calidad m7
    fireEvent.change(chordRootSelect, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    expect(within(panel).getByTestId('context-title').textContent).toBe('B♭m7');

    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    expect(within(navigator).getByTestId('voicing-chord-name').textContent).toBe('B♭m7');
  });

  it('(k) los desplegables reflejan siempre el contexto activo (menú, sugerencia aplicada o “Quitar”) y tras “Quitar” vuelven a sus valores por defecto, conservando “Aplicar”', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const chordRoot = screen.getByLabelText<HTMLSelectElement>('Tónica del acorde');
    const chordQuality = screen.getByLabelText<HTMLSelectElement>('Calidad del acorde');
    const scaleRoot = screen.getByLabelText<HTMLSelectElement>('Tónica de la escala');
    const scaleType = screen.getByLabelText<HTMLSelectElement>('Tipo de escala');
    const applyChordBtn = screen.getByTestId('apply-chord');
    const applyScaleBtn = screen.getByTestId('apply-scale');
    const removeBtn = screen.getByRole('button', { name: 'Quitar' });

    // Valores por defecto sin contexto activo: C mayor (0, maj) y C Mayor / Jónico (0, major)
    expect(chordRoot.value).toBe('0');
    expect(chordQuality.value).toBe('maj');
    expect(scaleRoot.value).toBe('0');
    expect(scaleType.value).toBe('major');

    // 1. Vía menú: elegir D (2) + m7
    fireEvent.change(chordRoot, { target: { value: '2' } });
    fireEvent.change(chordQuality, { target: { value: 'm7' } });
    expect(chordRoot.value).toBe('2');
    expect(chordQuality.value).toBe('m7');
    expect(scaleRoot.value).toBe('0');
    expect(scaleType.value).toBe('major');

    // 2. Vía sugerencia aplicada desde el panel de sugerencias (p. ej. pasar a Escalas y aplicar la primera sugerencia, D Menor natural)
    const suggestionsPanel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    fireEvent.click(within(suggestionsPanel).getByRole('button', { name: 'Escalas' }));
    const firstScaleSuggestion = within(suggestionsPanel).getAllByTestId('suggestion-button')[0]!;
    fireEvent.click(firstScaleSuggestion);

    expect(sandboxStore.getState().context).toEqual({
      kind: 'scale',
      root: 2,
      type: 'minor',
    });
    // Los desplegables de escala reflejan D (2) + minor, y los de acorde vuelven a los valores por defecto (0, maj)
    expect(scaleRoot.value).toBe('2');
    expect(scaleType.value).toBe('minor');
    expect(chordRoot.value).toBe('0');
    expect(chordQuality.value).toBe('maj');

    // 3. Aplicar una sugerencia de acorde (p. ej. en modo Acordes, aplicar el primer acorde diatónico Dm)
    fireEvent.click(within(suggestionsPanel).getByRole('button', { name: 'Acordes' }));
    const firstChordSuggestion = within(suggestionsPanel).getAllByTestId('suggestion-button')[0]!;
    fireEvent.click(firstChordSuggestion);

    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 2,
      quality: 'm',
    });
    expect(chordRoot.value).toBe('2');
    expect(chordQuality.value).toBe('m');
    expect(scaleRoot.value).toBe('0');
    expect(scaleType.value).toBe('major');

    // 4. Tras “Quitar”, ambos grupos vuelven a sus valores por defecto
    fireEvent.click(removeBtn);
    expect(sandboxStore.getState().context).toBeNull();
    expect(chordRoot.value).toBe('0');
    expect(chordQuality.value).toBe('maj');
    expect(scaleRoot.value).toBe('0');
    expect(scaleType.value).toBe('major');

    // 5. Los botones “Aplicar” permiten volver a aplicar la selección mostrada tras “Quitar”
    fireEvent.click(applyChordBtn);
    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 0,
      quality: 'maj',
    });
    fireEvent.click(removeBtn);
    expect(sandboxStore.getState().context).toBeNull();
    fireEvent.click(applyScaleBtn);
    expect(sandboxStore.getState().context).toEqual({
      kind: 'scale',
      root: 0,
      type: 'major',
    });
  });
});
