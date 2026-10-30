import { useEffect, useMemo, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  CHORD_QUALITIES,
  chordName,
  chordTones,
  degreeName,
  formulaOfChord,
  formulaOfScale,
  getScaleType,
  identifyByFormula,
  pcName,
  SCALE_TYPES,
  type ChordQualityId,
  type FormulaItemRef,
  type NameMode,
  type PitchClass,
  type ScaleTypeId,
} from '../../../theory';
import {
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  type MenuContext,
  type SandboxStore,
  type SettingsStore,
} from '../../../state';
import {
  arpeggioEvents,
  audioEngine as defaultAudioEngine,
  chordFallbackMidis,
  playEvents,
  scaleEvents,
  type AudioEngine,
} from '../../../audio';
import styles from './FormulasView.module.css';

export interface FormulasViewProps {
  initialKind?: 'chord' | 'scale';
  initialRoot?: PitchClass;
  initialQuality?: ChordQualityId;
  initialScaleType?: ScaleTypeId;
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  audioEngine?: AudioEngine;
  onOpenInSandbox?: (context: MenuContext) => void;
}

interface DegreePillDef {
  label: string;
  semitones: number;
  fixed?: boolean;
}

const DEGREE_PILLS: readonly DegreePillDef[] = [
  { label: '1', semitones: 0, fixed: true },
  { label: '♭2', semitones: 1 },
  { label: '2', semitones: 2 },
  { label: '♭3', semitones: 3 },
  { label: '3', semitones: 4 },
  { label: '4', semitones: 5 },
  { label: '♭5', semitones: 6 },
  { label: '5', semitones: 7 },
  { label: '♭6', semitones: 8 },
  { label: '6', semitones: 9 },
  { label: '♭7', semitones: 10 },
  { label: '7', semitones: 11 },
  { label: '9', semitones: 14 },
] as const;

const PITCH_CLASSES: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function FormulasView({
  initialKind = 'chord',
  initialRoot = 9, // A por defecto (Am7 = 1 ♭3 5 ♭7 como en maqueta)
  initialQuality = 'm7',
  initialScaleType = 'dorian',
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  audioEngine = defaultAudioEngine,
  onOpenInSandbox,
}: FormulasViewProps) {
  const nameMode = useStore(settingsStore, (s) => s.nameMode) as NameMode;

  // Estado columna izquierda: Nombre -> fórmula
  const [kind, setKind] = useState<'chord' | 'scale'>(initialKind);
  const [root, setRoot] = useState<PitchClass>(initialRoot);
  const [quality, setQuality] = useState<ChordQualityId>(initialQuality);
  const [scaleType, setScaleType] = useState<ScaleTypeId>(initialScaleType);

  // Estado columna derecha: Fórmula -> nombre
  const [selectedSemitones, setSelectedSemitones] = useState<Set<number>>(
    new Set([0, 3, 7, 10]), // Am7 por defecto
  );
  const [reverseRoot, setReverseRoot] = useState<PitchClass | null>(initialRoot);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  useEffect(() => {
    setRoot(initialRoot);
    setReverseRoot(initialRoot);
  }, [initialRoot]);

  useEffect(() => {
    setQuality(initialQuality);
  }, [initialQuality]);

  useEffect(() => {
    setScaleType(initialScaleType);
  }, [initialScaleType]);

  // Cálculos columna izquierda
  const formulaTones = useMemo(() => {
    if (kind === 'chord') {
      return formulaOfChord({ root, quality });
    }
    return formulaOfScale({ tonic: root, type: scaleType });
  }, [kind, root, quality, scaleType]);

  const itemDisplayName = useMemo(() => {
    if (kind === 'chord') {
      return chordName({ root, quality }, nameMode);
    }
    const st = getScaleType(scaleType);
    return `${pcName(root, nameMode)} ${st.name}`;
  }, [kind, root, quality, scaleType, nameMode]);

  const formulaDegreesString = useMemo(() => {
    return formulaTones.map((t) => t.degree).join(' ');
  }, [formulaTones]);

  // Reproducir sonido con el motor de audio
  const handleListen = () => {
    if (kind === 'chord') {
      const midis = chordFallbackMidis(root, quality);
      playEvents(arpeggioEvents(midis), audioEngine);
    } else {
      const st = getScaleType(scaleType);
      playEvents(scaleEvents(root, st.intervals), audioEngine);
    }
  };

  // Abrir contexto en el Sandbox
  const handleOpenSandbox = () => {
    const menuContext: MenuContext =
      kind === 'chord'
        ? { kind: 'chord', root, quality }
        : { kind: 'scale', root, type: scaleType };

    if (onOpenInSandbox) {
      onOpenInSandbox(menuContext);
    } else {
      sandboxStore.getState().setContext(menuContext);
    }
  };

  // Conmutar píldora de grado en la columna derecha
  const toggleDegreePill = (pill: DegreePillDef) => {
    if (pill.fixed) return; // 1 siempre está presente
    const next = new Set(selectedSemitones);
    if (next.has(pill.semitones)) {
      next.delete(pill.semitones);
    } else {
      next.add(pill.semitones);
    }
    setSelectedSemitones(next);
  };

  // Búsqueda inversa con identifyByFormula
  const identifyResult = useMemo(() => {
    const semitones = Array.from(selectedSemitones).sort((a, b) => a - b);
    return identifyByFormula({
      semitones,
      root: reverseRoot ?? undefined,
      mode: nameMode,
    });
  }, [selectedSemitones, reverseRoot, nameMode]);

  // Al hacer clic en un resultado de la columna derecha, se selecciona en la izquierda
  const handleSelectResult = (item: FormulaItemRef) => {
    if (item.kind === 'chord') {
      setKind('chord');
      setQuality(item.quality);
      if (item.root !== undefined) {
        setRoot(item.root);
      }
    } else {
      setKind('scale');
      setScaleType(item.type);
      if (item.tonic !== undefined) {
        setRoot(item.tonic);
      }
    }
  };

  // Función auxiliar para obtener notas o grados de un item del catálogo
  const getItemNotesDisplay = (item: FormulaItemRef): string => {
    if (item.kind === 'chord') {
      if (item.root !== undefined) {
        return formulaOfChord({ root: item.root, quality: item.quality })
          .map((t) => pcName(t.pc, nameMode))
          .join(' · ');
      }
      return chordTones(0, item.quality)
        .map((t) => t.degree)
        .join(' · ');
    } else {
      if (item.tonic !== undefined) {
        return formulaOfScale({ tonic: item.tonic, type: item.type })
          .map((t) => pcName(t.pc, nameMode))
          .join(' · ');
      }
      return getScaleType(item.type)
        .intervals.map((i) => degreeName(i))
        .join(' · ');
    }
  };

  return (
    <div className={styles.container} data-testid="formulas-container">
      {/* 1. Columna izquierda — Nombre → fórmula */}
      <section
        className={styles.formulaForwardCard}
        aria-label="Panel Nombre a fórmula"
        data-testid="formula-forward-card"
      >
        <h2 className={styles.cardTitle}>Nombre → fórmula</h2>

        {/* Barra de selección */}
        <div className={styles.selectorsRow}>
          <div className={styles.segmentedControl} role="radiogroup" aria-label="Tipo de estructura">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'chord'}
              className={`${styles.segmentedBtn} ${kind === 'chord' ? styles.segmentedBtnActive : ''}`}
              onClick={() => setKind('chord')}
            >
              Acorde
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'scale'}
              className={`${styles.segmentedBtn} ${kind === 'scale' ? styles.segmentedBtnActive : ''}`}
              onClick={() => setKind('scale')}
            >
              Escala
            </button>
          </div>

          <select
            className={styles.selectInput}
            value={root}
            onChange={(e) => setRoot(Number(e.target.value) as PitchClass)}
            aria-label="Tónica / Raíz"
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={pc}>
                {pcName(pc, nameMode)}
              </option>
            ))}
          </select>

          {kind === 'chord' ? (
            <select
              className={styles.selectInput}
              value={quality}
              onChange={(e) => setQuality(e.target.value as ChordQualityId)}
              aria-label="Calidad del acorde"
            >
              {CHORD_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.symbol || q.id})
                </option>
              ))}
            </select>
          ) : (
            <select
              className={styles.selectInput}
              value={scaleType}
              onChange={(e) => setScaleType(e.target.value as ScaleTypeId)}
              aria-label="Tipo de escala"
            >
              {SCALE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Ecuación principal de la fórmula */}
        <div className={styles.equationBox} data-testid="formula-equation">
          <span className={styles.equationText}>
            {itemDisplayName} =
            <span className={styles.equationDegrees}>{formulaDegreesString}</span>
          </span>
        </div>

        {/* Tabla de composición */}
        <div className={styles.tableWrapper}>
          <table className={styles.compositionTable} aria-label="Composición de intervalos">
            <thead>
              <tr>
                <th scope="col">Grado</th>
                <th scope="col">Intervalo</th>
                <th scope="col">Semitonos</th>
                <th scope="col">Nota</th>
              </tr>
            </thead>
            <tbody>
              {formulaTones.map((t, idx) => (
                <tr key={`${t.degree}-${idx}`}>
                  <td className={styles.degreeCell}>{t.degree}</td>
                  <td className={styles.intervalCell}>{t.intervalLong}</td>
                  <td className={styles.semitonesCell}>{t.semitones}</td>
                  <td className={styles.noteCell}>{pcName(t.pc, nameMode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Regla cromática lineal (13 celdas: 0..12 semitonos) */}
        <div className={styles.rulerSection} aria-label="Regla cromática desde la raíz">
          <div className={styles.rulerHeader}>Regla cromática desde la raíz</div>
          <div className={styles.rulerGrid} data-testid="chromatic-ruler">
            {Array.from({ length: 13 }, (_, s) => {
              const notePc = ((root + s) % 12) as PitchClass;
              const noteName = pcName(notePc, nameMode);

              // Determinar si este semitono pertenece a la fórmula activa
              let matchedTone = formulaTones.find((t) => t.semitones === s);
              // Extensiones (p. ej. 9 en la celda de semitono 2)
              if (!matchedTone && s < 12) {
                matchedTone = formulaTones.find((t) => t.semitones % 12 === s);
              }
              const isActive = s === 0 || matchedTone !== undefined;
              const displayDegree = s === 0 ? '1' : (matchedTone?.degree ?? '');

              return (
                <div
                  key={`ruler-${s}`}
                  className={`${styles.rulerCell} ${isActive ? styles.rulerCellActive : ''}`}
                  data-semitone={s}
                  data-active={isActive ? 'true' : 'false'}
                >
                  <span className={styles.rulerSemi}>{s}</span>
                  <span className={styles.rulerNote}>{noteName}</span>
                  <span
                    className={isActive ? styles.rulerDegree : styles.rulerDegreeInactive}
                    aria-hidden={!isActive}
                  >
                    {displayDegree}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Botones de acción inferiores */}
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.listenBtn}
            onClick={handleListen}
            aria-label="Escuchar acorde o escala"
          >
            <span aria-hidden="true">🔊</span> Escuchar
          </button>
          <button
            type="button"
            className={styles.openSandboxBtn}
            onClick={handleOpenSandbox}
            aria-label="Abrir en Sandbox"
          >
            Abrir en Sandbox
          </button>
        </div>
      </section>

      {/* 2. Columna derecha — Fórmula → nombre */}
      <section
        className={styles.formulaReverseCard}
        aria-label="Panel Fórmula a nombre"
        data-testid="formula-reverse-card"
      >
        <h2 className={styles.cardTitle}>Fórmula → nombre</h2>

        {/* Selector interactivo de grados */}
        <div className={styles.degreeSelectorHeader}>Grados (el 1 siempre está)</div>
        <div className={styles.pillsRow} role="group" aria-label="Selector de grados de la fórmula">
          {DEGREE_PILLS.map((pill) => {
            const isSelected = selectedSemitones.has(pill.semitones);
            return (
              <button
                key={pill.label}
                type="button"
                role="button"
                aria-pressed={isSelected}
                disabled={pill.fixed}
                className={`${styles.pillBtn} ${isSelected ? styles.pillBtnActive : ''} ${
                  pill.fixed ? styles.pillBtnFixed : ''
                }`}
                onClick={() => toggleDegreePill(pill)}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Filtro Raíz opcional */}
        <div className={styles.rootFilterRow}>
          <span className={styles.rootFilterLabel}>Raíz opcional:</span>
          <select
            className={styles.selectInput}
            value={reverseRoot !== null ? reverseRoot : 'none'}
            onChange={(e) => {
              const val = e.target.value;
              setReverseRoot(val === 'none' ? null : (Number(val) as PitchClass));
            }}
            aria-label="Filtro raíz opcional"
          >
            <option value="none">Sin raíz</option>
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={pc}>
                {pcName(pc, nameMode)}
              </option>
            ))}
          </select>
        </div>

        {/* Secciones de resultados */}
        <div className={styles.resultsContainer}>
          {/* A. Coincidencias exactas */}
          <div className={styles.resultsSection}>
            <div className={styles.sectionHeader}>Coincidencia exacta</div>
            {identifyResult.exact.length === 0 ? (
              <div className={styles.noExactMsg}>
                Ningún acorde o escala del catálogo coincide exactamente
              </div>
            ) : (
              <div className={styles.cardsList}>
                {identifyResult.exact.map((cand, idx) => (
                  <button
                    key={`exact-${cand.value.name}-${idx}`}
                    type="button"
                    className={styles.exactCard}
                    onClick={() => handleSelectResult(cand.value)}
                    aria-label={`Seleccionar coincidencia exacta ${cand.value.name}`}
                  >
                    <span className={styles.exactName}>{cand.value.name}</span>
                    <span className={styles.exactNotes}>{getItemNotesDisplay(cand.value)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* B. Mismas notas, otra raíz */}
          {identifyResult.rotations.length > 0 && (
            <div className={styles.resultsSection}>
              <div className={styles.sectionHeader}>Mismas notas, otra raíz</div>
              <div className={styles.cardsList}>
                {identifyResult.rotations.map((cand, idx) => {
                  const degReason = cand.reasons.find(
                    (r) => r.code === 'sameNotesOtherRoot',
                  )?.params?.degree;
                  return (
                    <button
                      key={`rotation-${cand.value.name}-${idx}`}
                      type="button"
                      className={styles.secondaryCard}
                      onClick={() => handleSelectResult(cand.value)}
                      aria-label={`Seleccionar rotación ${cand.value.name}`}
                    >
                      <span className={styles.secondaryName}>{cand.value.name}</span>
                      <span className={styles.secondaryDetail}>
                        {degReason ? `sobre el ${degReason}` : getItemNotesDisplay(cand.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* C. Cercanas (a 1 nota de distancia) */}
          {identifyResult.near.length > 0 && (
            <div className={styles.resultsSection}>
              <div className={styles.sectionHeader}>Cercanas (1 nota de diferencia)</div>
              <div className={styles.cardsList}>
                {identifyResult.near.map((cand, idx) => {
                  const missingReason = cand.reasons.find((r) => r.code === 'formulaMissingTone');
                  const addsReason = cand.reasons.find((r) => r.code === 'formulaAddsTone');
                  let detail = '';
                  if (missingReason?.params?.degree) {
                    detail = `quita ${missingReason.params.degree}`;
                  } else if (addsReason?.params?.degree) {
                    detail = `añade ${addsReason.params.degree}`;
                  } else {
                    detail = getItemNotesDisplay(cand.value);
                  }

                  return (
                    <button
                      key={`near-${cand.value.name}-${idx}`}
                      type="button"
                      className={styles.secondaryCard}
                      onClick={() => handleSelectResult(cand.value)}
                      aria-label={`Seleccionar candidata cercana ${cand.value.name}`}
                    >
                      <span className={styles.secondaryName}>{cand.value.name}</span>
                      <span className={styles.secondaryDetail}>{detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
