import { useState, useRef, useEffect } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  settingsStore as defaultSettingsStore,
  songStore as defaultSongStore,
  resolveActiveHarmony,
  type DegreeReferenceMode,
  type LabelMode,
  type SettingsStore,
  type SongStore,
} from '../../state';
import {
  analyzeBarChords,
  detectSongKeysByBar,
  type SongBar,
} from '../../song';
import {
  getChordQuality,
  getScaleType,
  pcName,
  romanNumeral,
  type PitchClass,
  type ScaleTypeId,
} from '../../theory';
import styles from './SongContextStrip.module.css';

export interface SongContextStripProps {
  songStore?: StoreApi<SongStore>;
  settingsStore?: StoreApi<SettingsStore>;
}

export function SongContextStrip({
  songStore = defaultSongStore,
  settingsStore = defaultSettingsStore,
}: SongContextStripProps) {
  const [keyMenuOpen, setKeyMenuOpen] = useState(false);
  const [chordMenuOpen, setChordMenuOpen] = useState(false);

  const keyMenuRef = useRef<HTMLDivElement>(null);
  const chordMenuRef = useRef<HTMLDivElement>(null);

  // Stores
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const activeTrackIndex = useStore(songStore, (s) => s.activeTrackIndex);
  const currentBar = useStore(songStore, (s) => s.currentBar);
  const currentBeat = useStore(songStore, (s) => s.currentBeat);
  const selectedBarRange = useStore(songStore, (s) => s.selectedBarRange);
  const degreeReferenceMode = useStore(songStore, (s) => s.degreeReferenceMode);
  const barOverrides = useStore(songStore, (s) => s.barOverrides);
  const songState = useStore(songStore, (s) => s);

  const nameMode = useStore(settingsStore, (s) => s.nameMode);
  const labels = useStore(settingsStore, (s) => s.labels);

  // Cerrar menús al hacer clic fuera o pulsar Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (keyMenuRef.current && !keyMenuRef.current.contains(e.target as Node)) {
        setKeyMenuOpen(false);
      }
      if (chordMenuRef.current && !chordMenuRef.current.contains(e.target as Node)) {
        setChordMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (keyMenuOpen || chordMenuOpen) {
          e.stopPropagation();
          setKeyMenuOpen(false);
          setChordMenuOpen(false);
        }
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [keyMenuOpen, chordMenuOpen]);

  // Pista y compás activo
  const track = activeSong?.tracks[activeTrackIndex] ?? activeSong?.tracks[0];
  const activeBar: SongBar | undefined =
    track?.bars.find((b) => b.number === currentBar) ??
    track?.bars[currentBar - 1] ??
    track?.bars[0];

  const sectionName = activeBar?.sectionMarker;

  // Armonía activa
  const harmony = resolveActiveHarmony(songState, { nameMode });

  // Tonalidad / Escala activa
  const scaleTonicName = harmony ? pcName(harmony.scaleTonic, nameMode) : 'C';
  const scaleTypeName = harmony ? getScaleType(harmony.scaleType).name : 'Mayor';
  const scaleDisplay = `${scaleTonicName} ${scaleTypeName}`;

  // Acorde activo
  let chordDisplay = '—';
  if (harmony && harmony.chordRoot !== undefined && harmony.chordQuality !== undefined) {
    const cRootName = pcName(harmony.chordRoot, nameMode);
    const cSymbol = getChordQuality(harmony.chordQuality).symbol;
    const chordNameStr = `${cRootName}${cSymbol}`;
    const roman = romanNumeral(
      harmony.scaleTonic,
      harmony.chordRoot,
      getChordQuality(harmony.chordQuality),
    );
    chordDisplay = `${chordNameStr} (${roman})`;
  }

  // Candidatos de acorde para el compás activo
  const barChordAnalysis = activeBar
    ? analyzeBarChords(activeBar, { mode: nameMode, override: barOverrides[currentBar] })
    : null;
  const chordCandidates = barChordAnalysis?.candidates ?? [];
  const maxChordScore =
    chordCandidates.length > 0 ? Math.max(...chordCandidates.map((c) => c.score)) : 1;

  // Candidatos de tonalidad sugeridos
  const keyMatches = activeSong
    ? detectSongKeysByBar(activeSong, {
        trackIndex: activeTrackIndex,
        allTracks: songState.analysisSource === 'all-tracks',
        barOverrides,
        mode: nameMode,
      })
    : [];
  const currentBarKey = keyMatches.find((k) => k.barNumber === currentBar);
  const suggestedScales = currentBarKey?.candidates ?? [];

  // Handlers
  const handleClearSelection = () => {
    songStore.getState().setSelectedBarRange(null);
  };

  const handleSetDegreeMode = (mode: DegreeReferenceMode) => {
    songStore.getState().setDegreeReferenceMode(mode);
  };

  const handleSetLabels = (mode: LabelMode) => {
    settingsStore.getState().setLabels(mode);
  };

  const handleResetScaleOverride = async () => {
    await songStore.getState().clearBarScaleOverride(currentBar);
    setKeyMenuOpen(false);
  };

  const handleSelectScale = async (tonic: PitchClass, scaleId: ScaleTypeId) => {
    await songStore.getState().setBarOverride(currentBar, { tonic, scaleId });
    setKeyMenuOpen(false);
  };

  const handleResetChordOverride = async () => {
    await songStore.getState().clearBarChordOverride(currentBar);
    setChordMenuOpen(false);
  };

  const handleSelectChord = async (chordNameStr: string) => {
    await songStore.getState().setBarOverride(currentBar, { chordId: chordNameStr });
    setChordMenuOpen(false);
  };

  return (
    <div className={styles.strip} data-testid="song-context-strip">
      {/* 1. Izquierda: Posición y Selección */}
      <div className={styles.leftCol}>
        <span className={styles.positionText}>
          Compás <strong>{currentBar}</strong> · Pulso <strong>{currentBeat + 1}</strong>
        </span>

        {sectionName && (
          <span className={styles.sectionBadge} data-testid="section-badge">
            {sectionName}
          </span>
        )}

        {selectedBarRange && (
          <>
            <span className={styles.selectionText}>
              Seleccionado: compases {selectedBarRange[0]}–{selectedBarRange[1]}
            </span>
            <button
              type="button"
              className={styles.clearSelectionBtn}
              onClick={handleClearSelection}
              aria-label="Quitar selección"
            >
              ✕ Quitar selección
            </button>
          </>
        )}
      </div>

      {/* 2. Centro: Tonalidad, Acorde y Referencia de Grados */}
      <div className={styles.centerCol}>
        {/* Desplegable Tonalidad */}
        <div className={styles.menuAnchor} ref={keyMenuRef}>
          <button
            type="button"
            className={styles.pillBtn}
            onClick={() => setKeyMenuOpen(!keyMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={keyMenuOpen}
            aria-label="Tonalidad activa"
          >
            <span>Tonalidad: {scaleDisplay}</span>
            {harmony?.hasScaleOverride && (
              <span className={styles.overrideDot} title="Tonalidad fijada manualmente">
                ●
              </span>
            )}
            <span>▾</span>
          </button>

          {keyMenuOpen && (
            <div className={styles.popoverMenu} role="menu" aria-label="Seleccionar tonalidad">
              {harmony?.hasScaleOverride && (
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemReset}`}
                  onClick={handleResetScaleOverride}
                >
                  Restablecer a automática
                </button>
              )}
              {suggestedScales.slice(0, 8).map((cand, idx) => {
                const fit = cand.value;
                return (
                  <button
                    key={`scale-cand-${idx}`}
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleSelectScale(fit.scale.tonic, fit.scale.type)}
                  >
                    <span>
                      {pcName(fit.scale.tonic, nameMode)} {getScaleType(fit.scale.type).name}
                    </span>
                    <small>{Math.round(fit.coverage * 100)}%</small>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desplegable Acorde */}
        <div className={styles.menuAnchor} ref={chordMenuRef}>
          <button
            type="button"
            className={`${styles.pillBtn} ${styles.chordPill}`}
            onClick={() => setChordMenuOpen(!chordMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={chordMenuOpen}
            aria-label="Acorde activo"
          >
            <span>Acorde: {chordDisplay}</span>
            {harmony?.hasChordOverride && (
              <span className={styles.overrideDot} title="Acorde fijado manualmente">
                ●
              </span>
            )}
            <span>▾</span>
          </button>

          {chordMenuOpen && (
            <div className={styles.popoverMenu} role="menu" aria-label="Seleccionar acorde">
              {harmony?.hasChordOverride && (
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemReset}`}
                  onClick={handleResetChordOverride}
                >
                  Restablecer a automático
                </button>
              )}
              {chordCandidates.slice(0, 6).map((c, idx) => (
                <button
                  key={`chord-cand-${idx}`}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleSelectChord(c.value.name)}
                >
                  <span>{c.value.name}</span>
                  <small>{Math.round((c.score / maxChordScore) * 100)}%</small>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conmutador GRADOS */}
        <span className={styles.groupLabel}>GRADOS</span>
        <div className={styles.segmented} role="radiogroup" aria-label="Referencia de grados">
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={degreeReferenceMode === 'key'}
            onClick={() => handleSetDegreeMode('key')}
            aria-label="Grados respecto a la tonalidad"
          >
            Tonalidad
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={degreeReferenceMode === 'chord'}
            onClick={() => handleSetDegreeMode('chord')}
            aria-label="Grados respecto al acorde"
          >
            Acorde
          </button>
        </div>
      </div>

      {/* 3. Derecha: ETIQUETAS */}
      <div className={styles.rightCol}>
        <span className={styles.groupLabel}>ETIQUETAS</span>
        <div className={styles.segmented} role="radiogroup" aria-label="Etiquetas de notas">
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={labels === 'note'}
            onClick={() => handleSetLabels('note')}
          >
            Nota
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={labels === 'interval'}
            onClick={() => handleSetLabels('interval')}
          >
            Intervalo
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={labels === 'degree'}
            onClick={() => handleSetLabels('degree')}
          >
            Grado
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={labels === 'none'}
            onClick={() => handleSetLabels('none')}
          >
            Ninguna
          </button>
        </div>
      </div>
    </div>
  );
}
