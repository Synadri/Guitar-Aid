/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSandboxStore, createSettingsStore } from '../../state';
import { AppShell } from './AppShell';

describe('AppShell — Navegación de modos y preservación de estado (Criterio a)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('el menú lateral permite alternar entre Sandbox y Aprender, mostrando la vista correspondiente', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-settings-appshell-1' });

    render(<AppShell sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Inicialmente arranca en Sandbox
    expect(screen.getByTestId('sandbox-container')).toBeTruthy();
    expect(screen.queryByTestId('learn-container')).toBeNull();

    // Cambiar a Aprender pulsando en el SideNav
    const learnNavBtn = screen.getByRole('button', {
      name: /Modo Aprender: Ejercicios, tarjetas y fórmulas/i,
    });
    fireEvent.click(learnNavBtn);

    // Ahora se muestra LearnView
    expect(screen.getByTestId('learn-container')).toBeTruthy();
    expect(screen.queryByTestId('sandbox-container')).toBeNull();

    // Las 4 pestañas de Aprender están presentes
    expect(screen.getByRole('tab', { name: /Ejercicios/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Tarjetas/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Fórmulas/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Progreso/i })).toBeTruthy();

    // Volver a Sandbox pulsando en el SideNav
    const sandboxNavBtn = screen.getByRole('button', {
      name: /Modo Sandbox: Guitarra y piano sincronizados/i,
    });
    fireEvent.click(sandboxNavBtn);

    // Vuelve a verse SandboxView
    expect(screen.getByTestId('sandbox-container')).toBeTruthy();
    expect(screen.queryByTestId('learn-container')).toBeNull();
  });

  it('al cambiar a Aprender y volver a Sandbox, la selección (notes), contexto (context) y foco (chordFocus) se conservan intactos', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-settings-appshell-2' });

    // 1. Establecer selección manual, contexto y chordFocus en el Sandbox
    sandboxStore.getState().toggleFretPosition({ string: 5, fret: 3 }); // C3
    sandboxStore.getState().setContext({ kind: 'chord', root: 0, quality: 'maj' }); // C mayor
    sandboxStore.getState().setChordFocus({
      chord: { root: 7, quality: '7', name: 'G7' }, // G7
      degree: 'V7',
      voicingIndex: 0,
      mode: 'voicing',
    });

    render(<AppShell sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Comprobamos que el store tiene el estado
    expect(sandboxStore.getState().notes.length).toBe(1);
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 0, quality: 'maj' });
    expect(sandboxStore.getState().chordFocus?.chord).toEqual({ root: 7, quality: '7', name: 'G7' });

    // 2. Conmutar a Aprender
    const learnNavBtn = screen.getByRole('button', {
      name: /Modo Aprender: Ejercicios, tarjetas y fórmulas/i,
    });
    fireEvent.click(learnNavBtn);
    expect(screen.getByTestId('learn-container')).toBeTruthy();

    // 3. Volver a Sandbox
    const sandboxNavBtn = screen.getByRole('button', {
      name: /Modo Sandbox: Guitarra y piano sincronizados/i,
    });
    fireEvent.click(sandboxNavBtn);
    expect(screen.getByTestId('sandbox-container')).toBeTruthy();

    // 4. El estado del Sandbox sigue exactamente igual
    const currentSandbox = sandboxStore.getState();
    expect(currentSandbox.notes.length).toBe(1);
    expect(currentSandbox.notes[0]?.midi).toBe(48); // C3
    expect(currentSandbox.context).toEqual({ kind: 'chord', root: 0, quality: 'maj' });
    expect(currentSandbox.chordFocus?.chord).toEqual({ root: 7, quality: '7', name: 'G7' });
    expect(currentSandbox.chordFocus?.degree).toBe('V7');
  });

  it('mientras se está en el modo Aprender, pulsar la tecla C no limpia el Sandbox', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-settings-appshell-3' });

    // Preparar selección en el Sandbox
    sandboxStore.getState().toggleFretPosition({ string: 5, fret: 3 });
    sandboxStore.getState().setContext({ kind: 'chord', root: 9, quality: 'm7' }); // Am7
    expect(sandboxStore.getState().notes.length).toBe(1);
    expect(sandboxStore.getState().context).not.toBeNull();

    render(<AppShell sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // Pasar a Aprender
    const learnNavBtn = screen.getByRole('button', {
      name: /Modo Aprender: Ejercicios, tarjetas y fórmulas/i,
    });
    fireEvent.click(learnNavBtn);
    expect(screen.getByTestId('learn-container')).toBeTruthy();

    // Pulsar tecla C en Aprender
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'C' });

    // El Sandbox no se ha limpiado
    expect(sandboxStore.getState().notes.length).toBe(1);
    expect(sandboxStore.getState().context).toEqual({ kind: 'chord', root: 9, quality: 'm7' });

    // Volver a Sandbox y comprobar que al pulsar C en Sandbox sí se limpia
    const sandboxNavBtn = screen.getByRole('button', {
      name: /Modo Sandbox: Guitarra y piano sincronizados/i,
    });
    fireEvent.click(sandboxNavBtn);

    fireEvent.keyDown(window, { key: 'c' });
    expect(sandboxStore.getState().notes.length).toBe(0);
    expect(sandboxStore.getState().context).toBeNull();
  });

  it('el atajo global M alterna el sonido tanto en Sandbox como en Aprender', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-settings-appshell-4' });

    render(<AppShell sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // En Sandbox: M desactiva sonido
    expect(settingsStore.getState().soundEnabled).toBe(true);
    fireEvent.keyDown(window, { key: 'm' });
    expect(settingsStore.getState().soundEnabled).toBe(false);

    // Pasar a Aprender
    const learnNavBtn = screen.getByRole('button', {
      name: /Modo Aprender: Ejercicios, tarjetas y fórmulas/i,
    });
    fireEvent.click(learnNavBtn);

    // En Aprender: M vuelve a activar sonido
    fireEvent.keyDown(window, { key: 'M' });
    expect(settingsStore.getState().soundEnabled).toBe(true);
  });
});
