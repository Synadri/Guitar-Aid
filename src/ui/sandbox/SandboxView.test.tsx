// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  type MemoryStorage,
} from '../../state';
import { SandboxView } from './SandboxView';

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
