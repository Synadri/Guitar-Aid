/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxStore, createSettingsStore } from '../../../state';
import type { AudioEngine } from '../../../audio';
import { FormulasView } from './FormulasView';
import { AppShell } from '../../shell/AppShell';

describe('FormulasView (Hito A6)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('(b) Columna izquierda: muestra la fórmula, tabla de intervalos y regla cromática de acordes y escalas (Am7, D dórico, Bm7♭5)', () => {
    const settingsStore = createSettingsStore({ storageName: 'test-formulas-b' });

    // 1. Am7 (por defecto)
    const { rerender } = render(
      <FormulasView
        initialKind="chord"
        initialRoot={9} // A
        initialQuality="m7"
        settingsStore={settingsStore}
      />,
    );

    // Ecuación destacada
    const eq = screen.getByTestId('formula-equation');
    expect(eq.textContent).toContain('Am7 =');
    expect(eq.textContent).toContain('1 ♭3 5 ♭7');

    // Tabla con 4 filas
    const table = screen.getByRole('table', { name: 'Composición de intervalos' });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toContain('1');
    expect(rows[0]?.textContent).toContain('A');
    expect(rows[1]?.textContent).toContain('♭3');
    expect(rows[1]?.textContent).toContain('C');
    expect(rows[2]?.textContent).toContain('5');
    expect(rows[2]?.textContent).toContain('E');
    expect(rows[3]?.textContent).toContain('♭7');
    expect(rows[3]?.textContent).toContain('G');

    // Regla cromática: celdas 0, 3, 7, 10 activas
    const ruler = screen.getByTestId('chromatic-ruler');
    const cell0 = ruler.querySelector('[data-semitone="0"]')!;
    const cell3 = ruler.querySelector('[data-semitone="3"]')!;
    const cell7 = ruler.querySelector('[data-semitone="7"]')!;
    const cell10 = ruler.querySelector('[data-semitone="10"]')!;
    const cell1 = ruler.querySelector('[data-semitone="1"]')!;

    expect(cell0.getAttribute('data-active')).toBe('true');
    expect(cell3.getAttribute('data-active')).toBe('true');
    expect(cell7.getAttribute('data-active')).toBe('true');
    expect(cell10.getAttribute('data-active')).toBe('true');
    expect(cell1.getAttribute('data-active')).toBe('false');

    // 2. D dórico
    rerender(
      <FormulasView
        initialKind="scale"
        initialRoot={2} // D
        initialScaleType="dorian"
        settingsStore={settingsStore}
      />,
    );

    expect(eq.textContent?.toLowerCase()).toContain('d dórico =');
    expect(eq.textContent).toContain('1 2 ♭3 4 5 6 ♭7');
    const dorianRows = table.querySelectorAll('tbody tr');
    expect(dorianRows).toHaveLength(7);
    expect(dorianRows[0]?.textContent).toContain('D');
    expect(dorianRows[1]?.textContent).toContain('E');
    expect(dorianRows[2]?.textContent).toContain('F');
    expect(dorianRows[3]?.textContent).toContain('G');
    expect(dorianRows[4]?.textContent).toContain('A');
    expect(dorianRows[5]?.textContent).toContain('B');
    expect(dorianRows[6]?.textContent).toContain('C');

    // 3. Bm7♭5
    rerender(
      <FormulasView
        initialKind="chord"
        initialRoot={11} // B
        initialQuality="m7b5"
        settingsStore={settingsStore}
      />,
    );
    expect(eq.textContent).toContain('Bm7♭5 =');
    expect(eq.textContent).toContain('1 ♭3 ♭5 ♭7');
  });

  it('(c) Columna derecha: búsqueda inversa identifyByFormula (exactas, otra raíz y cercanas)', () => {
    const settingsStore = createSettingsStore({ storageName: 'test-formulas-c' });

    // Arrancamos con [0, 3, 7, 10] (1, ♭3, 5, ♭7) con raíz A (9)
    render(
      <FormulasView
        initialRoot={9}
        settingsStore={settingsStore}
      />,
    );

    // [0, 3, 7, 10] da Am7 como coincidencia exacta y C6 sobre el ♭3
    const exactCard = screen.getByRole('button', {
      name: /Seleccionar coincidencia exacta Am7/i,
    });
    expect(exactCard).toBeTruthy();
    expect(exactCard.textContent).toContain('A · C · E · G');

    const rotationC6 = screen.getByRole('button', {
      name: /Seleccionar rotación C6/i,
    });
    expect(rotationC6).toBeTruthy();
    expect(rotationC6.textContent).toContain('sobre el ♭3');

    // Probar interacción: hacer clic en C6 actualiza la columna izquierda a C6
    fireEvent.click(rotationC6);
    const eq = screen.getByTestId('formula-equation');
    expect(eq.textContent).toContain('C6 =');
  });

  it('(c) Búsqueda inversa con acordes de 9ª [0, 4, 7, 10, 14] y maj7 [0, 4, 7, 11]', () => {
    const settingsStore = createSettingsStore({ storageName: 'test-formulas-c2' });

    render(<FormulasView initialRoot={0} settingsStore={settingsStore} />);

    // Desactivar ♭3 y ♭7, activar 3, 5 (ya está), ♭7 y 9
    // Pills: '1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7', '9'
    const pillB3 = screen.getByRole('button', { name: '♭3' });
    const pill3 = screen.getByRole('button', { name: '3' });
    const pill9 = screen.getByRole('button', { name: '9' });

    // Quitar ♭3, poner 3 y 9 -> [0, 4, 7, 10, 14] = C9
    fireEvent.click(pillB3);
    fireEvent.click(pill3);
    fireEvent.click(pill9);

    // Coincidencia exacta: C9
    const exactC9 = screen.getByRole('button', { name: /Seleccionar coincidencia exacta C9/i });
    expect(exactC9).toBeTruthy();

    // Cercanas: C7 con 'quita 9'
    const nearC7 = screen.getByRole('button', { name: /Seleccionar candidata cercana C7/i });
    expect(nearC7).toBeTruthy();
    expect(nearC7.textContent).toContain('quita 9');

    // Ahora quitar 9, quitar ♭7 y activar 7 -> [0, 4, 7, 11] = Cmaj7
    const pillB7 = screen.getByRole('button', { name: '♭7' });
    const pill7 = screen.getByRole('button', { name: '7' });

    fireEvent.click(pill9);
    fireEvent.click(pillB7);
    fireEvent.click(pill7);

    // Coincidencia exacta: Cmaj7
    const exactCmaj7 = screen.getByRole('button', {
      name: /Seleccionar coincidencia exacta Cmaj7/i,
    });
    expect(exactCmaj7).toBeTruthy();

    // Cercanas: C con 'quita 7'
    const nearC = screen.getByRole('button', { name: /Seleccionar candidata cercana C$/i });
    expect(nearC).toBeTruthy();
    expect(nearC.textContent).toContain('quita 7');
  });

  it('Botones de acción: Escuchar activa el motor de audio y Abrir en Sandbox fija el contexto', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-formulas-actions' });
    const onOpenInSandbox = vi.fn();

    const mockAudioEngine = {
      playEvents: vi.fn(),
      playNote: vi.fn(),
      setVolume: vi.fn(),
      getVolume: vi.fn(() => 0.8),
      setSoundEnabled: vi.fn(),
      isSoundEnabled: vi.fn(() => true),
      getActiveVoiceCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    } as unknown as AudioEngine;

    render(
      <FormulasView
        initialKind="chord"
        initialRoot={9} // A
        initialQuality="m7"
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={mockAudioEngine}
        onOpenInSandbox={onOpenInSandbox}
      />,
    );

    // 1. Escuchar
    const listenBtn = screen.getByRole('button', { name: /Escuchar acorde o escala/i });
    fireEvent.click(listenBtn);
    expect(mockAudioEngine.playEvents).toHaveBeenCalledTimes(1);

    // 2. Abrir en Sandbox
    const openBtn = screen.getByRole('button', { name: /Abrir en Sandbox/i });
    fireEvent.click(openBtn);
    expect(onOpenInSandbox).toHaveBeenCalledWith({
      kind: 'chord',
      root: 9,
      quality: 'm7',
    });
  });

  it('Integración con AppShell: Abrir en Sandbox desde Fórmulas abre el Sandbox con el contexto fijado', () => {
    const sandboxStore = createSandboxStore();
    const settingsStore = createSettingsStore({ storageName: 'test-formulas-appshell' });

    render(<AppShell sandboxStore={sandboxStore} settingsStore={settingsStore} />);

    // 1. Ir a Aprender
    const learnNavBtn = screen.getByRole('button', {
      name: /Modo Aprender: Ejercicios, tarjetas y fórmulas/i,
    });
    fireEvent.click(learnNavBtn);
    expect(screen.getByTestId('learn-container')).toBeTruthy();

    // 2. Ir a la pestaña Fórmulas
    const formulasTab = screen.getByRole('tab', { name: /Fórmulas/i });
    fireEvent.click(formulasTab);
    expect(screen.getByTestId('formulas-container')).toBeTruthy();

    // 3. Pulsar "Abrir en Sandbox"
    const openBtn = screen.getByRole('button', { name: /Abrir en Sandbox/i });
    fireEvent.click(openBtn);

    // 4. Conmuta automáticamente al modo Sandbox y fija el contexto
    expect(screen.getByTestId('sandbox-container')).toBeTruthy();
    expect(screen.queryByTestId('learn-container')).toBeNull();
    expect(sandboxStore.getState().context).toEqual({
      kind: 'chord',
      root: 9,
      quality: 'm7',
    });
  });
});
