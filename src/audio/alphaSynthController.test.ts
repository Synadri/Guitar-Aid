import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COUNT_IN_VOLUME,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_METRONOME_VOLUME,
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_SOUNDFONT_URL,
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  createAlphaSynthController,
  type AlphaSynthLike,
  type SoundSettingsLike,
  type SoundSettingsStoreLike,
} from './alphaSynthController';

function createMockPlayer(): AlphaSynthLike & {
  calls: {
    play: number;
    pause: number;
    stop: number;
    loadSoundFontFromUrl: string[];
    changeTrackMute: { tracks: number[] | unknown[]; mute: boolean }[];
    changeTrackSolo: { tracks: number[] | unknown[]; solo: boolean }[];
    changeTrackVolume: { tracks: number[] | unknown[]; volume: number }[];
  };
  triggerPlayerState: (state: number) => void;
  triggerPosition: (currentTick: number, currentTime: number) => void;
  triggerFinish: () => void;
} {
  let playerStateCb: ((args: { state: number }) => void) | null = null;
  let posCb: ((args: { currentTime: number; endTime: number; currentTick: number; endTick: number }) => void) | null =
    null;
  let finishCb: (() => void) | null = null;

  const calls = {
    play: 0,
    pause: 0,
    stop: 0,
    loadSoundFontFromUrl: [] as string[],
    changeTrackMute: [] as { tracks: number[] | unknown[]; mute: boolean }[],
    changeTrackSolo: [] as { tracks: number[] | unknown[]; solo: boolean }[],
    changeTrackVolume: [] as { tracks: number[] | unknown[]; volume: number }[],
  };

  const player: AlphaSynthLike & {
    calls: typeof calls;
    triggerPlayerState: (state: number) => void;
    triggerPosition: (currentTick: number, currentTime: number) => void;
    triggerFinish: () => void;
  } = {
    calls,
    masterVolume: DEFAULT_MASTER_VOLUME,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    metronomeVolume: 0,
    countInVolume: 0,
    isLooping: false,
    playbackRange: null,
    tickPosition: 0,
    timePosition: 0,

    play() {
      calls.play += 1;
      return true;
    },
    pause() {
      calls.pause += 1;
    },
    stop() {
      calls.stop += 1;
    },
    loadSoundFontFromUrl(url: string) {
      calls.loadSoundFontFromUrl.push(url);
      return Promise.resolve();
    },
    changeTrackMute(tracks: number[] | unknown[], mute: boolean) {
      calls.changeTrackMute.push({ tracks, mute });
    },
    changeTrackSolo(tracks: number[] | unknown[], solo: boolean) {
      calls.changeTrackSolo.push({ tracks, solo });
    },
    changeTrackVolume(tracks: number[] | unknown[], volume: number) {
      calls.changeTrackVolume.push({ tracks, volume });
    },

    playerStateChanged: {
      on(cb) {
        playerStateCb = cb;
      },
    },
    playerPositionChanged: {
      on(cb) {
        posCb = cb;
      },
    },
    playerFinished: {
      on(cb) {
        finishCb = cb;
      },
    },

    triggerPlayerState(state: number) {
      playerStateCb?.({ state });
    },
    triggerPosition(currentTick: number, currentTime: number) {
      posCb?.({ currentTick, currentTime, endTime: 100, endTick: 3840 });
    },
    triggerFinish() {
      finishCb?.();
    },
  };

  return player;
}

function createMockSettingsStore(initial: SoundSettingsLike): SoundSettingsStoreLike & {
  setState: (partial: Partial<SoundSettingsLike>) => void;
} {
  let current = { ...initial };
  const listeners = new Set<(s: SoundSettingsLike) => void>();

  return {
    getState: () => current,
    setState: (partial) => {
      current = { ...current, ...partial };
      listeners.forEach((l) => l(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('AlphaSynthController (Hito C5, docs/Fase-3/plan_fase3.md §7 C5)', () => {
  it('inicializa con valores por defecto correctos sin tocar audio eager', () => {
    const controller = createAlphaSynthController();
    const state = controller.getState();

    expect(state.isPlaying).toBe(false);
    expect(state.playbackSpeed).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(state.volume).toBe(DEFAULT_MASTER_VOLUME);
    expect(state.soundEnabled).toBe(true);
    expect(state.metronomeEnabled).toBe(false);
    expect(state.countInEnabled).toBe(false);
    expect(state.isLooping).toBe(false);
    expect(state.loopRange).toBeNull();
    expect(state.isReady).toBe(false);
    expect(state.soundFontLoaded).toBe(false);
  });

  it('inicialización diferida (ensureReady) con el SoundFont local (/soundfont/sonivox.sf2)', async () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    expect(controller.getState().isReady).toBe(false);
    expect(mockPlayer.calls.loadSoundFontFromUrl).toHaveLength(0);

    const ready = await controller.ensureReady();
    expect(ready).toBe(true);
    expect(mockPlayer.calls.loadSoundFontFromUrl).toEqual([DEFAULT_SOUNDFONT_URL]);
    expect(controller.getState().isReady).toBe(true);
    expect(controller.getState().soundFontLoaded).toBe(true);

    // Idempotencia: una segunda llamada no vuelve a cargar el SoundFont
    await controller.ensureReady();
    expect(mockPlayer.calls.loadSoundFontFromUrl).toHaveLength(1);
  });

  it('control de Play, Pausa, PlayPause y Stop con sincronización de estado', async () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    const stateChanges: boolean[] = [];
    controller.on('stateChange', (s) => stateChanges.push(s.isPlaying));

    // Play inicia diferido y arranca
    await controller.play();
    expect(mockPlayer.calls.play).toBe(1);
    expect(controller.isPlaying()).toBe(true);
    expect(mockPlayer.calls.loadSoundFontFromUrl).toEqual([DEFAULT_SOUNDFONT_URL]);

    // Pausa
    controller.pause();
    expect(mockPlayer.calls.pause).toBe(1);
    expect(controller.isPlaying()).toBe(false);

    // PlayPause desde pausa arranca
    await controller.playPause();
    expect(mockPlayer.calls.play).toBe(2);
    expect(controller.isPlaying()).toBe(true);

    // PlayPause desde reproducción pausa
    await controller.playPause();
    expect(mockPlayer.calls.pause).toBe(2);
    expect(controller.isPlaying()).toBe(false);

    // Stop
    await controller.play();
    controller.stop();
    expect(mockPlayer.calls.stop).toBe(1);
    expect(controller.isPlaying()).toBe(false);

    // ensureReady() emite false al cargarse el SoundFont, seguido de true al iniciar play
    expect(stateChanges).toEqual([false, true, false, true, false, true, false]);
  });

  it('control de velocidad (0.25× – 2.0×) con acotamiento estricto', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    controller.setPlaybackSpeed(1.5);
    expect(controller.getPlaybackSpeed()).toBe(1.5);
    expect(mockPlayer.playbackSpeed).toBe(1.5);

    // Límite inferior 0.25×
    controller.setPlaybackSpeed(0.1);
    expect(controller.getPlaybackSpeed()).toBe(MIN_PLAYBACK_SPEED);
    expect(mockPlayer.playbackSpeed).toBe(MIN_PLAYBACK_SPEED);

    // Límite superior 2.0×
    controller.setPlaybackSpeed(3.8);
    expect(controller.getPlaybackSpeed()).toBe(MAX_PLAYBACK_SPEED);
    expect(mockPlayer.playbackSpeed).toBe(MAX_PLAYBACK_SPEED);
  });

  it('sincronización con ajustes: volumen maestro y silenciado global (soundEnabled)', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer, initialVolume: 0.7 });

    expect(mockPlayer.masterVolume).toBe(0.7);

    // Cambiar volumen
    controller.setVolume(0.9);
    expect(controller.getVolume()).toBe(0.9);
    expect(mockPlayer.masterVolume).toBe(0.9);

    // Silenciar globalmente (soundEnabled = false)
    controller.setSoundEnabled(false);
    expect(controller.isSoundEnabled()).toBe(false);
    expect(controller.getVolume()).toBe(0.9); // El volumen de preferencia se conserva
    expect(mockPlayer.masterVolume).toBe(0); // Al reproductor se envía 0

    // Restaurar sonido
    controller.setSoundEnabled(true);
    expect(controller.isSoundEnabled()).toBe(true);
    expect(mockPlayer.masterVolume).toBe(0.9);
  });

  it('bindSettings conecta reactivamente con settingsStore y limpia la suscripción', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });
    const store = createMockSettingsStore({ soundEnabled: true, volume: 0.6 });

    const unsubscribe = controller.bindSettings(store);
    expect(controller.getVolume()).toBe(0.6);
    expect(mockPlayer.masterVolume).toBe(0.6);

    // Cambio en store
    store.setState({ volume: 0.85 });
    expect(controller.getVolume()).toBe(0.85);
    expect(mockPlayer.masterVolume).toBe(0.85);

    store.setState({ soundEnabled: false });
    expect(controller.isSoundEnabled()).toBe(false);
    expect(mockPlayer.masterVolume).toBe(0);

    // Desuscripción
    unsubscribe();
    store.setState({ soundEnabled: true, volume: 0.4 });
    // Ya no se actualiza
    expect(controller.getVolume()).toBe(0.85);
  });

  it('metrónomo y cuenta atrás (count-in)', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    expect(controller.isMetronomeEnabled()).toBe(false);
    expect(mockPlayer.metronomeVolume).toBe(0);

    controller.setMetronomeEnabled(true);
    expect(controller.isMetronomeEnabled()).toBe(true);
    expect(mockPlayer.metronomeVolume).toBe(DEFAULT_METRONOME_VOLUME);

    controller.setMetronomeVolume(0.6);
    expect(mockPlayer.metronomeVolume).toBe(0.6);

    controller.setMetronomeEnabled(false);
    expect(mockPlayer.metronomeVolume).toBe(0);

    // Cuenta atrás
    expect(controller.isCountInEnabled()).toBe(false);
    expect(mockPlayer.countInVolume).toBe(0);

    controller.setCountInEnabled(true);
    expect(controller.isCountInEnabled()).toBe(true);
    expect(mockPlayer.countInVolume).toBe(DEFAULT_COUNT_IN_VOLUME);

    controller.setCountInEnabled(false);
    expect(mockPlayer.countInVolume).toBe(0);
  });

  it('bucle A–B: activación, alternancia y rango en ticks', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    expect(controller.isLooping()).toBe(false);

    controller.setLoopEnabled(true);
    expect(controller.isLooping()).toBe(true);
    expect(mockPlayer.isLooping).toBe(true);

    controller.setPlaybackRange({ startTick: 1920, endTick: 5760 });
    expect(controller.getPlaybackRange()).toEqual({ startTick: 1920, endTick: 5760 });
    expect(mockPlayer.playbackRange).toEqual({ startTick: 1920, endTick: 5760 });

    controller.toggleLoop();
    expect(controller.isLooping()).toBe(false);
    expect(mockPlayer.isLooping).toBe(false);
  });

  it('setPlaybackRange no reasigna al reproductor si el rango de ticks es idéntico, y preserva tickPosition en reproducción activa', async () => {
    let playbackRangeAssignments = 0;
    let currentPlaybackRange: { startTick: number; endTick: number } | null = null;
    let currentTickPosition = 0;

    const customPlayer: AlphaSynthLike = {
      isReadyForPlayback: true,
      get playbackRange() {
        return currentPlaybackRange;
      },
      set playbackRange(val) {
        playbackRangeAssignments++;
        currentPlaybackRange = val as { startTick: number; endTick: number } | null;
        // Simular comportamiento nativo de AlphaTab: al asignar playbackRange, resetea a startTick
        if (val) currentTickPosition = val.startTick;
      },
      get tickPosition() {
        return currentTickPosition;
      },
      set tickPosition(val) {
        currentTickPosition = val ?? 0;
      },
      play: () => true,
      pause: () => {},
    };

    const controller = createAlphaSynthController({ player: customPlayer });
    controller.setLoopEnabled(true);

    const initialAssignments = playbackRangeAssignments;

    // 1. Asignar primer rango
    controller.setPlaybackRange({ startTick: 1920, endTick: 5760 });
    expect(playbackRangeAssignments).toBe(initialAssignments + 1);
    expect(currentTickPosition).toBe(1920);

    // 2. Avanzar cursor a 3840 ticks e iniciar reproducción
    controller.seekToTick(3840);
    expect(currentTickPosition).toBe(3840);
    await controller.play();
    expect(controller.isPlaying()).toBe(true);

    // 3. Volver a llamar setPlaybackRange con el mismo rango (ej. al cambiar de pista en la misma partitura)
    controller.setPlaybackRange({ startTick: 1920, endTick: 5760 });
    // No debe haber ninguna nueva reasignación al reproductor
    expect(playbackRangeAssignments).toBe(initialAssignments + 1);
    expect(currentTickPosition).toBe(3840);

    // 4. Cambiar rango mientras se reproduce (ej. expandir bucle a 1920..7680)
    controller.setPlaybackRange({ startTick: 1920, endTick: 7680 });
    expect(playbackRangeAssignments).toBe(initialAssignments + 2);
    // Aunque el setter nativo de AlphaTab hubiera intentado saltar a 1920, la posición se preserva
    expect(currentTickPosition).toBe(3840);
  });

  it('mezclador multipista independiente: Mute, Solo y Volumen por pista', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    // Pista 0: Mute
    controller.setTrackMute(0, true);
    expect(mockPlayer.calls.changeTrackMute).toContainEqual({ tracks: [0], mute: true });
    expect(controller.getTrackMixer()[0]?.muted).toBe(true);

    // Pista 1: Solo
    controller.setTrackSolo(1, true);
    expect(mockPlayer.calls.changeTrackSolo).toContainEqual({ tracks: [1], solo: true });
    expect(controller.getTrackMixer()[1]?.solo).toBe(true);

    // Pista 0: Volumen 0.4
    controller.setTrackVolume(0, 0.4);
    expect(mockPlayer.calls.changeTrackVolume).toContainEqual({ tracks: [0], volume: 0.4 });
    expect(controller.getTrackMixer()[0]?.volume).toBe(0.4);

    // Actualización por lote (applyTrackMixer)
    controller.applyTrackMixer({
      2: { muted: true, volume: 0.5 },
    });
    expect(controller.getTrackMixer()[2]).toEqual({ muted: true, solo: false, volume: 0.5 });

    // Restablecimiento del mezclador
    controller.resetTrackMixer();
    expect(controller.getTrackMixer()).toEqual({});
    expect(mockPlayer.calls.changeTrackVolume).toContainEqual({ tracks: [0], volume: 1.0 });
    expect(mockPlayer.calls.changeTrackMute).toContainEqual({ tracks: [0], mute: false });
  });

  it('al conectar un nuevo reproductor (attachPlayer) se le aplican todos los ajustes vigentes', () => {
    const controller = createAlphaSynthController({
      initialPlaybackSpeed: 1.25,
      initialVolume: 0.9,
    });
    controller.setLoopEnabled(true);
    controller.setPlaybackRange({ startTick: 960, endTick: 2880 });
    controller.setTrackMute(0, true);

    const secondPlayer = createMockPlayer();
    controller.attachPlayer(secondPlayer);

    expect(secondPlayer.playbackSpeed).toBe(1.25);
    expect(secondPlayer.masterVolume).toBe(0.9);
    expect(secondPlayer.isLooping).toBe(true);
    expect(secondPlayer.playbackRange).toEqual({ startTick: 960, endTick: 2880 });
    expect(secondPlayer.calls.changeTrackMute).toContainEqual({ tracks: [0], mute: true });
  });

  it('eventos del reproductor: posición, cambio de estado y fin de reproducción', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    const positions: { currentTick: number; currentTime: number }[] = [];
    controller.on('positionChange', (pos) => positions.push(pos as { currentTick: number; currentTime: number }));

    let finished = false;
    controller.on('finish', () => {
      finished = true;
    });

    // Simular evento de posición
    mockPlayer.triggerPosition(1920, 2.4);
    expect(positions).toEqual([{ currentTick: 1920, currentTime: 2.4 }]);

    // Simular cambio de estado a Playing desde el motor
    mockPlayer.triggerPlayerState(1);
    expect(controller.isPlaying()).toBe(true);

    // Simular fin
    mockPlayer.triggerFinish();
    expect(finished).toBe(true);
    expect(controller.isPlaying()).toBe(false);
  });

  it('en bucle activo, la señal finish de AlphaSynth no detiene la reproducción', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    mockPlayer.triggerPlayerState(1);
    expect(controller.isPlaying()).toBe(true);

    controller.setLoopEnabled(true);
    controller.setPlaybackRange({ startTick: 960, endTick: 3840 });

    let finishedCalls = 0;
    controller.on('finish', () => {
      finishedCalls++;
    });

    // En bucle, finish indica reinicio de ciclo
    mockPlayer.triggerFinish();
    expect(finishedCalls).toBe(0);
    expect(controller.isPlaying()).toBe(true);
  });

  it('seekToTick posiciona el cursor en el tick indicado', () => {
    const mockPlayer = createMockPlayer();
    const controller = createAlphaSynthController({ player: mockPlayer });

    controller.seekToTick(3840);
    expect(mockPlayer.tickPosition).toBe(3840);
  });
});
