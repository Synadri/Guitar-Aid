import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  calculateTickForBarBeat,
  calculatePlaybackRangeForBars,
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

function viewModeLabel(mode: ScoreViewMode): string {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const alphaTabHostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaSynthLike | null>(null);

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

  // Estado local para interacción de arrastre (drag selection de compases)
  const [dragStartBar, setDragStartBar] = useState<number | null>(null);

  // Pista activa
  const track = useMemo(() => {
    if (!activeSong || activeSong.tracks.length === 0) return null;
    return activeSong.tracks[activeTrackIndex] ?? activeSong.tracks[0];
  }, [activeSong, activeTrackIndex]);

  const totalBars = track?.bars.length ?? 0;
  const tuningName = track?.tuning.name ?? 'Estándar';
  const capoFret = track?.capoFret ?? 0;

  // 1. Inicialización del reproductor y visor AlphaTab (se ejecuta al montar)
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
    };

    if (alphaTabHostRef.current) {
      if (createApi) {
        // Doble inyectable para tests
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
        // Carga diferida en navegador real
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
              settings.player.enableUserInteraction = true;

              switch (currentScoreMode) {
                case 'score':
                  settings.display.staveProfile = at.StaveProfile.Score;
                  break;
                case 'score-tab':
                  settings.display.staveProfile = at.StaveProfile.ScoreTab;
                  break;
                case 'tab':
                default:
                  settings.display.staveProfile = at.StaveProfile.Tab;
                  break;
              }

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

                // Al quedar listo el reproductor con el SoundFont/score cargado, sincronizar niveles del mezclador
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
            // Entorno sin navegador / test runner
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

  // 2. Cambio de pista activa: se conmuta la pista renderizada en AlphaTab sin reiniciar el reproductor
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

  // 3. Cambio reactivo de modo de visualización (Score, Score+Tab, Tab) y letras
  useEffect(() => {
    const api = apiRef.current as {
      settings?: {
        display?: { staveProfile?: number };
        notation?: { elements?: { set?: (key: number, val: boolean) => void } };
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
            break;
          case 'score-tab':
            if (api.settings.display) api.settings.display.staveProfile = at.StaveProfile.ScoreTab;
            break;
          case 'tab':
          default:
            if (api.settings.display) api.settings.display.staveProfile = at.StaveProfile.Tab;
            break;
        }
        api.settings.notation?.elements?.set?.(at.NotationElement.EffectLyrics, showLyrics);
        api.updateSettings?.();
        api.render?.();
      })
      .catch(() => {});
  }, [scoreViewMode, showLyrics]);

  // 4. Cambio de canción activa: cargar nueva partitura en formato AlphaTex
  const prevSongIdRef = useRef<string | null>(activeSong?.id ?? null);
  useEffect(() => {
    const api = apiRef.current as { tex?: (t: string, tr?: number[]) => void } | null;
    if (!api || !activeSong || prevSongIdRef.current === activeSong.id) return;
    prevSongIdRef.current = activeSong.id;
    const alphaTex =
      activeSong.alphaTex ?? getPresetSong(activeSong.id)?.alphaTex ?? PRESET_POP_DIATONIC.alphaTex;
    if (alphaTex && typeof api.tex === 'function') {
      api.tex(alphaTex, [activeTrackIndex]);
    }
  }, [activeSong, activeTrackIndex]);

  // 5. Sincronización reactiva del bucle A–B (loopRange y loopEnabled) con el controlador de audio
  useEffect(() => {
    if (loopEnabled && loopRange && track?.bars) {
      const bounds = calculatePlaybackRangeForBars(track.bars, loopRange);
      controller.setPlaybackRange(bounds);
      controller.setLoopEnabled(Boolean(bounds));
    } else {
      controller.setPlaybackRange(null);
      controller.setLoopEnabled(false);
    }
  }, [loopEnabled, loopRange, track?.bars, controller]);

  // Selección de compases con ratón
  const handleBarClick = (barNumber: number, event: React.MouseEvent) => {
    if (event.shiftKey) {
      // Shift + Clic: selecciona el rango entre el compás previo y el pulsado
      const start = Math.min(currentBar, barNumber);
      const end = Math.max(currentBar, barNumber);
      songStore.getState().setSelectedBarRange([start, end]);
      songStore.getState().setInspectedBar(barNumber);
    } else {
      // Si el bucle está activo y se pulsa fuera de su rango, desactivar bucle para permitir navegar libremente
      if (loopEnabled && loopRange && (barNumber < loopRange[0] || barNumber > loopRange[1])) {
        songStore.getState().setLoopEnabled(false);
        controller.setLoopEnabled(false);
        controller.setPlaybackRange(null);
      }
      // Clic simple: fija compás activo y quita rango
      songStore.getState().setCurrentBar(barNumber);
      songStore.getState().setCurrentBeat(0);
      songStore.getState().setInspectedBar(barNumber);
      songStore.getState().setSelectedBarRange(null);
      const tick = calculateTickForBarBeat(track?.bars, barNumber, 0);
      controller.seekToTick(tick);
    }
  };

  const handleBarMouseDown = (barNumber: number, event: React.MouseEvent) => {
    if (event.button !== 0 || event.shiftKey) return;
    setDragStartBar(barNumber);
  };

  const handleBarMouseEnter = (barNumber: number) => {
    if (dragStartBar === null) return;
    const start = Math.min(dragStartBar, barNumber);
    const end = Math.max(dragStartBar, barNumber);
    songStore.getState().setSelectedBarRange([start, end]);
  };

  const handleMouseUp = () => {
    setDragStartBar(null);
  };

  return (
    <div
      className={`${styles.scoreCard} ${className ?? ''}`}
      style={style}
      data-testid="alphatab-viewport"
      data-score-view-mode={scoreViewMode}
      data-track-index={activeTrackIndex}
      onMouseUp={handleMouseUp}
    >
      {/* Contenedor DOM para la librería AlphaTab (aislado fuera de pantalla con position: fixed para evitar desplazamiento del lienzo) */}
      <div
        ref={alphaTabHostRef}
        className={styles.alphaTabContainer}
        data-testid="alphatab-container"
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          width: 800,
          height: 600,
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          zIndex: -100,
        }}
      />

      {/* 1. Cabecera interna fija (36 px) */}
      <header className={styles.scoreHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.viewModeBadge}>{viewModeLabel(scoreViewMode)}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.trackName}>{(track?.name ?? 'Pista 1').toUpperCase()}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.tuningText}>{tuningName}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.capoText}>Capo {capoFret}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.barPositionText}>
            compás {currentBar} de {totalBars}
          </span>
        </div>
      </header>

      {/* 2. Lienzo de partitura y tablatura con scroll */}
      <div
        ref={containerRef}
        className={styles.scoreViewport}
        tabIndex={0}
        role="region"
        aria-label="Lienzo de partitura y tablatura"
      >
        {/* Representación estructurada y reactiva de compases (visible y accesible en tests/fallback) */}
        {!track ? (
          <div className={styles.emptyState}>No hay ninguna canción activa.</div>
        ) : (
          <div className={styles.systemsContainer} data-testid="score-systems">
            {track.bars.map((bar) => {
              const isActive = bar.number === currentBar;
              const isSelected =
                Boolean(selectedBarRange) &&
                bar.number >= selectedBarRange![0] &&
                bar.number <= selectedBarRange![1];
              const isInLoop =
                Boolean(loopEnabled) &&
                Boolean(loopRange) &&
                bar.number >= loopRange![0] &&
                bar.number <= loopRange![1];
              const isLoopStart =
                Boolean(loopEnabled) && Boolean(loopRange) && bar.number === loopRange![0];
              const isLoopEnd =
                Boolean(loopEnabled) && Boolean(loopRange) && bar.number === loopRange![1];

              // Detección de acorde visible en el compás (override manual o anotación)
              const overrideChord = barOverrides[bar.number]?.chordId;
              const annotatedChord = bar.beats.find((b) => b.chordAnnotation)?.chordAnnotation;
              const chordDisplay = overrideChord ?? annotatedChord;

              // Letras del compás
              const barLyrics = bar.beats
                .map((b) => b.lyrics)
                .filter(Boolean)
                .join(' ');

              const isEstribillo = bar.sectionMarker?.toLowerCase().includes('estribillo') ?? false;

              return (
                <div
                  key={bar.number}
                  className={`${styles.barCell} ${isActive ? styles.barCellActive : ''} ${
                    isSelected ? styles.barCellSelected : ''
                  } ${isInLoop ? styles.barCellInLoop : ''}`}
                  data-testid={`bar-${bar.number}`}
                  data-bar-number={bar.number}
                  data-is-active={isActive}
                  data-is-selected={isSelected}
                  data-is-loop={isInLoop}
                  role="button"
                  tabIndex={0}
                  aria-label={`Compás ${bar.number}${
                    bar.sectionMarker ? `, Sección ${bar.sectionMarker}` : ''
                  }${chordDisplay ? `, Acorde ${chordDisplay}` : ''}`}
                  onClick={(e) => handleBarClick(bar.number, e)}
                  onMouseDown={(e) => handleBarMouseDown(bar.number, e)}
                  onMouseEnter={() => handleBarMouseEnter(bar.number)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBarClick(bar.number, e as unknown as React.MouseEvent);
                    }
                  }}
                >
                  {/* Meta superior del compás: Sección, Número, Acorde y Bucle */}
                  <div className={styles.barTopMeta}>
                    <div className={styles.metaLeft}>
                      {bar.sectionMarker && (
                        <span
                          className={`${styles.sectionBadge} ${
                            isEstribillo
                              ? styles.sectionBadgeEstribillo
                              : styles.sectionBadgeDefault
                          }`}
                          data-testid={`section-${bar.number}`}
                        >
                          {bar.sectionMarker}
                        </span>
                      )}
                      <span className={styles.barNumber}>{bar.number}</span>
                      {isLoopStart && (
                        <span
                          className={styles.loopBadge}
                          title={`Inicio del bucle (compás ${loopRange![0]})`}
                          data-testid="loop-start-badge"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m17 2 4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                            <path d="m7 22-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                          </svg>
                          <span>[</span>
                        </span>
                      )}
                    </div>
                    <div className={styles.metaRight}>
                      {chordDisplay && (
                        <span
                          className={`${styles.chordName} ${
                            isActive ? styles.chordNameActive : ''
                          }`}
                          data-testid={`chord-${bar.number}`}
                        >
                          {chordDisplay}
                        </span>
                      )}
                      {isLoopEnd && (
                        <span
                          className={styles.loopMarker}
                          title={`Fin del bucle (compás ${loopRange![1]})`}
                          data-testid="loop-end-icon"
                        >
                          <span>]</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m17 2 4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                            <path d="m7 22-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notación pentagrama (Score / ScoreTab) */}
                  {(scoreViewMode === 'score' || scoreViewMode === 'score-tab') && (
                    <div className={styles.staffContainer} data-testid="staff-notation">
                      <span className={styles.clefSymbol} aria-hidden="true">
                        {track.isPercussion ? '𝄌' : track.stringCount <= 4 ? '𝄢' : '𝄞'}
                      </span>
                      <div className={styles.staffLines}>
                        {[0, 1, 2, 3, 4].map((line) => (
                          <div key={line} className={styles.staffLine} />
                        ))}
                      </div>
                      <div className={styles.staffBeatsRow}>
                        {bar.beats.map((beat) => {
                          const isBeatActive = isActive && beat.index === currentBeat;
                          return (
                            <div
                              key={`staff-beat-${beat.index}`}
                              className={`${styles.staffBeatColumn} ${
                                isBeatActive ? styles.beatColumnActive : ''
                              }`}
                              data-beat-index={beat.index}
                            >
                              {isBeatActive && (
                                <div className={styles.beatCursor} data-testid="beat-cursor" />
                              )}
                              {beat.notes.map((note, nIdx) => {
                                const baseMidi = track.stringCount <= 4 ? 43 : 64;
                                const step = Math.round((note.midi - baseMidi) / 2);
                                const bottomPx = Math.max(2, Math.min(34, 6 + step * 3.5));
                                return (
                                  <span
                                    key={`staff-note-${nIdx}`}
                                    className={`${styles.staffNoteHead} ${
                                      isBeatActive ? styles.staffNoteHeadActive : ''
                                    }`}
                                    style={{ bottom: `${bottomPx}px` }}
                                    title={`Nota MIDI ${note.midi}`}
                                  >
                                    ●
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notación Tablatura (Tab / ScoreTab) */}
                  {(scoreViewMode === 'tab' || scoreViewMode === 'score-tab') && (
                    <div
                      className={styles.tabContainer}
                      data-testid="tab-notation"
                      style={{ height: `${(track.stringCount || 6) * 11}px` }}
                    >
                      {/* Líneas horizontales de cuerda */}
                      {Array.from({ length: track.stringCount || 6 }).map((_, stringIdx) => (
                        <div
                          key={stringIdx}
                          className={styles.tabLine}
                          style={{ top: `${stringIdx * 11 + 5}px` }}
                        />
                      ))}

                      {/* Pulsos y notas del compás */}
                      <div className={styles.tabBeatsRow}>
                        {bar.beats.map((beat) => {
                          const isBeatActive = isActive && beat.index === currentBeat;
                          return (
                            <div
                              key={beat.index}
                              className={`${styles.tabBeatColumn} ${
                                isBeatActive ? styles.tabBeatColumnActive : ''
                              }`}
                              data-beat-index={beat.index}
                            >
                              {isBeatActive && (
                                <div className={styles.tabBeatCursor} data-testid="beat-cursor" />
                              )}
                              {beat.notes.map((note, nIdx) => {
                                const sCount = track.stringCount || 6;
                                const lineIdx = Math.max(0, Math.min(sCount - 1, note.string - 1));
                                const topPx = lineIdx * 11 + 5;
                                return (
                                  <span
                                    key={nIdx}
                                    className={`${styles.fretBadge} ${
                                      isBeatActive ? styles.fretBadgeActive : ''
                                    }`}
                                    style={{ top: `${topPx}px` }}
                                  >
                                    {note.fret}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fila de letras (cuando showLyrics está activo) */}
                  {showLyrics && barLyrics && (
                    <div className={styles.lyricsRow} data-testid="lyrics-line">
                      {barLyrics}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
