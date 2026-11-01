import React, { useEffect, useRef, useMemo } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  alphaSynthController as defaultController,
  type AlphaSynthController,
  type AlphaSynthLike,
} from '../../audio';
import {
  songStore as defaultSongStore,
  resolveActiveHarmony,
  type ScoreViewMode,
  type SongStore,
} from '../../state/song';
import {
  getPresetSong,
  PRESET_POP_DIATONIC,
  calculatePlaybackRangeForBars,
  type SongBar,
} from '../../song';
import {
  getChordQuality,
  pcName,
  romanNumeral,
} from '../../theory';
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

export function viewModeLabel(mode: ScoreViewMode): string {
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

export function AlphaTabViewport({
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
  const currentBar = useStore(songStore, (s) => s.currentBar);
  const currentBeat = useStore(songStore, (s) => s.currentBeat);
  const scoreViewMode = useStore(songStore, (s) => s.scoreViewMode);
  const showLyrics = useStore(songStore, (s) => s.showLyrics);
  const loopRange = useStore(songStore, (s) => s.loopRange);
  const loopEnabled = useStore(songStore, (s) => s.loopEnabled);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);
  const barOverrides = useStore(songStore, (s) => s.barOverrides);

  // Pista activa
  const track = useMemo(() => {
    if (!activeSong || activeSong.tracks.length === 0) return null;
    return activeSong.tracks[activeTrackIndex] ?? activeSong.tracks[0];
  }, [activeSong, activeTrackIndex]);

  const totalBars = track?.bars.length ?? 0;
  const tuningName = track?.tuning.name ?? 'Estándar';
  const capoFret = track?.capoFret ?? 0;

  // Compás activo y marcador de sección
  const activeBar: SongBar | undefined = useMemo(() => {
    if (!track) return undefined;
    return (
      track.bars.find((b) => b.number === currentBar) ??
      track.bars[currentBar - 1] ??
      track.bars[0]
    );
  }, [track, currentBar]);

  const sectionName = activeBar?.sectionMarker;

  // Armonía activa calculada para el compás y pulso actual
  const harmony = useMemo(() => {
    return resolveActiveHarmony(songStore.getState());
  }, [songStore, currentBar, currentBeat, activeTrackIndex, activeSong, barOverrides]);

  const chordInfo = useMemo(() => {
    if (!harmony || harmony.chordRoot === undefined || !harmony.chordQuality) {
      return null;
    }
    const cRootName = pcName(harmony.chordRoot, 'sharps');
    const quality = getChordQuality(harmony.chordQuality);
    const chordNameStr = `${cRootName}${quality.symbol}`;
    const roman = romanNumeral(harmony.scaleTonic, harmony.chordRoot, quality);
    return {
      name: chordNameStr,
      roman,
      hasOverride: harmony.hasChordOverride,
    };
  }, [harmony]);

  const chordDisplay = chordInfo?.name;
  const chordRoman = chordInfo?.roman;
  const hasOverride = chordInfo?.hasOverride ?? false;

  // 1. Inicialización de AlphaTab (montaje en contenedor DOM visible)
  useEffect(() => {
    let isMounted = true;
    let apiInstance: AlphaSynthLike | null = null;

    const setupApiEvents = (api: AlphaSynthLike) => {
      if (api.playerStateChanged?.on) {
        api.playerStateChanged.on((args) => {
          if (!isMounted) return;
          const playing = args.state === 1;
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
            const range = calculatePlaybackRangeForBars(curTrack.bars, store.loopRange);
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
            const range = calculatePlaybackRangeForBars(curTrack.bars, store.selectedBarRange);
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
              const bounds = calculatePlaybackRangeForBars(curTrack.bars, [minBar, maxBar]);
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

          let tick = b.absolutePlaybackStart;
          if (tick === undefined || Number.isNaN(tick)) {
            const currentSong = store.activeSong;
            const currentTrack = currentSong?.tracks[store.activeTrackIndex];
            const startBar = currentTrack?.bars[barNum - 1];
            const num = startBar?.timeSignature?.numerator ?? 4;
            const den = startBar?.timeSignature?.denominator ?? 4;
            const ticksPerMeasure = Math.round((960 * 4 * num) / den);
            const ticksPerBeat = Math.round((960 * 4) / den);
            tick = (barNum - 1) * ticksPerMeasure + beatIdx * ticksPerBeat;
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
              const bounds = calculatePlaybackRangeForBars(curTrack.bars, [minBar, maxBar]);
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
              settings.player.scrollMode = at.ScrollMode.Continuous;
              settings.display.layoutMode = at.LayoutMode.Page;
              settings.display.scale = 0.9;
              settings.display.padding = [8, 12, 8, 12];

              // 1. Modos nativos de AlphaTab y visualización del ritmo en Tablatura
              switch (currentScoreMode) {
                case 'score':
                  settings.display.staveProfile = at.StaveProfile.Score;
                  settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
                  break;
                case 'score-tab':
                  settings.display.staveProfile = at.StaveProfile.ScoreTab;
                  settings.notation.rhythmMode = at.TabRhythmMode.Hidden;
                  break;
                case 'tab':
                default:
                  settings.display.staveProfile = at.StaveProfile.Tab;
                  settings.notation.rhythmMode = at.TabRhythmMode.ShowWithBars;
                  break;
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
                const alphaTex =
                  currentSong?.alphaTex ??
                  getPresetSong(currentSong?.id ?? '')?.alphaTex ??
                  PRESET_POP_DIATONIC.alphaTex;
                if (
                  alphaTex &&
                  typeof (api as unknown as { tex?: (t: string, tr?: number[]) => void }).tex ===
                    'function'
                ) {
                  (api as unknown as { tex: (t: string, tr?: number[]) => void }).tex(alphaTex, [
                    currentTrackIdx,
                  ]);
                }
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

  // 2. Cambio de pista activa: se conmuta la pista renderizada en AlphaTab
  useEffect(() => {
    const api = apiRef.current as {
      renderTracks?: (tracks: unknown[]) => void;
      score?: { tracks?: unknown[] };
    } | null;
    if (!api || typeof api.renderTracks !== 'function') return;

    const trackObj = api.score?.tracks?.[activeTrackIndex];
    if (trackObj) {
      api.renderTracks([trackObj]);
    } else {
      api.renderTracks([activeTrackIndex]);
    }
  }, [activeTrackIndex]);

  // 3. Cambio reactivo de modo de vista (Score, Score+Tab, Tab)
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
        switch (scoreViewMode) {
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
  }, [scoreViewMode]);

  // 4. Conmutación reactiva de la letra
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

  // 5. Carga reactiva de nueva canción si cambia activeSong
  useEffect(() => {
    const api = apiRef.current as {
      tex?: (tex: string, tracks?: number[]) => void;
    } | null;
    if (!api || typeof api.tex !== 'function' || !activeSong) return;

    const alphaTex =
      activeSong.alphaTex ??
      getPresetSong(activeSong.id ?? '')?.alphaTex ??
      PRESET_POP_DIATONIC.alphaTex;
    if (alphaTex) {
      api.tex(alphaTex, [activeTrackIndex]);
    }
  }, [activeSong, activeTrackIndex]);

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
      const playbackRange = calculatePlaybackRangeForBars(track.bars, loopRange);
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
      const selectionRange = calculatePlaybackRangeForBars(track.bars, selectedBarRange);
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
          <span className={styles.viewModeBadge}>{viewModeLabel(scoreViewMode)}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.trackName}>{(track?.name ?? 'Pista 1').toUpperCase()}</span>
        </div>
        <div className={styles.headerRight}>
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

      {/* 2. Barra contextual superior de Guitar Aid (acordes analizados, secciones y bucle) */}
      <div className={styles.contextOverlayBar} data-testid="context-overlay-bar">
        <div className={styles.contextLeft}>
          <span className={styles.contextBarIndicator} data-testid="active-bar-badge">
            Compás {currentBar}
            {currentBeat > 0 ? ` · Pulso ${currentBeat + 1}` : ''}
          </span>
          {sectionName && (
            <span className={styles.contextSectionBadge} data-testid="section-badge">
              {sectionName}
            </span>
          )}
          {chordDisplay && (
            <span
              className={`${styles.contextChordChip} ${hasOverride ? styles.overrideChip : ''}`}
              data-testid="analyzed-chord-chip"
              title={
                hasOverride
                  ? 'Acorde fijado manualmente por el usuario'
                  : 'Acorde analizado por Guitar Aid'
              }
            >
              <span className={styles.chordSymbol}>{chordDisplay}</span>
              {chordRoman && <span className={styles.chordDegree}>({chordRoman})</span>}
              {hasOverride && <span className={styles.overrideDot}>●</span>}
            </span>
          )}
        </div>
        <div className={styles.contextRight}>
          {selectedBarRange && (
            <span className={styles.selectedRangeBadge} data-testid="selected-range-badge">
              Selección: c.{selectedBarRange[0]}–{selectedBarRange[1]}
              <button
                type="button"
                className={styles.clearSelectionButton}
                onClick={() => {
                  songStore.getState().setSelectedBarRange(null);
                  if (alphaTabHostRef.current) {
                    alphaTabHostRef.current.removeAttribute('data-highlight-mode');
                  }
                  const rawApi = apiRef.current as unknown as {
                    _updateSelectionCursor?: (range: null) => void;
                  };
                  rawApi?._updateSelectionCursor?.(null);
                }}
                title="Quitar selección"
                aria-label="Quitar selección"
              >
                ×
              </button>
            </span>
          )}
          {loopEnabled && loopRange && (
            <span className={styles.loopBadge} data-testid="loop-active-badge">
              🔁 Bucle c.{loopRange[0]}–{loopRange[1]}
            </span>
          )}
        </div>
      </div>

      {/* 3. Contenedor nativo y visible de AlphaTab (con tema oscuro integrado) */}
      <div
        ref={alphaTabHostRef}
        className={styles.alphaTabContainer}
        data-testid="alphatab-container"
        tabIndex={0}
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
}
