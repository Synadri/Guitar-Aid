import { useState } from 'react';
import {
  DEFAULT_FRETS,
  STANDARD_TUNING,
  TUNINGS,
  chordPitchClasses,
  equivalentPositions,
  getTuning,
  midiToPositions,
  pcName,
  pitchClassOf,
  positionToMidi,
  type FretPosition,
  type StringNumber,
  type Tuning,
} from '../../theory';
import { DEFAULT_PIANO_RANGE, type FretMark, type KeyMark } from '../../state';
import { Fretboard, Piano } from '../instruments';
import styles from './Gallery.module.css';

const AM7_ROOT = 9; // A
const AM7_PCS = new Set(chordPitchClasses(AM7_ROOT, 'm7'));

function buildGalleryFretMarks(
  tuning: Tuning,
  pinnedPositions: readonly FretPosition[],
  pinnedMidis: readonly number[],
): FretMark[] {
  const map = new Map<string, FretMark>();

  // 1. Base: notas de Am7 (A como root, C-E-G como tone)
  for (let s: StringNumber = 1; s <= 6; s = (s + 1) as StringNumber) {
    for (let fret = 0; fret <= DEFAULT_FRETS; fret++) {
      const midi = positionToMidi(tuning, { string: s, fret });
      const pc = pitchClassOf(midi);
      if (AM7_PCS.has(pc)) {
        map.set(`${s}:${fret}`, {
          string: s,
          fret,
          role: pc === AM7_ROOT ? 'root' : 'tone',
          label: pcName(pc),
        });
      }
    }
  }

  // 2. Equivalentes de teclas pinned desde el piano
  for (const midi of pinnedMidis) {
    const label = pcName(pitchClassOf(midi));
    for (const eq of midiToPositions(tuning, midi, DEFAULT_FRETS)) {
      map.set(`${eq.string}:${eq.fret}`, {
        string: eq.string,
        fret: eq.fret,
        role: 'equivalent',
        label,
      });
    }
  }

  // 3. Equivalentes de las posiciones pinned en el mástil (p. ej. E3 en (5, 7))
  for (const pos of pinnedPositions) {
    const midi = positionToMidi(tuning, pos);
    const label = pcName(pitchClassOf(midi));
    for (const eq of equivalentPositions(tuning, pos, DEFAULT_FRETS)) {
      map.set(`${eq.string}:${eq.fret}`, {
        string: eq.string,
        fret: eq.fret,
        role: 'equivalent',
        label,
      });
    }
  }

  // 4. Posiciones pinned encima de todo
  for (const pos of pinnedPositions) {
    const midi = positionToMidi(tuning, pos);
    map.set(`${pos.string}:${pos.fret}`, {
      string: pos.string,
      fret: pos.fret,
      role: 'pinned',
      label: pcName(pitchClassOf(midi)),
    });
  }

  return [...map.values()];
}

function buildGalleryPianoMarks(
  tuning: Tuning,
  pinnedPositions: readonly FretPosition[],
  pinnedMidis: readonly number[],
): KeyMark[] {
  const map = new Map<number, KeyMark>();

  // 1. Base: notas de Am7 en el rango del piano
  for (let midi = DEFAULT_PIANO_RANGE.from; midi <= DEFAULT_PIANO_RANGE.to; midi++) {
    const pc = pitchClassOf(midi);
    if (AM7_PCS.has(pc)) {
      map.set(midi, {
        midi,
        role: pc === AM7_ROOT ? 'root' : 'tone',
        label: pcName(pc),
      });
    }
  }

  // 2. Notas pinned desde el mástil o directamente desde el piano
  for (const pos of pinnedPositions) {
    const midi = positionToMidi(tuning, pos);
    map.set(midi, {
      midi,
      role: 'pinned',
      label: pcName(pitchClassOf(midi)),
    });
  }
  for (const midi of pinnedMidis) {
    map.set(midi, {
      midi,
      role: 'pinned',
      label: pcName(pitchClassOf(midi)),
    });
  }

  return [...map.values()];
}

export function Gallery() {
  const [tuningId, setTuningId] = useState<string>(STANDARD_TUNING.id);
  const [leftHanded, setLeftHanded] = useState<boolean>(false);
  const [pinnedPositions, setPinnedPositions] = useState<FretPosition[]>([{ string: 5, fret: 7 }]);
  const [pinnedMidis, setPinnedMidis] = useState<number[]>([]);

  const tuning = getTuning(tuningId) ?? STANDARD_TUNING;
  const fretMarks = buildGalleryFretMarks(tuning, pinnedPositions, pinnedMidis);
  const keyMarks = buildGalleryPianoMarks(tuning, pinnedPositions, pinnedMidis);

  const handlePositionClick = (pos: FretPosition) => {
    setPinnedPositions((prev) => {
      const exists = prev.some((p) => p.string === pos.string && p.fret === pos.fret);
      if (exists) {
        return prev.filter((p) => p.string !== pos.string || p.fret !== pos.fret);
      }
      return [...prev, pos];
    });
  };

  const handleKeyClick = (midi: number) => {
    const hasPinnedOnFretboard = pinnedPositions.some((p) => positionToMidi(tuning, p) === midi);
    if (hasPinnedOnFretboard) {
      setPinnedPositions((prev) => prev.filter((p) => positionToMidi(tuning, p) !== midi));
      setPinnedMidis((prev) => prev.filter((m) => m !== midi));
      return;
    }
    setPinnedMidis((prev) =>
      prev.includes(midi) ? prev.filter((m) => m !== midi) : [...prev, midi],
    );
  };

  return (
    <div className={styles.gallery}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Guitar Aid — Galería de instrumentos (U1)</h1>
          <p className={styles.subtitle}>
            Ejemplo: E3 fijada en (5, 7) con sus equivalentes, y notas de Am7 (A como raíz).
          </p>
        </div>

        <div className={styles.controls}>
          <label className={styles.controlLabel}>
            Afinación
            <select
              className={styles.select}
              aria-label="Afinación"
              value={tuningId}
              onChange={(e) => setTuningId(e.target.value)}
            >
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.controlLabel}>
            <input
              type="checkbox"
              checked={leftHanded}
              onChange={(e) => setLeftHanded(e.target.checked)}
            />
            Modo zurdo
          </label>
        </div>
      </header>

      <div className={styles.legend}>
        <span>● Pinned: círculo lleno</span>
        <span>○ Equivalent: círculo hueco</span>
        <span>◉ Root (A): doble borde</span>
        <span>● Tone (C, E, G): nota del acorde</span>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mástil (24 trastes, 6 cuerdas)</h2>
        <Fretboard
          tuning={tuning}
          frets={DEFAULT_FRETS}
          leftHanded={leftHanded}
          marks={fretMarks}
          onPositionClick={handlePositionClick}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Piano (C2–C7, 61 teclas)</h2>
        <Piano range={DEFAULT_PIANO_RANGE} marks={keyMarks} onKeyClick={handleKeyClick} />
      </section>
    </div>
  );
}
