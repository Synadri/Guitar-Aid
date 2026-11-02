import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  alphaSynthController as defaultController,
  type AlphaSynthController,
  type AlphaSynthLike,
} from '../../audio';
import {
  songStore as defaultSongStore,
  type ScoreViewMode,
  type SongStore,
} from '../../state/song';
import {
  getPresetSong,
  PRESET_POP_DIATONIC,
  resolvePlaybackRangeForBars,
  resolvePlaybackTickForBarBeat,
  type SongModel,
} from '../../song';
import styles from './AlphaTabViewport.module.css';

export interface AlphaTabViewportProps {
  /** Store de estado del Modo Canción. Por defecto usa el singleton songStore. */
  songStore?: StoreApi<SongStore>;
  /** Controlador de síntesis de audio. Por defecto usa el singleton alphaSynthController. */
  controller?: AlphaSynthController;
  /** Fábrica inyectable de AlphaTabApi para pruebas unitarias y de integración. */
  createApi?: (container: HTMLElement, settings?: unknown) => AlphaSynthLike;
  className?: string;
  style?: React.CSSProperties;
}

export function viewModeLabel(mode: ScoreViewMode, isPercussion = false): string {
  if (isPercussion) return 'PARTITURA';
  switch (mode) {
    case 'score':
      return 'PARTITURA';
    case 'score-tab':
      return 'PARTITURA + TAB';
    case 'tab':
    default:
      return 'TABLATURA';
  }
}

/**
 * Carga una canción en AlphaTab utilizando datos binarios nativos (.gp, .gp5, .gpx, etc.)
 * o notación AlphaTex según la fuente de la canción.
 */
export function loadSongIntoAlphaTab(
  api: unknown,
  song: SongModel | null,
  trackIndex: number,
) {
  if (!api || !song) return;

  const rawApi = api as {
    load?: (data: unknown, tracks?: number[]) => void;
    tex?: (tex: string, tracks?: number[]) => void;
  };

  try {
    // 1. Si disponemos de datos binarios originales (.gp, .gp5, .gpx, etc.) o texto plano
    if (song.rawData) {
      if (typeof song.rawData === 'string') {
        if (typeof rawApi.tex === 'function') {
          rawApi.tex(song.rawData, [trackIndex]);
          return;
        }
        if (typeof rawApi.load === 'function') {
          rawApi.load(song.rawData, [trackIndex]);
          return;
        }
      } else {
        if (typeof rawApi.load === 'function') {
          rawApi.load(song.rawData, [trackIndex]);
          return;
        }
      }
    }

    // 2. Si disponemos de notación AlphaTex o es un preset integrado
    const presetTex = getPresetSong(song.id)?.alphaTex;
    const alphaTex = song.alphaTex ?? presetTex;

    if (alphaTex) {
      if (typeof rawApi.tex === 'function') {
        rawApi.tex(alphaTex, [trackIndex]);
        return;
      }
      if (typeof rawApi.load === 'function') {
        rawApi.load(alphaTex, [trackIndex]);
        return;
      }
    }

    // 3. Fallback solo si es el preset inicial por defecto
    if (song.id === PRESET_POP_DIATONIC.id) {
      if (typeof rawApi.tex === 'function') {
        rawApi.tex(PRESET_POP_DIATONIC.alphaTex, [trackIndex]);
      }
    }
  } catch (err) {
    console.warn('Error loading song into AlphaTab', err);
  }
}

export const AlphaTabViewport = React.memo(function AlphaTabViewport({
  songStore = defaultSongStore,
  controller = defaultController,
  createApi,
  className,
  style,
}: AlphaTabViewportProps) {
  const alphaTabHostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaSynthLike | null>(null);
  const isShiftPressedRef = useRef(false);
  const dragStartBarRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastLoadedSongIdRef = useRef<string | null>(null);
  const lastScrolledBarRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressedRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftPressedRef.current = false;
    };
    const handleMouseDown = (e: MouseEvent) => {
      isShiftPressedRef.current = e.shiftKey;
      if (alphaTabHostRef.current?.contains(e.target as Node)) {
        window.getSelection()?.removeAllRanges();
      }
    };
    const handleMouseUp = () => {
      dragStartBarRef.current = null;
      isDraggingRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  // Estado del store de canción
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const activeTrackIndex = useStore(songStore, (s) => s.activeTrackIndex);
  const scoreViewMode = useStore(songStore, (s) => s.scoreViewMode);
  const followPlayback = useStore(songStore, (s) => s.followPlayback);
  const showLyrics = useStore(songStore, (s) => s.showLyrics);
  const loopRange = useStore(songStore, (s) => s.loopRange);
  const loopEnabled = useStore(songStore, (s) => s.loopEnabled);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);

  // Control de scroll y seguimiento de reproducción ("Bloquear vista")
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  const scrollToActiveBar = useCallback((smooth = true) => {
    const container = alphaTabHostRef.current;
    if (!container) return;

    const cursorBar = container.querySelector('.at-cursor-bar') as HTMLElement | null;
    if (!cursorBar) return;

    const barRect = cursorBar.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Área confortable de visualización
    const marginComfortTop = 24;
    const marginComfortBottom = 80;
    const isAbove = barRect.top < containerRect.top + marginComfortTop;
    const isBelow = barRect.bottom > containerRect.bottom - marginComfortBottom;

    if (isAbove || isBelow) {
      const currentScroll = container.scrollTop;
      const elementRelativeTop = barRect.top - containerRect.top + currentScroll;
      const targetScroll = Math.max(0, elementRelativeTop - 70);

      container.scrollTo({
        top: targetScroll,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  const handleContainerScroll = useCallback(() => {
    if (!songStore.getState().followPlayback) return;

    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Al soltar el scroll (inactividad de desplazamiento), si el modo bloquear vista está activo, se vuelve a la posición actual
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      const state = songStore.getState();
      if (state.followPlayback && state.isPlaying) {
        scrollToActiveBar(true);
      }
    }, 650);
  }, [songStore, scrollToActiveBar]);

  const handlePointerUp = useCallback(() => {
    if (!songStore.getState().followPlayback) return;
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      const state = songStore.getState();
      if (state.followPlayback) {
        scrollToActiveBar(true);
      }
    }, 400);
  }, [songStore, scrollToActiveBar]);

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Pista activa
  const track = useMemo(() => {
    if (!activeSong || activeSong.tracks.length === 0) return null;
    return activeSong.tracks[activeTrackIndex] ?? activeSong.tracks[0];
  }, [activeSong, activeTrackIndex]);

  const totalBars = track?.bars.length ?? 0;
  const tuningName = track?.tuning.name ?? 'Estándar';
  const capoFret = track?.capoFret ?? 0;

  // 1. Inicialización de AlphaTab (montaje en contenedor DOM visible)
  useEffect(() => {
    let isMounted = true;
    let apiInstance: AlphaSynthLike | null = null;

    const setupApiEvents = (api: AlphaSynthLike) => {
      if (api.playerStateChanged?.on) {
        api.playerStateChanged.on((args) => {
          if (!isMounted) return;
          const playing = args.state === 1;
          if (playing) {
            lastScrolledBarRef.current = null;
          }
          songStore.getState().setIsPlaying(playing);
        });
      }

      if (api.playedBeatChanged?.on) {
        api.playedBeatChanged.on((beat: unknown) => {
          if (!isMounted || !beat) return;
          const b = beat as { index?: number; voice?: { bar?: { index?: number } } };
          const barNum = (b.voice?.bar?.index ?? 0) + 1;
          const beatIdx = b.index ?? 0;
          songStore.getState().setCurrentPosition(barNum, beatIdx);

          // Optimización de scroll: Solo verificar scroll cuando cambia el compás
          // Evita 31 comprobaciones de layout síncronas innecesarias en compases de 32 pulsos
          if (
            songStore.getState().followPlayback &&
            !isUserScrollingRef.current &&
            lastScrolledBarRef.current !== barNum
          ) {
            lastScrolledBarRef.current = barNum;
            scrollToActiveBar(true);
          }
        });
      }

      if (api.postRenderFinished?.on) {
        api.postRenderFinished.on(() => {
          if (!isMounted) return;
          const store = songStore.getState();
          const curTrack = store.activeSong?.tracks[store.activeTrackIndex];
          if (!curTrack?.bars) return;
          const rawApi = api as unknown as {
            _updateSelectionCursor?: (
              range: { startTick: number; endTick: number } | null,
            ) => void;
          };
          if (typeof rawApi._updateSelectionCursor !== 'function') return;

          if (store.loopEnabled && store.loopRange) {
            const range = resolvePlaybackRangeForBars(curTrack.bars, store.loopRange, api);
            if (range) {
              if (alphaTabHostRef.current) {
                alphaTabHostRef.current.setAttribute('data-highlight-mode', 'loop');
              }
              rawApi._updateSelectionCursor({
                startTick: range.startTick,
                endTick: Math.max(range.startTick, range.endTick - 10),
              });
            }
          } else if (store.selectedBarRange) {
            const range = resolvePlaybackRangeForBars(curTrack.bars, store.selectedBarRange, api);
            if (range) {
              if (alphaTabHostRef.current) {
                alphaTabHostRef.current.setAttribute('data-highlight-mode', 'selection');
              }
              rawApi._updateSelectionCursor({
                startTick: range.startTick,
                endTick: Math.max(range.startTick, range.endTick - 10),
              });
            }
          }
        });
      }

      if (api.beatMouseDown?.on) {
        api.beatMouseDown.on((beat: unknown) => {
          if (!isMounted || !beat) return;
          const b = beat as {
            index?: number;
            voice?: { bar?: { index?: number } };
            absolutePlaybackStart?: number;
            shiftKey?: boolean;
            isShift?: boolean;
          };
          const barNum = (b.voice?.bar?.index ?? 0) + 1;
          const beatIdx = b.index ?? 0;

          // Detección de selección múltiple de compases mediante Shift + Clic
          const isShift = isShiftPressedRef.current || Boolean(b.shiftKey || b.isShift);
          const store = songStore.getState();
          dragStartBarRef.current = barNum;
          isDraggingRef.current = false;

          if (isShift) {
            const prevBar = store.selectedBarRange ? store.selectedBarRange[0] : store.currentBar;
            const minBar = Math.min(prevBar, barNum);
            const maxBar = Math.max(prevBar, barNum);
            store.setSelectedBarRange([minBar, maxBar]);

            // Resaltar visualmente en turquesa sin desplazar el cursor de reproducción
            const curTrack = store.activeSong?.tracks[store.activeTrackIndex];
            if (curTrack?.bars) {
              const bounds = resolvePlaybackRangeForBars(curTrack.bars, [minBar, maxBar], api);
              if (bounds) {
                if (alphaTabHostRef.current) {
                  alphaTabHostRef.current.setAttribute('data-highlight-mode', 'selection');
                }
                const rawApi = api as unknown as {
                  _updateSelectionCursor?: (
                    range: { startTick: number; endTick: number } | null,
                  ) => void;
                };
                rawApi._updateSelectionCursor?.({
                  startTick: bounds.startTick,
                  endTick: Math.max(bounds.startTick, bounds.endTick - 10),
                });
              }
            }
            return;
          }

          // Clic normal sin Shift: limpiar selección previa si existía
          if (store.selectedBarRange) {
            store.setSelectedBarRange(null);
          }

          // Si el bucle estaba activo pero el usuario hace clic fuera del rango del bucle:
          // Desactivamos el bucle para permitir situar la reproducción y reproducir libremente en esa posición
          if (
            store.loopEnabled &&
            store.loopRange &&
            (barNum < store.loopRange[0] || barNum > store.loopRange[1])
          ) {
            store.setLoopEnabled(false);
            controller.setPlaybackRange(null);
            controller.setLoopEnabled(false);
            if (alphaTabHostRef.current) {
              alphaTabHostRef.current.removeAttribute('data-highlight-mode');
            }
            const rawApi = api as unknown as {
              _updateSelectionCursor?: (range: unknown) => void;
            };
            rawApi._updateSelectionCursor?.(null);
          }

          store.setCurrentPosition(barNum, beatIdx);

          let tick: number | undefined;
          const rawApiWithCache = api as unknown as {
            tickCache?: { getBeatStart?: (beat: unknown) => number };
          };
          if (
            rawApiWithCache.tickCache &&
            typeof rawApiWithCache.tickCache.getBeatStart === 'function'
          ) {
            const cacheTick = rawApiWithCache.tickCache.getBeatStart(beat);
            if (typeof cacheTick === 'number' && !Number.isNaN(cacheTick) && cacheTick >= 0) {
              tick = cacheTick;
            }
          }

          if (tick === undefined || Number.isNaN(tick)) {
            tick = b.absolutePlaybackStart;
          }

          if (tick === undefined || Number.isNaN(tick)) {
            const currentSong = store.activeSong;
            const currentTrack = currentSong?.tracks[store.activeTrackIndex];
            tick = resolvePlaybackTickForBarBeat(currentTrack?.bars, barNum, beatIdx, api);
          }

          if (tick !== undefined && !Number.isNaN(tick)) {
            controller.seekToTick(tick);
            const rawApi = api as unknown as {
              _cursorUpdateTick?: (
                tick: number,
                stop: boolean,
                speed: number,
                shouldScroll?: boolean,
                forceUpdate?: boolean,
              ) => void;
            };
            if (typeof rawApi._cursorUpdateTick === 'function') {
              rawApi._cursorUpdateTick(tick, false, 1, false, true);
            }
            if (store.followPlayback && !isUserScrollingRef.current) {
              lastScrolledBarRef.current = barNum;
              scrollToActiveBar(true);
            }
          }
        });
      }

      if (api.beatMouseMove?.on) {
        api.beatMouseMove.on((beat: unknown) => {
          if (!isMounted || !beat) return;
          if (dragStartBarRef.current === null) return;
          const b = beat as { voice?: { bar?: { index?: number } } };
          const hoverBar = (b.voice?.bar?.index ?? 0) + 1;
          if (hoverBar !== dragStartBarRef.current) {
            isDraggingRef.current = true;
            const minBar = Math.min(dragStartBarRef.current, hoverBar);
            const maxBar = Math.max(dragStartBarRef.current, hoverBar);
            const store = songStore.getState();
            store.setSelectedBarRange([minBar, maxBar]);
            const curTrack = store.activeSong?.tracks[store.activeTrackIndex];
            if (curTrack?.bars) {
              const bounds = resolvePlaybackRangeForBars(curTrack.bars, [minBar, maxBar], api);
              if (bounds) {
                if (alphaTabHostRef.current) {
                  alphaTabHostRef.current.setAttribute('data-highlight-mode', 'selection');
                }
                const rawApi = api as unknown as {
                  _updateSelectionCursor?: (
                    range: { startTick: number; endTick: number } | null,
                  ) => void;
                };
                rawApi._updateSelectionCursor?.({
                  startTick: bounds.startTick,
                  endTick: Math.max(bounds.startTick, bounds.endTick - 10),
                });
              }
            }
          }
        });
      }

      if (api.beatMouseUp?.on) {
        api.beatMouseUp.on(() => {
          if (!isMounted) return;
          dragStartBarRef.current = null;
          isDraggingRef.current = false;
        });
      }
    };

    if (alphaTabHostRef.current) {
      if (createApi) {
        // Fábrica inyectable para pruebas unitarias y de integración
        apiInstance = createApi(alphaTabHostRef.current, {
          scoreViewMode: songStore.getState().scoreViewMode,
          showLyrics: songStore.getState().showLyrics,
          activeTrackIndex: songStore.getState().activeTrackIndex,
        });
        if (apiInstance) {
          apiRef.current = apiInstance;
          controller.attachPlayer(apiInstance);
          setupApiEvents(apiInstance);

          const currentSong = songStore.getState().activeSong;
          lastLoadedSongIdRef.current = currentSong?.id ?? null;
          loadSongIntoAlphaTab(apiInstance, currentSong, songStore.getState().activeTrackIndex);
        }
      } else if (
        typeof window !== 'undefined' &&
        !(typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom'))
      ) {
        // Carga nativa en navegador real
        import('@coderline/alphatab')
          .then((at) => {
            if (!isMounted || !alphaTabHostRef.current) return;
            try {
              const currentTrackIdx = songStore.getState().activeTrackIndex;
              const currentScoreMode = songStore.getState().scoreViewMode;
              const currentLyrics = songStore.getState().showLyrics;

              const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
              const fontDir = `${baseUrl}/font/`;
              const soundFontUrl = `${baseUrl}/soundfont/sonivox.sf2`;

              const settings = new at.Settings();
              settings.core.fontDirectory = fontDir;
              settings.core.tracks = [currentTrackIdx];
              settings.player.soundFont = soundFontUrl;
              settings.player.enablePlayer = true;
              settings.player.enableUserInteraction = false;
              settings.player.enableCursor = true;
              settings.player.enableAnimatedBeatCursor = false;
              settings.player.enableElementHighlighting = true;
              settings.player.scrollElement = alphaTabHostRef.current;
              settings.player.scrollMode = at.ScrollMode.Off;
              settings.display.layoutMode = at.LayoutMode.Page;
              settings.display.scale = 0.9;
              settings.display.padding = [8, 12, 8, 12];

              // 1. Modos nativos de AlphaTab y visualización del ritmo en Tablatura
              const curTrackModel = songStore.getState().activeSong?.tracks[currentTrackIdx];
              const isPercTrack = Boolean(curTrackModel?.isPercussion);
              if (isPercTrack || currentScoreMode === 'score') {
                settings.display.staveProfile = at.StaveProfile.Score;
                settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
              } else if (currentScoreMode === 'score-tab') {
                settings.display.staveProfile = at.StaveProfile.ScoreTab;
                settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
              } else {
                settings.display.staveProfile = at.StaveProfile.Tab;
                settings.notation.rhythmMode = at.TabRhythmMode.ShowWithBars;
              }

              // 2. Tema oscuro nativo integrado en los recursos de grabado
              const Color = at.model.Color;
              settings.display.resources.staffLineColor = Color.fromJson('#334155')!;
              settings.display.resources.barSeparatorColor = Color.fromJson('#475569')!;
              settings.display.resources.mainGlyphColor = Color.fromJson('#f8fafc')!;
              settings.display.resources.secondaryGlyphColor = Color.fromJson('#94a3b8')!;
              settings.display.resources.barNumberColor = Color.fromJson('#64748b')!;
              settings.display.resources.scoreInfoColor = Color.fromJson('#f8fafc')!;

              // Ocultar cabeceras repetitivas redundantes (ya mostradas en SongTopBar)
              settings.notation.elements.set(at.NotationElement.ScoreTitle, false);
              settings.notation.elements.set(at.NotationElement.ScoreSubTitle, false);
              settings.notation.elements.set(at.NotationElement.ScoreArtist, false);
              settings.notation.elements.set(at.NotationElement.ScoreAlbum, false);
              settings.notation.elements.set(at.NotationElement.ScoreWords, false);
              settings.notation.elements.set(at.NotationElement.ScoreMusic, false);
              settings.notation.elements.set(at.NotationElement.ScoreWordsAndMusic, false);
              settings.notation.elements.set(at.NotationElement.ScoreCopyright, false);
              settings.notation.elements.set(at.NotationElement.GuitarTuning, false);
              settings.notation.elements.set(at.NotationElement.TrackNames, false);

              // Ocultar marcadores de sección en la partitura/tablatura para evitar solapamientos con acordes
              // (Guitar Aid los muestra limpia y ordenadamente en la barra contextual superior)
              settings.notation.elements.set(at.NotationElement.EffectMarker, false);

              // Letra
              settings.notation.elements.set(at.NotationElement.EffectLyrics, currentLyrics);

              const api = new at.AlphaTabApi(alphaTabHostRef.current, settings);
              try {
                api.midiEventsPlayedFilter = [at.midi.MidiEventType.AlphaTabMetronome];
              } catch {
                // ignore
              }
              apiInstance = api as unknown as AlphaSynthLike;
              apiRef.current = apiInstance;
              if (apiInstance) {
                controller.attachPlayer(apiInstance);
                setupApiEvents(apiInstance);

                if (api.playerReady) {
                  api.playerReady.on(() => {
                    if (!isMounted) return;
                    const mixer = songStore.getState().trackMixer;
                    controller.applyTrackMixer(mixer);
                  });
                }

                const currentSong = songStore.getState().activeSong;
                lastLoadedSongIdRef.current = currentSong?.id ?? null;
                loadSongIntoAlphaTab(api, currentSong, currentTrackIdx);
              }
            } catch (err) {
              console.warn('AlphaTabApi initialization deferred/skipped:', err);
            }
          })
          .catch(() => {
            // Entorno sin soporte / test runner
          });
      }
    }

    return () => {
      isMounted = false;
      controller.detachPlayer();
      if (apiRef.current && typeof apiRef.current.destroy === 'function') {
        apiRef.current.destroy();
      }
      apiRef.current = null;
    };
  }, [createApi, controller, songStore]);

  // 2. Cambio reactivo de modo de vista (Score, Score+Tab, Tab)
  useEffect(() => {
    const api = apiRef.current as {
      settings?: {
        display?: { staveProfile?: number };
        notation?: { rhythmMode?: number };
      };
      updateSettings?: () => void;
      render?: () => void;
    } | null;
    if (!api || !api.settings) return;

    import('@coderline/alphatab')
      .then((at) => {
        if (!apiRef.current || !api.settings) return;
        const effectiveMode = track?.isPercussion ? 'score' : scoreViewMode;
        switch (effectiveMode) {
          case 'score':
            if (api.settings.display) api.settings.display.staveProfile = at.StaveProfile.Score;
            if (api.settings.notation) api.settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
            break;
          case 'score-tab':
            if (api.settings.display) api.settings.display.staveProfile = at.StaveProfile.ScoreTab;
            if (api.settings.notation) api.settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
            break;
          case 'tab':
          default:
            if (api.settings.display) api.settings.display.staveProfile = at.StaveProfile.Tab;
            if (api.settings.notation) api.settings.notation.rhythmMode = at.TabRhythmMode.ShowWithBars;
            break;
        }
        if (typeof api.updateSettings === 'function') api.updateSettings();
        if (typeof api.render === 'function') api.render();
      })
      .catch(() => {
        // En entorno de tests sin bundler de AlphaTab
      });
  }, [scoreViewMode, track?.isPercussion]);

  // 3. Conmutación reactiva de la letra
  useEffect(() => {
    const api = apiRef.current as {
      settings?: {
        notation?: { elements?: { set?: (key: number, val: boolean) => void } };
      };
      updateSettings?: () => void;
      render?: () => void;
    } | null;
    if (!api || !api.settings) return;

    import('@coderline/alphatab')
      .then((at) => {
        if (!apiRef.current || !api.settings?.notation?.elements?.set) return;
        api.settings.notation.elements.set(at.NotationElement.EffectLyrics, showLyrics);
        if (typeof api.updateSettings === 'function') api.updateSettings();
        if (typeof api.render === 'function') api.render();
      })
      .catch(() => {});
  }, [showLyrics]);

  // 4. Carga reactiva de nueva canción si cambia activeSong o activeTrackIndex
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    if (!activeSong) {
      controller.stop();
      lastLoadedSongIdRef.current = null;
      return;
    }

    const rawApi = api as {
      load?: (data: unknown, tracks?: number[]) => void;
      tex?: (tex: string, tracks?: number[]) => void;
      renderTracks?: (tracks: unknown[]) => void;
      score?: { tracks?: unknown[] };
    };

    // Si la canción es la misma y solo cambió la pista activa, renderizar la pista directamente si está disponible
    if (
      lastLoadedSongIdRef.current === activeSong.id &&
      rawApi.score?.tracks?.[activeTrackIndex] &&
      typeof rawApi.renderTracks === 'function'
    ) {
      try {
        rawApi.renderTracks([rawApi.score.tracks[activeTrackIndex]]);
      } catch (err) {
        console.warn('Error conmutando pista en AlphaTab:', err);
      }
      return;
    }

    if (lastLoadedSongIdRef.current !== activeSong.id) {
      controller.stop();
    }

    lastLoadedSongIdRef.current = activeSong.id;
    try {
      loadSongIntoAlphaTab(api, activeSong, activeTrackIndex);
    } catch (err) {
      console.warn('Error cargando canción en AlphaTab:', err);
    }
  }, [activeSong, activeTrackIndex, controller]);

  // 6. Sincronización del bucle con el controlador de reproducción y resaltado visual en AlphaTab
  useEffect(() => {
    const rawApi = apiRef.current as unknown as {
      _updateSelectionCursor?: (
        range: { startTick: number; endTick: number } | null,
      ) => void;
      clearPlaybackRangeHighlight?: () => void;
    } | null;

    if (!track?.bars) return;

    if (loopEnabled && loopRange) {
      const playbackRange = resolvePlaybackRangeForBars(track.bars, loopRange, apiRef.current);
      if (playbackRange) {
        controller.setPlaybackRange(playbackRange);
        controller.setLoopEnabled(true);

        // Resaltar visualmente el bucle en ámbar mediante .at-selection en AlphaTab
        if (alphaTabHostRef.current) {
          alphaTabHostRef.current.setAttribute('data-highlight-mode', 'loop');
        }
        rawApi?._updateSelectionCursor?.({
          startTick: playbackRange.startTick,
          endTick: Math.max(playbackRange.startTick, playbackRange.endTick - 10),
        });
        return;
      }
    }

    controller.setPlaybackRange(null);
    controller.setLoopEnabled(false);

    // Si hay un rango de selección múltiple (Shift + clic o arrastre), resaltarlo visualmente en turquesa
    if (selectedBarRange) {
      const selectionRange = resolvePlaybackRangeForBars(track.bars, selectedBarRange, apiRef.current);
      if (selectionRange) {
        if (alphaTabHostRef.current) {
          alphaTabHostRef.current.setAttribute('data-highlight-mode', 'selection');
        }
        rawApi?._updateSelectionCursor?.({
          startTick: selectionRange.startTick,
          endTick: Math.max(selectionRange.startTick, selectionRange.endTick - 10),
        });
        return;
      }
    }

    if (alphaTabHostRef.current) {
      alphaTabHostRef.current.removeAttribute('data-highlight-mode');
    }
    rawApi?._updateSelectionCursor?.(null);
    rawApi?.clearPlaybackRangeHighlight?.();
  }, [loopEnabled, loopRange, selectedBarRange, track, activeTrackIndex, controller]);

  return (
    <div
      className={`${styles.scoreCard} ${className ?? ''}`}
      style={style}
      data-testid="alphatab-viewport"
      data-score-view-mode={scoreViewMode}
      data-track-index={activeTrackIndex}
      role="region"
      aria-label="Visor de partitura y tablatura"
    >
      {/* 1. Cabecera interna fija (36 px) */}
      <header className={styles.scoreHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.viewModeBadge}>
            {viewModeLabel(scoreViewMode, track?.isPercussion)}
          </span>
          <span className={styles.dot}>·</span>
          <span className={styles.trackName}>{(track?.name ?? 'Pista 1').toUpperCase()}</span>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={`${styles.followPlaybackBtn} ${followPlayback ? styles.followActive : ''}`}
            onClick={() => songStore.getState().toggleFollowPlayback()}
            title={
              followPlayback
                ? 'Bloqueo de vista activo: la partitura sigue la reproducción automáticamente. Haz clic para cambiar a Vista libre.'
                : 'Vista libre activa: puedes desplazarte libremente por la partitura. Haz clic para activar Bloquear vista.'
            }
            aria-pressed={followPlayback}
            data-testid="viewport-toggle-follow-btn"
          >
            {followPlayback ? '🔒 Seguir' : '🔓 Libre'}
          </button>
          {scoreViewMode === 'score' ? (
            <span className={styles.scoreTechnicalSubtitle}>
              {track?.isPercussion
                ? 'Percusión'
                : (track?.stringCount ?? 6) <= 4
                ? 'Clave de fa'
                : 'Clave de sol (8vb)'} · {totalBars} compases
            </span>
          ) : (
            <>
              <span className={styles.tuningText}>{tuningName}</span>
              <span className={styles.dot}>·</span>
              <span className={styles.capoText}>Capo {capoFret}</span>
              <span className={styles.dot}>·</span>
              <span className={styles.barTotalText}>{totalBars} compases</span>
            </>
          )}
        </div>
      </header>

      {/* 2. Contenedor nativo y visible de AlphaTab (con tema oscuro integrado) */}
      <div
        ref={alphaTabHostRef}
        className={styles.alphaTabContainer}
        data-testid="alphatab-container"
        tabIndex={0}
        onScroll={handleContainerScroll}
        onPointerUp={handlePointerUp}
        onMouseDown={(e) => {
          if (e.button === 0) {
            e.preventDefault();
            window.getSelection()?.removeAllRanges();
          }
        }}
      >
        {!track && <div className={styles.emptyState}>No hay ninguna canción activa.</div>}
      </div>
    </div>
  );
});
