// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES,
  chordsContaining,
  chordsWithinScale,
  relatedScales,
  scalesContaining,
  scalesOnTonic,
  voicingsForChord,
  type PitchClass,
} from '../../theory';
import {
  SETTINGS_STORAGE_KEY,
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  type MemoryStorage,
} from '../../state';
import { SandboxView } from '../sandbox/SandboxView';
import { INITIAL_SUGGESTIONS_LIMIT } from './SuggestionsPanel';
import { SUGGESTIONS_PANEL_TEXTS } from './texts';

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

describe('SuggestionsPanel e interacción de previsualizar y aplicar (U5)', () => {
  it('(a) una nota C → en Acordes aparecen acordes que la contienen con su papel, y en Escalas las que la contienen y las de tónica C', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: notas pulsadas C3',
    );

    // En modo Acordes (por defecto)
    const chordList = within(panel).getByRole('list', { name: 'Sugerencias de acordes' });
    fireEvent.click(within(panel).getByTestId('suggestions-show-more'));

    const chordButtons = within(chordList).getAllByTestId('suggestion-button');
    const expectedChords = chordsContaining(0 as PitchClass);
    expect(chordButtons).toHaveLength(expectedChords.length);

    // Aparecen C (fundamental / 1), Am (3ª menor / ♭3), F (5ª justa / 5) con su papel
    const cBtn = chordButtons.find(
      (b) => within(b).getByTestId('suggestion-name').textContent === 'C',
    )!;
    expect(within(cBtn).getByTestId('suggestion-badge').textContent).toBe('1');
    expect(within(cBtn).getByTestId('suggestion-reason').textContent).toContain('fundamental');

    const amBtn = chordButtons.find(
      (b) => within(b).getByTestId('suggestion-name').textContent === 'Am',
    )!;
    expect(within(amBtn).getByTestId('suggestion-badge').textContent).toBe('♭3');
    expect(within(amBtn).getByTestId('suggestion-reason').textContent).toContain('3ª menor');

    // Escalas en Columna 3
    const scalesPanel = screen.getByTestId('scales-panel');
    fireEvent.click(within(scalesPanel).getByTestId('suggestions-show-more'));

    const scaleButtons = within(scalesPanel).getAllByTestId('suggestion-button');
    const scaleNames = scaleButtons.map(
      (b) => within(b).getByTestId('suggestion-name').textContent!,
    );

    // Incluye todas las escalas con tónica C (incluso si alguna variante existe) y las que contienen C
    for (const s of scalesOnTonic(0 as PitchClass)) {
      expect(scaleNames).toContain(s.value.name);
    }
    for (const s of scalesContaining(0 as PitchClass)) {
      expect(scaleNames).toContain(s.value.name);
    }
  });

  it('(b) criterio 6: contexto La pentatónica menor → Acordes incluye Am, Am7, C6 y Asus4 y no Em, y Escalas pone primero a Do pentatónica mayor (la relativa)', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), {
      target: { value: 'minorPentatonic' },
    });

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: A pentatónica menor (menú)',
    );

    // Modo Acordes: expandir todas
    const showMoreChords = within(panel).queryByTestId('suggestions-show-more');
    if (showMoreChords) fireEvent.click(showMoreChords);

    const chordButtons = within(panel).getAllByTestId('suggestion-button');
    const chordNames = chordButtons.map(
      (b) => within(b).getByTestId('suggestion-name').textContent!,
    );
    const expectedWithin = chordsWithinScale({
      tonic: 9,
      type: 'minorPentatonic',
      name: 'A Pentatónica menor',
    });
    expect(chordNames).toHaveLength(expectedWithin.length);
    expect(chordNames).toEqual(expect.arrayContaining(['Am', 'Am7', 'C6', 'Asus4']));
    expect(chordNames).not.toContain('Em');

    // Columna 3 (Escalas): Do pentatónica mayor (relativa) va primero
    const scalesPanel = screen.getByTestId('scales-panel');
    const scaleButtons = within(scalesPanel).getAllByTestId('suggestion-button');
    const expectedRelated = relatedScales({
      tonic: 9,
      type: 'minorPentatonic',
      name: 'A Pentatónica menor',
    });
    expect(within(scaleButtons[0]!).getByTestId('suggestion-name').textContent).toBe(
      expectedRelated[0]!.value.name,
    );
    expect(within(scaleButtons[0]!).getByTestId('suggestion-name').textContent).toBe(
      'C Pentatónica mayor',
    );
    expect(within(scaleButtons[0]!).getByTestId('suggestion-reason').textContent).toContain(
      'escala relativa',
    );
  });

  it('(c) notas A, C, E, G con raíz A → Escalas pone dórico, eólico y pentatónica menor por encima del frigio, y Acordes muestra Do mayor con grado vi y Sol mayor con grado ii', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Seleccionar A3, C4, E4, G4 en el piano (A3 es la nota más grave → raíz automática A)
    for (const n of ['A3', 'C4', 'E4', 'G4']) {
      fireEvent.click(screen.getByRole('button', { name: n }));
    }

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });

    // En modo Acordes (progresiones para Am7)
    const showMoreProgs = within(panel).queryByTestId('suggestions-show-more');
    if (showMoreProgs) fireEvent.click(showMoreProgs);

    const progTitles = within(panel)
      .getAllByTestId('progression-title')
      .map((el) => el.textContent!);
    expect(progTitles.some((t) => t.includes('C mayor') && t.includes('grado vi'))).toBe(true);
    expect(progTitles.some((t) => t.includes('G mayor') && t.includes('grado ii'))).toBe(true);

    // En Columna 3 (Escalas): dórico, eólico (Menor natural) y pentatónica menor por encima del frigio
    const scalesPanel = screen.getByTestId('scales-panel');
    const showMoreScales = within(scalesPanel).queryByTestId('suggestions-show-more');
    if (showMoreScales) fireEvent.click(showMoreScales);

    const scaleNames = within(scalesPanel)
      .getAllByTestId('suggestion-name')
      .map((el) => el.textContent!);

    const idxMinor = scaleNames.indexOf('A Menor natural');
    const idxDorian = scaleNames.indexOf('A Dórico');
    const idxMinorPent = scaleNames.indexOf('A Pentatónica menor');
    const idxPhrygian = scaleNames.indexOf('A Frigio');

    expect(idxMinor).toBeGreaterThanOrEqual(0);
    expect(idxDorian).toBeGreaterThanOrEqual(0);
    expect(idxMinorPent).toBeGreaterThanOrEqual(0);
    expect(idxPhrygian).toBeGreaterThanOrEqual(0);

    expect(idxDorian).toBeLessThan(idxPhrygian);
    expect(idxMinor).toBeLessThan(idxPhrygian);
    expect(idxMinorPent).toBeLessThan(idxPhrygian);
  });

  it('(d) ratón encima de una sugerencia → hay marcas preview en mástil y piano y notes y context no cambian; al salir, se quitan', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    const initialNotes = sandboxStore.getState().notes;
    expect(sandboxStore.getState().context).toBeNull();

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const firstBtn = within(panel).getAllByTestId('suggestion-button')[0]!;

    expect(container.querySelectorAll('[data-string][data-role="preview"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role="preview"]')).toHaveLength(0);

    // Pasar el ratón por encima de la primera sugerencia (C mayor)
    fireEvent.mouseEnter(firstBtn);

    expect(sandboxStore.getState().preview).toEqual({ kind: 'chord', root: 0, quality: 'maj' });
    expect(sandboxStore.getState().notes).toEqual(initialNotes);
    expect(sandboxStore.getState().context).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role="preview"]').length).toBeGreaterThan(
      0,
    );
    expect(container.querySelectorAll('[data-midi][data-role="preview"]').length).toBeGreaterThan(
      0,
    );

    // Salir con el ratón quita la previsualización
    fireEvent.mouseLeave(firstBtn);
    expect(sandboxStore.getState().preview).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role="preview"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role="preview"]')).toHaveLength(0);
  });

  it('(e) clic aplica como contexto (con la primera digitación si es acorde) y quita la previsualización', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const firstBtn = within(panel).getAllByTestId('suggestion-button')[0]!; // C mayor

    fireEvent.mouseEnter(firstBtn);
    expect(sandboxStore.getState().preview).not.toBeNull();

    fireEvent.click(firstBtn);

    expect(sandboxStore.getState().preview).toBeNull();
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 0, quality: 'maj' });
    expect(sandboxStore.getState().voicingIndex).toBe(0);
    expect(container.querySelectorAll('[data-string][data-role="preview"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role="preview"]')).toHaveLength(0);

    // El navegador de voicings muestra la 1ª digitación de C mayor
    const firstVoicing = voicingsForChord(0, 'maj')[0]!;
    const navigator = screen.getByRole('region', { name: 'Navegador de digitaciones' });
    expect(within(navigator).getByTestId('voicing-indicator').textContent).toMatch(
      /^Digitación 1 de /,
    );
    expect(firstVoicing).toBeDefined();
  });

  it('(f) dos notas C y E → sugerencias que las contienen a ambas, ordenadas por menos sobrantes, y la cabecera nombra las notas', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    fireEvent.click(screen.getByRole('button', { name: 'E3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: notas pulsadas C3 E3',
    );

    fireEvent.click(within(panel).getByTestId('suggestions-show-more'));

    const chordNames = within(panel)
      .getAllByTestId('suggestion-name')
      .map((el) => el.textContent!);
    expect(chordNames).toEqual(expect.arrayContaining(['C', 'Cmaj7', 'Am', 'C6', 'Am7', 'Fmaj7']));
    expect(chordNames).not.toContain('Em');

    // Dentro de los acordes con raíz C (primer bloque), los de 3 notas (1 sobrante: C, Caug) van antes que los de 4 notas (2 sobrantes: C7, Cmaj7, C6) y 5 notas (C9)
    expect(chordNames.indexOf('C')).toBeLessThan(chordNames.indexOf('Cmaj7'));
    expect(chordNames.indexOf('C')).toBeLessThan(chordNames.indexOf('C6'));
    expect(chordNames.indexOf('Cmaj7')).toBeLessThan(chordNames.indexOf('C9'));

    // Y fuera de la raíz C, las tríadas (Am, 1 sobrante) van antes que las cuatríadas (Am7, Fmaj7, 2 sobrantes)
    expect(chordNames.indexOf('Am')).toBeLessThan(chordNames.indexOf('Am7'));
    expect(chordNames.indexOf('Am')).toBeLessThan(chordNames.indexOf('Fmaj7'));

    // Comprobar que las tallas de acorde fuera de la raíz C están en orden no decreciente de notas sobrantes
    const qualitySize = new Map(CHORD_QUALITIES.map((q) => [q.symbol, q.intervals.length]));
    const nonCRoot = chordNames.filter(
      (n) => !n.startsWith('C') || n.startsWith('C♯') || n.startsWith('C#'),
    );
    for (let i = 1; i < nonCRoot.length; i++) {
      const symPrev = nonCRoot[i - 1]!.replace(/^[A-G][♯♭]?/, '');
      const symCurr = nonCRoot[i]!.replace(/^[A-G][♯♭]?/, '');
      expect(qualitySize.get(symPrev)!).toBeLessThanOrEqual(qualitySize.get(symCurr)!);
    }
  });

  it('(g) con notas y contexto a la vez, las pestañas cambian el sujeto y la cabecera indica el origen', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Elegir escala A pentatónica menor en el menú
    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), {
      target: { value: 'minorPentatonic' },
    });

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    expect(within(panel).queryByTestId('suggestions-layer-tabs')).toBeNull();
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: A pentatónica menor (menú)',
    );

    // Pulsar C3 en el piano → ahora hay dos capas y aparecen las pestañas; foco en notas pulsadas
    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    const tabs = within(panel).getByTestId('suggestions-layer-tabs');
    expect(tabs).toBeDefined();
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: notas pulsadas C3',
    );

    // Cambiar a la pestaña "Menú"
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Menú' }));
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: A pentatónica menor (menú)',
    );

    // Volver a la pestaña "Notas pulsadas"
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Notas pulsadas' }));
    expect(within(panel).getByTestId('suggestions-subject-header').textContent).toBe(
      'Analizando: notas pulsadas C3',
    );
  });

  it('(h) cada sugerencia muestra una razón en texto y la incluye en su aria-label', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const buttons = within(panel).getAllByTestId('suggestion-button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      const reasonEl = within(btn).getByTestId('suggestion-reason');
      const reasonText = reasonEl.textContent?.trim() ?? '';
      expect(reasonText.length).toBeGreaterThan(0);
      expect(btn.getAttribute('aria-label')).toContain(reasonText);
    }
  });

  it('(i) “Ver más” amplía de 8 a todas', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const totalExpected = chordsContaining(0 as PitchClass).length;
    expect(totalExpected).toBeGreaterThan(INITIAL_SUGGESTIONS_LIMIT);

    expect(within(panel).getAllByTestId('suggestion-button')).toHaveLength(
      INITIAL_SUGGESTIONS_LIMIT,
    );

    const showMoreBtn = within(panel).getByRole('button', { name: 'Ver más' });
    fireEvent.click(showMoreBtn);

    expect(within(panel).getAllByTestId('suggestion-button')).toHaveLength(totalExpected);
    expect(within(panel).queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('(j) el interruptor Acordes/Escalas se guarda en los ajustes', () => {
    const storage = createMemoryStorage();
    const { sandboxStore, settingsStore } = createIsolatedStores(storage);
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    expect(settingsStore.getState().suggestionsMode).toBe('chords');
    settingsStore.getState().setSuggestionsMode('scales');

    expect(settingsStore.getState().suggestionsMode).toBe('scales');
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).state.suggestionsMode).toBe('scales');
  });

  it('(k) Escape quita la previsualización', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const firstBtn = within(panel).getAllByTestId('suggestion-button')[0]!;

    // Enfocar con teclado activa la previsualización
    fireEvent.focus(firstBtn);
    expect(sandboxStore.getState().preview).not.toBeNull();
    expect(container.querySelectorAll('[data-string][data-role="preview"]').length).toBeGreaterThan(
      0,
    );

    // Pulsar Escape limpia la previsualización
    fireEvent.keyDown(firstBtn, { key: 'Escape' });
    expect(sandboxStore.getState().preview).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role="preview"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role="preview"]')).toHaveLength(0);
  });

  it('(l) sin selección, el mensaje y ninguna lista', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    expect(within(panel).getByTestId('suggestions-empty').textContent).toBe(
      SUGGESTIONS_PANEL_TEXTS.emptyPrompt,
    );
    expect(within(panel).queryByRole('list')).toBeNull();
    expect(within(panel).queryByTestId('suggestions-subject-header')).toBeNull();
  });

  it('(m) criterios 1.1 (c), (d), (e) y (j): conmutador Tríadas/Cuatríadas (7ª), chordFocus sobre grados de escala, botón “Ir al acorde” y escalas relativas con grado respecto a la madre', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Seleccionar C mayor
    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), { target: { value: 'major' } });

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const harmonyToggle = within(panel).getByTestId('harmony-mode-toggle');

    // Conmutar a Cuatríadas (7ª) -> Criterio (c)
    fireEvent.click(within(harmonyToggle).getByRole('button', { name: 'Cuatríadas (7ª)' }));
    const cMajSeventhNames = within(panel)
      .getAllByTestId('suggestion-name')
      .map((el) => el.textContent!);
    expect(cMajSeventhNames).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);

    // Criterio (e): clic en G7 activa chordFocus dejando la escala en scale-bg
    const g7Btn = within(panel)
      .getAllByTestId('suggestion-button')
      .find((b) => within(b).getByTestId('suggestion-name').textContent === 'G7')!;
    fireEvent.click(g7Btn);

    expect(sandboxStore.getState().context).toEqual({ kind: 'scale', root: 0, type: 'major' });
    expect(sandboxStore.getState().chordFocus?.chord.name).toBe('G7');
    expect(
      container.querySelectorAll('[data-string][data-role="scale-bg"]').length,
    ).toBeGreaterThan(0);

    // Segundo clic en G7 desactiva chordFocus y restaura la escala
    fireEvent.click(g7Btn);
    expect(sandboxStore.getState().chordFocus).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role="scale-bg"]')).toHaveLength(0);

    // Criterio (j): escalas relativas en Columna 3 muestran grados respecto a la madre sin incluirse a sí misma
    const scalesPanel = screen.getByTestId('scales-panel');
    const relativeHeader = within(scalesPanel).getByRole('button', {
      name: /Escalas relativas \(mismas notas\)/i,
    });
    expect(relativeHeader.getAttribute('aria-expanded')).toBe('true');

    // Botón "Ir al acorde G7" cambia el contexto principal a G7
    const goToG7Btn = within(panel).getByRole('button', { name: 'Ir al acorde G7' });
    fireEvent.click(goToG7Btn);
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 7, quality: '7' });

    // Criterio (d): A menor armónica en Cuatríadas (7ª)
    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Tipo de escala'), {
      target: { value: 'harmonicMinor' },
    });
    const aHarmSeventhNames = within(panel)
      .getAllByTestId('suggestion-name')
      .map((el) => el.textContent!);
    expect(aHarmSeventhNames).toEqual([
      'Am(maj7)',
      'Bm7♭5',
      'Cmaj7♯5',
      'Dm7',
      'E7',
      'Fmaj7',
      'G♯dim7',
    ]);
  });

  it('(n) criterio 1.1 (f): con Dm como contexto, en las progresiones Dm se resalta como grado actual, clic en G activa chordFocus sin cambiar el contexto y “Volver a Dm” restaura Dm', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Seleccionar Dm como contexto
    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm' } });

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    const showMore = within(panel).queryByTestId('suggestions-show-more');
    if (showMore) fireEvent.click(showMore);

    // Buscar una progresión de C mayor donde Dm es ii (p. ej. ii–V–I)
    const progItems = within(panel).getAllByTestId('progression-item');
    const cMajorProg = progItems.find((item) =>
      within(item).getByTestId('progression-title').textContent?.includes('C mayor · grado ii'),
    )!;
    expect(cMajorProg).toBeDefined();

    const stepButtons = within(cMajorProg).getAllByTestId('suggestion-button');
    const dmBtn = stepButtons.find(
      (b) => within(b).getByTestId('suggestion-name').textContent === 'Dm',
    )!;
    const gBtn = stepButtons.find(
      (b) => within(b).getByTestId('suggestion-name').textContent === 'G',
    )!;

    expect(dmBtn.getAttribute('data-current-degree')).toBe('true');
    expect(gBtn.getAttribute('data-current-degree')).toBeNull();

    // Clic en G activa chordFocus sin cambiar el contexto principal Dm
    fireEvent.click(gBtn);
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 2, quality: 'm' });
    expect(sandboxStore.getState().chordFocus?.chord.name).toBe('G');

    // Pulsar "Volver a Dm" restaura la visualización de Dm
    const restoreBtn = within(panel).getByTestId('restore-context-chord');
    expect(restoreBtn.textContent).toBe('Volver a Dm');
    fireEvent.click(restoreBtn);
    expect(sandboxStore.getState().chordFocus).toBeNull();
  });
});
