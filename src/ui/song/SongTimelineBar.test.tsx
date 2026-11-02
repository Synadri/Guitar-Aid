// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createSongStore } from '../../state/song';
import { SongTimelineBar } from './SongTimelineBar';
import { loadPresetSongModel, PRESET_POP_DIATONIC } from '../../song';
import type { AlphaSynthController } from '../../audio';

afterEach(() => {
  cleanup();
});

function setupTimelineTest() {
  const songStore = createSongStore();
  const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
  if (song) {
    songStore.getState().setActiveSong(song);
  }

  const mockPlayer = {
    tickPosition: 0,
    timePosition: 0,
    playbackRange: null,
  };

  const controller: AlphaSynthController = {
    isReady: () => true,
    isPlaying: () => false,
    isLooping: () => false,
    play: vi.fn(),
    pause: vi.fn(),
    playPause: vi.fn(),
    stop: vi.fn(),
    seekToTick: vi.fn((tick: number) => {
      mockPlayer.tickPosition = tick;
    }),
    seekToTime: vi.fn(),
    setSpeed: vi.fn(),
    setVolume: vi.fn(),
    setMetronome: vi.fn(),
    setPlaybackRange: vi.fn(),
    setLoopEnabled: vi.fn(),
    getPlayer: () => mockPlayer as unknown as ReturnType<AlphaSynthController['getPlayer']>,
  } as unknown as AlphaSynthController;

  return { songStore, controller, mockPlayer };
}

describe('SongTimelineBar — Hito C8 Parte 1 (Cinta armónica y segmentos intra-compás)', () => {
  it('renderiza la estructura de dos filas: bloques de sección y celdas de compás', () => {
    const { songStore, controller } = setupTimelineTest();

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('song-timeline-bar')).not.toBeNull();
    expect(screen.getByTestId('timeline-scroll-area')).not.toBeNull();

    // Verificamos presencia de bloques de sección (Intro, Estribillo, Estrofa en Pop Diatónico)
    expect(screen.getByTestId('section-block-1')).not.toBeNull();
    expect(screen.getByText(/Intro · C mayor/i)).not.toBeNull();

    // Verificamos presencia de celdas de compás (1..8)
    expect(screen.getByTestId('timeline-bar-1')).not.toBeNull();
    expect(screen.getByTestId('timeline-bar-2')).not.toBeNull();
    expect(screen.getByTestId('timeline-bar-5')).not.toBeNull();
  });

  it('al hacer clic en un bloque de sección selecciona todos sus compases y posiciona el cursor', () => {
    const { songStore, controller } = setupTimelineTest();

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    // Pop Diatónico: Sección Estribillo va de compás 5 a 8
    const chorusBlock = screen.getByTestId('section-block-5');
    fireEvent.click(chorusBlock);

    expect(songStore.getState().selectedBarRange).toEqual([5, 8]);
    expect(songStore.getState().currentBar).toBe(5);
    expect(controller.seekToTick).toHaveBeenCalled();
  });

  it('soporta segmentos proporcionales intra-compás (BarChordSegment) y renderiza sus sub-slots', () => {
    const { songStore, controller } = setupTimelineTest();

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    // Compás 1 de Pop Diatónico: contiene segmentos armónicos
    const seg0 = screen.getByTestId('bar-segment-1-0');
    expect(seg0).not.toBeNull();
    expect(seg0.textContent).toBe('C');
  });

  it('ilumina dinámicamente en ámbar el sub-slot del segmento activo según el pulso de reproducción', () => {
    const { songStore, controller } = setupTimelineTest();

    const { rerender } = render(<SongTimelineBar songStore={songStore} controller={controller} />);

    // Compás 1 pulso 0: activo slot 0
    act(() => {
      songStore.getState().setCurrentPosition(1, 0);
    });
    rerender(<SongTimelineBar songStore={songStore} controller={controller} />);

    const slot0 = screen.getByTestId('bar-segment-1-0');
    expect(slot0.getAttribute('data-active-slot')).toBe('true');
  });

  it('muestra el punto ámbar en compases que tienen sobreescritura manual (override)', () => {
    const { songStore, controller } = setupTimelineTest();

    const { rerender } = render(<SongTimelineBar songStore={songStore} controller={controller} />);

    expect(screen.queryByTestId('override-dot-3')).toBeNull();

    // Fijamos override manual en compás 3
    act(() => {
      songStore.getState().setBarOverride(3, { chordId: 'Fmaj7' });
    });
    rerender(<SongTimelineBar songStore={songStore} controller={controller} />);

    expect(screen.getByTestId('override-dot-3')).not.toBeNull();
  });

  it('permite selección de rangos con Shift + Clic', () => {
    const { songStore, controller } = setupTimelineTest();

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    // Situamos compás 2
    act(() => {
      songStore.getState().setCurrentPosition(2, 0);
    });

    // Shift + Clic en compás 6
    const bar6 = screen.getByTestId('timeline-bar-6');
    fireEvent.mouseDown(bar6, { button: 0, shiftKey: true });

    expect(songStore.getState().selectedBarRange).toEqual([2, 6]);
  });

  it('permite colapsar y expandir la cinta armónica con el botón de colapso rápido', () => {
    const { songStore, controller } = setupTimelineTest();

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    // Botón ocultar cinta
    const hideBtn = screen.getByRole('button', { name: /Ocultar cinta de compases/i });
    fireEvent.click(hideBtn);

    // Debe mostrar la vista colapsada
    expect(screen.getByTestId('song-timeline-bar-collapsed')).not.toBeNull();
    expect(screen.queryByTestId('song-timeline-bar')).toBeNull();

    // Botón para volver a expandir
    const showBtn = screen.getByRole('button', { name: /Mostrar cinta armónica de compases/i });
    fireEvent.click(showBtn);

    expect(screen.getByTestId('song-timeline-bar')).not.toBeNull();
  });

  it('aplica el estilo turquesa barSelected a los compases dentro del bucle o selección', () => {
    const { songStore, controller } = setupTimelineTest();

    act(() => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    render(<SongTimelineBar songStore={songStore} controller={controller} />);

    const bar3 = screen.getByTestId('timeline-bar-3');
    expect(bar3.className).toContain('barSelected');
  });

  it('dimensiona las celdas a 120px para garantizar legibilidad de 4 a 6 compases sin compresión', () => {
    const { songStore, controller } = setupTimelineTest();

    const { container } = render(<SongTimelineBar songStore={songStore} controller={controller} />);

    const grid = container.querySelector('[data-testid="timeline-scroll-area"] > div') as HTMLElement;
    expect(grid).not.toBeNull();
    // 8 compases * 120px = 960px (+ espaciado entre columnas)
    expect(grid.style.gridTemplateColumns).toContain('repeat(8, 120px)');
  });
});
