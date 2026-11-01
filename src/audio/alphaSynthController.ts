/**
 * Controlador de síntesis y reproducción multipista con AlphaSynth (Hito C5, docs/Fase-3/plan_fase3.md §7 C5).
 *
 * Responsabilidades:
 *  - Fachada unificada para controlar la reproducción de partituras/tablaturas (Play, Pausa, Stop).
 *  - Inicialización diferida del sintetizador y carga 100 % local del SoundFont ('/soundfont/sonivox.sf2').
 *  - Sincronización bidireccional con ajustes de sonido de la aplicación (soundEnabled, volume).
 *  - Control fino de velocidad (0.25× a 2.0×), bucle A–B (isLooping, playbackRange), metrónomo y cuenta atrás.
 *  - Control multipista independiente: Mute, Solo y Volumen por pista.
 *  - Soporte para doble inyectable (mocks/stubs en pruebas sin requerir entorno de navegador ni Web Audio).
 *
 * Regla de capas:
 *  - Capa audio: NO importa learning, state ni ui (docs/plan_fase1.md §5, eslint.config.js).
 *  - La sincronización con settingsStore se realiza mediante contratos duck-typed (bindSettings, syncWithSettings).
 */

import { metronomeAudio } from './metronomeAudio';

export const DEFAULT_SOUNDFONT_URL = '/soundfont/sonivox.sf2';
export const MIN_PLAYBACK_SPEED = 0.25;
export const MAX_PLAYBACK_SPEED = 2.0;
export const DEFAULT_PLAYBACK_SPEED = 1.0;
export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_METRONOME_VOLUME = 0.8;
export const DEFAULT_COUNT_IN_VOLUME = 1.0;

/** Estado del mezclador para una pista individual. */
export interface TrackMixerItem {
  muted: boolean;
  solo: boolean;
  volume: number; // 0..1
}

/** Límites en ticks de un bucle A–B. */
export interface PlaybackRangeBounds {
  startTick: number;
  endTick: number;
}

export type MetronomeSubdivision = '1' | '1/3' | '1/4' | '1/8' | '1/16';

/** Estado reactivo observable del controlador AlphaSynth. */
export interface AlphaSynthControllerState {
  isPlaying: boolean;
  playbackSpeed: number;
  volume: number;
  soundEnabled: boolean;
  metronomeEnabled: boolean;
  metronomeVolume: number;
  metronomeSubdivision?: MetronomeSubdivision;
  countInEnabled: boolean;
  countInVolume: number;
  isLooping: boolean;
  loopRange: PlaybackRangeBounds | null;
  isReady: boolean;
  soundFontLoaded: boolean;
  trackMixer: Record<number, TrackMixerItem>;
}

/**
 * Contrato duck-type de AlphaSynth o AlphaTabApi para permitir inyección de dobles en pruebas.
 */
export interface AlphaSynthLike {
  play?: () => Promise<boolean> | boolean | void;
  pause?: () => void;
  playPause?: () => Promise<boolean> | boolean | void;
  stop?: () => void;
  isReadyForPlayback?: boolean;
  masterVolume?: number;
  playbackSpeed?: number;
  metronomeVolume?: number;
  countInVolume?: number;
  isLooping?: boolean;
  playbackRange?: PlaybackRangeBounds | null;
  changeTrackMute?: (tracks: number[] | unknown[], isMute: boolean) => void;
  changeTrackSolo?: (tracks: number[] | unknown[], isSolo: boolean) => void;
  changeTrackVolume?: (tracks: number[] | unknown[], volume: number) => void;
  setChannelMute?: (channel: number, isMute: boolean) => void;
  setChannelSolo?: (channel: number, isSolo: boolean) => void;
  setChannelVolume?: (channel: number, volume: number) => void;
  loadSoundFont?: (data: unknown, append?: boolean) => void;
  loadSoundFontFromUrl?: (url: string, append?: boolean) => Promise<void> | void;
  tickPosition?: number;
  timePosition?: number;
  destroy?: () => void;
  playerReady?: { on: (cb: () => void) => void };
  playerStateChanged?: { on: (cb: (args: { state: number }) => void) => void };
  playerPositionChanged?: {
    on: (cb: (args: { currentTime: number; endTime: number; currentTick: number; endTick: number }) => void) => void;
  };
  playedBeatChanged?: { on: (cb: (beat: unknown) => void) => void };
  midiEventsPlayed?: { on: (cb: (args: { events?: readonly unknown[] }) => void) => void };
  playerFinished?: { on: (cb: () => void) => void };
  soundFontLoaded?: { on: (cb: () => void) => void };
}

/** Contrato mínimo de fuente de ajustes de sonido (duck-typed con StoreApi<SettingsStore>). */
export interface SoundSettingsLike {
  soundEnabled: boolean;
  volume: number;
}

export interface SoundSettingsStoreLike {
  getState: () => SoundSettingsLike;
  subscribe: (listener: (state: SoundSettingsLike) => void) => () => void;
}

export interface AlphaSynthControllerOptions {
  soundFontUrl?: string;
  player?: AlphaSynthLike;
  initialVolume?: number;
  initialSoundEnabled?: boolean;
  initialPlaybackSpeed?: number;
  initialMetronomeEnabled?: boolean;
  initialMetronomeSubdivision?: MetronomeSubdivision;
  initialCountInEnabled?: boolean;
  createPlayer?: () => Promise<AlphaSynthLike | null> | AlphaSynthLike | null;
}

export interface AlphaSynthController {
  getState: () => AlphaSynthControllerState;
  attachPlayer: (player: AlphaSynthLike) => void;
  detachPlayer: () => void;
  getPlayer: () => AlphaSynthLike | null;
  ensureReady: () => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => void;
  playPause: () => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
  setPlaybackSpeed: (speed: number) => void;
  getPlaybackSpeed: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setSoundEnabled: (enabled: boolean) => void;
  isSoundEnabled: () => boolean;
  syncWithSettings: (settings: Partial<SoundSettingsLike>) => void;
  bindSettings: (store: SoundSettingsStoreLike) => () => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  isMetronomeEnabled: () => boolean;
  setMetronomeVolume: (volume: number) => void;
  getMetronomeVolume: () => number;
  setMetronomeSubdivision: (subdivision: MetronomeSubdivision) => void;
  getMetronomeSubdivision: () => MetronomeSubdivision;
  triggerMetronomeBeat?: (info: { numerator: number; durationMs: number }) => void;
  setCountInEnabled: (enabled: boolean) => void;
  isCountInEnabled: () => boolean;
  setCountInVolume: (volume: number) => void;
  getCountInVolume: () => number;
  setLoopEnabled: (enabled: boolean) => void;
  isLooping: () => boolean;
  toggleLoop: () => void;
  setPlaybackRange: (range: PlaybackRangeBounds | null) => void;
  getPlaybackRange: () => PlaybackRangeBounds | null;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, solo: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  applyTrackMixer: (mixer: Record<number, Partial<TrackMixerItem>>) => void;
  resetTrackMixer: () => void;
  getTrackMixer: () => Record<number, TrackMixerItem>;
  seekToTick: (tick: number) => void;
  on(event: 'stateChange', listener: (state: AlphaSynthControllerState) => void): () => void;
  on(event: 'positionChange', listener: (pos: { currentTick: number; currentTime: number }) => void): () => void;
  on(event: 'finish', listener: () => void): () => void;
  destroy: () => void;
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_PLAYBACK_SPEED;
  return Math.max(MIN_PLAYBACK_SPEED, Math.min(MAX_PLAYBACK_SPEED, speed));
}

function clampVolume(volume: number, fallback = DEFAULT_MASTER_VOLUME): number {
  if (!Number.isFinite(volume)) return fallback;
  return Math.max(0, Math.min(1, volume));
}

/**
 * Crea una nueva instancia de AlphaSynthController.
 */
export function createAlphaSynthController(
  options: AlphaSynthControllerOptions = {},
): AlphaSynthController {
  const soundFontUrl = options.soundFontUrl ?? DEFAULT_SOUNDFONT_URL;
  let player: AlphaSynthLike | null = options.player ?? null;
  const createPlayer = options.createPlayer;

  const state: AlphaSynthControllerState = {
    isPlaying: false,
    playbackSpeed: clampSpeed(options.initialPlaybackSpeed ?? DEFAULT_PLAYBACK_SPEED),
    volume: clampVolume(options.initialVolume ?? DEFAULT_MASTER_VOLUME),
    soundEnabled: options.initialSoundEnabled ?? true,
    metronomeEnabled: options.initialMetronomeEnabled ?? false,
    metronomeVolume: DEFAULT_METRONOME_VOLUME,
    metronomeSubdivision: options.initialMetronomeSubdivision ?? '1/4',
    countInEnabled: options.initialCountInEnabled ?? false,
    countInVolume: DEFAULT_COUNT_IN_VOLUME,
    isLooping: false,
    loopRange: null,
    isReady: false,
    soundFontLoaded: false,
    trackMixer: {},
  };

  type StateListener = (s: AlphaSynthControllerState) => void;
  type PosListener = (pos: { currentTick: number; currentTime: number }) => void;
  type FinishListener = () => void;

  const stateListeners = new Set<StateListener>();
  const posListeners = new Set<PosListener>();
  const finishListeners = new Set<FinishListener>();

  const emitState = () => {
    const copy = { ...state, trackMixer: { ...state.trackMixer } };
    for (const listener of stateListeners) {
      try {
        listener(copy);
      } catch (err) {
        console.error('Error in AlphaSynthController state listener', err);
      }
    }
  };

  const emitPosition = (pos: { currentTick: number; currentTime: number }) => {
    for (const listener of posListeners) {
      try {
        listener(pos);
      } catch (err) {
        console.error('Error in AlphaSynthController position listener', err);
      }
    }
  };

  const emitFinish = () => {
    // Si el bucle está activo con un rango definido, el evento finish de AlphaSynth
    // indica la finalización de un ciclo de bucle y retorno a startTick; no debe detenerse la reproducción.
    if (state.isLooping && state.loopRange) {
      return;
    }
    state.isPlaying = false;
    emitState();
    for (const listener of finishListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in AlphaSynthController finish listener', err);
      }
    }
  };

  const applyVolumeToPlayer = () => {
    if (!player) return;
    const effective = state.soundEnabled ? state.volume : 0;
    player.masterVolume = effective;
  };

  const applySpeedToPlayer = () => {
    if (!player) return;
    player.playbackSpeed = state.playbackSpeed;
  };

  const applyMetronomeToPlayer = () => {
    if (!player) return;
    if ('midiEventsPlayedFilter' in player) {
      player.metronomeVolume = 0;
    } else {
      player.metronomeVolume = state.metronomeEnabled ? state.metronomeVolume : 0;
    }
  };

  const applyCountInToPlayer = () => {
    if (!player) return;
    player.countInVolume = state.countInEnabled ? state.countInVolume : 0;
  };

  const applyLoopToPlayer = () => {
    if (!player) return;
    player.isLooping = state.isLooping;
    player.playbackRange = state.isLooping ? state.loopRange : null;
  };

  const applySingleTrackToPlayer = (trackIndex: number, item: TrackMixerItem) => {
    if (!player) return;
    const finalTracks = [trackIndex];

    if (typeof player.changeTrackMute === 'function') {
      player.changeTrackMute(finalTracks, item.muted);
    } else if (typeof player.setChannelMute === 'function') {
      player.setChannelMute(trackIndex, item.muted);
    }

    if (typeof player.changeTrackSolo === 'function') {
      player.changeTrackSolo(finalTracks, item.solo);
    } else if (typeof player.setChannelSolo === 'function') {
      player.setChannelSolo(trackIndex, item.solo);
    }

    if (typeof player.changeTrackVolume === 'function') {
      player.changeTrackVolume(finalTracks, item.volume);
    } else if (typeof player.setChannelVolume === 'function') {
      player.setChannelVolume(trackIndex, item.volume);
    }
  };

  const applyAllTracksToPlayer = () => {
    if (!player) return;
    for (const [idxStr, item] of Object.entries(state.trackMixer)) {
      applySingleTrackToPlayer(Number(idxStr), item);
    }
  };

  const registerPlayerListeners = (p: AlphaSynthLike) => {
    if (p.playerStateChanged?.on) {
      p.playerStateChanged.on((args) => {
        // PlayerState: 0 = Paused, 1 = Playing
        const playing = args.state === 1;
        if (!playing) {
          metronomeAudio.stop();
        }
        if (state.isPlaying !== playing) {
          state.isPlaying = playing;
          emitState();
        }
      });
    }

    if (p.midiEventsPlayed?.on) {
      try {
        if ('midiEventsPlayedFilter' in p) {
          (p as unknown as { midiEventsPlayedFilter: number[] }).midiEventsPlayedFilter = [242];
        }
      } catch {
        // ignore
      }
      p.midiEventsPlayed.on((args) => {
        if (!args?.events) return;
        for (const ev of args.events) {
          const m = ev as {
            isMetronome?: boolean;
            type?: number;
            metronomeNumerator?: number;
            metronomeDurationInMilliseconds?: number;
          };
          if (m.isMetronome || m.type === 242) {
            triggerMetronomeBeat({
              numerator: m.metronomeNumerator ?? 0,
              durationMs: m.metronomeDurationInMilliseconds ?? 500,
            });
          }
        }
      });
    }

    if (p.playerPositionChanged?.on) {
      p.playerPositionChanged.on((args) => {
        emitPosition({
          currentTick: args.currentTick ?? 0,
          currentTime: args.currentTime ?? 0,
        });
      });
    }

    if (p.playerFinished?.on) {
      p.playerFinished.on(() => {
        emitFinish();
      });
    }

    if (p.soundFontLoaded?.on) {
      p.soundFontLoaded.on(() => {
        state.soundFontLoaded = true;
        state.isReady = true;
        applyVolumeToPlayer();
        applySpeedToPlayer();
        applyMetronomeToPlayer();
        applyCountInToPlayer();
        applyLoopToPlayer();
        applyAllTracksToPlayer();
        emitState();
      });
    }

    if (p.playerReady?.on) {
      p.playerReady.on(() => {
        state.isReady = true;
        applyVolumeToPlayer();
        applySpeedToPlayer();
        applyMetronomeToPlayer();
        applyCountInToPlayer();
        applyLoopToPlayer();
        applyAllTracksToPlayer();
        emitState();
      });
    }
  };

  const attachPlayer = (newPlayer: AlphaSynthLike) => {
    player = newPlayer;
    applyVolumeToPlayer();
    applySpeedToPlayer();
    applyMetronomeToPlayer();
    applyCountInToPlayer();
    applyLoopToPlayer();
    applyAllTracksToPlayer();
    registerPlayerListeners(newPlayer);
  };

  const detachPlayer = () => {
    player = null;
  };

  // Si se proporcionó un reproductor inicial, conectarlo
  if (player) {
    attachPlayer(player);
  }

  const ensureReady = async (): Promise<boolean> => {
    if (state.soundFontLoaded && state.isReady) return true;

    // Si aún no hay reproductor pero tenemos fábrica diferida, crearlo ahora
    if (!player && createPlayer) {
      try {
        const created = await createPlayer();
        if (created) attachPlayer(created);
      } catch (err) {
        console.warn('Error creating player in AlphaSynthController', err);
      }
    }

    if (player) {
      try {
        if (typeof player.loadSoundFontFromUrl === 'function') {
          await player.loadSoundFontFromUrl(soundFontUrl);
          state.soundFontLoaded = true;
          state.isReady = true;
          emitState();
          return true;
        }

        if (typeof player.loadSoundFont === 'function' && typeof fetch !== 'undefined') {
          const resp = await fetch(soundFontUrl);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            player.loadSoundFont(new Uint8Array(buf));
            state.soundFontLoaded = true;
            state.isReady = true;
            emitState();
            return true;
          }
        }
      } catch (err) {
        console.warn('Error loading soundfont in AlphaSynthController', err);
        return false;
      }
    }

    // Entorno de prueba / fallback: marcar listo
    state.soundFontLoaded = true;
    state.isReady = true;
    emitState();
    return true;
  };

  const play = async () => {
    await ensureReady();
    if (player && typeof player.play === 'function') {
      await player.play();
    }
    state.isPlaying = true;
    emitState();
  };

  const pause = () => {
    metronomeAudio.stop();
    if (player && typeof player.pause === 'function') {
      player.pause();
    }
    state.isPlaying = false;
    emitState();
  };

  const playPause = async () => {
    if (state.isPlaying) {
      pause();
    } else {
      await play();
    }
  };

  const stop = () => {
    metronomeAudio.stop();
    if (player && typeof player.stop === 'function') {
      player.stop();
    } else if (player && typeof player.pause === 'function') {
      player.pause();
    }
    state.isPlaying = false;
    emitState();
  };

  const setPlaybackSpeed = (speed: number) => {
    state.playbackSpeed = clampSpeed(speed);
    applySpeedToPlayer();
    emitState();
  };

  const setVolume = (vol: number) => {
    state.volume = clampVolume(vol);
    applyVolumeToPlayer();
    emitState();
  };

  const setSoundEnabled = (enabled: boolean) => {
    state.soundEnabled = Boolean(enabled);
    applyVolumeToPlayer();
    emitState();
  };

  const syncWithSettings = (settings: Partial<SoundSettingsLike>) => {
    let changed = false;
    if (typeof settings.volume === 'number' && Number.isFinite(settings.volume)) {
      state.volume = clampVolume(settings.volume);
      changed = true;
    }
    if (typeof settings.soundEnabled === 'boolean') {
      state.soundEnabled = settings.soundEnabled;
      changed = true;
    }
    if (changed) {
      applyVolumeToPlayer();
      emitState();
    }
  };

  const bindSettings = (store: SoundSettingsStoreLike): (() => void) => {
    const cur = store.getState();
    syncWithSettings(cur);
    const unsub = store.subscribe((next) => {
      syncWithSettings(next);
    });
    return unsub;
  };

  const setMetronomeEnabled = (enabled: boolean) => {
    state.metronomeEnabled = Boolean(enabled);
    if (!state.metronomeEnabled) {
      metronomeAudio.stop();
    }
    applyMetronomeToPlayer();
    emitState();
  };

  const setMetronomeVolume = (vol: number) => {
    state.metronomeVolume = clampVolume(vol, DEFAULT_METRONOME_VOLUME);
    applyMetronomeToPlayer();
    emitState();
  };

  const setMetronomeSubdivision = (subdivision: MetronomeSubdivision) => {
    state.metronomeSubdivision = subdivision;
    emitState();
  };

  const triggerMetronomeBeat = (info: { numerator: number; durationMs: number }) => {
    if (!state.metronomeEnabled || state.metronomeVolume <= 0) return;
    metronomeAudio.scheduleBeat(
      info.numerator,
      info.durationMs,
      state.metronomeSubdivision ?? '1/4',
      state.metronomeVolume,
    );
  };

  const setCountInEnabled = (enabled: boolean) => {
    state.countInEnabled = Boolean(enabled);
    applyCountInToPlayer();
    emitState();
  };

  const setCountInVolume = (vol: number) => {
    state.countInVolume = clampVolume(vol, DEFAULT_COUNT_IN_VOLUME);
    applyCountInToPlayer();
    emitState();
  };

  const areRangesEqual = (
    a: PlaybackRangeBounds | null,
    b: PlaybackRangeBounds | null,
  ): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.startTick === b.startTick && a.endTick === b.endTick;
  };

  const setLoopEnabled = (enabled: boolean) => {
    const next = Boolean(enabled);
    if (state.isLooping === next) return;
    state.isLooping = next;
    applyLoopToPlayer();
    emitState();
  };

  const toggleLoop = () => {
    setLoopEnabled(!state.isLooping);
  };

  const setPlaybackRange = (range: PlaybackRangeBounds | null) => {
    if (areRangesEqual(state.loopRange, range)) {
      return;
    }
    const curTick = player?.tickPosition;
    state.loopRange = range;
    applyLoopToPlayer();
    // Si la reproducción está activa y el cursor ya se encontraba dentro del nuevo rango,
    // preservamos la posición para evitar que AlphaTab reinicie el playback a startTick.
    if (
      state.isPlaying &&
      curTick !== undefined &&
      range &&
      curTick >= range.startTick &&
      curTick <= range.endTick
    ) {
      if (player) {
        player.tickPosition = curTick;
      }
    }
    emitState();
  };

  const getOrCreateTrack = (trackIndex: number): TrackMixerItem => {
    return (
      state.trackMixer[trackIndex] ?? {
        muted: false,
        solo: false,
        volume: 1.0,
      }
    );
  };

  const setTrackMute = (trackIndex: number, muted: boolean) => {
    const cur = getOrCreateTrack(trackIndex);
    const updated = { ...cur, muted: Boolean(muted) };
    state.trackMixer[trackIndex] = updated;
    applySingleTrackToPlayer(trackIndex, updated);
    emitState();
  };

  const setTrackSolo = (trackIndex: number, solo: boolean) => {
    const cur = getOrCreateTrack(trackIndex);
    const updated = { ...cur, solo: Boolean(solo) };
    state.trackMixer[trackIndex] = updated;
    applySingleTrackToPlayer(trackIndex, updated);
    emitState();
  };

  const setTrackVolume = (trackIndex: number, volume: number) => {
    const cur = getOrCreateTrack(trackIndex);
    const updated = { ...cur, volume: clampVolume(volume, 1.0) };
    state.trackMixer[trackIndex] = updated;
    applySingleTrackToPlayer(trackIndex, updated);
    emitState();
  };

  const applyTrackMixer = (mixer: Record<number, Partial<TrackMixerItem>>) => {
    for (const [idxStr, partial] of Object.entries(mixer)) {
      const idx = Number(idxStr);
      const cur = getOrCreateTrack(idx);
      state.trackMixer[idx] = {
        muted: partial.muted !== undefined ? Boolean(partial.muted) : cur.muted,
        solo: partial.solo !== undefined ? Boolean(partial.solo) : cur.solo,
        volume: partial.volume !== undefined ? clampVolume(partial.volume, 1.0) : cur.volume,
      };
      applySingleTrackToPlayer(idx, state.trackMixer[idx]);
    }
    emitState();
  };

  const resetTrackMixer = () => {
    for (const [idxStr] of Object.entries(state.trackMixer)) {
      const idx = Number(idxStr);
      const defaultItem: TrackMixerItem = { muted: false, solo: false, volume: 1.0 };
      applySingleTrackToPlayer(idx, defaultItem);
    }
    state.trackMixer = {};
    emitState();
  };

  const seekToTick = (tick: number) => {
    metronomeAudio.stop();
    if (!player) return;
    player.tickPosition = Math.max(0, Math.round(tick));
  };

  const on: AlphaSynthController['on'] = ((
    event: 'stateChange' | 'positionChange' | 'finish',
    listener: (arg?: unknown) => void,
  ): (() => void) => {
    if (event === 'stateChange') {
      const typed = listener as StateListener;
      stateListeners.add(typed);
      return () => stateListeners.delete(typed);
    }
    if (event === 'positionChange') {
      const typed = listener as PosListener;
      posListeners.add(typed);
      return () => posListeners.delete(typed);
    }
    if (event === 'finish') {
      const typed = listener as FinishListener;
      finishListeners.add(typed);
      return () => finishListeners.delete(typed);
    }
    return () => {};
  }) as AlphaSynthController['on'];

  const destroy = () => {
    if (player && typeof player.destroy === 'function') {
      player.destroy();
    }
    player = null;
    stateListeners.clear();
    posListeners.clear();
    finishListeners.clear();
  };

  return {
    getState: () => ({ ...state, trackMixer: { ...state.trackMixer } }),
    attachPlayer,
    detachPlayer,
    getPlayer: () => player,
    ensureReady,
    play,
    pause,
    playPause,
    stop,
    isPlaying: () => state.isPlaying,
    setPlaybackSpeed,
    getPlaybackSpeed: () => state.playbackSpeed,
    setVolume,
    getVolume: () => state.volume,
    setSoundEnabled,
    isSoundEnabled: () => state.soundEnabled,
    syncWithSettings,
    bindSettings,
    setMetronomeEnabled,
    isMetronomeEnabled: () => state.metronomeEnabled,
    setMetronomeVolume,
    getMetronomeVolume: () => state.metronomeVolume,
    setMetronomeSubdivision,
    getMetronomeSubdivision: () => state.metronomeSubdivision ?? '1/4',
    triggerMetronomeBeat,
    setCountInEnabled,
    isCountInEnabled: () => state.countInEnabled,
    setCountInVolume,
    getCountInVolume: () => state.countInVolume,
    setLoopEnabled,
    isLooping: () => state.isLooping,
    toggleLoop,
    setPlaybackRange,
    getPlaybackRange: () => state.loopRange,
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    applyTrackMixer,
    resetTrackMixer,
    getTrackMixer: () => ({ ...state.trackMixer }),
    seekToTick,
    on,
    destroy,
  };
}

/** Instancia singleton global del controlador AlphaSynth. */
export const alphaSynthController: AlphaSynthController = createAlphaSynthController();
