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

  // Integración con AlphaTabApi (inyectado o diferido en navegador)
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
          scoreViewMode,
          showLyrics,
          activeTrackIndex,
        });
        if (apiInstance) {
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
              const settings = new at.Settings();
              settings.core.tracks = [activeTrackIndex];
              settings.player.soundFont = '/soundfont/sonivox.sf2';
              settings.player.enablePlayer = true;
              settings.player.enableUserInteraction = true;

              switch (scoreViewMode) {
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

              settings.notation.elements.set(at.NotationElement.EffectLyrics, showLyrics);

              const api = new at.AlphaTabApi(alphaTabHostRef.current, settings);
              apiInstance = api as unknown as AlphaSynthLike;
              if (apiInstance) {
                controller.attachPlayer(apiInstance);
                setupApiEvents(apiInstance);
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
      if (apiInstance && typeof apiInstance.destroy === 'function') {
        apiInstance.destroy();
      }
    };
  }, [createApi, controller, songStore, activeTrackIndex, scoreViewMode, showLyrics]);

  // Selección de compases con ratón
  const handleBarClick = (barNumber: number, event: React.MouseEvent) => {
    if (event.shiftKey) {
      // Shift + Clic: selecciona el rango entre el compás previo y el pulsado
      const start = Math.min(currentBar, barNumber);
      const end = Math.max(currentBar, barNumber);
      songStore.getState().setSelectedBarRange([start, end]);
      songStore.getState().setInspectedBar(barNumber);
    } else {
      // Clic simple: fija compás activo y quita rango
      songStore.getState().setCurrentBar(barNumber);
      songStore.getState().setCurrentBeat(0);
      songStore.getState().setInspectedBar(barNumber);
      songStore.getState().setSelectedBarRange(null);
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

  // Agrupación de compases en sistemas de hasta 4 por fila para visualización clara
  const systems = useMemo(() => {
    if (!track) return [];
    const barsPerSystem = 4;
    const result: (typeof track.bars)[] = [];
    for (let i = 0; i < track.bars.length; i += barsPerSystem) {
      result.push(track.bars.slice(i, i + barsPerSystem));
    }
    return result;
  }, [track]);

  return (
    <div
      className={`${styles.scoreCard} ${className ?? ''}`}
      style={style}
      data-testid="alphatab-viewport"
      data-score-view-mode={scoreViewMode}
      data-track-index={activeTrackIndex}
      onMouseUp={handleMouseUp}
    >
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
        {/* Contenedor DOM para la librería AlphaTab */}
        <div
          ref={alphaTabHostRef}
          className={styles.alphaTabContainer}
          data-testid="alphatab-container"
        />

        {/* Representación estructurada y reactiva de compases (visible y accesible en tests/fallback) */}
        {!track ? (
          <div className={styles.emptyState}>No hay ninguna canción activa.</div>
        ) : (
          <div className={styles.systemsContainer} data-testid="score-systems">
            {systems.map((system, sysIdx) => (
              <div key={sysIdx} className={styles.systemRow}>
                {system.map((bar) => {
                  const isActive = bar.number === currentBar;
                  const isSelected =
                    Boolean(selectedBarRange) &&
                    bar.number >= selectedBarRange![0] &&
                    bar.number <= selectedBarRange![1];
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

                  const isEstribillo =
                    bar.sectionMarker?.toLowerCase().includes('estribillo') ?? false;

                  return (
                    <div
                      key={bar.number}
                      className={`${styles.barCell} ${isActive ? styles.barCellActive : ''} ${
                        isSelected ? styles.barCellSelected : ''
                      }`}
                      data-testid={`bar-${bar.number}`}
                      data-bar-number={bar.number}
                      data-is-active={isActive}
                      data-is-selected={isSelected}
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
                              title="Fin del bucle"
                              data-testid="loop-end-icon"
                            >
                              🔁
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notación pentagrama (Score / ScoreTab) */}
                      {(scoreViewMode === 'score' || scoreViewMode === 'score-tab') && (
                        <div className={styles.staffContainer} data-testid="staff-notation">
                          {[0, 1, 2, 3, 4].map((line) => (
                            <div key={line} className={styles.staffLine} />
                          ))}
                        </div>
                      )}

                      {/* Notación Tablatura (Tab / ScoreTab) */}
                      {(scoreViewMode === 'tab' || scoreViewMode === 'score-tab') && (
                        <div className={styles.tabContainer} data-testid="tab-notation">
                          {Array.from({ length: track.stringCount || 6 }).map((_, stringIdx) => (
                            <div key={stringIdx} className={styles.tabLine} />
                          ))}

                          {/* Pulsos y notas del compás */}
                          <div className={styles.beatsRow}>
                            {bar.beats.map((beat) => {
                              const isBeatActive = isActive && beat.index === currentBeat;
                              return (
                                <div
                                  key={beat.index}
                                  className={`${styles.beatColumn} ${
                                    isBeatActive ? styles.beatColumnActive : ''
                                  }`}
                                  data-beat-index={beat.index}
                                >
                                  {isBeatActive && (
                                    <div
                                      className={styles.beatCursor}
                                      data-testid="beat-cursor"
                                    />
                                  )}
                                  {beat.notes.map((note, nIdx) => (
                                    <span
                                      key={nIdx}
                                      className={`${styles.fretNumber} ${
                                        isBeatActive ? styles.fretNumberActive : ''
                                      }`}
                                    >
                                      {note.fret}
                                    </span>
                                  ))}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
