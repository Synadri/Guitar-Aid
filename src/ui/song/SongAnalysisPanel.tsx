import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  audioEngine as defaultAudioEngine,
  arpeggioEvents,
  chordFallbackMidis,
  playEvents,
  scaleEvents,
  type AudioEngine,
  type NoteEvent,
} from '../../audio';
import {
  fragmentToSandboxContext,
  songChordToSandboxContext,
  songScaleToSandboxContext,
  type SongMenuContext,
} from '../../song';
import {
  selectActiveBarAnalysis,
  selectActiveFragmentAnalysis,
  settingsStore as defaultSettingsStore,
  songStore as defaultSongStore,
  type SandboxStore,
  type SettingsStore,
  type SongState,
  type SongStore,
} from '../../state';
import {
  getChordQuality,
  getScaleType,
  pcName,
  romanNumeral,
  type Candidate,
  type ChordRef,
  type NameMode,
  type PitchClass,
  type ScaleRef,
} from '../../theory';
import { formatReason } from '../panels/texts';
import styles from './SongAnalysisPanel.module.css';

export interface SongAnalysisPanelProps {
  /** Store de estado del Modo Canción. Por defecto usa el singleton songStore. */
  songStore?: StoreApi<SongStore>;
  /** Store de ajustes generales de la aplicación. */
  settingsStore?: StoreApi<SettingsStore>;
  /** Store del modo Sandbox para apertura de acordes y escalas. */
  sandboxStore?: StoreApi<SandboxStore>;
  /** Motor Web Audio de síntesis para previsualización acústica de escalas y acordes. */
  audioEngine?: AudioEngine;
  /** Clase CSS adicional opcional. */
  className?: string;
  /** Estilos en línea opcionales. */
  style?: React.CSSProperties;
  /** Callback opcional al abrir un contexto en el Sandbox. */
  onOpenInSandbox?: (context: SongMenuContext) => void;
  /** Callback opcional para navegar al modo Sandbox. */
  onNavigateToSandbox?: () => void;
  /** Callback opcional al solicitar crear o añadir al mazo SRS. */
  onCreateSrsDeck?: () => void;
  /** Callback opcional al solicitar practicar el fragmento en Ejercicios. */
  onPracticeInDrills?: () => void;
}

function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatScaleDisplayName(scale: ScaleRef, nameMode: NameMode): string {
  const tonicName = pcName(scale.tonic, nameMode);
  if (scale.type === 'major') {
    return `${tonicName} mayor · Jónico`;
  }
  if (scale.type === 'minor') {
    return `${tonicName} menor natural · Eólico`;
  }
  const scaleType = getScaleType(scale.type);
  if (scaleType) {
    return `${tonicName} ${scaleType.name.toLowerCase()}`;
  }
  return scale.name;
}

export const SongAnalysisPanel = React.memo(function SongAnalysisPanel({
  songStore = defaultSongStore,
  settingsStore = defaultSettingsStore,
  sandboxStore,
  audioEngine = defaultAudioEngine,
  className,
  style,
  onOpenInSandbox,
  onNavigateToSandbox,
  onCreateSrsDeck,
  onPracticeInDrills,
}: SongAnalysisPanelProps) {
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const activeTrackIndex = useStore(songStore, (s) => s.activeTrackIndex);
  const currentBar = useStore(songStore, (s) => s.currentBar);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);
  const inspectedBar = useStore(songStore, (s) => s.inspectedBar);
  const analysisSource = useStore(songStore, (s) => s.analysisSource);
  const barOverrides = useStore(songStore, (s) => s.barOverrides);

  const nameMode: NameMode = useStore(settingsStore, (s) => s.nameMode ?? 'sharps');

  // Limpiar cualquier previsualización activa al desmontar
  useEffect(() => {
    return () => {
      songStore.getState().setPreviewContext(null);
    };
  }, [songStore]);

  // Track activo y metadatos del fragmento
  const track = activeSong?.tracks[activeTrackIndex] ?? activeSong?.tracks[0];

  // 1. Análisis integral del fragmento activo (memorizado en selectors/analysis.ts)
  const fragmentAnalysis = useMemo(() => {
    return selectActiveFragmentAnalysis(
      {
        activeSong,
        activeTrackIndex,
        currentBar,
        selectedBarRange,
        analysisSource,
        barOverrides,
      } as SongState,
      { mode: nameMode },
    );
  }, [activeSong, activeTrackIndex, currentBar, selectedBarRange, analysisSource, barOverrides, nameMode]);

  // 2. Compás bajo foco de inspección para acordes
  const inspectedBarNumber = useMemo(() => {
    if (inspectedBar !== null) return inspectedBar;
    if (selectedBarRange) {
      if (currentBar >= selectedBarRange[0] && currentBar <= selectedBarRange[1]) {
        return currentBar;
      }
      return selectedBarRange[0];
    }
    return currentBar;
  }, [inspectedBar, selectedBarRange, currentBar]);

  // 3. Análisis armónico detallado del compás inspeccionado
  const barAnalysis = useMemo(() => {
    return selectActiveBarAnalysis(
      {
        activeSong,
        activeTrackIndex,
        currentBar,
        inspectedBar: inspectedBarNumber,
        analysisSource,
        barOverrides,
      } as SongState,
      { mode: nameMode },
    );
  }, [activeSong, activeTrackIndex, currentBar, inspectedBarNumber, analysisSource, barOverrides, nameMode]);

  // Subtítulo dinámico de la cabecera
  const analysisSubtitle = useMemo(() => {
    if (selectedBarRange && selectedBarRange[0] !== selectedBarRange[1]) {
      const startB = selectedBarRange[0];
      const endB = selectedBarRange[1];
      const barWithSection = track?.bars.find(
        (b) => b.number >= startB && b.number <= endB && Boolean(b.sectionMarker),
      );
      const sectionName = barWithSection?.sectionMarker;
      return `Analizando: compases ${startB}–${endB}${sectionName ? ` (${sectionName})` : ''}`;
    }
    const currentBarObj = track?.bars.find((b) => b.number === inspectedBarNumber);
    const sectionName = currentBarObj?.sectionMarker;
    return `Analizando: compás ${inspectedBarNumber}${sectionName ? ` (${sectionName})` : ''}`;
  }, [selectedBarRange, inspectedBarNumber, track]);

  // Acciones de audio
  const handlePlayScale = useCallback(
    (scale: ScaleRef) => {
      if (!audioEngine) return;
      const st = getScaleType(scale.type);
      if (st) {
        const events = scaleEvents(scale.tonic, st.intervals);
        playEvents(events, audioEngine);
      }
    },
    [audioEngine],
  );

  const handlePlayChord = useCallback(
    (chord: ChordRef) => {
      if (!audioEngine) return;
      const midis = chordFallbackMidis(chord.root, chord.quality);
      const events = arpeggioEvents(midis, 0.1, 0.6);
      playEvents(events, audioEngine);
    },
    [audioEngine],
  );

  const handlePlayProgression = useCallback(() => {
    if (!audioEngine || !fragmentAnalysis) return;
    const chords = fragmentAnalysis.barChords
      .map((bc) => bc.primaryChord)
      .filter((c): c is ChordRef => Boolean(c));
    if (chords.length === 0) return;

    const events: NoteEvent[] = [];
    chords.forEach((c, idx) => {
      const midis = chordFallbackMidis(c.root, c.quality);
      const start = idx * 0.75;
      midis.forEach((m) => {
        events.push({
          midi: m,
          start,
          duration: 0.7,
        });
      });
    });
    playEvents(events, audioEngine);
  }, [audioEngine, fragmentAnalysis]);

  // Acciones de previsualización (hover)
  const handleScaleHoverStart = useCallback(
    (scale: ScaleRef) => {
      songStore.getState().setPreviewContext({
        kind: 'scale',
        root: scale.tonic,
        type: scale.type,
      });
    },
    [songStore],
  );

  const handleChordHoverStart = useCallback(
    (chord: ChordRef) => {
      songStore.getState().setPreviewContext({
        kind: 'chord',
        root: chord.root,
        quality: chord.quality,
      });
    },
    [songStore],
  );

  const handleHoverEnd = useCallback(() => {
    songStore.getState().setPreviewContext(null);
  }, [songStore]);

  // Acciones de sobreescritura manual (fijar / desfijar)
  const handleToggleScaleOverride = useCallback(
    async (scale: ScaleRef) => {
      const targetBars = selectedBarRange
        ? Array.from(
            { length: selectedBarRange[1] - selectedBarRange[0] + 1 },
            (_, i) => selectedBarRange[0] + i,
          )
        : [inspectedBarNumber];

      const isAllFixed = targetBars.every(
        (b) =>
          barOverrides[b]?.tonic === scale.tonic &&
          barOverrides[b]?.scaleId === scale.type,
      );

      if (isAllFixed) {
        for (const b of targetBars) {
          await songStore.getState().clearBarScaleOverride(b);
        }
      } else {
        for (const b of targetBars) {
          await songStore.getState().setBarOverride(b, {
            tonic: scale.tonic,
            scaleId: scale.type,
          });
        }
      }
    },
    [selectedBarRange, inspectedBarNumber, barOverrides, songStore],
  );

  const handleToggleChordOverride = useCallback(
    async (chord: ChordRef, barNum: number) => {
      const isFixed = barOverrides[barNum]?.chordId === chord.name;
      if (isFixed) {
        await songStore.getState().clearBarChordOverride(barNum);
      } else {
        await songStore.getState().setBarOverride(barNum, {
          chordId: chord.name,
        });
      }
    },
    [barOverrides, songStore],
  );

  // Acciones de puente con Sandbox
  const handleOpenScaleInSandbox = useCallback(
    (scale: ScaleRef) => {
      const ctx = songScaleToSandboxContext(scale);
      if (onOpenInSandbox) {
        onOpenInSandbox(ctx);
      } else {
        if (sandboxStore) {
          sandboxStore.getState().setContext(ctx);
        }
        onNavigateToSandbox?.();
      }
    },
    [onOpenInSandbox, onNavigateToSandbox, sandboxStore],
  );

  const handleOpenChordInSandbox = useCallback(
    (chord: ChordRef) => {
      const ctx = songChordToSandboxContext(chord);
      if (onOpenInSandbox) {
        onOpenInSandbox(ctx);
      } else {
        if (sandboxStore) {
          sandboxStore.getState().setContext(ctx);
        }
        onNavigateToSandbox?.();
      }
    },
    [onOpenInSandbox, onNavigateToSandbox, sandboxStore],
  );

  const handleOpenFragmentInSandbox = useCallback(() => {
    if (!fragmentAnalysis) return;
    const ctx = fragmentToSandboxContext(fragmentAnalysis);
    if (!ctx) return;
    if (onOpenInSandbox) {
      onOpenInSandbox(ctx);
    } else {
      if (sandboxStore) {
        sandboxStore.getState().setContext(ctx);
      }
      onNavigateToSandbox?.();
    }
  }, [fragmentAnalysis, onOpenInSandbox, onNavigateToSandbox, sandboxStore]);

  // Clic en chips de progresión
  const handleClickProgressionChip = useCallback(
    (barNum: number) => {
      if (inspectedBar === barNum) {
        songStore.getState().setInspectedBar(null);
      } else {
        songStore.getState().setInspectedBar(barNum);
      }
    },
    [inspectedBar, songStore],
  );

  // Tónica activa de referencia para numerales romanos
  const activeTonic: PitchClass = fragmentAnalysis?.primaryScale.tonic ?? (0 as PitchClass);

  return (
    <aside
      className={`${styles.panel} ${className ?? ''}`}
      style={style}
      data-testid="song-analysis-panel"
      aria-label="Panel de análisis armónico"
    >
      {/* 1. Cabecera del panel */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Análisis del fragmento</span>
          <span className={styles.subTitle}>{analysisSubtitle}</span>
        </div>

        <div className={styles.sourceGroup} role="group" aria-label="Fuente de pistas">
          <span className={styles.sourceLabel}>FUENTE</span>
          <div className={styles.sourceSegmented}>
            <button
              type="button"
              className={`${styles.sourceBtn} ${
                analysisSource === 'active-track' ? styles.sourceBtnActive : ''
              }`}
              onClick={() => songStore.getState().setAnalysisSource('active-track')}
              aria-pressed={analysisSource === 'active-track'}
            >
              Pista activa
            </button>
            <button
              type="button"
              className={`${styles.sourceBtn} ${
                analysisSource === 'all-tracks' ? styles.sourceBtnActive : ''
              }`}
              onClick={() => songStore.getState().setAnalysisSource('all-tracks')}
              aria-pressed={analysisSource === 'all-tracks'}
            >
              Todas
            </button>
          </div>
        </div>
      </header>

      {/* 2. Cuerpo desplazable */}
      <div className={styles.body}>
        {/* BLOQUE 1: Tonalidad y escalas sugeridas */}
        <section
          className={styles.section}
          aria-labelledby="section-tonality-heading"
        >
          <div className={styles.sectionHeader}>
            <h3 id="section-tonality-heading" className={styles.sectionTitle}>
              Tonalidad y escalas sugeridas
            </h3>
          </div>

          <div className={styles.candidatesList} role="list">
            {fragmentAnalysis?.scaleCandidates.slice(0, 5).map((cand, idx) => {
              const scale = cand.value.scale;
              const coveragePct = Math.round(cand.value.coverage * 100);
              const isActive =
                fragmentAnalysis.primaryScale.tonic === scale.tonic &&
                fragmentAnalysis.primaryScale.type === scale.type;

              // Comprobar si está fijada manualmente
              const targetBars = selectedBarRange
                ? Array.from(
                    { length: selectedBarRange[1] - selectedBarRange[0] + 1 },
                    (_, i) => selectedBarRange[0] + i,
                  )
                : [inspectedBarNumber];
              const isFixed = targetBars.every(
                (b) =>
                  barOverrides[b]?.tonic === scale.tonic &&
                  barOverrides[b]?.scaleId === scale.type,
              );

              // Formateo de razones estructuradas
              const formattedReasons = cand.reasons
                .filter((r) => r.code !== 'scaleCommonness' && r.code !== 'scaleExtraNotes')
                .map((r) => formatReason(r, nameMode))
                .filter(Boolean);

              const reasonsText =
                formattedReasons.length > 0
                  ? capitalizeFirst(formattedReasons.join(' · '))
                  : `Cubre el ${coveragePct} % de la duración`;

              return (
                <div
                  key={`scale-cand-${scale.tonic}-${scale.type}-${idx}`}
                  className={`${styles.candidateCard} ${
                    isActive ? styles.candidateCardActive : ''
                  }`}
                  role="listitem"
                  onMouseEnter={() => handleScaleHoverStart(scale)}
                  onMouseLeave={handleHoverEnd}
                  data-testid={`scale-candidate-${idx + 1}`}
                >
                  <span className={styles.orderNumber}>{idx + 1}</span>

                  <div className={styles.cardInfo}>
                    <div className={styles.cardHeaderLine}>
                      <span className={styles.cardName}>
                        {formatScaleDisplayName(scale, nameMode)}
                      </span>
                      <span
                        className={`${styles.pctBadge} ${
                          coveragePct >= 95 ? styles.pctHigh : styles.pctModerate
                        }`}
                      >
                        {coveragePct} %
                      </span>
                    </div>

                    <div className={styles.cardReasons} title={reasonsText}>
                      {reasonsText}
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.playBtn}`}
                      onClick={() => handlePlayScale(scale)}
                      aria-label={`Escuchar escala ${scale.name}`}
                      title="Escuchar escala"
                    >
                      ▶
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${isFixed ? styles.pinBtnPinned : ''}`}
                      onClick={() => handleToggleScaleOverride(scale)}
                      aria-pressed={isFixed}
                      title={
                        isFixed
                          ? 'Tonalidad fijada manualmente. Clic para restablecer a automática.'
                          : 'Fijar esta tonalidad para el compás o fragmento'
                      }
                      data-testid={`pin-scale-${idx + 1}`}
                    >
                      {isFixed ? '✓ Fijada' : '📌 Fijar tonalidad'}
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleOpenScaleInSandbox(scale)}
                      aria-label={`Abrir escala ${scale.name} en Sandbox`}
                      title="Explorar escala en Sandbox"
                    >
                      ↗ Sandbox
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BLOQUE 2: Acordes y progresión */}
        <section
          className={styles.section}
          aria-labelledby="section-progression-heading"
        >
          <div className={styles.sectionHeader}>
            <h3 id="section-progression-heading" className={styles.sectionTitle}>
              Acordes y progresión
            </h3>
            {fragmentAnalysis?.primaryKey && (
              <span className={styles.sectionSub}>
                en {fragmentAnalysis.primaryKey.name}
              </span>
            )}
          </div>

          {/* Tira horizontal interactiva de compases y acordes */}
          <div
            className={styles.progressionStrip}
            role="toolbar"
            aria-label="Secuencia de acordes de la progresión"
          >
            {fragmentAnalysis?.barChords.map((bc, idx) => {
              const chord = bc.primaryChord;
              const barNum = bc.barNumber;
              const isInspected = inspectedBarNumber === barNum;
              const hasChordOverride = bc.hasOverride;

              // Numeral romano para el acorde
              let romanStr = '—';
              if (chord) {
                const q = getChordQuality(chord.quality);
                romanStr = romanNumeral(activeTonic, chord.root, q);
              }

              return (
                <div key={`prog-bar-${barNum}`} className={styles.progressionStep}>
                  <span className={styles.progBarLabel}>c.{barNum}</span>
                  <button
                    type="button"
                    className={`${styles.progChordChip} ${
                      isInspected ? styles.progChordChipInspected : ''
                    }`}
                    onClick={() => handleClickProgressionChip(barNum)}
                    aria-pressed={isInspected}
                    title={`Compás ${barNum}: ${chord?.name ?? 'Sin acorde'} (${romanStr}). Clic para inspeccionar candidatos.`}
                    data-testid={`progression-chip-${barNum}`}
                  >
                    <span>{chord?.name ?? '—'}</span>
                    <span style={{ opacity: 0.85, fontWeight: 500 }}>{romanStr}</span>
                    {hasChordOverride && <span className={styles.overrideDot} title="Fijado manualmente" />}
                  </button>

                  {idx < (fragmentAnalysis?.barChords.length ?? 0) - 1 && (
                    <span className={styles.progArrow} aria-hidden="true">
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sublínea con diagnóstico de plantilla y botón de escucha */}
          <div className={styles.progressionSubline}>
            <div className={styles.templateText}>
              {fragmentAnalysis?.progression.progressions &&
              fragmentAnalysis.progression.progressions.length > 0 ? (
                <>
                  Coincide con la plantilla{' '}
                  <span className={styles.templateHighlight}>
                    {fragmentAnalysis.progression.progressions[0]!.value.template.name}
                  </span>{' '}
                  · progresión habitual
                </>
              ) : (
                <span>
                  Progresión de {fragmentAnalysis?.barChords.length ?? 0} compases
                </span>
              )}
            </div>

            <button
              type="button"
              className={styles.playProgressionBtn}
              onClick={handlePlayProgression}
              aria-label="Escuchar la progresión de acordes"
              title="Reproducir los acordes de la progresión secuencialmente"
            >
              ▶ Escuchar progresión
            </button>
          </div>

          {/* Subsección: CANDIDATOS DEL COMPÁS X */}
          <div className={styles.inspectedBarTitle}>
            CANDIDATOS DEL COMPÁS {inspectedBarNumber}
          </div>

          <div className={styles.candidatesList} role="list">
            {barAnalysis?.candidates.slice(0, 4).map((cand: Candidate<ChordRef>, idx: number) => {
              const chord = cand.value;
              const q = getChordQuality(chord.quality);
              const romanStr = romanNumeral(activeTonic, chord.root, q);
              const isFixed = barOverrides[inspectedBarNumber]?.chordId === chord.name;

              // Porcentaje de cobertura o score normalizado
              const pct =
                cand.reasons.find((r) => r.params?.pct !== undefined)?.params?.pct !== undefined
                  ? Number(cand.reasons.find((r) => r.params?.pct !== undefined)!.params!.pct)
                  : Math.min(100, Math.max(0, Math.round(cand.score)));

              // Formateo de razones estructuradas
              const formattedReasons = cand.reasons
                .map((r) => formatReason(r, nameMode))
                .filter(Boolean);

              const reasonsText =
                formattedReasons.length > 0
                  ? capitalizeFirst(formattedReasons.join(' · '))
                  : `Contiene notas del acorde`;

              return (
                <div
                  key={`chord-cand-${chord.name}-${idx}`}
                  className={styles.candidateCard}
                  role="listitem"
                  onMouseEnter={() => handleChordHoverStart(chord)}
                  onMouseLeave={handleHoverEnd}
                  data-testid={`chord-candidate-${idx + 1}`}
                >
                  <span className={styles.orderNumber}>{idx + 1}</span>

                  <div className={styles.cardInfo}>
                    <div className={styles.cardHeaderLine}>
                      <span className={styles.cardName}>{chord.name}</span>
                      <span className={styles.chordDegree}>{romanStr}</span>
                      <span
                        className={`${styles.pctBadge} ${
                          pct >= 90 ? styles.pctHigh : styles.pctModerate
                        }`}
                      >
                        {pct} %
                      </span>
                    </div>

                    <div className={styles.cardReasons} title={reasonsText}>
                      {reasonsText}
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.playBtn}`}
                      onClick={() => handlePlayChord(chord)}
                      aria-label={`Escuchar acorde ${chord.name}`}
                      title="Escuchar acorde"
                    >
                      ▶
                    </button>

                    <button
                      type="button"
                      className={`${styles.actionBtn} ${isFixed ? styles.pinBtnPinned : ''}`}
                      onClick={() => handleToggleChordOverride(chord, inspectedBarNumber)}
                      aria-pressed={isFixed}
                      title={
                        isFixed
                          ? 'Acorde fijado manualmente. Clic para restablecer a automático.'
                          : 'Fijar este acorde para el compás'
                      }
                      data-testid={`pin-chord-${idx + 1}`}
                    >
                      {isFixed ? '✓ Fijado' : '📌 Fijar'}
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleOpenChordInSandbox(chord)}
                      aria-label={`Abrir acorde ${chord.name} en Sandbox`}
                      title="Explorar acorde en Sandbox"
                    >
                      ↗ Sandbox
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 3. Pie fijo del panel: Llevar este fragmento a otro modo */}
      <footer className={styles.footer}>
        <div className={styles.footerTitle}>Llevar este fragmento a otro modo</div>
        <div className={styles.footerGrid}>
          <button
            type="button"
            className={styles.footerSandboxBtn}
            onClick={handleOpenFragmentInSandbox}
            data-testid="bridge-open-sandbox"
          >
            ↗ Abrir en Sandbox
          </button>

          <button
            type="button"
            className={styles.footerSecondaryBtn}
            onClick={() => onCreateSrsDeck?.()}
            data-testid="bridge-create-srs"
          >
            Crear / añadir a mazo SRS
          </button>

          <button
            type="button"
            className={styles.footerSecondaryBtn}
            onClick={() => onPracticeInDrills?.()}
            data-testid="bridge-practice-drills"
          >
            Practicar en Ejercicios
          </button>
        </div>
      </footer>
    </aside>
  );
});
