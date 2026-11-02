// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { createAlphaSynthController, type AlphaSynthLike } from '../../audio';
import { createSongStore, createMemorySongStorage } from '../../state/song';
import { loadPresetSongModel, PRESET_POP_DIATONIC, type SongModel } from '../../song';
import { AlphaTabViewport } from './AlphaTabViewport';

function setupViewportTest() {
  const storage = createMemorySongStorage();
  const songStore = createSongStore({ storage });
  const controller = createAlphaSynthController();

  let playedBeatCallback: ((beat: unknown) => void) | null = null;
  let playerStateCallback: ((args: { state: number }) => void) | null = null;
  let beatMouseDownCallback: ((beat: unknown) => void) | null = null;
  let beatMouseMoveCallback: ((beat: unknown) => void) | null = null;
  let beatMouseUpCallback: ((beat: unknown) => void) | null = null;
  let destroyCalled = false;

  const mockApi: AlphaSynthLike & {
    destroyCalls: number;
    triggerBeat: (barIndex: number, beatIndex: number) => void;
    triggerBeatMouseDown: (
      barIndex: number,
      beatIndex: number,
      absolutePlaybackStart?: number,
      extra?: Record<string, unknown>,
    ) => void;
    triggerBeatMouseMove: (barIndex: number, beatIndex: number) => void;
    triggerBeatMouseUp: () => void;
    triggerState: (state: number) => void;
    _updateSelectionCursor: (range: unknown) => void;
    _cursorUpdateTick: (tick: number, stop: boolean, speed: number, scroll?: boolean, force?: boolean) => void;
    load?: (data: unknown, tracks?: number[]) => void;
    tex?: (tex: string, tracks?: number[]) => void;
    renderTracks?: (tracks: unknown[]) => void;
    tickCache?: {
      getBeatStart?: (beat: unknown) => number;
      masterBarLookup?: Map<number, { start: number; end: number }>;
    };
  } = {
    destroyCalls: 0,
    tickPosition: 0,
    _updateSelectionCursor: vi.fn(),
    _cursorUpdateTick: vi.fn(),
    load: vi.fn(),
    tex: vi.fn(),
    renderTracks: vi.fn(),
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
    beatMouseDown: {
      on(cb) {
        beatMouseDownCallback = cb;
      },
    },
    beatMouseMove: {
      on(cb) {
        beatMouseMoveCallback = cb;
      },
    },
    beatMouseUp: {
      on(cb) {
        beatMouseUpCallback = cb;
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
    triggerBeatMouseDown(
      barIndex: number,
      beatIndex: number,
      absolutePlaybackStart?: number,
      extra?: Record<string, unknown>,
    ) {
      beatMouseDownCallback?.({
        index: beatIndex,
        absolutePlaybackStart: absolutePlaybackStart ?? 960 * 4 * barIndex + 960 * beatIndex,
        voice: {
          bar: {
            index: barIndex,
          },
        },
        ...extra,
      });
    },
    triggerBeatMouseMove(barIndex: number, beatIndex: number) {
      beatMouseMoveCallback?.({
        index: beatIndex,
        voice: {
          bar: {
            index: barIndex,
          },
        },
      });
    },
    triggerBeatMouseUp() {
      beatMouseUpCallback?.(null);
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

describe('AlphaTabViewport (Hito C5 / C6b — Delegación en AlphaTab y Barra Contextual)', () => {
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
    expect(screen.getByText('8 compases')).not.toBeNull();
  });

  it('renderiza el contenedor DOM real y visible de AlphaTab en el viewport', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    const container = screen.getByTestId('alphatab-container');
    expect(container).not.toBeNull();
    // Verifica que NO tiene position: fixed ni coordenadas fuera de pantalla
    expect(container.style.position).not.toBe('fixed');
    expect(container.style.top).not.toBe('-99999px');
  });

  it('renderiza la barra contextual superior con compás activo, sección y acorde analizado', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('context-overlay-bar')).not.toBeNull();
    // Compás 1
    const barBadge = screen.getByTestId('active-bar-badge');
    expect(barBadge.textContent).toContain('Compás 1');

    // Marcador de sección (Intro en compás 1 de Pop Diatónico)
    const sectionBadge = screen.getByTestId('section-badge');
    expect(sectionBadge.textContent).toBe('Intro');

    // Acorde analizado por Guitar Aid (Do mayor: C, grado I)
    const chordChip = screen.getByTestId('analyzed-chord-chip');
    expect(chordChip.textContent).toContain('C');
    expect(chordChip.textContent).toContain('(I)');
  });

  it('actualiza dinámicamente la barra contextual al cambiar de compás o fijar una sobreescritura manual', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    // Avanzar a compás 5 (Estribillo, Am)
    act(() => {
      songStore.getState().setCurrentPosition(5, 0);
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('active-bar-badge').textContent).toContain('Compás 5');
    expect(screen.getByTestId('section-badge').textContent).toBe('Estribillo');

    const chordChip = screen.getByTestId('analyzed-chord-chip');
    expect(chordChip.textContent).toContain('Am');
    expect(chordChip.textContent).toContain('(i)');
    expect(chordChip.textContent).not.toContain('●');

    // Fijar override manual en compás 5 a 'A7'
    act(() => {
      songStore.getState().setBarOverride(5, { chordId: 'A7' });
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    const updatedChordChip = screen.getByTestId('analyzed-chord-chip');
    expect(updatedChordChip.textContent).toContain('A7');
    // Indicador de punto ámbar de sobreescritura manual
    expect(updatedChordChip.textContent).toContain('●');
  });

  it('muestra los marcadores de bucle activo y de rango seleccionado con botón de quitar selección', () => {
    const { songStore, controller } = setupViewportTest();

    act(() => {
      songStore.getState().setSelectedBarRange([2, 4]);
      songStore.getState().setLoopRange([1, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // Insignia de selección activa
    const rangeBadge = screen.getByTestId('selected-range-badge');
    expect(rangeBadge.textContent).toContain('Selección: c.2–4');

    // Insignia de bucle activo
    const loopBadge = screen.getByTestId('loop-active-badge');
    expect(loopBadge.textContent).toContain('🔁 Bucle c.1–4');

    // Botón para quitar selección
    const clearBtn = screen.getByTitle('Quitar selección');
    fireEvent.click(clearBtn);
    expect(songStore.getState().selectedBarRange).toBeNull();
  });

  it('alterna reactivamente entre los 3 modos nativos de vista (Tab, Partitura + Tab, Partitura)', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    const viewport = screen.getByTestId('alphatab-viewport');

    // Modo por defecto: Tab
    expect(screen.getByText('TABLATURA')).not.toBeNull();
    expect(viewport.getAttribute('data-score-view-mode')).toBe('tab');

    // Modo: Partitura + Tab (score-tab)
    act(() => {
      songStore.getState().setScoreViewMode('score-tab');
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByText('PARTITURA + TAB')).not.toBeNull();
    expect(viewport.getAttribute('data-score-view-mode')).toBe('score-tab');

    // Modo: Solo Partitura (score)
    act(() => {
      songStore.getState().setScoreViewMode('score');
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByText('PARTITURA')).not.toBeNull();
    expect(viewport.getAttribute('data-score-view-mode')).toBe('score');
    // En modo Partitura muestra información técnica de clave
    expect(screen.getByText('Clave de sol (8vb) · 8 compases')).not.toBeNull();
  });

  it('controla la visibilidad de la fila de letra (showLyrics) en el store', () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // showLyrics activo por defecto
    expect(songStore.getState().showLyrics).toBe(true);

    act(() => {
      songStore.getState().setShowLyrics(false);
    });
    expect(songStore.getState().showLyrics).toBe(false);

    act(() => {
      songStore.getState().setShowLyrics(true);
    });
    expect(songStore.getState().showLyrics).toBe(true);
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

    // Fábrica invocada con el contenedor visible
    expect(createApi).toHaveBeenCalledTimes(1);
    expect(createApi).toHaveBeenCalledWith(
      screen.getByTestId('alphatab-container'),
      expect.objectContaining({
        scoreViewMode: 'tab',
        showLyrics: true,
      }),
    );

    // Reproductor adjuntado al controlador
    expect(controller.getPlayer()).toBe(mockApi);

    // Evento de pulso reproducido desde AlphaTab actualiza el store
    act(() => {
      mockApi.triggerBeat(4, 1); // bar 5 (0-based 4), beat 1
    });
    expect(songStore.getState().currentBar).toBe(5);
    expect(songStore.getState().currentBeat).toBe(1);

    // Evento de estado de reproducción
    act(() => {
      mockApi.triggerState(1); // 1 = Playing
    });
    expect(songStore.getState().isPlaying).toBe(true);

    act(() => {
      mockApi.triggerState(0); // 0 = Paused
    });
    expect(songStore.getState().isPlaying).toBe(false);

    // Al desmontar, se desacopla del controlador y se destruye
    unmount();
    expect(controller.getPlayer()).toBeNull();
    expect(isDestroyCalled()).toBe(true);
  });

  it('permite cambiar la posición mediante click del ratón (beatMouseDown) incluso con la reproducción parada', () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Inicialmente en compás 1, pulso 0 y detenido
    expect(songStore.getState().currentBar).toBe(1);
    expect(songStore.getState().currentBeat).toBe(0);
    expect(songStore.getState().isPlaying).toBe(false);

    // El usuario hace click sobre el compás 4 (índice 3), pulso 2 (tick 13440) estando parado
    act(() => {
      mockApi.triggerBeatMouseDown(3, 2, 13440);
    });

    // Se actualiza inmediatamente la posición en el store y se reposiciona en el controlador
    expect(songStore.getState().currentBar).toBe(4);
    expect(songStore.getState().currentBeat).toBe(2);
    expect(controller.getPlayer()?.tickPosition).toBe(13440);
  });

  it('permite selección múltiple de compases manteniendo Shift y haciendo click (Shift + beatMouseDown)', () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Situamos compás 2
    act(() => {
      songStore.getState().setCurrentPosition(2, 0);
    });

    // Shift + Clic en compás 5
    act(() => {
      mockApi.triggerBeatMouseDown(4, 0, undefined, { shiftKey: true });
    });

    expect(songStore.getState().selectedBarRange).toEqual([2, 5]);
    expect(screen.getByTestId('selected-range-badge').textContent).toContain('Selección: c.2–5');
    expect(screen.getByTestId('alphatab-container').getAttribute('data-highlight-mode')).toBe('selection');
    // El cursor de reproducción no se desplaza con Shift + Clic (permanece en compás 2)
    expect(songStore.getState().currentBar).toBe(2);

    // Clic normal en compás 3 sin Shift deselecciona el rango y sitúa la posición en compás 3
    act(() => {
      mockApi.triggerBeatMouseDown(2, 0, undefined, { shiftKey: false });
    });
    expect(songStore.getState().selectedBarRange).toBeNull();
    expect(songStore.getState().currentBar).toBe(3);
  });

  it('permite selección arrastrando el ratón a través de los compases (beatMouseMove)', () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Mousedown en compás 1
    act(() => {
      mockApi.triggerBeatMouseDown(0, 0);
    });

    // Arrastre a compás 3
    act(() => {
      mockApi.triggerBeatMouseMove(2, 0);
    });

    expect(songStore.getState().selectedBarRange).toEqual([1, 3]);
    expect(screen.getByTestId('selected-range-badge').textContent).toContain('Selección: c.1–3');
    expect(screen.getByTestId('alphatab-container').getAttribute('data-highlight-mode')).toBe('selection');

    // Soltar ratón
    act(() => {
      mockApi.triggerBeatMouseUp();
    });

    // La selección permanece intacta tras soltar el ratón
    expect(songStore.getState().selectedBarRange).toEqual([1, 3]);
  });

  it('al hacer click fuera de un bucle activo, desactiva el bucle y sitúa la posición en el compás pulsado', () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Bucle activo en compases 2..4
    act(() => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });
    expect(songStore.getState().loopEnabled).toBe(true);
    expect(controller.isLooping()).toBe(true);

    // Clic en compás 6 (fuera del bucle [2, 4])
    act(() => {
      mockApi.triggerBeatMouseDown(5, 0, 19200);
    });

    // Debe desactivar el bucle para permitir reproducir libremente en compás 6
    expect(songStore.getState().loopEnabled).toBe(false);
    expect(controller.isLooping()).toBe(false);
    expect(songStore.getState().currentBar).toBe(6);
    expect(controller.getPlayer()?.tickPosition).toBe(19200);
  });

  it('analyzed-chord-chip actualiza dinámicamente el acorde según el pulso activo dentro del compás', () => {
    const { songStore, controller } = setupViewportTest();

    const { rerender } = render(
      <AlphaTabViewport songStore={songStore} controller={controller} />,
    );

    // En compás 1, pulso 0 de Pop Diatónico hay un acorde C (I)
    act(() => {
      songStore.getState().setCurrentPosition(1, 0);
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    const chip = screen.getByTestId('analyzed-chord-chip');
    expect(chip.textContent).toContain('C');
    expect(chip.textContent).toContain('(I)');

    // En compás 1, pulso 3 cambia a G (V)
    act(() => {
      songStore.getState().setCurrentPosition(1, 3);
    });
    rerender(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('analyzed-chord-chip').textContent).toContain('G');
    expect(screen.getByTestId('analyzed-chord-chip').textContent).toContain('(V)');
  });

  it('la pista de bajo (4 cuerdas) en modo partitura muestra Clave de fa', () => {
    const { songStore, controller } = setupViewportTest();

    act(() => {
      songStore.getState().setActiveTrackIndex(1); // Bajo Eléctrico (4 cuerdas)
      songStore.getState().setScoreViewMode('score');
    });

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    expect(screen.getByText('BAJO ELÉCTRICO')).not.toBeNull();
    expect(screen.getByText('Clave de fa · 8 compases')).not.toBeNull();
  });

  it('cumple el Criterio de Aceptación (k): vistas de partitura, bucle, velocidad y mezclador multipista', async () => {
    const { songStore, controller } = setupViewportTest();

    render(<AlphaTabViewport songStore={songStore} controller={controller} />);

    // 1. Vistas de partitura
    act(() => {
      songStore.getState().setScoreViewMode('score-tab');
    });
    expect(songStore.getState().scoreViewMode).toBe('score-tab');
    act(() => {
      songStore.getState().setScoreViewMode('score');
    });
    expect(songStore.getState().scoreViewMode).toBe('score');
    act(() => {
      songStore.getState().setScoreViewMode('tab');
    });
    expect(songStore.getState().scoreViewMode).toBe('tab');

    // 2. Configurar bucle A–B (compases 2..6 calculan 3840..23040 ticks en 4/4)
    act(() => {
      songStore.getState().setLoopRange([2, 6]);
      songStore.getState().setLoopEnabled(true);
    });

    expect(controller.isLooping()).toBe(true);
    expect(controller.getPlaybackRange()).toEqual({ startTick: 3840, endTick: 23040 });

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

  it('carga correctamente canciones no predefinidas que poseen rawData (GP3, GP4, GP5, GPX) invocando api.load con los bytes originales', async () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Inicialmente carga el preset Pop Diatónico usando tex
    expect(mockApi.tex).toHaveBeenCalled();

    // Ahora se importa y activa una canción de Guitar Pro con rawData binario
    const customBytes = new Uint8Array([71, 80, 53, 0, 1, 2]); // Simulación de GP
    const baseModel = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const customSong = {
      ...baseModel,
      id: 'user-imported-gp5',
      title: 'Solo de Metal en Drop D',
      rawData: customBytes,
      alphaTex: undefined,
    };

    await act(async () => {
      await songStore.getState().setActiveSong(customSong);
    });

    // Se debe haber invocado api.load con los bytes originales y la pista activa
    expect(mockApi.load).toHaveBeenCalledWith(customBytes, [0]);
  });

  it('en pista de percusión, viewModeLabel y badge renderizan siempre PARTITURA y subtítulo de Percusión', async () => {
    const { songStore, controller, createApi } = setupViewportTest();

    const baseModel = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const songWithDrums: SongModel = {
      ...baseModel,
      id: 'drums-viewport-song',
      title: 'Canción con batería',
      tracks: [
        baseModel.tracks[0]!,
        {
          ...baseModel.tracks[0]!,
          index: 1,
          name: 'Batería',
          isPercussion: true,
        },
      ],
    };

    await act(async () => {
      await songStore.getState().setActiveSong(songWithDrums);
      songStore.getState().setActiveTrackIndex(1);
    });

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Badge en cabecera
    const viewModeBadge = screen.getByText('PARTITURA');
    expect(viewModeBadge).toBeTruthy();

    // Subtítulo técnico
    const subtitle = screen.getByText(/Percusión/i);
    expect(subtitle).toBeTruthy();
  });

  it('utiliza tickCache.getBeatStart en beatMouseDown para resolver la posición real en compases con repetición', async () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    // Simulamos un tickCache donde el compás 13 tras repetición x4 devuelve un tick superior al raw
    mockApi.tickCache = {
      getBeatStart: vi.fn((beat: unknown) => {
        const b = beat as { voice?: { bar?: { index?: number } }; index?: number };
        const barIdx = b.voice?.bar?.index ?? 0;
        const beatIdx = b.index ?? 0;
        // Simular desfase por repeticiones
        return (barIdx + 12) * 3840 + beatIdx * 960;
      }),
    };

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    const seekSpy = vi.spyOn(controller, 'seekToTick');

    // Clic en compás 13 (índice 12), pulso 0
    act(() => {
      mockApi.triggerBeatMouseDown(12, 0, 12 * 3840);
    });

    // Debe haber llamado a tickCache.getBeatStart y pasado el tick calculado al controlador
    expect(mockApi.tickCache.getBeatStart).toHaveBeenCalled();
    expect(seekSpy).toHaveBeenCalledWith((12 + 12) * 3840);
  });

  it('permite alternar el seguimiento de reproducción (Bloquear vista) mediante el botón en la barra contextual', () => {
    const { songStore, controller, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    expect(songStore.getState().followPlayback).toBe(true);
    const toggleBtn = screen.getByTestId('viewport-toggle-follow-btn');
    expect(toggleBtn.textContent).toContain('🔒 Seguir');

    // Clic para cambiar a libre
    fireEvent.click(toggleBtn);
    expect(songStore.getState().followPlayback).toBe(false);
    expect(toggleBtn.textContent).toContain('🔓 Libre');

    // Clic de nuevo para volver a seguir
    fireEvent.click(toggleBtn);
    expect(songStore.getState().followPlayback).toBe(true);
    expect(toggleBtn.textContent).toContain('🔒 Seguir');
  });

  it('eliminar la canción activa no provoca un fallo en AlphaTabViewport y reinicializa la pista', async () => {
    const { songStore, controller, createApi } = setupViewportTest();

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Activar una canción guardada
    const baseModel = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const customSong: SongModel = {
      ...baseModel,
      id: 'active-song-to-delete',
      title: 'Canción a eliminar',
    };

    await act(async () => {
      await songStore.getState().importSong(customSong);
    });
    expect(songStore.getState().activeSong?.id).toBe('active-song-to-delete');

    // Eliminar la canción activa
    await act(async () => {
      await songStore.getState().deleteSavedSong('active-song-to-delete');
    });

    // AlphaTabViewport sigue montado y la canción por defecto está activa
    expect(songStore.getState().activeSong?.id).toBe(PRESET_POP_DIATONIC.id);
    expect(screen.getByTestId('alphatab-viewport')).toBeTruthy();
  });

  it('al activar bucle o seleccionar compases en partitura con repeticiones, sincroniza el rango exacto de tickCache sin desfases', async () => {
    const { songStore, controller, mockApi, createApi } = setupViewportTest();

    // Simular que los compases 37 y 38 están desplazados en la línea de tiempo por repeticiones previas
    mockApi.tickCache = {
      masterBarLookup: new Map([
        [36, { start: 276480, end: 280320 }],
        [37, { start: 280320, end: 284160 }],
      ]),
    };

    render(
      <AlphaTabViewport
        songStore={songStore}
        controller={controller}
        createApi={createApi}
      />,
    );

    // Activar bucle en compases 37–38
    act(() => {
      songStore.getState().setLoopRange([37, 38]);
      songStore.getState().setLoopEnabled(true);
    });

    // El controlador debe recibir exactamente los ticks de los compases 37 y 38 (276480 a 284160), no ticks planos
    expect(controller.getPlaybackRange()).toEqual({
      startTick: 276480,
      endTick: 284160,
    });

    // _updateSelectionCursor debe recibir el rango correspondiente
    expect(mockApi._updateSelectionCursor).toHaveBeenCalledWith({
      startTick: 276480,
      endTick: 284160 - 10,
    });
  });
});
