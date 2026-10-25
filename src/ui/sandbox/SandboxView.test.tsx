// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_TUNING } from '../../theory';
import {
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type MemoryStorage,
} from '../../state';
import { Fretboard, Piano } from '../instruments';
import { App } from '../App';
import { SINGLE_INSTRUMENT_NOTICE, SandboxView } from './SandboxView';

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

describe('SandboxView — integración contenedor ↔ stores (U2)', () => {
  it('(a) criterio 1: clic en la cuerda 5, traste 7 → esa marca es pinned y la tecla E3 del piano tiene marca', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    fireEvent.click(pos57);

    expect(pos57.getAttribute('data-role')).toBe('pinned');
    expect(pos57.textContent).toBe('E');

    // Las otras dos posiciones equivalentes de E3 están como equivalent
    const pos612 = container.querySelector('[data-string="6"][data-fret="12"]')!;
    const pos42 = container.querySelector('[data-string="4"][data-fret="2"]')!;
    expect(pos612.getAttribute('data-role')).toBe('equivalent');
    expect(pos42.getAttribute('data-role')).toBe('equivalent');

    // La tecla E3 del piano tiene marca activa con etiqueta E
    const keyE3 = screen.getByRole('button', { name: 'E3' });
    expect(keyE3.getAttribute('data-role')).toBe('tone');
    expect(keyE3.getAttribute('aria-pressed')).toBe('true');
    expect(keyE3.textContent).toContain('E');
  });

  it('(b) criterio 2: clic en la tecla E3 del piano → aparecen marcas equivalent en las tres posiciones del mástil', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const keyE3 = screen.getByRole('button', { name: 'E3' });
    fireEvent.click(keyE3);

    const pos612 = container.querySelector('[data-string="6"][data-fret="12"]')!;
    const pos57 = container.querySelector('[data-string="5"][data-fret="7"]')!;
    const pos42 = container.querySelector('[data-string="4"][data-fret="2"]')!;

    expect(pos612.getAttribute('data-role')).toBe('equivalent');
    expect(pos57.getAttribute('data-role')).toBe('equivalent');
    expect(pos42.getAttribute('data-role')).toBe('equivalent');

    const allFretMarks = container.querySelectorAll('[data-string][data-role]');
    expect(allFretMarks).toHaveLength(3);
  });

  it('(c) clic en una posición equivalent la fija (pasa a pinned)', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Clic en E3 del piano genera 3 posiciones equivalent
    fireEvent.click(screen.getByRole('button', { name: 'E3' }));

    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    expect(pos57.getAttribute('data-role')).toBe('equivalent');

    // Clic en la posición equivalent (5, 7) la fija como pinned
    fireEvent.click(pos57);
    expect(pos57.getAttribute('data-role')).toBe('pinned');

    // Las otras dos siguen siendo equivalent
    expect(
      container.querySelector('[data-string="6"][data-fret="12"]')?.getAttribute('data-role'),
    ).toBe('equivalent');
    expect(
      container.querySelector('[data-string="4"][data-fret="2"]')?.getAttribute('data-role'),
    ).toBe('equivalent');
  });

  it('(d) clic en una pinned la desfija, y si era la última de una nota que vino de la guitarra, la nota desaparece del mástil y del piano', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    const pos612 = screen.getByRole('button', { name: 'Cuerda 6, traste 12, E3' });
    const keyE3 = screen.getByRole('button', { name: 'E3' });

    // Seleccionar E3 desde la guitarra en (5, 7) y fijar también (6, 12)
    fireEvent.click(pos57);
    fireEvent.click(pos612);
    expect(pos57.getAttribute('data-role')).toBe('pinned');
    expect(pos612.getAttribute('data-role')).toBe('pinned');
    expect(keyE3.getAttribute('data-role')).toBe('tone');

    // Desfijar (5, 7): pasa a equivalent porque aún queda (6, 12) fijada
    fireEvent.click(pos57);
    expect(pos57.getAttribute('data-role')).toBe('equivalent');
    expect(pos612.getAttribute('data-role')).toBe('pinned');
    expect(keyE3.getAttribute('data-role')).toBe('tone');

    // Desfijar (6, 12) (la última pinned de una nota que vino de la guitarra): desaparece todo
    fireEvent.click(pos612);
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role]')).toHaveLength(0);
    expect(keyE3.getAttribute('data-role')).toBeNull();
  });

  it('(e) clic en una tecla activa quita la nota con todas sus posiciones', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Fijar (5, 7) y (6, 12) en la guitarra para E3
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 6, traste 12, E3' }));
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(3);

    // Clic en la tecla activa E3 del piano elimina la nota y todas sus posiciones
    const keyE3 = screen.getByRole('button', { name: 'E3' });
    expect(keyE3.getAttribute('data-role')).toBe('tone');
    fireEvent.click(keyE3);

    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role]')).toHaveLength(0);
  });

  it('(f) con “Mostrar todas” desactivado no hay marcas equivalent', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Pulsar (5, 7) en guitarra y C4 en piano
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(screen.getByRole('button', { name: 'C4' }));
    expect(
      container.querySelectorAll('[data-string][data-role="equivalent"]').length,
    ).toBeGreaterThan(0);

    // Desactivar "Mostrar todas las posiciones"
    const toggle = screen.getByLabelText('Mostrar todas las posiciones');
    fireEvent.click(toggle);

    expect(container.querySelectorAll('[data-string][data-role="equivalent"]')).toHaveLength(0);
    expect(
      container.querySelector('[data-string="5"][data-fret="7"]')?.getAttribute('data-role'),
    ).toBe('pinned');
  });

  it('(g) criterio 7: con E3 fijada en (6, 12), cambiar a Drop D desde el selector la recoloca en (6, 14)', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const pos612 = screen.getByRole('button', { name: 'Cuerda 6, traste 12, E3' });
    fireEvent.click(pos612);
    expect(pos612.getAttribute('data-role')).toBe('pinned');

    // Cambiar a Drop D desde el selector de la barra
    const tuningSelect = screen.getByLabelText('Afinación');
    fireEvent.change(tuningSelect, { target: { value: 'dropD' } });

    expect(
      container.querySelector('[data-string="6"][data-fret="12"]')?.getAttribute('data-role'),
    ).toBeNull();
    expect(
      container.querySelector('[data-string="6"][data-fret="14"]')?.getAttribute('data-role'),
    ).toBe('pinned');
    expect(screen.getByRole('button', { name: 'E3' }).getAttribute('data-role')).toBe('tone');
  });

  it('(h) una nota D2 puesta desde el piano, al pasar a estándar, sigue en el piano y no tiene marcas en el mástil', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    const tuningSelect = screen.getByLabelText('Afinación');
    fireEvent.change(tuningSelect, { target: { value: 'dropD' } });

    // En Drop D, pulsar D2 en el piano marca (6, 0) en el mástil
    const keyD2 = screen.getByRole('button', { name: 'D2' });
    fireEvent.click(keyD2);
    expect(
      container.querySelector('[data-string="6"][data-fret="0"]')?.getAttribute('data-role'),
    ).toBe('equivalent');
    expect(keyD2.getAttribute('data-role')).toBe('tone');

    // Pasar a afinación estándar: D2 no cabe en el mástil pero sigue activa en el piano
    fireEvent.change(tuningSelect, { target: { value: 'standard' } });
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);
    expect(keyD2.getAttribute('data-role')).toBe('tone');
  });

  it('(i) “Limpiar” vacía todo', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(screen.getByRole('button', { name: 'C4' }));
    expect(container.querySelectorAll('[data-string][data-role]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-midi][data-role]')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-midi][data-role]')).toHaveLength(0);
  });

  it('(j) con ajustes guardados con dropD y showAllPositions: false, un montaje nuevo arranca en esa configuración', () => {
    const sharedStorage = createMemoryStorage();

    // Primera sesión: guardar dropD y showAllPositions: false en el almacenamiento
    const firstStores = createIsolatedStores(sharedStorage);
    firstStores.settingsStore.getState().setTuning('dropD');
    firstStores.settingsStore.getState().setShowAllPositions(false);

    // Nuevo montaje desde cero leyendo del mismo almacenamiento persistido
    const freshSandbox = createSandboxStore();
    const freshSettings = createSettingsStore({
      storage: sharedStorage,
      syncWithSandbox: freshSandbox,
    });

    const { container } = render(
      <SandboxView sandboxStore={freshSandbox} settingsStore={freshSettings} />,
    );

    const tuningSelect = screen.getByLabelText<HTMLSelectElement>('Afinación');
    const showAllCheckbox = screen.getByLabelText<HTMLInputElement>('Mostrar todas las posiciones');

    expect(tuningSelect.value).toBe('dropD');
    expect(showAllCheckbox.checked).toBe(false);
    expect(container.querySelector('[data-tuning-string="6"]')?.textContent).toBe('D');
    expect(freshSandbox.getState().tuning.id).toBe('dropD');
    expect(freshSandbox.getState().showAllPositions).toBe(false);

    // Al hacer clic en una posición, se fija pero no se generan marcas equivalent
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    expect(
      container.querySelector('[data-string="5"][data-fret="7"]')?.getAttribute('data-role'),
    ).toBe('pinned');
    expect(container.querySelectorAll('[data-string][data-role="equivalent"]')).toHaveLength(0);
  });
});

function hasAccessibleName(el: HTMLElement, doc: Document): boolean {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length > 0) return true;

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const referencedText = ariaLabelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim();
    if (referencedText.length > 0) return true;
  }

  if ('labels' in el) {
    const labels = (el as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).labels;
    if (labels && labels.length > 0) {
      const labelText = Array.from(labels)
        .map((l) => l.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (labelText.length > 0) return true;
    }
  }

  const wrappingLabel = el.closest('label');
  if (wrappingLabel && (wrappingLabel.textContent?.trim().length ?? 0) > 0) {
    return true;
  }

  if (el.tagName.toUpperCase() === 'BUTTON' && (el.textContent?.trim().length ?? 0) > 0) {
    return true;
  }

  return false;
}

describe('SandboxView — vista, orientación, persistencia, atajos y accesibilidad (U7)', () => {
  it('(a) criterio 8: ocultar la guitarra → ya no hay mástil y sí piano; un montaje nuevo sobre el mismo almacenamiento sigue con la guitarra oculta', () => {
    const sharedStorage = createMemoryStorage();
    const first = createIsolatedStores(sharedStorage);
    const { unmount } = render(
      <SandboxView sandboxStore={first.sandboxStore} settingsStore={first.settingsStore} />,
    );

    expect(screen.getByTestId('fretboard')).toBeTruthy();
    expect(screen.getByTestId('piano')).toBeTruthy();

    const showGuitarCheckbox = screen.getByLabelText<HTMLInputElement>('Mostrar guitarra');
    fireEvent.click(showGuitarCheckbox);

    expect(showGuitarCheckbox.checked).toBe(false);
    expect(screen.queryByTestId('fretboard')).toBeNull();
    expect(screen.getByTestId('piano')).toBeTruthy();

    unmount();

    // Nuevo montaje sobre el mismo almacenamiento persistido
    const second = createIsolatedStores(sharedStorage);
    render(<SandboxView sandboxStore={second.sandboxStore} settingsStore={second.settingsStore} />);

    expect(screen.queryByTestId('fretboard')).toBeNull();
    expect(screen.getByTestId('piano')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Mostrar guitarra').checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>('Mostrar piano').checked).toBe(true);
  });

  it('(b) criterio 8: cambiar a orientación vertical actualiza data-orientation y un montaje nuevo sobre el mismo almacenamiento conserva la orientación vertical', () => {
    const sharedStorage = createMemoryStorage();
    const first = createIsolatedStores(sharedStorage);
    const { unmount } = render(
      <SandboxView sandboxStore={first.sandboxStore} settingsStore={first.settingsStore} />,
    );

    expect(screen.getByTestId('fretboard').getAttribute('data-orientation')).toBe('horizontal');
    expect(screen.getByTestId('piano').getAttribute('data-orientation')).toBe('horizontal');
    expect(screen.getByTestId('instruments-area').getAttribute('data-orientation')).toBe(
      'horizontal',
    );

    const orientationSelect = screen.getByLabelText<HTMLSelectElement>('Orientación');
    fireEvent.change(orientationSelect, { target: { value: 'vertical' } });

    expect(orientationSelect.value).toBe('vertical');
    expect(screen.getByTestId('fretboard').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByTestId('piano').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByTestId('instruments-area').getAttribute('data-orientation')).toBe(
      'vertical',
    );

    unmount();

    // Nuevo montaje sobre el mismo almacenamiento persistido
    const second = createIsolatedStores(sharedStorage);
    render(<SandboxView sandboxStore={second.sandboxStore} settingsStore={second.settingsStore} />);

    expect(screen.getByLabelText<HTMLSelectElement>('Orientación').value).toBe('vertical');
    expect(screen.getByTestId('fretboard').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByTestId('piano').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByTestId('instruments-area').getAttribute('data-orientation')).toBe(
      'vertical',
    );
  });

  it('(c) con la guitarra oculta, el interruptor del piano está deshabilitado con texto explicativo y el piano sigue visible', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    render(<SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    const showGuitar = screen.getByLabelText<HTMLInputElement>('Mostrar guitarra');
    const showPiano = screen.getByLabelText<HTMLInputElement>('Mostrar piano');

    expect(showGuitar.disabled).toBe(false);
    expect(showPiano.disabled).toBe(false);
    expect(screen.queryByTestId('single-instrument-notice')).toBeNull();

    // Ocultar la guitarra
    fireEvent.click(showGuitar);

    expect(showGuitar.checked).toBe(false);
    expect(showPiano.checked).toBe(true);
    expect(showPiano.disabled).toBe(true);
    expect(showPiano.getAttribute('title')).toContain(SINGLE_INSTRUMENT_NOTICE);
    expect(screen.getByTestId('single-instrument-notice').textContent).toContain(
      SINGLE_INSTRUMENT_NOTICE,
    );
    expect(screen.getByTestId('piano')).toBeTruthy();

    // Volver a mostrar la guitarra y ocultar el piano: ahora el de guitarra queda deshabilitado
    fireEvent.click(showGuitar);
    expect(showPiano.disabled).toBe(false);

    fireEvent.click(showPiano);
    expect(showPiano.checked).toBe(false);
    expect(showGuitar.checked).toBe(true);
    expect(showGuitar.disabled).toBe(true);
    expect(screen.getByTestId('fretboard')).toBeTruthy();
    expect(screen.queryByTestId('piano')).toBeNull();
  });

  it('(d) “Zurdo” refleja el mástil (data-mirrored) y se conserva al recargar', () => {
    const sharedStorage = createMemoryStorage();
    const first = createIsolatedStores(sharedStorage);
    const { unmount } = render(
      <SandboxView sandboxStore={first.sandboxStore} settingsStore={first.settingsStore} />,
    );

    const leftHandedCheckbox = screen.getByLabelText<HTMLInputElement>('Zurdo');
    expect(leftHandedCheckbox.checked).toBe(false);
    expect(screen.getByTestId('fretboard').getAttribute('data-mirrored')).toBe('false');

    fireEvent.click(leftHandedCheckbox);
    expect(leftHandedCheckbox.checked).toBe(true);
    expect(screen.getByTestId('fretboard').getAttribute('data-mirrored')).toBe('true');

    unmount();

    const second = createIsolatedStores(sharedStorage);
    render(<SandboxView sandboxStore={second.sandboxStore} settingsStore={second.settingsStore} />);

    expect(screen.getByLabelText<HTMLInputElement>('Zurdo').checked).toBe(true);
    expect(screen.getByTestId('fretboard').getAttribute('data-mirrored')).toBe('true');
  });

  it('(e) en vertical, Fretboard tiene 150 posiciones y Piano 61 teclas, los clics devuelven los mismos datos que en horizontal (cuerda 5, traste 7; MIDI 52) y los aria-label son iguales', () => {
    const onPosH = vi.fn();
    const onKeyH = vi.fn();
    const { unmount: unmountH } = render(
      <div>
        <Fretboard tuning={STANDARD_TUNING} orientation="horizontal" onPositionClick={onPosH} />
        <Piano orientation="horizontal" onKeyClick={onKeyH} />
      </div>,
    );

    const fbGroupH = screen.getByRole('group', { name: 'Mástil de guitarra' });
    const pianoGroupH = screen.getByRole('group', { name: 'Teclado de piano' });
    const fbButtonsH = within(fbGroupH).getAllByRole('button');
    const pianoButtonsH = within(pianoGroupH).getAllByRole('button');
    const fbAriaH = fbButtonsH.map((b) => b.getAttribute('aria-label'));
    const pianoAriaH = pianoButtonsH.map((b) => b.getAttribute('aria-label'));

    fireEvent.click(within(fbGroupH).getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(within(pianoGroupH).getByRole('button', { name: 'E3' }));
    unmountH();

    const onPosV = vi.fn();
    const onKeyV = vi.fn();
    render(
      <div>
        <Fretboard tuning={STANDARD_TUNING} orientation="vertical" onPositionClick={onPosV} />
        <Piano orientation="vertical" onKeyClick={onKeyV} />
      </div>,
    );

    const fbGroupV = screen.getByRole('group', { name: 'Mástil de guitarra' });
    const pianoGroupV = screen.getByRole('group', { name: 'Teclado de piano' });
    const fbButtonsV = within(fbGroupV).getAllByRole('button');
    const pianoButtonsV = within(pianoGroupV).getAllByRole('button');

    expect(fbButtonsV).toHaveLength(150);
    expect(pianoButtonsV).toHaveLength(61);
    expect(fbButtonsV.map((b) => b.getAttribute('aria-label'))).toEqual(fbAriaH);
    expect(pianoButtonsV.map((b) => b.getAttribute('aria-label'))).toEqual(pianoAriaH);

    fireEvent.click(within(fbGroupV).getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(within(pianoGroupV).getByRole('button', { name: 'E3' }));

    expect(onPosV).toHaveBeenCalledWith({ string: 5, fret: 7 });
    expect(onPosV.mock.calls[0]?.[0]).toEqual(onPosH.mock.calls[0]?.[0]);
    expect(onKeyV).toHaveBeenCalledWith(52);
    expect(onKeyV.mock.calls[0]?.[0]).toBe(onKeyH.mock.calls[0]?.[0]);
  });

  it('(f) C limpia la selección y M alterna el sonido; no actúan con el foco en un select, ni con Ctrl o Alt', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Anunciados en title y aria-keyshortcuts y en la línea de ayuda
    const clearButton = screen.getByRole('button', { name: 'Limpiar' });
    const soundCheckbox = screen.getByLabelText<HTMLInputElement>('Sonido');
    expect(clearButton.getAttribute('aria-keyshortcuts')).toBe('C');
    expect(clearButton.getAttribute('title')).toContain('C');
    expect(soundCheckbox.getAttribute('aria-keyshortcuts')).toBe('M');
    expect(soundCheckbox.getAttribute('title')).toContain('M');
    expect(screen.getByTestId('shortcuts-hint').textContent).toContain('C');
    expect(screen.getByTestId('shortcuts-hint').textContent).toContain('M');

    // Seleccionar una nota y un acorde de menú
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(screen.getByTestId('apply-chord'));
    expect(sandboxStore.getState().notes).toHaveLength(1);
    expect(sandboxStore.getState().context).not.toBeNull();

    // Con el foco en un <select>, ni C ni M actúan
    const tuningSelect = screen.getByLabelText<HTMLSelectElement>('Afinación');
    tuningSelect.focus();
    expect(document.activeElement).toBe(tuningSelect);

    fireEvent.keyDown(tuningSelect, { key: 'c' });
    fireEvent.keyDown(tuningSelect, { key: 'm' });
    expect(sandboxStore.getState().notes).toHaveLength(1);
    expect(sandboxStore.getState().context).not.toBeNull();
    expect(settingsStore.getState().soundEnabled).toBe(true);

    // Quitar el foco del select
    tuningSelect.blur();

    // Con Ctrl, Alt o Meta pulsados, ni C ni M actúan
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'c', altKey: true });
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'm', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'm', altKey: true });
    expect(sandboxStore.getState().notes).toHaveLength(1);
    expect(settingsStore.getState().soundEnabled).toBe(true);

    // Pulsar C limpia toda la selección
    fireEvent.keyDown(window, { key: 'c' });
    expect(sandboxStore.getState().notes).toHaveLength(0);
    expect(sandboxStore.getState().context).toBeNull();
    expect(container.querySelectorAll('[data-string][data-role]')).toHaveLength(0);

    // Pulsar M alterna el sonido (true -> false -> true)
    fireEvent.keyDown(window, { key: 'm' });
    expect(settingsStore.getState().soundEnabled).toBe(false);
    expect(soundCheckbox.checked).toBe(false);

    fireEvent.keyDown(window, { key: 'M' });
    expect(settingsStore.getState().soundEnabled).toBe(true);
    expect(soundCheckbox.checked).toBe(true);
  });

  it('(g) un montaje completo de App con los stores reales no lanza errores y muestra ambos instrumentos por defecto', () => {
    defaultSandboxStore.getState().clear();
    defaultSettingsStore.getState().resetSettings();

    try {
      expect(() => render(<App />)).not.toThrow();
      expect(screen.getByTestId('fretboard')).toBeTruthy();
      expect(screen.getByTestId('piano')).toBeTruthy();
      expect(screen.getByTestId('info-panel')).toBeTruthy();
      expect(screen.getByTestId('suggestions-panel')).toBeTruthy();
    } finally {
      defaultSandboxStore.getState().clear();
      defaultSettingsStore.getState().resetSettings();
    }
  });

  it('(h) todos los button, select e input de la aplicación tienen nombre accesible (aria-label, label asociada o texto)', () => {
    const { sandboxStore, settingsStore } = createIsolatedStores();
    const { container } = render(
      <SandboxView sandboxStore={sandboxStore} settingsStore={settingsStore} />,
    );

    // Activar notas y un acorde para montar también los botones condicionales (Reproducir, Voicings, Pestañas, Ver más)
    fireEvent.click(screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    fireEvent.click(screen.getByTestId('apply-chord'));

    const controls = Array.from(container.querySelectorAll<HTMLElement>('button, select, input'));
    expect(controls.length).toBeGreaterThan(0);

    for (const control of controls) {
      expect(hasAccessibleName(control, document)).toBe(true);
    }
  });
});
