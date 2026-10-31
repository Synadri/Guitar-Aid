import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  drillsStore as defaultDrillsStore,
  decksStore as defaultDecksStore,
  settingsStore as defaultSettingsStore,
  selectFretboardAccuracyMap,
  selectWeakIntervals,
  selectRecentSessionEvolution,
  selectGlobalStats,
  selectDeckStats,
  type DrillsStore,
  type DecksStore,
  type SettingsStore,
  type PositionAccuracyCell,
  type PositionAccuracyStatus,
} from '../../../state';
import {
  pcName,
  pitchClassOf,
  positionToMidi,
  STANDARD_TUNING,
  type StringNumber,
} from '../../../theory';
import { DRILL_CATALOG, getStudyDayKey, type DrillId } from '../../../learning';
import styles from './ProgressView.module.css';

export interface BackupPayload {
  app: 'guitar-aid';
  version: 1;
  exportedAt: string;
  decks: unknown;
  drills: unknown;
}

export interface ProgressViewProps {
  drillsStore?: StoreApi<DrillsStore>;
  decksStore?: StoreApi<DecksStore>;
  settingsStore?: StoreApi<SettingsStore>;
  now?: () => number;
  onExportJson?: (jsonString: string, filename: string) => void;
}

const STRINGS_ORDER: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];

function formatSeconds(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) {
    return '0,0 s';
  }
  const sec = (ms / 1000).toFixed(1).replace('.', ',');
  return `${sec} s`;
}

function statusLabel(status: PositionAccuracyStatus): string {
  switch (status) {
    case 'mastered':
      return 'Dominada';
    case 'learning':
      return 'Regular';
    case 'weak':
      return 'Débil';
    case 'untested':
    default:
      return 'Sin datos';
  }
}

/** Formatea una clave de día de estudio ("YYYY-MM-DD") a "DD/MM". */
function formatShortStudyDay(dayKey: string): string {
  const parts = dayKey.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dayKey;
}

/**
 * Renderiza el círculo SVG de estado de una posición (o de la leyenda) codificado
 * simultáneamente por color y estilo de trazo (§7.2).
 */
function StatusCircleSvg({
  status,
  size = 26,
}: {
  status: PositionAccuracyStatus;
  size?: number;
}) {
  const center = size / 2;
  const r = size / 2 - 2;

  if (status === 'mastered') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="rgba(34, 197, 94, 0.25)"
          stroke="#22c55e"
          strokeWidth={2}
        />
      </svg>
    );
  }

  if (status === 'learning') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="rgba(217, 119, 6, 0.20)"
          stroke="#d97706"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      </svg>
    );
  }

  if (status === 'weak') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="rgba(239, 68, 68, 0.30)"
          stroke="#f87171"
          strokeWidth={2.5}
        />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="transparent"
        stroke="var(--border, #2a3140)"
        strokeWidth={1.25}
      />
    </svg>
  );
}

/**
 * Sección 4 — Progreso (Hito A9, §7 de interfaz_fase2.md):
 * - Mapa de aciertos del mástil (A1 y A2 · últimas 20 respuestas por posición) con pie fijo sin saltos
 * - Precisión por sesión · últimas 10 con etiquetas visibles de porcentaje, código de ejercicio y tiempo
 * - Resumen de Tarjetas con selector de mazo y gráfica de evolución de la retención
 * - Estadísticas de Intervalos débiles (B1–B4)
 * - Copia de seguridad (Exportar JSON e Importar)
 */
export function ProgressView({
  drillsStore = defaultDrillsStore,
  decksStore = defaultDecksStore,
  settingsStore = defaultSettingsStore,
  now = () => Date.now(),
  onExportJson,
}: ProgressViewProps) {
  const [maxFret, setMaxFret] = useState<12 | 24>(12);
  const [activeCellTooltip, setActiveCellTooltip] = useState<string | null>(null);
  const [selectedSessionDrill, setSelectedSessionDrill] = useState<'all' | DrillId>('all');
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string>('all');
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado reactivo de stores
  const itemStats = useStore(drillsStore, (s) => s.itemStats);
  const drillsHistory = useStore(drillsStore, (s) => s.history);
  const decks = useStore(decksStore, (s) => s.decks);
  const cardsSRS = useStore(decksStore, (s) => s.cardsSRS);
  const dailyUsage = useStore(decksStore, (s) => s.dailyUsage);
  const decksHistory = useStore(decksStore, (s) => s.history);

  const tuning = useStore(settingsStore, (s) => s.tuning);
  const nameMode = useStore(settingsStore, (s) => s.nameMode);

  const currentTuning = tuning ?? STANDARD_TUNING;

  // 1. Mapa de aciertos del mástil
  const accuracyCells = useMemo(() => {
    const state = drillsStore.getState();
    return selectFretboardAccuracyMap(state, maxFret);
  }, [drillsStore, itemStats, maxFret]);

  const cellsByString = useMemo(() => {
    const map = new Map<StringNumber, PositionAccuracyCell[]>();
    for (const s of STRINGS_ORDER) {
      map.set(s, []);
    }
    for (const cell of accuracyCells) {
      map.get(cell.string)?.push(cell);
    }
    return map;
  }, [accuracyCells]);

  // 2. Evolución de las últimas 10 sesiones (filtrable por ejercicio)
  const recentSessions = useMemo(() => {
    if (selectedSessionDrill === 'all') {
      return selectRecentSessionEvolution(drillsStore.getState(), 10);
    }
    return drillsHistory
      .filter((s) => s.drillId === selectedSessionDrill)
      .slice(-10);
  }, [drillsStore, drillsHistory, selectedSessionDrill]);

  const sessionsSummary = useMemo(() => {
    if (recentSessions.length === 0) return null;
    const avgAcc = Math.round(
      recentSessions.reduce((acc, s) => acc + s.accuracy, 0) / recentSessions.length,
    );
    const avgMs = Math.round(
      recentSessions.reduce((acc, s) => acc + s.averageTimeMs, 0) / recentSessions.length,
    );
    return { avgAcc, avgMs };
  }, [recentSessions]);

  // 3. Estadísticas de tarjetas (global o por mazo seleccionado) y evolución de la retención
  const effectiveDeckFilter = useMemo(() => {
    if (selectedDeckFilter === 'all') return 'all';
    return decks.some((d) => d.id === selectedDeckFilter) ? selectedDeckFilter : 'all';
  }, [selectedDeckFilter, decks]);

  const cardStats = useMemo(() => {
    const state = decksStore.getState();
    const currentNow = now();
    if (effectiveDeckFilter === 'all') {
      return selectGlobalStats(state, currentNow);
    }
    const ds = selectDeckStats(state, effectiveDeckFilter, currentNow);
    const filteredHistory = state.history.filter((h) => h.deckId === effectiveDeckFilter);
    return {
      pendientesHoy: ds.dueToday,
      retención: ds.retentionRate,
      nuevas: ds.newCount,
      enAprendizaje: ds.learningCount,
      totalRepasos: filteredHistory.length,
    };
  }, [decksStore, decks, cardsSRS, dailyUsage, decksHistory, effectiveDeckFilter, now]);

  const retentionEvolution = useMemo(() => {
    const filtered =
      effectiveDeckFilter === 'all'
        ? decksHistory
        : decksHistory.filter((h) => h.deckId === effectiveDeckFilter);

    const byDay = new Map<string, { total: number; passed: number }>();
    // decksHistory viene del más reciente al más antiguo; recorremos en orden cronológico
    for (let i = filtered.length - 1; i >= 0; i--) {
      const entry = filtered[i]!;
      const dayKey = getStudyDayKey(entry.at);
      const curr = byDay.get(dayKey) ?? { total: 0, passed: 0 };
      curr.total += 1;
      if (entry.rating !== 'again') {
        curr.passed += 1;
      }
      byDay.set(dayKey, curr);
    }

    const days = Array.from(byDay.entries()).map(([dayKey, data]) => ({
      dayKey,
      dayLabel: formatShortStudyDay(dayKey),
      total: data.total,
      passed: data.passed,
      retention: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 100,
    }));

    return days.slice(-7);
  }, [decksHistory, effectiveDeckFilter]);

  // 4. Intervalos débiles (top 5)
  const weakIntervals = useMemo(() => {
    return selectWeakIntervals(drillsStore.getState(), 5);
  }, [drillsStore, itemStats]);

  const fretNumbers = useMemo(
    () => Array.from({ length: maxFret + 1 }, (_, i) => i),
    [maxFret],
  );

  const buildCellDescription = useCallback(
    (cell: PositionAccuracyCell): string => {
      const midi = positionToMidi(currentTuning, { string: cell.string, fret: cell.fret });
      const note = pcName(pitchClassOf(midi), nameMode);
      const posLabel = `${note} (cuerda ${cell.string}, traste ${cell.fret})`;
      if (cell.attempts === 0) {
        return `${posLabel} · Sin datos (0 intentos)`;
      }
      const timePart =
        cell.averageTimeMs !== undefined ? ` · Tiempo medio: ${formatSeconds(cell.averageTimeMs)}` : '';
      return `${posLabel} · ${statusLabel(cell.status)}: ${cell.accuracy} % de acierto (${cell.hits}/${cell.attempts})${timePart}`;
    },
    [currentTuning, nameMode],
  );

  // Acción: Exportar JSON (mazos + ejercicios)
  const handleExport = useCallback(() => {
    const decksData = JSON.parse(decksStore.getState().exportData()) as unknown;
    const drillsData = JSON.parse(drillsStore.getState().exportData()) as unknown;

    const payload: BackupPayload = {
      app: 'guitar-aid',
      version: 1,
      exportedAt: new Date(now()).toISOString(),
      decks: decksData,
      drills: drillsData,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const datePart = payload.exportedAt.slice(0, 10);
    const filename = `guitar-aid-backup-${datePart}.json`;

    if (onExportJson) {
      onExportJson(jsonString, filename);
    } else if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } catch {
        // Entorno sin soporte de descarga de archivos
      }
    }

    setBackupFeedback({
      type: 'success',
      message: 'Copia de seguridad exportada correctamente.',
    });
  }, [decksStore, drillsStore, now, onExportJson]);

  // Procesa e importa un texto JSON validando tanto formatos combinados como individuales
  const processImportedJson = useCallback(
    (rawText: string) => {
      try {
        const parsed = JSON.parse(rawText) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setBackupFeedback({
            type: 'error',
            message: 'Error al importar: el archivo JSON no tiene un formato válido.',
          });
          return;
        }

        const record = parsed as Record<string, unknown>;
        const hasCombinedDecks =
          'decks' in record &&
          record.decks !== null &&
          typeof record.decks === 'object' &&
          !Array.isArray(record.decks);
        const hasCombinedDrills =
          'drills' in record &&
          record.drills !== null &&
          typeof record.drills === 'object' &&
          !Array.isArray(record.drills);

        if (hasCombinedDecks || hasCombinedDrills) {
          const decksOk = hasCombinedDecks
            ? decksStore.getState().importData(record.decks)
            : true;
          const drillsOk = hasCombinedDrills
            ? drillsStore.getState().importData(record.drills)
            : true;

          if (decksOk && drillsOk) {
            setBackupFeedback({
              type: 'success',
              message: 'Copia de seguridad restaurada correctamente.',
            });
          } else {
            setBackupFeedback({
              type: 'error',
              message: 'Error al importar: los datos de la copia de seguridad están incompletos o dañados.',
            });
          }
          return;
        }

        // Soporte para importación directa de store de mazos o de store de ejercicios
        if (Array.isArray(record.decks)) {
          const ok = decksStore.getState().importData(record);
          if (ok) {
            setBackupFeedback({
              type: 'success',
              message: 'Datos de mazos y tarjetas restaurados correctamente.',
            });
          } else {
            setBackupFeedback({
              type: 'error',
              message: 'Error al importar: los datos de mazos no son válidos.',
            });
          }
          return;
        }

        if ('itemStats' in record || 'history' in record) {
          const ok = drillsStore.getState().importData(record);
          if (ok) {
            setBackupFeedback({
              type: 'success',
              message: 'Estadísticas de ejercicios restauradas correctamente.',
            });
          } else {
            setBackupFeedback({
              type: 'error',
              message: 'Error al importar: las estadísticas de ejercicios no son válidas.',
            });
          }
          return;
        }

        setBackupFeedback({
          type: 'error',
          message: 'Error al importar: el archivo no contiene datos reconocibles de Guitar Aid.',
        });
      } catch {
        setBackupFeedback({
          type: 'error',
          message: 'Error al importar: el archivo no es un JSON válido.',
        });
      }
    },
    [decksStore, drillsStore],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text =
          typeof file.text === 'function'
            ? await file.text()
            : await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ''));
                reader.onerror = () => reject(new Error('Error de lectura'));
                reader.readAsText(file);
              });
        processImportedJson(text);
      } catch {
        setBackupFeedback({
          type: 'error',
          message: 'Error al leer el archivo seleccionado.',
        });
      } finally {
        e.target.value = '';
      }
    },
    [processImportedJson],
  );

  const circleSize = maxFret === 12 ? 26 : 18;

  return (
    <div className={styles.progressGrid} data-testid="progress-view">
      {/* Columna izquierda: Mapa de aciertos y Evolución de sesiones */}
      <div className={styles.leftColumn}>
        {/* Tarjeta superior: Mapa de aciertos del mástil */}
        <section
          className={`${styles.card} ${styles.heatmapCard}`}
          aria-labelledby="progress-heatmap-title"
          data-testid="progress-heatmap-card"
        >
          <div className={styles.cardHeader}>
            <h2 id="progress-heatmap-title" className={styles.cardTitle}>
              Mapa de aciertos del mástil
            </h2>
            <div className={styles.headerRight}>
              <span className={styles.cardSubtitle}>
                A1 y A2 · últimas 20 respuestas por posición
              </span>
              <div
                className={styles.rangeToggleGroup}
                role="group"
                aria-label="Rango de trastes del mapa"
              >
                <button
                  type="button"
                  className={`${styles.rangeToggleBtn} ${maxFret === 12 ? styles.rangeToggleBtnActive : ''}`}
                  aria-pressed={maxFret === 12}
                  onClick={() => setMaxFret(12)}
                  data-testid="heatmap-range-12"
                >
                  0–12
                </button>
                <button
                  type="button"
                  className={`${styles.rangeToggleBtn} ${maxFret === 24 ? styles.rangeToggleBtnActive : ''}`}
                  aria-pressed={maxFret === 24}
                  onClick={() => setMaxFret(24)}
                  data-testid="heatmap-range-24"
                >
                  0–24
                </button>
              </div>
            </div>
          </div>

          <div
            className={styles.matrixWrapper}
            role="grid"
            aria-label="Matriz de dominio del mástil por cuerda y traste"
          >
            <div className={styles.matrixTable}>
              {/* Cabecera de números de traste */}
              <div
                className={styles.fretNumbersRow}
                style={{ gridTemplateColumns: `repeat(${maxFret + 1}, minmax(0, 1fr))` }}
                role="row"
              >
                {fretNumbers.map((fret) => (
                  <span key={fret} className={styles.fretNumberCell} role="columnheader">
                    {fret}
                  </span>
                ))}
              </div>

              {/* Filas de las 6 cuerdas (e B G D A E) */}
              {STRINGS_ORDER.map((stringNum) => {
                const openMidi = positionToMidi(currentTuning, { string: stringNum, fret: 0 });
                const rawName = pcName(pitchClassOf(openMidi), nameMode);
                const stringLabel =
                  stringNum === 1 && rawName === 'E' ? 'e' : rawName;
                const rowCells = cellsByString.get(stringNum) ?? [];

                return (
                  <div key={stringNum} className={styles.stringRow} role="row">
                    <span
                      className={styles.stringLabel}
                      role="rowheader"
                      aria-label={`Cuerda ${stringNum} (${stringLabel})`}
                    >
                      {stringLabel}
                    </span>
                    <div
                      className={styles.stringCellsGrid}
                      style={{ gridTemplateColumns: `repeat(${maxFret + 1}, minmax(0, 1fr))` }}
                    >
                      {rowCells.map((cell) => {
                        const desc = buildCellDescription(cell);
                        return (
                          <button
                            key={cell.fret}
                            type="button"
                            role="gridcell"
                            className={styles.cellButton}
                            title={desc}
                            aria-label={desc}
                            data-testid={`heatmap-cell-s${cell.string}-f${cell.fret}`}
                            data-status={cell.status}
                            onMouseEnter={() => setActiveCellTooltip(desc)}
                            onMouseLeave={() => setActiveCellTooltip(null)}
                            onFocus={() => setActiveCellTooltip(desc)}
                            onBlur={() => setActiveCellTooltip(null)}
                          >
                            <StatusCircleSvg status={cell.status} size={circleSize} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.heatmapFooter}>
            <div className={styles.heatmapLegend} aria-label="Leyenda de dominio del mástil">
              <span className={styles.legendItem}>
                <StatusCircleSvg status="mastered" size={18} />
                <span>Dominada · 85 % o más</span>
              </span>
              <span className={styles.legendItem}>
                <StatusCircleSvg status="learning" size={18} />
                <span>Regular</span>
              </span>
              <span className={styles.legendItem}>
                <StatusCircleSvg status="weak" size={18} />
                <span>Débil · menos de 60 %</span>
              </span>
            </div>

            <div
              className={
                activeCellTooltip ? styles.activeTooltipBanner : styles.activeTooltipPlaceholder
              }
              role="status"
              aria-live="polite"
              data-testid="heatmap-active-tooltip"
            >
              {activeCellTooltip ?? 'Pasa el cursor por una posición para ver su detalle'}
            </div>
          </div>
        </section>

        {/* Tarjeta inferior: Precisión por sesión · últimas 10 */}
        <section
          className={`${styles.card} ${styles.sessionsCard}`}
          aria-labelledby="progress-sessions-title"
          data-testid="progress-sessions-card"
        >
          <div className={styles.cardHeader}>
            <h2 id="progress-sessions-title" className={styles.cardTitle}>
              Precisión por sesión · últimas 10
            </h2>
            <div className={styles.headerRight}>
              {sessionsSummary && (
                <span className={styles.cardSubtitle} data-testid="sessions-summary-badge">
                  Media: {sessionsSummary.avgAcc} % · {formatSeconds(sessionsSummary.avgMs)}
                </span>
              )}
              <select
                className={styles.compactSelect}
                aria-label="Filtrar sesiones por ejercicio"
                value={selectedSessionDrill}
                onChange={(e) => setSelectedSessionDrill(e.target.value as 'all' | DrillId)}
                data-testid="sessions-drill-filter"
              >
                <option value="all">Todos los ejercicios</option>
                {DRILL_CATALOG.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.sessionsChartArea}>
            <div className={styles.yAxisLabels} aria-hidden="true">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>

            <div className={styles.barsPlotWrapper}>
              <div
                className={styles.barsContainer}
                role="list"
                aria-label="Precisión de las últimas 10 sesiones de ejercicios"
              >
                {Array.from({ length: 10 }, (_, idx) => {
                  const session = recentSessions[idx];
                  if (!session) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className={styles.barSlot}
                        role="listitem"
                        aria-label={`Sesión ${idx + 1}: sin datos`}
                        data-testid="session-bar-empty"
                      >
                        <span className={styles.barValueTopEmpty} aria-hidden="true" />
                        <div className={styles.barTrackVertical}>
                          <div className={styles.sessionBarEmpty} />
                        </div>
                        <div className={styles.barFooterMeta} aria-hidden="true">
                          <span className={styles.barEmptyDash}>—</span>
                        </div>
                      </div>
                    );
                  }

                  const dateFormatted = session.date ? session.date.slice(0, 10) : '';
                  const label = `${session.drillId} · ${session.accuracy} % · ${formatSeconds(session.averageTimeMs)}${dateFormatted ? ` · ${dateFormatted}` : ''}`;
                  const barToneClass =
                    session.accuracy < 60
                      ? styles.sessionBarLow
                      : styles.sessionBarHigh;

                  return (
                    <div
                      key={session.id || `sess-${idx}`}
                      className={styles.barSlot}
                      role="listitem"
                    >
                      <span className={styles.barValueTop}>{session.accuracy}%</span>
                      <div className={styles.barTrackVertical}>
                        <div
                          className={`${styles.sessionBar} ${barToneClass}`}
                          style={{ height: `${Math.max(4, Math.min(100, session.accuracy))}%` }}
                          title={label}
                          aria-label={label}
                          tabIndex={0}
                          data-testid={`session-bar-${idx}`}
                          data-accuracy={session.accuracy}
                        />
                      </div>
                      <div className={styles.barFooterMeta}>
                        <span className={styles.barDrillCode}>{session.drillId}</span>
                        <span className={styles.barSubMeta}>
                          {formatSeconds(session.averageTimeMs)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Columna derecha: Tarjetas, Intervalos débiles y Copia de seguridad */}
      <div className={styles.rightColumn}>
        {/* Tarjeta 1: Tarjetas + Evolución de retención por mazo */}
        <section
          className={styles.card}
          aria-labelledby="progress-cards-title"
          data-testid="progress-cards-stats"
        >
          <div className={styles.cardHeader}>
            <h2 id="progress-cards-title" className={styles.cardTitle}>
              Tarjetas
            </h2>
            <select
              className={styles.compactSelect}
              aria-label="Seleccionar mazo para estadísticas de tarjetas"
              value={effectiveDeckFilter}
              onChange={(e) => setSelectedDeckFilter(e.target.value)}
              data-testid="progress-deck-select"
            >
              <option value="all">Todos los mazos</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metricBox} data-testid="metric-due-today">
              <span className={styles.metricValue}>{cardStats.pendientesHoy}</span>
              <span className={styles.metricLabel}>Pendientes hoy</span>
            </div>
            <div className={styles.metricBox} data-testid="metric-retention">
              <span className={styles.metricValue}>{cardStats.retención} %</span>
              <span className={styles.metricLabel}>Retención</span>
            </div>
            <div className={styles.metricBox} data-testid="metric-new">
              <span className={styles.metricValue}>{cardStats.nuevas}</span>
              <span className={styles.metricLabel}>Nuevas</span>
            </div>
            <div className={styles.metricBox} data-testid="metric-learning">
              <span className={styles.metricValue}>{cardStats.enAprendizaje}</span>
              <span className={styles.metricLabel}>En aprendizaje</span>
            </div>
          </div>

          <div className={styles.retentionSection} data-testid="retention-evolution-section">
            <div className={styles.retentionHeader}>
              <span className={styles.retentionTitle}>
                Evolución de la retención (últimos días de estudio)
              </span>
              <span className={styles.retentionTotalBadge}>
                {cardStats.totalRepasos} repasos
              </span>
            </div>

            {retentionEvolution.length > 0 ? (
              <div
                className={styles.retentionBarsGrid}
                role="list"
                aria-label="Evolución diaria de la retención de tarjetas"
              >
                {Array.from({ length: 7 }, (_, idx) => {
                  const day = retentionEvolution[idx];
                  if (!day) {
                    return (
                      <div
                        key={`ret-empty-${idx}`}
                        className={styles.retentionCol}
                        role="listitem"
                        aria-label="Día sin repasos registrados"
                      >
                        <span className={styles.retentionPct} />
                        <div className={styles.retentionTrack} />
                        <span className={styles.retentionDayLabel}>—</span>
                      </div>
                    );
                  }

                  const barLabel = `${day.dayLabel}: ${day.retention} % de retención (${day.passed}/${day.total} repasos superados)`;

                  return (
                    <div
                      key={day.dayKey}
                      className={styles.retentionCol}
                      role="listitem"
                      title={barLabel}
                      aria-label={barLabel}
                      data-testid={`retention-day-${idx}`}
                    >
                      <span className={styles.retentionPct}>{day.retention}%</span>
                      <div className={styles.retentionTrack}>
                        <div
                          className={`${styles.retentionFill} ${
                            day.retention < 75 ? styles.retentionFillWarn : ''
                          }`}
                          style={{ height: `${Math.max(6, Math.min(100, day.retention))}%` }}
                        />
                      </div>
                      <span className={styles.retentionDayLabel}>{day.dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.retentionEmpty}>
                Aún no hay repasos registrados para mostrar la curva de retención.
              </p>
            )}
          </div>
        </section>

        {/* Tarjeta 2: Intervalos débiles */}
        <section
          className={`${styles.card} ${styles.weakIntervalsCard}`}
          aria-labelledby="progress-weak-title"
          data-testid="progress-weak-intervals"
        >
          <div className={styles.cardHeader}>
            <h2 id="progress-weak-title" className={styles.cardTitle}>
              Intervalos débiles
            </h2>
            <span className={styles.cardSubtitle}>Ejercicios B1–B4</span>
          </div>

          {weakIntervals.length > 0 ? (
            <div className={styles.weakList} role="list" aria-label="Intervalos con menor precisión">
              {weakIntervals.map((item) => (
                <div
                  key={item.interval}
                  className={styles.weakRow}
                  role="listitem"
                  aria-label={`Intervalo ${item.interval}: ${item.accuracy} % de precisión (${item.hits} de ${item.attempts})`}
                  data-testid={`weak-interval-${item.interval}`}
                >
                  <span className={styles.weakSymbol}>{item.interval}</span>
                  <div className={styles.weakBarTrack} aria-hidden="true">
                    <div
                      className={styles.weakBarFill}
                      style={{ width: `${Math.max(0, Math.min(100, item.accuracy))}%` }}
                    />
                  </div>
                  <span className={styles.weakPercent}>
                    <span className={styles.weakAttemptsMuted}>
                      {item.hits}/{item.attempts} ·{' '}
                    </span>
                    {item.accuracy} %
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.weakEmptyText}>
              Completa ejercicios de intervalos (B1–B4) para analizar la precisión por intervalo.
            </p>
          )}
        </section>

        {/* Tarjeta 3: Copia de seguridad */}
        <section
          className={`${styles.card} ${styles.backupCard}`}
          aria-labelledby="progress-backup-title"
          data-testid="progress-backup-card"
        >
          <div className={styles.cardHeader}>
            <h2 id="progress-backup-title" className={styles.cardTitle}>
              Copia de seguridad
            </h2>
          </div>

          <p className={styles.backupDescription}>
            Los datos viven en este navegador. Si los borras, pierdes mazos y progreso: exporta una
            copia de vez en cuando.
          </p>

          <div className={styles.backupActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleExport}
              data-testid="backup-export-btn"
            >
              Exportar JSON
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => fileInputRef.current?.click()}
              data-testid="backup-import-btn"
            >
              Importar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.hiddenFileInput}
              onChange={handleFileChange}
              aria-label="Seleccionar archivo JSON de copia de seguridad"
              data-testid="backup-file-input"
            />
          </div>

          {backupFeedback && (
            <div
              role={backupFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`${styles.backupFeedback} ${
                backupFeedback.type === 'error'
                  ? styles.backupFeedbackError
                  : styles.backupFeedbackSuccess
              }`}
              data-testid="backup-status-msg"
            >
              {backupFeedback.message}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
