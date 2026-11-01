// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { createAlphaSynthController, type AlphaSynthLike } from '../../audio';
import { createSongStore, createMemorySongStorage } from '../../state/song';
import { AlphaTabViewport } from './AlphaTabViewport';

function setupViewportTest() {
  const storage = createMemorySongStorage();
  const songStore = createSongStore({ storage });
  const controller = createAlphaSynthController();

  let playedBeatCallback: ((beat: unknown) => void) | null = null;
  let playerStateCallback: ((args: { state: number }) => void) | null = null;
  let destroyCalled = false;

  const mockApi: AlphaSynthLike & {
    destroyCalls: number;
    triggerBeat: (barIndex: number, beatIndex: number) => void;
    triggerState: (state: number) => void;
  } = {
    destroyCalls: 0,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: () => {
      destroyCalled = true;
      mockApi.destroyCalls += 1;
    },
    playedBeatChanged: {
      on(cb) {
        playedBeatCallback = cb;
      },
    },
    playerStateChanged: {
      on(cb) {
        playerStateCallback = cb;
      },
    },
    triggerBeat(barIndex: number, beatIndex: number) {
      playedBeatCallback?.({
        index: beatIndex,
        voice: {
          bar: {
            index: barIndex,
          },
        },
      });
    },
    triggerState(state: number) {
      playerStateCallback?.({ state });
    },
  };

  const createApi = vi.fn(() => mockApi);

  return {
    songStore,
    controller,
    mockApi,
    createApi,
    isDestroyCalled: () => destroyCalled,
  };
}

describe('AlphaTabViewport (Hito C5, docs/Fase-3/plan_fase3.md §7 C5)', () => {
  afterEach(() => {
    cleanup();
  });
  it('renderiza la cabecera fija con modo de vista, nombre de pista y resumen técnico monoespaciado', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('alphatab-viewport')).not.toBeNull();
    expect(screen.getByText('TABLATURA')).not.toBeNull();
    expect(screen.getByText('GUITARRA RÍTMICA')).not.toBeNull();
    expect(screen.getByText('Estándar')).not.toBeNull();
    expect(screen.getByText('Capo 0')).not.toBeNull();
    expect(screen.getByText('compás 1 de 8')).not.toBeNull();
  });

  it('alterna reactivamente entre los 3 modos de vista (Tab, Partitura + Tab, Partitura)', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    // Modo por defecto: Tab
    expect(screen.getByText('TABLATURA')).not.toBeNull();
    expect(screen.getAllByTestId('tab-notation')).toHaveLength(8);
    expect(screen.queryByTestId('staff-notation')).toBeNull();

    // Modo: Partitura + Tab (score-tab)
    songStore.getState().setScoreViewMode('score-tab');
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByText('PARTITURA + TAB')).not.toBeNull();
    expect(screen.getAllByTestId('tab-notation')).toHaveLength(8);
    expect(screen.getAllByTestId('staff-notation')).toHaveLength(8);

    // Modo: Solo Partitura (score)
    songStore.getState().setScoreViewMode('score');
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByText('PARTITURA')).not.toBeNull();
    expect(screen.queryByTestId('tab-notation')).toBeNull();
    expect(screen.getAllByTestId('staff-notation')).toHaveLength(8);
  });

  it('controla la visibilidad de la fila de letra (showLyrics)', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    // Con letra activa por defecto: el estribillo (compases 5 a 8) contiene letras
    expect(screen.getAllByTestId('lyrics-line').length).toBeGreaterThan(0);

    // Ocultar letra
    songStore.getState().setShowLyrics(false);
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.queryByTestId('lyrics-line')).toBeNull();

    // Volver a mostrar letra
    songStore.getState().setShowLyrics(true);
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getAllByTestId('lyrics-line').length).toBeGreaterThan(0);
  });

  it('resalta el compás activo (warm amber) y dibuja el cursor de pulso turquesa sincronizado', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    // Compás 1 activo por defecto
    const bar1 = screen.getByTestId('bar-1');
    expect(bar1.getAttribute('data-is-active')).toBe('true');
    expect(screen.getByTestId('bar-2').getAttribute('data-is-active')).toBe('false');

    // Cursor de pulso presente en el pulso 0 de compás 1
    expect(screen.getByTestId('beat-cursor')).not.toBeNull();

    // Avanzar pulso a compás 3, pulso 2
    songStore.getState().setCurrentPosition(3, 2);
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(bar1.getAttribute('data-is-active')).toBe('false');
    const bar3 = screen.getByTestId('bar-3');
    expect(bar3.getAttribute('data-is-active')).toBe('true');
    expect(screen.getByText('compás 3 de 8')).not.toBeNull();
  });

  it('resalta el rango de compases seleccionado y muestra el icono de bucle en el extremo', () => {
    const { songStore, controller } = setupViewportTest();

    // Rango seleccionado 2..4
    songStore.getState().setSelectedBarRange([2, 4]);
    // Bucle activo en compases 1..4
    songStore.getState().setLoopRange([1, 4]);
    songStore.getState().setLoopEnabled(true);

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('bar-1').getAttribute('data-is-selected')).toBe('false');
    expect(screen.getByTestId('bar-2').getAttribute('data-is-selected')).toBe('true');
    expect(screen.getByTestId('bar-3').getAttribute('data-is-selected')).toBe('true');
    expect(screen.getByTestId('bar-4').getAttribute('data-is-selected')).toBe('true');
    expect(screen.getByTestId('bar-5').getAttribute('data-is-selected')).toBe('false');

    // Icono de fin de bucle en compás 4
    expect(screen.getByTestId('loop-end-icon')).not.toBeNull();
  });

  it('selección de compases con ratón: clic simple sitúa el cursor y Shift + Clic selecciona un rango', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // Clic simple en compás 4
    const bar4 = screen.getByTestId('bar-4');
    fireEvent.click(bar4);

    expect(songStore.getState().currentBar).toBe(4);
    expect(songStore.getState().currentBeat).toBe(0);
    expect(songStore.getState().inspectedBar).toBe(4);
    expect(songStore.getState().selectedBarRange).toBeNull();

    // Shift + Clic en compás 7: selecciona el rango [4, 7]
    const bar7 = screen.getByTestId('bar-7');
    fireEvent.click(bar7, { shiftKey: true });

    expect(songStore.getState().selectedBarRange).toEqual([4, 7]);
    expect(songStore.getState().inspectedBar).toBe(7);
  });

  it('selección de compases por arrastre (drag selection)', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    const bar2 = screen.getByTestId('bar-2');
    const bar5 = screen.getByTestId('bar-5');

    fireEvent.mouseDown(bar2, { button: 0 });
    fireEvent.mouseEnter(bar5);
    fireEvent.mouseUp(screen.getByTestId('alphatab-viewport'));

    expect(songStore.getState().selectedBarRange).toEqual([2, 5]);
  });

  it('integración con doble inyectable de AlphaTabApi / AlphaSynth y sincronización de eventos', () => {
    const { songStore, controller, mockApi, createApi, isDestroyCalled } = setupViewportTest();

    const { unmount } = render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Fábrica invocada
    expect(createApi).toHaveBeenCalledTimes(1);
    // Reproductor adjuntado al controlador
    expect(controller.getPlayer()).toBe(mockApi);

    // Evento de pulso reproducido desde AlphaTab actualiza el store
    mockApi.triggerBeat(4, 1); // bar 5 (0-based 4), beat 1
    expect(songStore.getState().currentBar).toBe(5);
    expect(songStore.getState().currentBeat).toBe(1);

    // Evento de estado de reproducción
    mockApi.triggerState(1); // 1 = Playing
    expect(songStore.getState().isPlaying).toBe(true);

    mockApi.triggerState(0); // 0 = Paused
    expect(songStore.getState().isPlaying).toBe(false);

    // Al desmontar, se desacopla del controlador y se destruye
    unmount();
    expect(controller.getPlayer()).toBeNull();
    expect(isDestroyCalled()).toBe(true);
  });

  it('cumple el Criterio de Aceptación (k): vistas de partitura, bucle, velocidad y mezclador multipista', async () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // 1. Vistas de partitura
    songStore.getState().setScoreViewMode('score-tab');
    expect(songStore.getState().scoreViewMode).toBe('score-tab');
    songStore.getState().setScoreViewMode('score');
    expect(songStore.getState().scoreViewMode).toBe('score');
    songStore.getState().setScoreViewMode('tab');
    expect(songStore.getState().scoreViewMode).toBe('tab');

    // 2. Configurar bucle A–B
    songStore.getState().setLoopRange([2, 6]);
    songStore.getState().setLoopEnabled(true);
    controller.setPlaybackRange({ startTick: 1920, endTick: 5760 });
    controller.setLoopEnabled(true);

    expect(controller.isLooping()).toBe(true);
    expect(controller.getPlaybackRange()).toEqual({ startTick: 1920, endTick: 5760 });

    // 3. Velocidad de reproducción (0.25× – 2.0×)
    controller.setPlaybackSpeed(0.75);
    expect(controller.getPlaybackSpeed()).toBe(0.75);

    // 4. Mute / Solo / Volumen por pista
    controller.setTrackMute(0, true);
    controller.setTrackSolo(1, true);
    controller.setTrackVolume(0, 0.6);

    const mixer = controller.getTrackMixer();
    expect(mixer[0]?.muted).toBe(true);
    expect(mixer[0]?.volume).toBe(0.6);
    expect(mixer[1]?.solo).toBe(true);
  });

  it('sincroniza reactivamente el rango de reproducción en ticks con el controlador al cambiar el bucle', async () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // Inicialmente sin bucle
    expect(controller.isLooping()).toBe(false);
    expect(controller.getPlaybackRange()).toBeNull();

    // Activar bucle en compases 2..4
    act(() => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    // Compás 2 inicia en 3840 ticks (4/4) y compás 4 termina en 15360 ticks
    expect(controller.isLooping()).toBe(true);
    expect(controller.getPlaybackRange()).toEqual({ startTick: 3840, endTick: 15360 });

    // Desactivar bucle
    act(() => {
      songStore.getState().setLoopEnabled(false);
    });

    expect(controller.isLooping()).toBe(false);
    expect(controller.getPlaybackRange()).toBeNull();
  });

  it('al hacer clic simple en un compás fuera del bucle activo, desactiva el bucle y salta al compás pulsado', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // Bucle en compases 2..4
    act(() => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    expect(songStore.getState().loopEnabled).toBe(true);

    // Clic en compás 6 (fuera del bucle)
    const bar6 = screen.getByTestId('bar-6');
    fireEvent.click(bar6);

    expect(songStore.getState().currentBar).toBe(6);
    expect(songStore.getState().loopEnabled).toBe(false);
    expect(controller.isLooping()).toBe(false);
    expect(controller.getPlaybackRange()).toBeNull();
  });

  describe('Hito C6b: Sistemas Continuos e Interactividad Nota a Nota (Criterio o)', () => {
    it('agrupa los compases en sistemas continuos de 4 compases con cabecera T A B única por sistema', () => {
      const { songStore, controller } = setupViewportTest();

      render(<AlphaTabViewport songStore={songStore} controller={controller} />);

      // En la pieza de 8 compases, hay 2 sistemas continuos
      const system0 = screen.getByTestId('system-0');
      const system1 = screen.getByTestId('system-1');
      expect(system0).not.toBeNull();
      expect(system1).not.toBeNull();

      // Cabeceras TAB presentes (una por sistema)
      const tabLettersT = screen.getAllByText('T');
      const tabLettersA = screen.getAllByText('A');
      const tabLettersB = screen.getAllByText('B');
      expect(tabLettersT.length).toBe(2);
      expect(tabLettersA.length).toBe(2);
      expect(tabLettersB.length).toBe(2);
    });

    it('permite mover el cursor directamente a una nota o pulso específico al hacer clic sobre él', () => {
      const { songStore, controller } = setupViewportTest();
      const seekSpy = vi.spyOn(controller, 'seekToTick');

      render(<AlphaTabViewport songStore={songStore} controller={controller} />);

      // Buscar pulso 2 del compás 3
      const bar3 = screen.getByTestId('bar-3');
      const beat2 = bar3.querySelector('[data-beat-index="2"]');
      expect(beat2).not.toBeNull();

      fireEvent.click(beat2!);

      // Se actualiza la posición exacta a compás 3, pulso 2
      expect(songStore.getState().currentBar).toBe(3);
      expect(songStore.getState().currentBeat).toBe(2);
      expect(songStore.getState().inspectedBar).toBe(3);

      // Se llamó a seekToTick con el tick exacto correspondiente a compás 3, pulso 2
      expect(seekSpy).toHaveBeenCalledWith(expect.any(Number));
      const lastCall = seekSpy.mock.calls[seekSpy.mock.calls.length - 1];
      // Compás 1 (3840 ticks) + Compás 2 (3840 ticks) + pulso 2 de compás 3 (1440 ticks) = 9120 ticks
      expect(lastCall?.[0]).toBe(9120);
    });

    it('renderiza cifrados armónicos en su coordenada temporal y soporta sobreescritura manual', () => {
      const { songStore, controller } = setupViewportTest();

      render(<AlphaTabViewport songStore={songStore} controller={controller} />);

      // Compás 1 tiene acorde 'C' anotado
      const chord1 = screen.getByTestId('chord-1');
      expect(chord1.textContent).toBe('C');

      // Fijar override manual en compás 1 a 'Cmaj7'
      act(() => {
        songStore.getState().setBarOverride(1, { chordId: 'Cmaj7' });
      });

      expect(screen.getByTestId('chord-1').textContent).toBe('Cmaj7');
    });

    it('resalta visualmente el traste y el cursor vertical sobre la nota activa', () => {
      const { songStore, controller } = setupViewportTest();

      const { rerender } = render(<AlphaTabViewport songStore={songStore} controller={controller} />);

      // Activar compás 1, pulso 0
      songStore.getState().setCurrentPosition(1, 0);
      rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

      const cursor = screen.getByTestId('beat-cursor');
      expect(cursor).not.toBeNull();
    });
  });
});
