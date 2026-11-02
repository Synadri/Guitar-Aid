import {
  type Candidate,
  type ChordQualityId,
  type ChordRef,
  type KeyRef,
  type NameMode,
  type PcMask,
  type PitchClass,
  type Reason,
  type RootObservation,
  type ScaleRef,
  type ScaleTypeId,
  type WeightedPc,
  CHORD_QUALITIES,
  CHORD_QUALITY_WEIGHTS,
  SCALE_TYPES,
  analyzeChordSequence,
  chordDisplayName,
  estimateRoot,
  hasPc,
  pcName,
  rankScalesForFragment,
  rotateMask,
} from '../theory';
import { parseChordSymbol } from '../theory/voicings/dictionary';
import type {
  AnalyzeSongFragmentOptions,
  BarChordAnalysis,
  BarChordSegment,
  BarOverride,
  DetectBarChordsOptions,
  DetectSongKeysOptions,
  SongBar,
  SongBeat,
  SongFragmentAnalysis,
  SongKeyByBar,
  SongModel,
  SongNote,
  SongTrack,
} from './types';

// ============================================================================
// 1. Ponderación rítmica y métrica de notas (plan_fase3.md §3.2)
// ============================================================================

/**
 * Calcula el peso armónico de una nota individual según su duración rítmica,
 * acento métrico del pulso, registro grave (bajo) y articulación:
 *
 * weight(n) = (n.durationTicks / 960) × b.metricWeight × w_bajo(n) × w_articulación(n)
 */
export function computeNoteWeight(
  note: SongNote,
  beat: SongBeat,
  lowestMidiInBeat?: number,
): number {
  if (note.durationTicks <= 0) return 0;

  const baseDuration = note.durationTicks / 960;
  const metric = beat.metricWeight > 0 ? beat.metricWeight : 1.0;

  const isBass = lowestMidiInBeat !== undefined && note.midi === lowestMidiInBeat;
  const isDownbeat = beat.startTick === 0;
  const wBass = isBass ? (isDownbeat ? 1.5 : 1.35) : 1.0;

  const wArt = note.isGhost || note.durationTicks < 120 ? 0.35 : 1.0;

  return baseDuration * metric * wBass * wArt;
}

/**
 * Extrae las observaciones de raíz de un compás para alimentar `estimateRoot` (§3.3).
 */
export function extractRootObservations(bar: SongBar): RootObservation[] {
  const obs: RootObservation[] = [];

  for (const beat of bar.beats) {
    if (beat.notes.length === 0) continue;

    let minMidi = Infinity;
    for (const note of beat.notes) {
      if (note.midi < minMidi) minMidi = note.midi;
    }

    const isDownbeat = beat.startTick === 0;

    for (const note of beat.notes) {
      const isBass = note.midi === minMidi;
      const weight = computeNoteWeight(note, beat, minMidi);
      if (weight > 0) {
        obs.push({
          pc: note.pc,
          midi: note.midi,
          weight,
          isDownbeat,
          isBass,
        });
      }
    }
  }

  return obs;
}

/**
 * Calcula los pesos acumulados por clase de altura (`WeightedPc[]`) de un compás.
 */
export function computeBarWeightedPcs(bar: SongBar): WeightedPc[] {
  const weights = new Float64Array(12);

  for (const beat of bar.beats) {
    if (beat.notes.length === 0) continue;

    let minMidi = Infinity;
    for (const note of beat.notes) {
      if (note.midi < minMidi) minMidi = note.midi;
    }

    for (const note of beat.notes) {
      const weight = computeNoteWeight(note, beat, minMidi);
      if (weight > 0) {
        weights[note.pc] = (weights[note.pc] ?? 0) + weight;
      }
    }
  }

  const result: WeightedPc[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if (weights[pc]! > 0) {
      result.push({ pc: pc as PitchClass, weight: weights[pc]! });
    }
  }
  return result;
}

/**
 * Suma y acumula los pesos por clase de altura de una secuencia de compases.
 */
export function computeRangeWeightedPcs(bars: readonly SongBar[]): WeightedPc[] {
  const weights = new Float64Array(12);

  for (const bar of bars) {
    for (const wp of computeBarWeightedPcs(bar)) {
      weights[wp.pc] = (weights[wp.pc] ?? 0) + wp.weight;
    }
  }

  const result: WeightedPc[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if (weights[pc]! > 0) {
      result.push({ pc: pc as PitchClass, weight: weights[pc]! });
    }
  }
  return result;
}

// ============================================================================
// 2. Combinación multipista de compases
// ============================================================================

/**
 * Combina los compases de la misma posición temporal entre múltiples pistas armónicas.
 */
export function combineBarsForIndex(
  tracks: readonly SongTrack[],
  barIndex: number,
): SongBar | null {
  const activeTracks = tracks.filter((t) => !t.isPercussion);
  if (activeTracks.length === 0) return null;

  const template = activeTracks[0]!.bars[barIndex];
  if (!template) return null;

  if (activeTracks.length === 1) return template;

  const combinedBeats: SongBeat[] = [];
  const beatCount = Math.max(...activeTracks.map((t) => t.bars[barIndex]?.beats.length ?? 0));

  for (let b = 0; b < beatCount; b++) {
    const beatsAtIdx = activeTracks
      .map((t) => t.bars[barIndex]?.beats[b])
      .filter((beat): beat is SongBeat => Boolean(beat));

    if (beatsAtIdx.length === 0) continue;

    const baseBeat = beatsAtIdx[0]!;
    const allNotes: SongNote[] = [];
    let chordAnnotation: string | undefined = undefined;
    let lyrics: string | undefined = undefined;

    for (const beat of beatsAtIdx) {
      allNotes.push(...beat.notes);
      if (!chordAnnotation && beat.chordAnnotation) {
        chordAnnotation = beat.chordAnnotation;
      }
      if (!lyrics && beat.lyrics) {
        lyrics = beat.lyrics;
      }
    }

    combinedBeats.push({
      index: b,
      startTick: baseBeat.startTick,
      durationTicks: baseBeat.durationTicks,
      metricWeight: baseBeat.metricWeight,
      chordAnnotation,
      lyrics,
      notes: allNotes,
    });
  }

  return {
    index: template.index,
    number: template.number,
    timeSignature: template.timeSignature,
    tempoBpm: template.tempoBpm,
    keySignature: template.keySignature,
    sectionMarker: template.sectionMarker,
    beats: combinedBeats,
  };
}

// ============================================================================
// 3. Detección de acordes por compás (plan_fase3.md §3.4)
// ============================================================================

function popcount12(mask: PcMask): number {
  let count = 0;
  let m = mask & 0xfff;
  while (m !== 0) {
    m &= m - 1;
    count++;
  }
  return count;
}

/**
 * Detecta candidatos de acorde para un compás tolerando notas de paso y
 * ponderando por acento métrico, registro grave y anotaciones de partitura.
 */
export function detectBarChords(
  bar: SongBar,
  options?: DetectBarChordsOptions,
): Candidate<ChordRef>[] {
  const mode = options?.mode ?? 'sharps';
  const obs = extractRootObservations(bar);

  if (obs.length === 0) return [];

  // Calcular peso total y máscara de notas presentes
  let totalWeight = 0;
  let inputMask: PcMask = 0;
  const weightsByPc = new Float64Array(12);

  for (const o of obs) {
    if (o.weight <= 0) continue;
    totalWeight += o.weight;
    weightsByPc[o.pc] = (weightsByPc[o.pc] ?? 0) + o.weight;
    inputMask |= 1 << o.pc;
  }

  if (totalWeight <= 0 || inputMask === 0) return [];

  const distinctPcs = popcount12(inputMask);

  // Estimación de raíz
  let estimatedRoot: PitchClass | undefined = options?.root;
  if (estimatedRoot === undefined) {
    const rootCandidates = estimateRoot(obs);
    if (rootCandidates.length > 0) {
      estimatedRoot = rootCandidates[0]!.value;
    }
  }

  // Anotación en partitura
  let annotatedChordText = options?.annotatedChord;
  if (!annotatedChordText) {
    for (const b of bar.beats) {
      if (b.chordAnnotation) {
        annotatedChordText = b.chordAnnotation;
        break;
      }
    }
  }

  let annotatedParsed: { root: PitchClass; quality: ChordQualityId } | null = null;
  if (annotatedChordText) {
    const cleanAnnotation = annotatedChordText.split('/')[0]!.trim();
    annotatedParsed = parseChordSymbol(cleanAnnotation);
  }

  // Una sola nota aislada sin contexto armónico suficiente ni cifrado no inventa un acorde
  if (distinctPcs <= 1 && !annotatedParsed) {
    return [];
  }

  const minCoverageThreshold = options?.minCoverage ?? 0.5;
  const candidates: Candidate<ChordRef>[] = [];

  for (let r = 0; r < 12; r++) {
    const root = r as PitchClass;

    for (const q of CHORD_QUALITIES) {
      const reqMask = rotateMask(q.requiredMask, root);
      const allowMask = rotateMask(q.allowedMask, root);

      // 1. Verificación de presencia de raíz y tonos característicos
      const hasRoot = hasPc(inputMask, root);
      const isAnnotatedExact =
        annotatedParsed !== null &&
        annotatedParsed.root === root &&
        annotatedParsed.quality === q.id;

      if (!hasRoot && !isAnnotatedExact) {
        continue;
      }

      // Requisitos por tipo de acorde:
      if (q.id === '5') {
        // Power chord: requiere fundamental y 5ª justa
        const fifth = ((root + 7) % 12) as PitchClass;
        if (!hasPc(inputMask, fifth) && !isAnnotatedExact) continue;
      } else {
        // Acordes con tercera o suspensión
        const minor3rd = ((root + 3) % 12) as PitchClass;
        const major3rd = ((root + 4) % 12) as PitchClass;
        const sus4 = ((root + 5) % 12) as PitchClass;
        const sus2 = ((root + 2) % 12) as PitchClass;

        const hasMinor3rd = hasPc(reqMask, minor3rd);
        const hasMajor3rd = hasPc(reqMask, major3rd);
        const hasSus4 = hasPc(reqMask, sus4);
        const hasSus2 = hasPc(reqMask, sus2);

        let characteristicFound = false;
        if (hasMinor3rd && hasPc(inputMask, minor3rd)) characteristicFound = true;
        if (hasMajor3rd && hasPc(inputMask, major3rd)) characteristicFound = true;
        if (hasSus4 && hasPc(inputMask, sus4)) characteristicFound = true;
        if (hasSus2 && hasPc(inputMask, sus2)) characteristicFound = true;

        // Si no tiene 3ª típica (p. ej. disminuida o tríada incompleta) o es exactamente el anotado
        if (!characteristicFound && !isAnnotatedExact && distinctPcs > 2) {
          continue;
        }

        // Al menos 2 notas requeridas del acorde deben sonar
        const presentReqCount = popcount12(inputMask & reqMask);
        if (presentReqCount < 2 && !isAnnotatedExact) {
          continue;
        }
      }

      // 2. Cobertura de peso armónico
      let coveredWeight = 0;
      for (let p = 0; p < 12; p++) {
        const pc = p as PitchClass;
        if (hasPc(allowMask, pc)) {
          coveredWeight += weightsByPc[pc]!;
        }
      }

      const coverageRatio = coveredWeight / totalWeight;
      if (coverageRatio < minCoverageThreshold && !isAnnotatedExact) {
        continue;
      }

      // 3. Puntuación
      let score = coverageRatio * 100;

      if (coverageRatio >= 0.7) {
        score += 25;
      }

      const reasons: Reason[] = [
        {
          code: 'containsChordTones',
          params: {
            pct: Math.round(coverageRatio * 100),
            n: popcount12(inputMask & reqMask),
            of: popcount12(reqMask),
          },
        },
      ];

      // Coincidencia con la raíz estimada
      let bass: PitchClass | undefined;
      if (estimatedRoot !== undefined) {
        if (root === estimatedRoot) {
          score += 40;
          reasons.push({ code: 'rootMatches', params: { root } });
        } else if (hasPc(allowMask, estimatedRoot)) {
          score += 20;
          bass = estimatedRoot;
          reasons.push({ code: 'invertedBass', params: { root, bass: estimatedRoot } });
        }
      }

      // Coincidencia con anotación de partitura
      if (annotatedParsed) {
        if (root === annotatedParsed.root && q.id === annotatedParsed.quality) {
          score += 85;
          reasons.push({
            code: 'annotatedInScore',
            params: { name: annotatedChordText ?? '' },
          });
        } else if (root === annotatedParsed.root) {
          score += 35;
        }
      }

      // Peso intrínseco de la calidad en el catálogo
      score += (CHORD_QUALITY_WEIGHTS[q.id] ?? 50) * 0.1;

      // Penalización por notas requeridas omitidas
      const omittedRequired = popcount12(reqMask & ~inputMask);
      score -= omittedRequired * 10;

      // Razones adicionales
      if (obs.some((o) => o.isBass && o.pc === root)) {
        reasons.push({ code: 'bassNoteInBar' });
      }
      if (obs.some((o) => o.isDownbeat && o.pc === root)) {
        reasons.push({ code: 'downbeatAccent' });
      }

      candidates.push({
        value: {
          root,
          quality: q.id,
          name: chordDisplayName({ root, quality: q.id, bass }, mode),
          ...(bass !== undefined ? { bass } : {}),
        },
        score: Math.round(score),
        reasons,
      });
    }
  }

  // Ordenar candidatos por puntuación descendente
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.value.root - b.value.root;
  });

  return candidates;
}

/**
 * Realiza el análisis armónico completo de un compás individual, incluyendo
 * posibles cambios armónicos por mitades (desglose) y comprobación de overrides.
 */
export function analyzeBarChords(
  bar: SongBar,
  options?: DetectBarChordsOptions & { override?: BarOverride },
): BarChordAnalysis {
  const mode = options?.mode ?? 'sharps';
  const obs = extractRootObservations(bar);
  const weightedPcs = computeBarWeightedPcs(bar);

  let estimatedRoot: PitchClass | undefined = options?.root;
  if (estimatedRoot === undefined && obs.length > 0) {
    const roots = estimateRoot(obs);
    if (roots.length > 0) estimatedRoot = roots[0]!.value;
  }

  const candidates = detectBarChords(bar, { ...options, root: estimatedRoot });

  // Desglose opcional por mitades si el compás tiene duración suficiente (p. ej. 4/4)
  let splitChords: BarChordAnalysis['splitChords'];
  const totalTicks = bar.beats.reduce((acc, b) => acc + b.durationTicks, 0);

  if (totalTicks >= 1920 && bar.beats.length >= 2) {
    const midTick = totalTicks / 2;
    const firstHalfBeats = bar.beats.filter((b) => b.startTick < midTick);
    const secondHalfBeats = bar.beats.filter((b) => b.startTick >= midTick);

    if (firstHalfBeats.length > 0 && secondHalfBeats.length > 0) {
      const firstBar: SongBar = { ...bar, beats: firstHalfBeats };
      const secondBar: SongBar = { ...bar, beats: secondHalfBeats };

      const firstCands = detectBarChords(firstBar, options);
      const secondCands = detectBarChords(secondBar, options);

      if (
        firstCands.length > 0 &&
        secondCands.length > 0 &&
        (firstCands[0]!.value.root !== secondCands[0]!.value.root ||
          firstCands[0]!.value.quality !== secondCands[0]!.value.quality)
      ) {
        splitChords = {
          firstHalf: firstCands,
          secondHalf: secondCands,
        };
      }
    }
  }

  // Comprobar override manual
  let primaryChord: ChordRef | null = null;
  let hasOverride = false;

  if (options?.override?.chordId) {
    const parsed = parseChordSymbol(options.override.chordId);
    if (parsed) {
      primaryChord = {
        root: parsed.root,
        quality: parsed.quality,
        name: chordDisplayName(parsed, mode),
      };
      hasOverride = true;
      splitChords = undefined; // Override manual prevalece y fija el acorde del compás
    }
  }

  if (!primaryChord && candidates.length > 0) {
    primaryChord = candidates[0]!.value;
  }

  let annotatedChord: string | undefined = options?.annotatedChord;
  if (!annotatedChord) {
    for (const b of bar.beats) {
      if (b.chordAnnotation) {
        annotatedChord = b.chordAnnotation;
        break;
      }
    }
  }

  // Segmentos armónicos proporcionales dentro del compás (plan_fase3.md §7 C8)
  const segments: BarChordSegment[] = [];

  if (hasOverride && primaryChord) {
    segments.push({
      startTick: 0,
      durationTicks: totalTicks,
      durationRatio: 1,
      startBeatIndex: 0,
      chord: primaryChord,
      candidates,
      hasOverride: true,
    });
  } else {
    // 1. Detectar si el compás contiene anotaciones explícitas de acordes en los pulsos
    interface AnnotationGroup {
      text: string;
      startTick: number;
      durationTicks: number;
      startBeatIndex: number;
      beats: SongBeat[];
    }
    const annotationGroups: AnnotationGroup[] = [];
    let currentGroup: AnnotationGroup | null = null;

    for (let bi = 0; bi < bar.beats.length; bi++) {
      const b = bar.beats[bi]!;
      if (b.chordAnnotation) {
        if (!currentGroup || currentGroup.text !== b.chordAnnotation) {
          if (currentGroup) {
            annotationGroups.push(currentGroup);
          }
          currentGroup = {
            text: b.chordAnnotation,
            startTick: b.startTick,
            durationTicks: b.durationTicks,
            startBeatIndex: bi,
            beats: [b],
          };
        } else {
          currentGroup.durationTicks += b.durationTicks;
          currentGroup.beats.push(b);
        }
      } else if (currentGroup) {
        currentGroup.durationTicks += b.durationTicks;
        currentGroup.beats.push(b);
      }
    }
    if (currentGroup) {
      annotationGroups.push(currentGroup);
    }

    if (annotationGroups.length > 0 && totalTicks > 0) {
      for (const grp of annotationGroups) {
        const parsed = parseChordSymbol(grp.text);
        let segmentChord: ChordRef;
        let segmentCandidates: Candidate<ChordRef>[];

        if (parsed) {
          segmentChord = {
            root: parsed.root,
            quality: parsed.quality,
            name: chordDisplayName(parsed, mode),
          };
          segmentCandidates = [
            {
              value: segmentChord,
              score: 100,
              reasons: [{ code: 'annotatedInScore', params: { text: grp.text } }],
            },
          ];
        } else {
          const subBar: SongBar = { ...bar, beats: grp.beats };
          const subCands = detectBarChords(subBar, options);
          segmentCandidates = subCands;
          segmentChord = subCands[0]?.value ?? primaryChord ?? {
            root: 0 as PitchClass,
            quality: 'maj',
            name: grp.text,
          };
        }

        segments.push({
          startTick: grp.startTick,
          durationTicks: grp.durationTicks,
          durationRatio: totalTicks > 0 ? grp.durationTicks / totalTicks : 1,
          startBeatIndex: grp.startBeatIndex,
          chord: segmentChord,
          candidates: segmentCandidates,
          isAnnotated: true,
        });
      }
    } else if (splitChords) {
      // 2. Si no hay anotaciones pero se detectaron 2 mitades claramente diferenciadas
      const midTick = totalTicks / 2;
      const firstBeats = bar.beats.filter((b) => b.startTick < midTick);
      const secondBeats = bar.beats.filter((b) => b.startTick >= midTick);
      const firstTicks = firstBeats.reduce((acc, b) => acc + b.durationTicks, 0);
      const secondTicks = secondBeats.reduce((acc, b) => acc + b.durationTicks, 0);
      const secondStartTick = secondBeats[0]?.startTick ?? midTick;
      const secondStartBeatIdx = bar.beats.findIndex((b) => b.startTick >= midTick);

      segments.push({
        startTick: 0,
        durationTicks: firstTicks,
        durationRatio: totalTicks > 0 ? firstTicks / totalTicks : 0.5,
        startBeatIndex: 0,
        chord: splitChords.firstHalf[0]!.value,
        candidates: splitChords.firstHalf,
      });

      segments.push({
        startTick: secondStartTick,
        durationTicks: secondTicks,
        durationRatio: totalTicks > 0 ? secondTicks / totalTicks : 0.5,
        startBeatIndex: secondStartBeatIdx >= 0 ? secondStartBeatIdx : 1,
        chord: splitChords.secondHalf[0]!.value,
        candidates: splitChords.secondHalf,
      });
    } else if (primaryChord) {
      // 3. Un único acorde que abarca todo el compás
      segments.push({
        startTick: 0,
        durationTicks: totalTicks,
        durationRatio: 1,
        startBeatIndex: 0,
        chord: primaryChord,
        candidates,
      });
    }
  }

  return {
    barIndex: bar.index,
    barNumber: bar.number,
    candidates,
    primaryChord,
    annotatedChord,
    hasOverride,
    segments,
    splitChords,
    weightedPcs,
    estimatedRoot,
  };
}

// ============================================================================
// 4. Estimación de tonalidad por compás con suavizado contextual (plan_fase3 §3.5)
// ============================================================================

function scaleToKeyRef(scale: ScaleRef, mode: NameMode = 'sharps'): KeyRef {
  const isMinor =
    scale.type === 'minor' ||
    scale.type === 'harmonicMinor' ||
    scale.type === 'melodicMinor' ||
    scale.type === 'dorian' ||
    scale.type === 'phrygian';

  const modeKind = isMinor ? 'minor' : 'major';
  return {
    tonic: scale.tonic,
    mode: modeKind,
    name: `${pcName(scale.tonic, mode)} ${modeKind === 'minor' ? 'menor' : 'mayor'}`,
  };
}

/**
 * Asigna la tonalidad/escala local de cada compás de la canción con suavizado
 * contextual dentro de la sección y detección de modulaciones.
 */
export function detectSongKeysByBar(
  songOrTracks: SongModel | readonly SongTrack[] | readonly SongBar[],
  options?: DetectSongKeysOptions,
): SongKeyByBar[] {
  const mode = options?.mode ?? 'sharps';

  // Obtener lista unificada de compases
  let bars: SongBar[] = [];

  if (Array.isArray(songOrTracks)) {
    if (songOrTracks.length === 0) return [];
    if ('beats' in songOrTracks[0]!) {
      bars = songOrTracks as SongBar[];
    } else {
      const tracks = songOrTracks as SongTrack[];
      const activeTracks =
        options?.trackIndex !== undefined && tracks[options.trackIndex]
          ? [tracks[options.trackIndex]!]
          : tracks;
      const barCount = Math.max(...activeTracks.map((t) => t.bars.length));
      for (let i = 0; i < barCount; i++) {
        const combined = combineBarsForIndex(activeTracks, i);
        if (combined) bars.push(combined);
      }
    }
  } else {
    const song = songOrTracks as SongModel;
    const activeTracks =
      options?.trackIndex !== undefined && song.tracks[options.trackIndex]
        ? [song.tracks[options.trackIndex]!]
        : song.tracks;
    const barCount = Math.max(...activeTracks.map((t) => t.bars.length));
    for (let i = 0; i < barCount; i++) {
      const combined = combineBarsForIndex(activeTracks, i);
      if (combined) bars.push(combined);
    }
  }

  const result: SongKeyByBar[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const section = bar.sectionMarker;

    // Ventana contextual [i-1, i+1] dentro de la misma sección
    const windowPcs = new Float64Array(12);

    for (const wp of computeBarWeightedPcs(bar)) {
      windowPcs[wp.pc] = (windowPcs[wp.pc] ?? 0) + wp.weight;
    }

    if (i > 0 && bars[i - 1]!.sectionMarker === section) {
      for (const wp of computeBarWeightedPcs(bars[i - 1]!)) {
        windowPcs[wp.pc] = (windowPcs[wp.pc] ?? 0) + wp.weight * 0.4;
      }
    }

    if (i + 1 < bars.length && bars[i + 1]!.sectionMarker === section) {
      for (const wp of computeBarWeightedPcs(bars[i + 1]!)) {
        windowPcs[wp.pc] = (windowPcs[wp.pc] ?? 0) + wp.weight * 0.4;
      }
    }

    const aggregatedNotes: WeightedPc[] = [];
    for (let pc = 0; pc < 12; pc++) {
      if (windowPcs[pc]! > 0) {
        aggregatedNotes.push({ pc: pc as PitchClass, weight: windowPcs[pc]! });
      }
    }

    // Acordes detectados en el compás
    const barChords = detectBarChords(bar, { mode });
    const chordsInput = barChords.slice(0, 3).map((c) => ({
      root: c.value.root,
      quality: c.value.quality,
    }));

    const obs = extractRootObservations(bar);
    const roots = estimateRoot(obs);
    const barRoot = roots.length > 0 ? roots[0]!.value : undefined;

    const candidates = rankScalesForFragment(
      {
        notes: aggregatedNotes,
        chords: chordsInput,
        keySignature: bar.keySignature,
        openingRoot: barRoot,
      },
      mode,
    );

    // Bono de continuidad armónica si el compás anterior está en la misma sección
    if (i > 0 && result[i - 1] && bars[i - 1]!.sectionMarker === section) {
      const prevScale = result[i - 1]!.scale;
      for (const cand of candidates) {
        if (cand.value.scale.tonic === prevScale.tonic && cand.value.scale.type === prevScale.type) {
          cand.score += 18;
        }
      }
      candidates.sort((a, b) => b.score - a.score);
    }

    // Comprobar si hay override manual de tonalidad para este compás
    const barOverride = options?.barOverrides?.[bar.number];
    let activeScale: ScaleRef;

    if (barOverride?.tonic !== undefined && barOverride.scaleId) {
      const typeId = barOverride.scaleId as ScaleTypeId;
      const scaleType = SCALE_TYPES.find((st) => st.id === typeId);
      activeScale = {
        tonic: barOverride.tonic,
        type: typeId,
        name: `${pcName(barOverride.tonic, mode)} ${scaleType?.name ?? typeId}`,
      };
    } else if (candidates.length > 0) {
      activeScale = candidates[0]!.value.scale;
    } else {
      activeScale = {
        tonic: 0 as PitchClass,
        type: 'major',
        name: `${pcName(0 as PitchClass, mode)} Mayor`,
      };
    }

    const activeKey = scaleToKeyRef(activeScale, mode);

    // Detección de modulación respecto al compás anterior
    let isModulation = false;
    if (i > 0 && result[i - 1]) {
      const prevKey = result[i - 1]!.key;
      isModulation = prevKey.tonic !== activeKey.tonic || prevKey.mode !== activeKey.mode;
    }

    result.push({
      barIndex: bar.index,
      barNumber: bar.number,
      key: activeKey,
      scale: activeScale,
      isModulation,
      candidates,
      sectionMarker: bar.sectionMarker,
    });
  }

  return result;
}

// ============================================================================
// 5. Análisis integral de fragmento (plan_fase3 §3.6 y §5.4)
// ============================================================================

/**
 * Analiza un fragmento (rango de compases) de la canción integrando detección
 * de acordes, tonalidad predominante, progresión en números romanos y overrides manuales.
 */
export function analyzeSongFragment(
  song: SongModel,
  range: [number, number] | { startBarNumber: number; endBarNumber: number },
  options?: AnalyzeSongFragmentOptions,
): SongFragmentAnalysis {
  const mode = options?.mode ?? 'sharps';

  // Normalizar rango a números de compás visibles 1..N
  let startNum: number;
  let endNum: number;

  if (Array.isArray(range)) {
    startNum = Math.min(range[0], range[1]);
    endNum = Math.max(range[0], range[1]);
  } else {
    startNum = Math.min(range.startBarNumber, range.endBarNumber);
    endNum = Math.max(range.startBarNumber, range.endBarNumber);
  }

  const activeTracks =
    options?.trackIndex !== undefined && song.tracks[options.trackIndex]
      ? [song.tracks[options.trackIndex]!]
      : song.tracks;

  const barCount = Math.max(...activeTracks.map((t) => t.bars.length));
  const clampedStart = Math.max(1, Math.min(startNum, barCount));
  const clampedEnd = Math.max(clampedStart, Math.min(endNum, barCount));

  // Obtener compases combinados en el rango
  const fragmentBars: SongBar[] = [];
  for (let n = clampedStart; n <= clampedEnd; n++) {
    const combined = combineBarsForIndex(activeTracks, n - 1);
    if (combined) fragmentBars.push(combined);
  }

  // Pesos acumulados del fragmento
  const weightedPcs = computeRangeWeightedPcs(fragmentBars);

  // Tonalidades por compás de toda la canción
  const allKeys = detectSongKeysByBar(song, options);
  const keysByBar = allKeys.filter(
    (k) => k.barNumber >= clampedStart && k.barNumber <= clampedEnd,
  );

  // Acordes de cada compás en el fragmento
  const barChords: BarChordAnalysis[] = fragmentBars.map((bar) =>
    analyzeBarChords(bar, {
      mode,
      override: options?.barOverrides?.[bar.number],
    }),
  );

  // Ranking de escalas sobre el fragmento completo
  const detectedChordsForScale = barChords
    .map((bc) => bc.primaryChord)
    .filter((c): c is ChordRef => Boolean(c))
    .map((c) => ({ root: c.root, quality: c.quality }));

  const firstBarObs = fragmentBars.length > 0 ? extractRootObservations(fragmentBars[0]!) : [];
  const lastBarObs =
    fragmentBars.length > 0
      ? extractRootObservations(fragmentBars[fragmentBars.length - 1]!)
      : [];

  const openingRoots = estimateRoot(firstBarObs);
  const closingRoots = estimateRoot(lastBarObs);

  const scaleCandidates = rankScalesForFragment(
    {
      notes: weightedPcs,
      openingRoot: openingRoots.length > 0 ? openingRoots[0]!.value : undefined,
      closingRoot: closingRoots.length > 0 ? closingRoots[0]!.value : undefined,
      chords: detectedChordsForScale,
      keySignature: fragmentBars[0]?.keySignature,
    },
    mode,
  );

  // Determinar la tonalidad y escala principal del fragmento
  let primaryScale: ScaleRef;
  const rangeOverride = options?.barOverrides?.[clampedStart];

  if (rangeOverride?.tonic !== undefined && rangeOverride.scaleId) {
    const typeId = rangeOverride.scaleId as ScaleTypeId;
    const scaleType = SCALE_TYPES.find((st) => st.id === typeId);
    primaryScale = {
      tonic: rangeOverride.tonic,
      type: typeId,
      name: `${pcName(rangeOverride.tonic, mode)} ${scaleType?.name ?? typeId}`,
    };
  } else if (scaleCandidates.length > 0) {
    primaryScale = scaleCandidates[0]!.value.scale;
  } else {
    primaryScale = {
      tonic: 0 as PitchClass,
      type: 'major',
      name: `${pcName(0 as PitchClass, mode)} Mayor`,
    };
  }

  const primaryKey = scaleToKeyRef(primaryScale, mode);

  // Análisis de progresión de acordes en números romanos
  const chordSequence: ({ root: PitchClass; quality: ChordQualityId } | null)[] = [];
  for (const bc of barChords) {
    if (!bc.hasOverride && bc.segments && bc.segments.length > 0) {
      for (const seg of bc.segments) {
        chordSequence.push({ root: seg.chord.root, quality: seg.chord.quality });
      }
    } else if (
      !bc.hasOverride &&
      bc.splitChords &&
      bc.splitChords.firstHalf.length > 0 &&
      bc.splitChords.secondHalf.length > 0
    ) {
      const c1 = bc.splitChords.firstHalf[0]!.value;
      const c2 = bc.splitChords.secondHalf[0]!.value;
      chordSequence.push({ root: c1.root, quality: c1.quality });
      chordSequence.push({ root: c2.root, quality: c2.quality });
    } else if (bc.primaryChord) {
      chordSequence.push({ root: bc.primaryChord.root, quality: bc.primaryChord.quality });
    } else {
      chordSequence.push(null);
    }
  }

  const progression = analyzeChordSequence(
    chordSequence,
    { tonic: primaryKey.tonic, type: primaryScale.type },
    mode,
  );

  return {
    range: {
      startBarNumber: clampedStart,
      endBarNumber: clampedEnd,
      startBarIndex: clampedStart - 1,
      endBarIndex: clampedEnd - 1,
    },
    weightedPcs,
    keysByBar,
    primaryKey,
    primaryScale,
    scaleCandidates,
    barChords,
    progression,
  };
}
