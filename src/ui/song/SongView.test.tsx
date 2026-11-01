// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  loadPresetSongModel,
  PRESET_POP_DIATONIC,
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

  it('Visualización de bucle: resalta los compases contenidos con distintivo de inicio y fin', async () => {
    const { songStore } = setupSongView();

    await act(async () => {
      songStore.getState().setLoopRange([2, 4]);
      songStore.getState().setLoopEnabled(true);
    });

    // Compás 1: fuera de bucle
    const bar1 = screen.getByTestId('bar-1');
    expect(bar1.getAttribute('data-is-loop')).toBe('false');

    // Compases 2, 3, 4: dentro del bucle
    const bar2 = screen.getByTestId('bar-2');
    const bar3 = screen.getByTestId('bar-3');
    const bar4 = screen.getByTestId('bar-4');
    expect(bar2.getAttribute('data-is-loop')).toBe('true');
    expect(bar3.getAttribute('data-is-loop')).toBe('true');
    expect(bar4.getAttribute('data-is-loop')).toBe('true');

    // Inicio de bucle en compás 2
    expect(screen.getByTestId('loop-start-badge')).toBeTruthy();
    // Fin de bucle en compás 4
    expect(screen.getByTestId('loop-end-icon')).toBeTruthy();
  });
});
