import { pcsToMask } from '../core/pcset';
import { type PitchClass, pitchClassOf } from '../core/pitch';
import { getChordQuality } from '../data/chords';
import { STANDARD_TUNING, type Tuning } from '../data/tunings';
import type { FretValue, SixStringFrets } from '../data/voicings/standard';
import { DEFAULT_FRETS, type FretPosition, type StringNumber, positionToMidi } from '../fretboard';
import { type Voicing, requiredFingers, voicingFretSpan } from './dictionary';

const OPEN_TUNING_IDS = new Set(['openG', 'openD', 'dadgad']);

/**
 * Detecta si `tuning` es un desplazamiento uniforme de `k` semitonos hacia abajo
 * respecto a `base` (por defecto `STANDARD_TUNING`), comparando cuerda por cuerda.
 *
 * Devuelve `k` (`0` en estándar, `1` en Eb / `halfDown`, `2` en D / `wholeDown`),
 * o `null` si las cuerdas no están desplazadas de forma uniforme.
 */
export function uniformSemitoneShift(
  tuning: Tuning,
  base: Tuning = STANDARD_TUNING,
): number | null {
  if (tuning.strings.length !== base.strings.length || tuning.strings.length === 0) {
    return null;
  }
  const k = base.strings[0]! - tuning.strings[0]!;
  for (let i = 1; i < tuning.strings.length; i++) {
    if (base.strings[i]! - tuning.strings[i]! !== k) {
      return null;
    }
  }
  return k;
}

/**
 * Indica si `tuning` es una afinación abierta/modal (`openG`, `openD`, `dadgad`)
 * en la que no se generan ni adaptan voicings en la Fase 1.
 */
export function isOpenTuning(tuning: Tuning, base: Tuning = STANDARD_TUNING): boolean {
  if (OPEN_TUNING_IDS.has(tuning.id)) return true;
  if (uniformSemitoneShift(tuning, base) !== null) return false;

  let diffStrings = 0;
  for (let i = 0; i < tuning.strings.length; i++) {
    if (tuning.strings[i] !== base.strings[i]) {
      diffStrings++;
    }
  }
  return diffStrings > 1;
}

/**
 * Comprueba si un `Voicing` cumple todas las restricciones de integridad del diccionario
 * en la afinación indicada calculando sus notas reales con `positionToMidi(tuning, pos)`.
 */
export function isValidVoicing(voicing: Voicing, tuning: Tuning = STANDARD_TUNING): boolean {
  const quality = getChordQuality(voicing.quality);

  const realMidis: number[] = [];
  for (let i = 0; i < voicing.frets.length; i++) {
    const fret = voicing.frets[i];
    if (typeof fret === 'number') {
      if (!Number.isInteger(fret) || fret < 0 || fret > DEFAULT_FRETS) {
        return false;
      }
      const string = (6 - i) as StringNumber;
      realMidis.push(positionToMidi(tuning, { string, fret }));
    }
  }

  if (realMidis.length < 3) return false;
  if (voicing.midis.length !== realMidis.length) return false;
  for (let i = 0; i < realMidis.length; i++) {
    if (voicing.midis[i] !== realMidis[i]) return false;
  }

  const relPcs = realMidis.map((midi) => pitchClassOf(midi - voicing.root));
  const relMask = pcsToMask(relPcs);

  if ((relMask & quality.requiredMask) !== quality.requiredMask) return false;
  if ((relMask & ~quality.allowedMask) !== 0) return false;

  const lowestMidi = Math.min(...realMidis);
  if (pitchClassOf(lowestMidi) !== voicing.root) return false;

  if (voicingFretSpan(voicing.frets) > 4) return false;

  const fingers = requiredFingers(voicing.frets);
  if (voicing.fingers !== fingers) return false;
  if (fingers < 1 || fingers > 4) return false;

  return true;
}

/**
 * Reconstruye un voicing manteniendo sus trastes pero evaluando sus notas MIDI
 * y su raíz en la afinación `tuning` (usado en desplazamientos uniformes como Eb y D).
 */
export function rebindVoicingToTuning(voicing: Voicing, root: PitchClass, tuning: Tuning): Voicing {
  const positions: FretPosition[] = [];
  const midis: number[] = [];

  for (let i = 0; i < voicing.frets.length; i++) {
    const fret = voicing.frets[i];
    if (typeof fret === 'number') {
      const string = (6 - i) as StringNumber;
      const pos: FretPosition = { string, fret };
      positions.push(pos);
      midis.push(positionToMidi(tuning, pos));
    }
  }

  return {
    ...voicing,
    root,
    positions,
    midis,
    fingers: requiredFingers(voicing.frets),
  };
}

/**
 * Adapta un voicing de la afinación `base` (por defecto estándar) a `tuning`
 * sumando a cada cuerda activa la diferencia de afinación `base.strings[i] - tuning.strings[i]`,
 * de modo que las notas MIDI resultantes sean las mismas.
 * Devuelve `null` si el voicing adaptado incumple alguna restricción del diccionario.
 */
export function adaptVoicingToTuning(
  voicing: Voicing,
  tuning: Tuning,
  base: Tuning = STANDARD_TUNING,
): Voicing | null {
  const adaptedFrets = voicing.frets.map((fret, i): FretValue => {
    if (fret === 'x') return 'x';
    const diff = base.strings[i]! - tuning.strings[i]!;
    return fret + diff;
  }) as unknown as SixStringFrets;

  const positions: FretPosition[] = [];
  const midis: number[] = [];

  for (let i = 0; i < adaptedFrets.length; i++) {
    const fret = adaptedFrets[i];
    if (typeof fret === 'number') {
      if (fret < 0 || fret > DEFAULT_FRETS) {
        return null;
      }
      const string = (6 - i) as StringNumber;
      const pos: FretPosition = { string, fret };
      positions.push(pos);
      midis.push(positionToMidi(tuning, pos));
    }
  }

  const adapted: Voicing = {
    ...voicing,
    frets: adaptedFrets,
    positions,
    midis,
    fingers: requiredFingers(adaptedFrets),
  };

  return isValidVoicing(adapted, tuning) ? adapted : null;
}
