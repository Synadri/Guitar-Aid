import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  alphaSynthController as defaultController,
  type AlphaSynthController,
} from '../../audio';
import {
  analyzeBarChords,
  detectSongKeysByBar,
  resolvePlaybackTickForBarBeat,
  type BarChordAnalysis,
  type BarChordSegment,
  type SongBar,
  type SongKeyByBar,
} from '../../song';
import { songStore as defaultSongStore, type SongStore } from '../../state/song';
import styles from './SongTimelineBar.module.css';

export interface SongTimelineBarProps {
  /** Store de estado del Modo Canción. Por defecto usa el singleton songStore. */
  songStore?: StoreApi<SongStore>;
  /** Controlador de síntesis de audio. Por defecto usa el singleton alphaSynthController. */
  controller?: AlphaSynthController;
  className?: string;
  style?: React.CSSProperties;
}

export interface TimelineSectionGroup {
  name: string;
  startBar: number;
  endBar: number;
  barCount: number;
  tonalityName: string;
  isModulation: boolean;
}

const BAR_CELL_WIDTH = 120;

export const SongTimelineBar = React.memo(function SongTimelineBar({
  songStore = defaultSongStore,
  controller = defaultController,
  className,
  style,
}: SongTimelineBarProps) {
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const activeTrackIndex = useStore(songStore, (s) => s.activeTrackIndex);
  const currentBar = useStore(songStore, (s) => s.currentBar);
  const currentBeat = useStore(songStore, (s) => s.currentBeat);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);
  const loopRange = useStore(songStore, (s) => s.loopRange);
  const loopEnabled = useStore(songStore, (s) => s.loopEnabled);
  const barOverrides = useStore(songStore, (s) => s.barOverrides);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const track = activeSong?.tracks[activeTrackIndex] ?? activeSong?.tracks[0];
  const bars: readonly SongBar[] = track?.bars ?? [];
  const totalBars = bars.length;

  // 1. Análisis armónico y tonalidades por compás
  const keysByBar: SongKeyByBar[] = useMemo(() => {
    if (!activeSong) return [];
    return detectSongKeysByBar(activeSong, {
      trackIndex: activeTrackIndex,
      barOverrides,
    });
  }, [activeSong, activeTrackIndex, barOverrides]);

  const barAnalyses: BarChordAnalysis[] = useMemo(() => {
    if (!track) return [];
    return track.bars.map((bar) =>
      analyzeBarChords(bar, {
        override: barOverrides[bar.number],
      }),
    );
  }, [track, barOverrides]);

  // 2. Agrupación por marcadores de sección continuos
  const sectionGroups: TimelineSectionGroup[] = useMemo(() => {
    if (bars.length === 0) return [];

    const groups: TimelineSectionGroup[] = [];
    let currentGroup: TimelineSectionGroup | null = null;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]!;
      const barNum = bar.number;
      const keyInfo = keysByBar.find((k) => k.barNumber === barNum);
      const tonalityName = keyInfo?.key.name ?? 'Do mayor';
      const isModulation = keyInfo?.isModulation ?? false;

      const marker = bar.sectionMarker;
      const shouldStartNew =
        !currentGroup || (Boolean(marker) && marker !== currentGroup.name);

      if (shouldStartNew) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          name: marker || (i === 0 ? 'Intro' : 'Sección'),
          startBar: barNum,
          endBar: barNum,
          barCount: 1,
          tonalityName,
          isModulation,
        };
      } else if (currentGroup) {
        currentGroup.endBar = barNum;
        currentGroup.barCount += 1;
        if (isModulation) {
          currentGroup.isModulation = true;
        }
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [bars, keysByBar]);

  // 3. Auto-scroll suave siguiendo al compás activo
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (isCollapsed) return;
    const activeEl = barRefs.current[currentBar];
    if (activeEl && scrollAreaRef.current && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentBar, isCollapsed]);

  // 4. Soporte para arrastre de ratón (drag selection)
  const isDraggingRef = useRef(false);
  const dragStartBarRef = useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      dragStartBarRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleBarMouseDown = (barNum: number, startBeatIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // solo botón principal izquierdo

    if (e.shiftKey) {
      e.preventDefault();
      const prevBar = songStore.getState().selectedBarRange
        ? songStore.getState().selectedBarRange![0]
        : songStore.getState().currentBar;
      const newMin = Math.min(prevBar, barNum);
      const newMax = Math.max(prevBar, barNum);
      songStore.getState().setSelectedBarRange([newMin, newMax]);
      return;
    }

    // Iniciar posible arrastre
    isDraggingRef.current = true;
    dragStartBarRef.current = barNum;

    // Clic simple: posicionar reproducción / cursor
    songStore.getState().setSelectedBarRange(null);
    songStore.getState().setCurrentPosition(barNum, startBeatIndex);

    if (track?.bars) {
      const tick = resolvePlaybackTickForBarBeat(
        track.bars,
        barNum,
        startBeatIndex,
        controller.getPlayer(),
      );
      controller.seekToTick(tick);
    }
  };

  const handleBarMouseEnter = (barNum: number) => {
    if (isDraggingRef.current && dragStartBarRef.current !== null) {
      const start = dragStartBarRef.current;
      const newMin = Math.min(start, barNum);
      const newMax = Math.max(start, barNum);
      songStore.getState().setSelectedBarRange([newMin, newMax]);
    }
  };

  const handleSectionClick = (sec: TimelineSectionGroup) => {
    songStore.getState().setSelectedBarRange([sec.startBar, sec.endBar]);
    songStore.getState().setCurrentPosition(sec.startBar, 0);

    if (track?.bars) {
      const tick = resolvePlaybackTickForBarBeat(
        track.bars,
        sec.startBar,
        0,
        controller.getPlayer(),
      );
      controller.seekToTick(tick);
    }
  };

  if (totalBars === 0) {
    return null;
  }

  // Si está colapsado, renderizar barra minimalista
  if (isCollapsed) {
    const activeSection =
      sectionGroups.find((g) => currentBar >= g.startBar && currentBar <= g.endBar)?.name ??
      'Sección';
    return (
      <div
        className={`${styles.collapsedView} ${className ?? ''}`}
        style={style}
        data-testid="song-timeline-bar-collapsed"
        role="region"
        aria-label="Cinta de compases (colapsada)"
      >
        <div className={styles.collapsedSummary}>
          <span className={styles.timelineBadge}>Compás {currentBar}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeSection}</span>
          {selectedBarRange && (
            <span style={{ fontSize: '11px', color: '#14b8a6' }}>
              Selección: {selectedBarRange[0]}–{selectedBarRange[1]}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setIsCollapsed(false)}
          aria-label="Mostrar cinta armónica de compases"
          title="Mostrar cinta armónica de compases"
        >
          <span>Mostrar cinta</span>
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${styles.timelineContainer} ${className ?? ''}`}
      style={style}
      data-testid="song-timeline-bar"
      role="region"
      aria-label="Cinta armónica de compases"
    >
      {/* Cabecera superior compacta con botón de colapso */}
      <header className={styles.timelineHeader}>
        <div className={styles.timelineTitleGroup}>
          <span>Cinta armónica</span>
          <span className={styles.timelineBadge}>{totalBars} compases</span>
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setIsCollapsed(true)}
          aria-label="Ocultar cinta de compases"
          title="Ocultar cinta de compases para ampliar la partitura"
        >
          <span>Ocultar</span>
          <span aria-hidden="true">▲</span>
        </button>
      </header>

      {/* Área desplazable horizontal */}
      <div ref={scrollAreaRef} className={styles.scrollArea} data-testid="timeline-scroll-area">
        <div
          className={styles.timelineGrid}
          style={{
            gridTemplateColumns: `repeat(${totalBars}, ${BAR_CELL_WIDTH}px)`,
            width: `${totalBars * BAR_CELL_WIDTH + (totalBars - 1) * 5}px`,
          }}
        >
          {/* Fila 1: Bloques de Sección */}
          {sectionGroups.map((sec, idx) => {
            const isSectionActive =
              currentBar >= sec.startBar && currentBar <= sec.endBar;
            const isSectionSelected =
              selectedBarRange &&
              selectedBarRange[0] <= sec.endBar &&
              selectedBarRange[1] >= sec.startBar;

            let secClass = styles.sectionBlock;
            if (sec.isModulation) {
              secClass += ` ${styles.sectionModulation}`;
            } else if (isSectionActive || isSectionSelected) {
              secClass += ` ${styles.sectionActive}`;
            }

            return (
              <div
                key={`sec-${idx}-${sec.startBar}`}
                className={secClass}
                style={{
                  gridColumn: `${sec.startBar} / ${sec.endBar + 1}`,
                  gridRow: 1,
                }}
                onClick={() => handleSectionClick(sec)}
                title={`Sección ${sec.name} · ${sec.tonalityName} (Compases ${sec.startBar}–${sec.endBar}). Haz clic para seleccionar.`}
                data-testid={`section-block-${sec.startBar}`}
              >
                <span className={styles.sectionTitle}>
                  {sec.name} · {sec.tonalityName}
                  {sec.isModulation ? ' (modulación)' : ''}
                </span>
              </div>
            );
          })}

          {/* Fila 2: Celdas de Compás */}
          {bars.map((bar, barIdx) => {
            const barNum = bar.number;
            const analysis = barAnalyses[barIdx];
            const hasOverride = analysis?.hasOverride ?? false;
            const segments = analysis?.segments ?? [];

            const isCurrent = barNum === currentBar;
            const isSelected =
              selectedBarRange &&
              barNum >= selectedBarRange[0] &&
              barNum <= selectedBarRange[1];
            const isLoop =
              loopEnabled &&
              loopRange &&
              barNum >= loopRange[0] &&
              barNum <= loopRange[1];

            let cellClass = styles.barCell;
            if (isCurrent) cellClass += ` ${styles.barCurrent}`;
            if (isSelected || isLoop) cellClass += ` ${styles.barSelected}`;

            // Determinar qué segmento coincide con el beat actual si es el compás activo
            let activeSegmentIndex = -1;
            if (isCurrent && segments.length > 0) {
              // Si solo hay un segmento, siempre es el activo
              if (segments.length === 1) {
                activeSegmentIndex = 0;
              } else {
                // Si hay varios, encontrar cuál cubre el pulso actual
                for (let si = segments.length - 1; si >= 0; si--) {
                  const seg = segments[si]!;
                  if (currentBeat >= seg.startBeatIndex) {
                    activeSegmentIndex = si;
                    break;
                  }
                }
                if (activeSegmentIndex === -1) activeSegmentIndex = 0;
              }
            }

            return (
              <button
                type="button"
                key={`bar-${barNum}`}
                ref={(el) => {
                  barRefs.current[barNum] = el;
                }}
                className={cellClass}
                style={{
                  gridColumn: barNum,
                  gridRow: 2,
                }}
                onMouseDown={(e) => handleBarMouseDown(barNum, 0, e)}
                onMouseEnter={() => handleBarMouseEnter(barNum)}
                aria-label={`Compás ${barNum}${
                  analysis?.primaryChord ? ` · Acorde ${analysis.primaryChord.name}` : ''
                }`}
                data-testid={`timeline-bar-${barNum}`}
                data-bar-number={barNum}
                data-is-current={isCurrent ? 'true' : 'false'}
              >
                {/* Cabecera del compás: Número y punto de override */}
                <div className={styles.barCellHeader}>
                  <span className={styles.barNumber}>{barNum}</span>
                  {hasOverride && (
                    <span
                      className={styles.overrideDot}
                      title="Acorde o tonalidad fijada manualmente por el usuario"
                      data-testid={`override-dot-${barNum}`}
                    />
                  )}
                </div>

                {/* Segmentos armónicos proporcionales dentro del compás */}
                <div className={styles.segmentsContainer}>
                  {segments.length > 0 ? (
                    segments.map((seg: BarChordSegment, segIdx: number) => {
                      const isSegActive = isCurrent && segIdx === activeSegmentIndex;
                      const flexRatio = Math.max(0.15, seg.durationRatio);

                      return (
                        <div
                          key={`seg-${barNum}-${segIdx}`}
                          className={`${styles.segmentSlot} ${
                            isSegActive ? styles.segmentActive : ''
                          }`}
                          style={{ flex: flexRatio }}
                          title={`Pulso ${seg.startBeatIndex + 1}: ${seg.chord.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBarMouseDown(barNum, seg.startBeatIndex, e);
                          }}
                          data-testid={`bar-segment-${barNum}-${segIdx}`}
                          data-active-slot={isSegActive ? 'true' : 'false'}
                        >
                          {seg.chord.name}
                        </div>
                      );
                    })
                  ) : (
                    <span className={styles.emptyBarText}>—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
