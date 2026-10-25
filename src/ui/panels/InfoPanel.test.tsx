// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  sandboxStore as realSandboxStore,
  settingsStore as realSettingsStore,
  type MemoryStorage,
} from '../../state';
import { SandboxView } from '../sandbox/SandboxView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  realSandboxStore.getState().clear();
  realSettingsStore.getState().resetSettings();
});

function createIsolatedStores(storage: MemoryStorage = createMemoryStorage()) {
  const sandboxStore = createSandboxStore();
  const settingsStore = createSettingsStore({
    storage,
    syncWithSandbox: sandboxStore,
  });
  return { sandboxStore, settingsStore, storage };
}

describe('InfoPanel y etiquetas en SandboxView (U3)', () => {
  it('(a) criterio 4: clic en C3, E3 y G3 en el piano → el panel muestra “C” como único candidato', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    fireEvent.click(screen.getByRole('button', { name: 'E3' }));
    fireEvent.click(screen.getByRole('button', { name: 'G3' }));

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    expect(panel.getAttribute('aria-live')).toBe('polite');

    const candidateNames = within(panel)
      .getAllByTestId('chord-candidate-name')
      .map((el) => el.textContent);
    expect(candidateNames).toEqual(['C']);

    const reasons = within(panel).getByTestId('chord-candidate-reasons').textContent;
    expect(reasons).toContain('contiene las 3 notas del acorde');
    expect(reasons).toContain('la raíz coincide');
  });

  it('(b) criterio 5: C3, E3, G3 y A3 → el panel lista C6 y Am7/C, y ninguno está marcado como “elegido”; si fijas la raíz en A desde el selector, Am7 pasa al primer lugar; volver a “Automática” lo devuelve a su sitio', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    for (const note of ['C3', 'E3', 'G3', 'A3']) {
      fireEvent.click(screen.getByRole('button', { name: note }));
    }

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    const getCandidateNames = () =>
      within(panel)
        .getAllByTestId('chord-candidate-name')
        .map((el) => el.textContent);

    // Con raíz automática (C3 es la más grave): C6 primero y Am7/C segundo
    expect(getCandidateNames()).toEqual(['C6', 'Am7/C']);

    // Ningún candidato está marcado como elegido/seleccionado
    const candidateItems = within(panel).getAllByTestId('chord-candidate');
    expect(candidateItems).toHaveLength(2);
    for (const item of candidateItems) {
      expect(item.getAttribute('aria-selected')).toBeNull();
      expect(item.getAttribute('aria-current')).toBeNull();
      expect(item.getAttribute('data-selected')).toBeNull();
      expect(item.textContent?.toLowerCase()).not.toContain('elegido');
    }

    // Razones traducidas a texto
    expect(candidateItems[0]?.textContent).toContain('contiene las 4 notas del acorde');
    expect(candidateItems[0]?.textContent).toContain('la raíz coincide');
    expect(candidateItems[1]?.textContent).toContain('contiene las 4 notas del acorde');
    expect(candidateItems[1]?.textContent).toContain('con el bajo en C');

    // Fijar la raíz en A (pitch class 9) desde el selector
    const rootSelect = within(panel).getByLabelText<HTMLSelectElement>('Raíz');
    fireEvent.change(rootSelect, { target: { value: '9' } });
    expect(sandboxStore.getState().rootOverride).toBe(9);
    expect(getCandidateNames()).toEqual(['Am7', 'C6/A']);

    // Volver a "Automática" lo devuelve a su sitio
    fireEvent.change(rootSelect, { target: { value: 'auto' } });
    expect(sandboxStore.getState().rootOverride).toBeNull();
    expect(getCandidateNames()).toEqual(['C6', 'Am7/C']);
  });

  it('(c) criterio 3 desde el store: contexto Am7 inyectado → el panel muestra A, C, E, G con fundamental, 3ª menor, 5ª justa y 7ª menor', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    act(() => {
      sandboxStore.getState().setContext({ kind: 'chord', root: 9, quality: 'm7' });
    });

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    const tones = within(panel).getAllByTestId('context-tone');
    expect(tones).toHaveLength(4);

    const expected: [string, string, string][] = [
      ['A', 'fundamental', 'Grado 1'],
      ['C', '3ª menor', 'Grado ♭3'],
      ['E', '5ª justa', 'Grado 5'],
      ['G', '7ª menor', 'Grado ♭7'],
    ];

    expected.forEach(([note, intervalLong, degreeText], idx) => {
      expect(tones[idx]?.textContent).toContain(note);
      expect(tones[idx]?.textContent).toContain(intervalLong);
      expect(tones[idx]?.textContent).toContain(degreeText);
    });
  });

  it('(d) tres notas sin acorde (por ejemplo C3, C♯3, D3) → “No se reconoce ningún acorde”', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    fireEvent.click(screen.getByRole('button', { name: 'C♯3' }));
    fireEvent.click(screen.getByRole('button', { name: 'D3' }));

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    expect(within(panel).getByTestId('no-chord-recognized').textContent).toBe(
      'No se reconoce ningún acorde',
    );
    expect(within(panel).queryAllByTestId('chord-candidate')).toHaveLength(0);
  });

  it('(e) una o dos notas → sin análisis de acorde', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const panel = screen.getByRole('region', { name: 'Información de la selección' });

    // 1 nota
    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    expect(within(panel).getAllByTestId('selected-note-row')).toHaveLength(1);
    expect(within(panel).queryByTestId('chord-analysis-section')).toBeNull();
    expect(within(panel).queryByText('No se reconoce ningún acorde')).toBeNull();

    // 2 notas
    fireEvent.click(screen.getByRole('button', { name: 'E3' }));
    expect(within(panel).getAllByTestId('selected-note-row')).toHaveLength(2);
    expect(within(panel).queryByTestId('chord-analysis-section')).toBeNull();
    expect(within(panel).queryByText('No se reconoce ningún acorde')).toBeNull();
  });

  it('(f) las etiquetas cambian: con E3 fijada y raíz C, Nota muestra “E”, Intervalo “M3”, Grado “3” y Ninguna no muestra texto', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Fijar E3 en cuerda 5, traste 7
    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    fireEvent.click(pos57);

    // Fijar raíz en C (0) desde el selector del panel
    const rootSelect = screen.getByLabelText('Raíz');
    fireEvent.change(rootSelect, { target: { value: '0' } });

    const labelsSelect = screen.getByLabelText('Etiquetas');
    const keyE3 = screen.getByRole('button', { name: 'E3' });

    // Nota -> "E"
    expect(pos57.textContent).toBe('E');
    expect(keyE3.textContent).toBe('E');

    // Intervalo -> "M3"
    fireEvent.change(labelsSelect, { target: { value: 'interval' } });
    expect(pos57.textContent).toBe('M3');
    expect(keyE3.textContent).toBe('M3');

    // Grado -> "3"
    fireEvent.change(labelsSelect, { target: { value: 'degree' } });
    expect(pos57.textContent).toBe('3');
    expect(keyE3.textContent).toBe('3');

    // Ninguna -> sin texto en la marca
    fireEvent.change(labelsSelect, { target: { value: 'none' } });
    expect(pos57.textContent).toBe('');
    expect(keyE3.textContent).toBe('');
  });

  it('(g) Bemoles muestra B♭ donde Sostenidos muestra A♯', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // En modo Sostenidos (por defecto), pulsar A♯3 en el piano
    fireEvent.click(screen.getByRole('button', { name: 'A♯3' }));

    const pos33 = container.querySelector('[data-string="3"][data-fret="3"]')!;
    const key58 = container.querySelector('[data-midi="58"]')!;
    const panel = screen.getByRole('region', { name: 'Información de la selección' });

    expect(pos33.textContent).toBe('A♯');
    expect(key58.textContent).toBe('A♯');
    expect(within(panel).getByTestId('selected-note-row').textContent).toContain('A♯3');

    // Cambiar a Bemoles desde el selector de la barra
    const namesSelect = screen.getByLabelText('Nombres');
    fireEvent.change(namesSelect, { target: { value: 'flats' } });

    expect(pos33.textContent).toBe('B♭');
    expect(key58.textContent).toBe('B♭');
    expect(within(panel).getByTestId('selected-note-row').textContent).toContain('B♭3');
  });

  it('(h) D2 puesta desde el piano y afinación estándar → aviso con D2 en el panel', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // En afinación estándar (por defecto), pulsar D2 directamente en el piano
    fireEvent.click(screen.getByRole('button', { name: 'D2' }));

    const panel = screen.getByRole('region', { name: 'Información de la selección' });
    const warning = within(panel).getByTestId('unplayable-warning');
    expect(warning.textContent).toBe('No se puede tocar en esta afinación: D2');
  });

  it('(i) con los singletons reales montados, cambiar la afinación desde el selector recoloca una nota fijada una sola vez (espía en sandboxStore.setTuning)', () => {
    realSandboxStore.getState().clear();
    realSettingsStore.getState().resetSettings();

    const { container } = render(<SandboxView />);

    // Fijar E3 en cuerda 6, traste 12
    const pos612 = screen.getByRole('button', { name: 'Cuerda 6, traste 12, E3' });
    fireEvent.click(pos612);
    expect(pos612.getAttribute('data-role')).toBe('pinned');

    const spy = vi.spyOn(realSandboxStore.getState(), 'setTuning');

    // Cambiar la afinación a Drop D desde el selector de la barra
    const tuningSelect = screen.getByLabelText('Afinación');
    fireEvent.change(tuningSelect, { target: { value: 'dropD' } });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(realSandboxStore.getState().notes[0]?.pinned).toEqual([{ string: 6, fret: 14 }]);
    expect(
      container.querySelector('[data-string="6"][data-fret="14"]')?.getAttribute('data-role'),
    ).toBe('pinned');
  });

  it('(j) el selector de raíz tiene 13 opciones', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const rootSelect = screen.getByLabelText<HTMLSelectElement>('Raíz');
    expect(rootSelect.options).toHaveLength(13);
    expect(rootSelect.options[0]?.textContent).toBe('Automática');
  });
});
