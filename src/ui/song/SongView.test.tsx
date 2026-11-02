// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAlphaSynthController,
  type AlphaSynthController,
  type AlphaSynthLike,
} from '../../audio';
import {
  createMemorySongStorage,
  createSandboxStore,
  createSettingsStore,
  createSongStore,
} from '../../state';
import {
  calculateTickForBarBeat,
  loadPresetSongModel,
  PRESET_POP_DIATONIC,
  type SongModel,
} from '../../song';
import { SongView } from './SongView';

afterEach(() => {
  cleanup();
});

function createMockPlayer(): AlphaSynthLike {
  let isPlaying = false;
  const speed = 1.0;
  let vol = 0.8;

  return {
    isReadyForPlayback: true,
    masterVolume: vol,
    playbackSpeed: speed,
    metronomeVolume: 0.8,
    countInVolume: 1.0,
    isLooping: false,
    playbackRange: null,
    play: vi.fn(async () => {
      isPlaying = true;
      return true;
    }),
    pause: vi.fn(() => {
      isPlaying = false;
    }),
    playPause: vi.fn(async () => {
      isPlaying = !isPlaying;
      return true;
    }),
    stop: vi.fn(() => {
      isPlaying = false;
    }),
    changeTrackMute: vi.fn(),
    changeTrackSolo: vi.fn(),
    changeTrackVolume: vi.fn(),
    setChannelMute: vi.fn(),
    setChannelSolo: vi.fn(),
    setChannelVolume: vi.fn((_ch, v) => {
      vol = v;
    }),
  };
}

function setupSongView(presetId = PRESET_POP_DIATONIC.id) {
  const songStorage = createMemorySongStorage();
  const initialSong = loadPresetSongModel(presetId);
  const songStore = createSongStore({
    storage: songStorage,
    initialSong,
  });
  const settingsStore = createSettingsStore({
    storageName: `test-settings-songview-${Math.random()}`,
  });
  const sandboxStore = createSandboxStore();

  const mockPlayer = createMockPlayer();
  const controller: AlphaSynthController = createAlphaSynthController({
    player: mockPlayer,
  });

  const renderResult = render(
    <SongView
      songStore={songStore}
      settingsStore={settingsStore}
      sandboxStore={sandboxStore}
      controller={controller}
      createApi={() => mockPlayer}
    />,
  );

  return {
    ...renderResult,
    songStore,
    settingsStore,
    sandboxStore,
    controller,
    mockPlayer,
  };
}

describe('SongView — Hito C6 (UI Parte 1: Instrumentos en vivo, Transporte y Mezclador)', () => {
  it('renderiza la estructura principal completa de SongView (TopBar, ContextStrip, Mástil, Piano y Visor)', () => {
    setupSongView();

    expect(screen.getByTestId('song-view')).toBeTruthy();
    expect(screen.getByTestId('song-top-bar')).toBeTruthy();
    expect(screen.getByTestId('song-context-strip')).toBeTruthy();
    expect(screen.getByTestId('fretboard')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Teclado de piano' })).toBeTruthy();
    expect(screen.getByTestId('alphatab-viewport')).toBeTruthy();
    expect(screen.getByTestId('song-timeline-bar')).toBeTruthy();
    expect(screen.getByTestId('song-analysis-panel')).toBeTruthy();
  });

  it('(Criterio i) Fretboard y Piano muestran en vivo las notas del pulso activo (pinned / root) superpuestas a la escala (scale-bg)', () => {
    const { container } = setupSongView();

    // En compás 1, pulso 0 de Pop Diatónico (Acorde C mayor en Do mayor)
    // Fondo de escala: scale-bg presente en mástil
    const scaleBgMarks = container.querySelectorAll('[data-role="scale-bg"]');
    expect(scaleBgMarks.length).toBeGreaterThan(0);

    // Notas activas del pulso: pinned presentes
    const pinnedMarks = container.querySelectorAll('[data-role="pinned"]');
    expect(pinnedMarks.length).toBeGreaterThan(0);

    // Piano: tecla C3 (midi 48) o C4 (midi 60) marcada como root / isRoot
    const pianoC = container.querySelector('[data-midi="48"]') ?? container.querySelector('[data-midi="60"]');
    expect(pianoC).not.toBeNull();
  });

  it('(Criterio i) al cambiar de compás, las marcas del mástil y del piano se recalculan en tiempo real', () => {
    const { container, songStore } = setupSongView();

    // Compás 1 tiene acorde C (cuerda 5 traste 3 es C3 pinned)
    const posC = container.querySelector('[data-string="5"][data-fret="3"]');
    expect(posC?.getAttribute('data-role')).toBe('pinned');

    // Cambiar a compás 2 (acorde Am en el preset Pop Diatónico: cuerda 3 traste 2 es A3 pinned)
    act(() => {
      songStore.getState().setCurrentBar(2);
    });

    const posA = container.querySelector('[data-string="3"][data-fret="2"]');
    expect(posA?.getAttribute('data-role')).toBe('pinned');
  });

  it('(Criterio i) cambiar de pista adapta automáticamente la afinación del Fretboard sin tocar el Sandbox', () => {
    const { container, songStore, sandboxStore } = setupSongView();

    // Sandbox arranca en estándar
    expect(sandboxStore.getState().tuning.id).toBe('standard');

    // En la canción Pop Diatónico, la pista 1 es Bajo eléctrico de 4 cuerdas
    const tracks = songStore.getState().activeSong?.tracks ?? [];
    expect(tracks.length).toBeGreaterThan(1);
    const bassTrack = tracks[1];
    expect(bassTrack?.stringCount).toBe(4);

    // Conmutar a la pista 1 (Bajo) mediante el selector de pista en la TopBar
    const trackSelect = screen.getByRole('combobox', { name: 'Seleccionar pista activa' });
    fireEvent.change(trackSelect, { target: { value: '1' } });

    // El mástil ahora tiene la afinación del bajo (4 cuerdas)
    const stringLines = container.querySelectorAll('[data-string-line]');
    expect(stringLines.length).toBe(4);

    // El Sandbox sigue en estándar sin alterarse
    expect(sandboxStore.getState().tuning.id).toBe('standard');
  });

  it('soporta cejilla (capoFret > 0) dibujando la barra de cejilla y atenuando los trastes anteriores', async () => {
    const { container, songStore } = setupSongView(PRESET_POP_DIATONIC.id);

    // Crear una pista simulada con capoFret: 2
    const currentSong = songStore.getState().activeSong!;
    const trackWithCapo = {
      ...currentSong.tracks[0]!,
      capoFret: 2,
    };
    const songWithCapo = {
      ...currentSong,
      tracks: [trackWithCapo, ...currentSong.tracks.slice(1)],
    };

    await act(async () => {
      await songStore.getState().setActiveSong(songWithCapo);
    });

    // La barra de cejilla está presente
    const capoBar = container.querySelector('[data-testid="fretboard-capo"]');
    expect(capoBar).not.toBeNull();
    expect(capoBar?.getAttribute('data-capo-fret')).toBe('2');

    // Los trastes anteriores al traste 2 (traste 1) tienen opacidad atenuada 0.28
    const posFret1 = container.querySelector('[data-string="5"][data-fret="1"]') as HTMLElement | null;
    expect(posFret1?.style.opacity).toBe('0.28');
  });

  it('(Criterio k) Transporte: Play/Pausa, velocidad variable, metrónomo y conmutación de vista', async () => {
    const { songStore, controller } = setupSongView();

    // 1. Play / Pausa
    const playBtn = screen.getByRole('button', { name: /Reproducir/i });
    expect(songStore.getState().isPlaying).toBe(false);

    await act(async () => {
      fireEvent.click(playBtn);
    });
    expect(controller.isPlaying()).toBe(true);

    // 2. Velocidad: botones − y + recorren los pasos SPEED_STEPS
    expect(songStore.getState().playbackSpeed).toBe(1.0);
    const speedDownBtn = screen.getByRole('button', { name: 'Reducir velocidad' });
    fireEvent.click(speedDownBtn);
    expect(songStore.getState().playbackSpeed).toBe(0.75);

    const speedUpBtn = screen.getByRole('button', { name: 'Aumentar velocidad' });
    fireEvent.click(speedUpBtn);
    expect(songStore.getState().playbackSpeed).toBe(1.0);

    // 3. Metrónomo
    const metronomeBtn = screen.getByRole('button', { name: 'Metrónomo' });
    expect(songStore.getState().metronomeEnabled).toBe(false);
    fireEvent.click(metronomeBtn);
    expect(songStore.getState().metronomeEnabled).toBe(true);

    // 4. Conmutar vista (Tab -> Partitura + Tab -> Partitura)
    const scoreTabBtn = screen.getByRole('button', { name: 'Vista Partitura y Tablatura' });
    fireEvent.click(scoreTabBtn);
    expect(songStore.getState().scoreViewMode).toBe('score-tab');

    // 5. Letra
    const lyricsBtn = screen.getByRole('button', { name: 'Mostrar u ocultar letra' });
    expect(songStore.getState().showLyrics).toBe(true);
    fireEvent.click(lyricsBtn);
    expect(songStore.getState().showLyrics).toBe(false);
  });

  it('(Criterio k) Mezclador multipista: abre TrackMixerPopover y controla Mute, Solo y Volumen por pista', () => {
    const { songStore } = setupSongView();

    // Abrir mezclador
    const mixerBtn = screen.getByRole('button', { name: 'Mezclador multipista' });
    fireEvent.click(mixerBtn);

    // Popover abierto
    const popover = screen.getByTestId('track-mixer-popover');
    expect(popover).toBeTruthy();

    // Silenciar primera pista (M)
    const track0Row = popover.querySelector('[data-track-index="0"]')!;
    const muteBtn = within(track0Row as HTMLElement).getByRole('button', { name: /Silenciar/i });
    fireEvent.click(muteBtn);
    expect(songStore.getState().trackMixer[0]?.muted).toBe(true);

    // Solo primera pista (S)
    const soloBtn = within(track0Row as HTMLElement).getByRole('button', { name: /Solo/i });
    fireEvent.click(soloBtn);
    expect(songStore.getState().trackMixer[0]?.solo).toBe(true);

    // Volumen primera pista
    const slider = within(track0Row as HTMLElement).getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.6' } });
    expect(songStore.getState().trackMixer[0]?.volume).toBe(0.6);

    // Cuenta atrás
    const countInBtn = screen.getByRole('button', { name: /Cuenta atrás/i });
    fireEvent.click(countInBtn);
    expect(songStore.getState().countInEnabled).toBe(true);

    // Restablecer
    const resetBtn = screen.getByRole('button', { name: 'Restablecer' });
    fireEvent.click(resetBtn);
    expect(songStore.getState().trackMixer).toEqual({});

    // Cerrar con Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('track-mixer-popover')).toBeNull();
  });

  it('SongContextStrip: conmutador de GRADOS (Tonalidad vs Acorde) y ETIQUETAS', () => {
    const { songStore, settingsStore } = setupSongView();

    // Conmutador de grados: por defecto 'chord'
    expect(songStore.getState().degreeReferenceMode).toBe('chord');
    const keyDegreeBtn = screen.getByRole('button', { name: 'Grados respecto a la tonalidad' });
    fireEvent.click(keyDegreeBtn);
    expect(songStore.getState().degreeReferenceMode).toBe('key');

    // Conmutador de etiquetas
    const intervalBtn = screen.getByRole('button', { name: 'Intervalo' });
    fireEvent.click(intervalBtn);
    expect(settingsStore.getState().labels).toBe('interval');
  });

  it('Sobreescritura manual (override): fijar acorde en compás actual muestra indicador y actualiza el store', async () => {
    const { songStore } = setupSongView();

    // Compás 1
    songStore.getState().setCurrentBar(1);

    // Desplegable de acorde
    const chordPill = screen.getByRole('button', { name: 'Acorde activo' });
    fireEvent.click(chordPill);

    // Seleccionar candidato alternativo
    const candBtns = screen.getAllByRole('button');
    const amCand = candBtns.find((b) => b.textContent?.includes('Am') || b.textContent?.includes('C'));
    expect(amCand).toBeTruthy();

    await act(async () => {
      await songStore.getState().setBarOverride(1, { chordId: 'Am7' });
    });

    // Ahora tiene override
    expect(songStore.getState().barOverrides[1]?.chordId).toBe('Am7');
    expect(chordPill.textContent).toContain('●');
  });

  it('Atajos de teclado en SongView: Espacio (Play/Pausa), L (Bucle), flechas (compás)', async () => {
    const { songStore, controller } = setupSongView();

    // Espacio: Play
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(controller.isPlaying()).toBe(true);

    // Flecha derecha: avanza de compás
    expect(songStore.getState().currentBar).toBe(1);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(songStore.getState().currentBar).toBe(2);

    // Flecha izquierda: retrocede de compás
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(songStore.getState().currentBar).toBe(1);

    // L: toggle bucle
    expect(songStore.getState().loopEnabled).toBe(false);
    act(() => {
      fireEvent.keyDown(window, { key: 'l' });
    });
    expect(songStore.getState().loopEnabled).toBe(true);
    expect(controller.isLooping()).toBe(true);
    expect(controller.getPlaybackRange()).toEqual({ startTick: 0, endTick: 3840 });

    // L de nuevo: desactiva bucle
    act(() => {
      fireEvent.keyDown(window, { key: 'l' });
    });
    expect(songStore.getState().loopEnabled).toBe(false);
    expect(controller.isLooping()).toBe(false);
    expect(controller.getPlaybackRange()).toBeNull();
  });

  it('al pulsar Play con bucle activo y cursor fuera de él, reposiciona la reproducción al inicio del bucle', async () => {
    const { songStore, controller } = setupSongView();

    // Cursor en compás 1
    expect(songStore.getState().currentBar).toBe(1);

    // Bucle activo en compases 3..5
    act(() => {
      songStore.getState().setLoopRange([3, 5]);
      songStore.getState().setLoopEnabled(true);
    });

    // Iniciar Play con barra espaciadora
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });

    // Debe haberse reposicionado al inicio del bucle (compás 3, pulso 0 = tick 7680)
    expect(songStore.getState().currentBar).toBe(3);
    expect(songStore.getState().currentBeat).toBe(0);
    expect(controller.isPlaying()).toBe(true);
  });

  it('Restablecimiento independiente de sobreescrituras (overrides): restablecer tonalidad no borra acorde y viceversa', async () => {
    const { songStore } = setupSongView();

    // 1. Fijar tanto escala como acorde en el compás 1
    await act(async () => {
      await songStore.getState().setBarOverride(1, { tonic: 0, scaleId: 'major', chordId: 'Cmaj7' });
    });

    expect(songStore.getState().barOverrides[1]?.tonic).toBe(0);
    expect(songStore.getState().barOverrides[1]?.scaleId).toBe('major');
    expect(songStore.getState().barOverrides[1]?.chordId).toBe('Cmaj7');

    // 2. Abrir menú de tonalidad y pulsar restablecer
    const keyPill = screen.getByRole('button', { name: 'Tonalidad activa' });
    fireEvent.click(keyPill);

    const resetKeyBtn = screen.getByRole('button', { name: 'Restablecer a automática' });
    await act(async () => {
      fireEvent.click(resetKeyBtn);
    });

    // La escala se borró, pero el acorde Cmaj7 permanece intacto
    expect(songStore.getState().barOverrides[1]?.tonic).toBeUndefined();
    expect(songStore.getState().barOverrides[1]?.scaleId).toBeUndefined();
    expect(songStore.getState().barOverrides[1]?.chordId).toBe('Cmaj7');

    // 3. Abrir menú de acorde y pulsar restablecer
    const chordPill = screen.getByRole('button', { name: 'Acorde activo' });
    fireEvent.click(chordPill);

    const resetChordBtn = screen.getByRole('button', { name: 'Restablecer a automático' });
    await act(async () => {
      fireEvent.click(resetChordBtn);
    });

    // Ahora se borró el acorde también y el compás 1 queda completamente limpio
    expect(songStore.getState().barOverrides[1]).toBeUndefined();
  });

  it('Visualización de bucle: resalta el botón en SongTopBar y el distintivo en la barra contextual', async () => {
    const { songStore, controller } = setupSongView();

    await act(async () => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    // Botón de bucle en SongTopBar activado
    const loopBtn = screen.getByRole('button', { name: /Bucle 2–4/i });
    expect(loopBtn.getAttribute('aria-pressed')).toBe('true');

    // Distintivo de bucle en la barra contextual de AlphaTabViewport
    const loopBadge = screen.getByTestId('loop-active-badge');
    expect(loopBadge.textContent).toContain('🔁 Bucle c.2–4');

    // Controlador sincronizado en modo bucle
    expect(controller.isLooping()).toBe(true);
  });

  it('al cambiar de pista no se pausa la reproducción activa ni se destruye el reproductor', async () => {
    const { songStore, controller, mockPlayer } = setupSongView();

    // Iniciar reproducción
    await act(async () => {
      await controller.play();
      songStore.getState().setIsPlaying(true);
    });
    expect(controller.isPlaying()).toBe(true);

    // Cambiar de pista a la pista 1 (Bajo)
    const trackSelect = screen.getByLabelText('Seleccionar pista activa');
    act(() => {
      fireEvent.change(trackSelect, { target: { value: '1' } });
    });

    // La pista activa ahora es 1, pero la reproducción NO se pausa
    expect(songStore.getState().activeTrackIndex).toBe(1);
    expect(controller.isPlaying()).toBe(true);
    expect(songStore.getState().isPlaying).toBe(true);
    // El reproductor sigue conectado al controlador
    expect(controller.getPlayer()).toBe(mockPlayer);
  });

  it('al cambiar de pista durante la reproducción con un bucle activo, no salta al inicio del bucle', async () => {
    const { songStore, controller, mockPlayer } = setupSongView();

    // Activar bucle en compases 2..5
    act(() => {
      songStore.getState().setLoopRange([2, 5]);
      songStore.getState().setLoopEnabled(true);
    });

    // Iniciar reproducción
    await act(async () => {
      await controller.play();
      songStore.getState().setIsPlaying(true);
    });

    // Supongamos que la reproducción avanza por el compás 4 (tick 11520)
    controller.seekToTick(11520);
    act(() => {
      songStore.getState().setCurrentPosition(4, 0);
    });
    expect(mockPlayer.tickPosition).toBe(11520);

    // Cambiar de pista a la pista 1 (Bajo)
    const trackSelect = screen.getByLabelText('Seleccionar pista activa');
    act(() => {
      fireEvent.change(trackSelect, { target: { value: '1' } });
    });

    // La reproducción sigue activa y la posición no se ha reiniciado al compás 2 (3840)
    expect(controller.isPlaying()).toBe(true);
    expect(mockPlayer.tickPosition).toBe(11520);
    expect(songStore.getState().currentBar).toBe(4);
  });

  it('al cambiar de pista y pulsar reproducir se continúa desde el compás/pulso actual', async () => {
    const { songStore, controller } = setupSongView();

    // Situarse en el compás 3, pulso 1
    act(() => {
      songStore.getState().setCurrentPosition(3, 1);
    });
    expect(songStore.getState().currentBar).toBe(3);
    expect(songStore.getState().currentBeat).toBe(1);

    // Cambiar de pista a la pista 1
    const trackSelect = screen.getByLabelText('Seleccionar pista activa');
    act(() => {
      fireEvent.change(trackSelect, { target: { value: '1' } });
    });

    expect(songStore.getState().activeTrackIndex).toBe(1);
    expect(songStore.getState().currentBar).toBe(3);
    expect(songStore.getState().currentBeat).toBe(1);

    // Pulsar reproducir desde el transporte
    const playBtn = screen.getByRole('button', { name: 'Reproducir' });
    await act(async () => {
      fireEvent.click(playBtn);
    });

    // El reproductor ha sido posicionado en el tick correspondiente al compás 3 pulso 1
    const expectedTick = calculateTickForBarBeat(songStore.getState().activeSong?.tracks[1]?.bars, 3, 1);
    expect(controller.getPlayer()?.tickPosition).toBe(expectedTick);
    expect(controller.isPlaying()).toBe(true);
  });

  it('los niveles del mezclador modifican la pista seleccionada independientemente de qué pista esté activa', () => {
    const { songStore, mockPlayer } = setupSongView();

    // Seleccionar pista activa 1
    act(() => {
      songStore.getState().setActiveTrackIndex(1);
    });
    expect(songStore.getState().activeTrackIndex).toBe(1);

    // Abrir mezclador
    const mixerBtn = screen.getByRole('button', { name: 'Mezclador multipista' });
    fireEvent.click(mixerBtn);
    const popover = screen.getByTestId('track-mixer-popover');

    // Modificar volumen de la Pista 0 (Guitarra) mientras la activa es Pista 1 (Bajo)
    const track0Row = popover.querySelector('[data-track-index="0"]')!;
    const slider0 = within(track0Row as HTMLElement).getByRole('slider');
    fireEvent.change(slider0, { target: { value: '0.4' } });

    // Se actualiza el store y el reproductor para la pista 0
    expect(songStore.getState().trackMixer[0]?.volume).toBe(0.4);
    expect(mockPlayer.changeTrackVolume).toHaveBeenCalledWith([0], 0.4);

    // Modificar volumen de la Pista 1 (Bajo)
    const track1Row = popover.querySelector('[data-track-index="1"]')!;
    const slider1 = within(track1Row as HTMLElement).getByRole('slider');
    fireEvent.change(slider1, { target: { value: '0.7' } });

    expect(songStore.getState().trackMixer[1]?.volume).toBe(0.7);
    expect(mockPlayer.changeTrackVolume).toHaveBeenCalledWith([1], 0.7);
  });

  describe('Hito C7 — Integración de Biblioteca y Drag & Drop en SongView', () => {
    it('al pulsar el botón Canciones en SongTopBar se abre SongLibraryModal', async () => {
      setupSongView();

      expect(screen.queryByRole('dialog', { name: /Biblioteca de canciones/i })).toBeNull();

      const songsBtn = screen.getByRole('button', { name: 'Biblioteca de canciones' });
      fireEvent.click(songsBtn);

      const modal = await screen.findByRole('dialog', { name: /Biblioteca de canciones/i });
      expect(modal).toBeTruthy();

      // Cerrar modal
      const closeBtn = screen.getByTestId('close-song-library-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog', { name: /Biblioteca de canciones/i })).toBeNull();
    });

    it('arrastrar un archivo sobre SongView muestra el overlay visual y al soltarlo lo importa', async () => {
      const { songStore } = setupSongView();
      const songView = screen.getByTestId('song-view');

      // Al entrar con arrastre de archivos, se muestra el overlay
      fireEvent.dragEnter(songView, {
        dataTransfer: { types: ['Files'] },
      });
      expect(screen.getByTestId('song-view-drag-overlay')).toBeTruthy();

      // Al salir el arrastre, se oculta
      fireEvent.dragLeave(songView);
      expect(screen.queryByTestId('song-view-drag-overlay')).toBeNull();

      // Al soltar un archivo AlphaTex válido
      const validTex = `\\title "Canción Drag & Drop"
\\tempo 120
.
\\track "Gtr"
:4 0.1 1.2 2.3 3.4 |`;
      const file = new File([validTex], 'drag.tex', { type: 'text/plain' });

      fireEvent.drop(songView, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(songStore.getState().activeSong?.title).toBe('Canción Drag & Drop');
        expect(screen.queryByTestId('song-view-drag-overlay')).toBeNull();
      });
    });

    it('al soltar un archivo corrupto abre SongLibraryModal con el aviso accesible', async () => {
      const { songStore } = setupSongView();
      const songView = screen.getByTestId('song-view');
      const prevTitle = songStore.getState().activeSong?.title;

      const corruptFile = new File([new Uint8Array([0, 1, 2, 3])], 'error.gp5', {
        type: 'application/octet-stream',
      });

      fireEvent.drop(songView, {
        dataTransfer: { files: [corruptFile] },
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain('No se pudo importar «error.gp5»: el archivo está vacío o dañado.');
      // La canción activa no cambió
      expect(songStore.getState().activeSong?.title).toBe(prevTitle);
    });

    it('los atajos de transporte quedan inactivos mientras SongLibraryModal está abierto', async () => {
      const { songStore, controller } = setupSongView();

      // Abrir biblioteca
      const songsBtn = screen.getByRole('button', { name: 'Biblioteca de canciones' });
      fireEvent.click(songsBtn);
      expect(await screen.findByRole('dialog', { name: /Biblioteca de canciones/i })).toBeTruthy();

      // Pulsar Espacio no debe disparar reproducción
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });
      expect(controller.isPlaying()).toBe(false);
      expect(songStore.getState().isPlaying).toBe(false);
    });

    it('mientras SongLibraryModal está abierto, el arrastre de archivos no activa el overlay global de SongView', async () => {
      setupSongView();
      const songView = screen.getByTestId('song-view');

      // Abrir biblioteca
      const songsBtn = screen.getByRole('button', { name: 'Biblioteca de canciones' });
      fireEvent.click(songsBtn);
      expect(await screen.findByRole('dialog', { name: /Biblioteca de canciones/i })).toBeTruthy();

      // Simular arrastre mientras el modal está abierto
      fireEvent.dragEnter(songView, {
        dataTransfer: { types: ['Files'] },
      });

      // No debe mostrar el overlay global para no solaparse ni interferir con el modal
      expect(screen.queryByTestId('song-view-drag-overlay')).toBeNull();
    });

    it('en pista de percusión, fuerza vista en modo partitura y desactiva las opciones de Tab y Partitura + Tab en SongTopBar', async () => {
      const { songStore } = setupSongView();

      const baseModel = loadPresetSongModel(PRESET_POP_DIATONIC.id);
      const songWithDrums: SongModel = {
        ...baseModel,
        id: 'drums-test-song',
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
      });

      // Inicialmente pista 0 (guitarra)
      expect(songStore.getState().activeTrackIndex).toBe(0);
      const tabBtn = screen.getByRole('button', { name: 'Vista Tablatura' });
      const scoreTabBtn = screen.getByRole('button', { name: 'Vista Partitura y Tablatura' });
      expect((tabBtn as HTMLButtonElement).disabled).toBe(false);
      expect((scoreTabBtn as HTMLButtonElement).disabled).toBe(false);

      // Cambiar a la pista 1 (batería/percusión)
      act(() => {
        songStore.getState().setActiveTrackIndex(1);
      });

      // Se fuerza automáticamente modo 'score'
      expect(songStore.getState().scoreViewMode).toBe('score');
      expect((tabBtn as HTMLButtonElement).disabled).toBe(true);
      expect((scoreTabBtn as HTMLButtonElement).disabled).toBe(true);
      expect(tabBtn.getAttribute('title')).toBe('La percusión solo se visualiza en modo partitura');

      // Intentar forzar Tab no tiene efecto
      act(() => {
        songStore.getState().setScoreViewMode('tab');
      });
      expect(songStore.getState().scoreViewMode).toBe('score');
    });

    it('no renderiza el botón de seguimiento en SongTopBar para evitar overflow y permite conmutar desde el visor', () => {
      const { songStore } = setupSongView();

      // En la barra superior ya no debe existir para evitar overflow horizontal
      expect(screen.queryByTestId('toggle-follow-playback-btn')).toBeNull();

      // Por defecto el seguimiento de reproducción está activado
      expect(songStore.getState().followPlayback).toBe(true);
      const viewportToggleBtn = screen.getByTestId('viewport-toggle-follow-btn');
      expect(viewportToggleBtn.textContent).toContain('🔒 Seguir');

      // Clic para cambiar a Vista libre
      fireEvent.click(viewportToggleBtn);
      expect(songStore.getState().followPlayback).toBe(false);
      expect(viewportToggleBtn.textContent).toContain('🔓 Libre');

      // Clic de nuevo para volver a Seguir
      fireEvent.click(viewportToggleBtn);
      expect(songStore.getState().followPlayback).toBe(true);
      expect(viewportToggleBtn.textContent).toContain('🔒 Seguir');
    });

    it('eliminar la canción activa no provoca errores y restaura limpiamente la canción por defecto', async () => {
      const { songStore } = setupSongView();

      const baseModel = loadPresetSongModel(PRESET_POP_DIATONIC.id);
      const customSong: SongModel = {
        ...baseModel,
        id: 'saved-song-to-delete',
        title: 'Canción para borrar',
      };

      await act(async () => {
        await songStore.getState().importSong(customSong);
      });

      expect(songStore.getState().activeSong?.id).toBe('saved-song-to-delete');

      // Eliminar la canción actualmente activa
      await act(async () => {
        await songStore.getState().deleteSavedSong('saved-song-to-delete');
      });

      // Debe haber vuelto a la canción predefinida sin explotar
      expect(songStore.getState().activeSong?.id).toBe(PRESET_POP_DIATONIC.id);
      expect(screen.getByTestId('song-view')).toBeTruthy();
    });
  });
});
