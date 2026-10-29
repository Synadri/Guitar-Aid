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

    // Cambiar a Escalas
    fireEvent.click(within(panel).getByRole('button', { name: 'Escalas' }));
    fireEvent.click(within(panel).getByTestId('suggestions-show-more'));

    const scaleButtons = within(panel).getAllByTestId('suggestion-button');
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

    // Modo Escalas: Do pentatónica mayor (relativa) va primero
    fireEvent.click(within(panel).getByRole('button', { name: 'Escalas' }));
    const scaleButtons = within(panel).getAllByTestId('suggestion-button');
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

    // En modo Escalas: dórico, eólico (Menor natural) y pentatónica menor por encima del frigio
    fireEvent.click(within(panel).getByRole('button', { name: 'Escalas' }));
    const showMoreScales = within(panel).queryByTestId('suggestions-show-more');
    if (showMoreScales) fireEvent.click(showMoreScales);

    const scaleNames = within(panel)
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

    const panel = screen.getByRole('region', { name: 'Sugerencias teóricas' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Escalas' }));

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
});
