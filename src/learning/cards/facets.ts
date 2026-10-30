import type { PitchClass } from '../../theory';
import { intervalLongName, intervalName } from '../../theory/core/interval';
import { pcName } from '../../theory/core/spelling';
import { CHORD_QUALITIES, type ChordQualityId, getChordQuality } from '../../theory/data/chords';
import { PROGRESSIONS } from '../../theory/data/progressions';
import { SCALE_TYPES, type ScaleTypeId } from '../../theory/data/scales';
import { STANDARD_TUNING, type Tuning } from '../../theory/data/tunings';
import {
  MOVABLE_VOICING_SHAPES,
  OPEN_VOICING_SHAPES,
  type SixStringFrets,
} from '../../theory/data/voicings/standard';
import {
  type FretPosition,
  type StringNumber,
  positionToMidi,
} from '../../theory/fretboard';
import { formulaOfChord, formulaOfScale } from '../../theory/formulas/formulaOf';
import { resolveMovableShape, resolveOpenShape } from '../../theory/voicings/dictionary';
import { parseCardId } from './ids';
import type {
  CardFacet,
  DegreeSubject,
  ResolvedCard,
} from './types';

// ============================================================================
// Resolutores por Sujeto (§6.1)
// ============================================================================

function resolveInterval(semitones: number, facet: CardFacet): ResolvedCard | null {
  if (semitones < 0 || semitones > 24) return null;

  const longName = intervalLongName(semitones);
  const shortName = intervalName(semitones);
  const semisText = `${semitones} ${semitones === 1 ? 'semitono' : 'semitonos'}`;

  if (facet === 'name>semitones') {
    return {
      id: `interval:${semitones}|name>semitones`,
      subject: { type: 'interval', semitones },
      facet,
      category: 'Intervalo',
      directionLabel: 'nombre → semitonos',
      front: {
        title: longName,
        subtitle: '¿Cuántos semitonos tiene este intervalo?',
      },
      back: {
        title: semisText,
        details: `${shortName} · ${semisText}`,
      },
      audioMidis: [60, 60 + semitones],
    };
  }

  if (facet === 'semitones>name') {
    return {
      id: `interval:${semitones}|semitones>name`,
      subject: { type: 'interval', semitones },
      facet,
      category: 'Intervalo',
      directionLabel: 'semitonos → nombre',
      front: {
        title: semisText,
        subtitle: '¿Qué intervalo corresponde a esta distancia?',
      },
      back: {
        title: longName,
        details: `${shortName} · ${semisText}`,
      },
      audioMidis: [60, 60 + semitones],
    };
  }

  return null;
}

function resolveFretnote(
  string: StringNumber,
  fret: number,
  facet: CardFacet,
  tuning: Tuning,
): ResolvedCard | null {
  if (string < 1 || string > 6 || fret < 0 || fret > 24) return null;

  const midi = positionToMidi(tuning, { string, fret });
  const pc = ((midi % 12) + 12) % 12 as PitchClass;
  const name = pcName(pc);
  const pos: FretPosition = { string, fret };

  if (facet === 'pos>name') {
    return {
      id: `fretnote:s${string}f${fret}|pos>name`,
      subject: { type: 'fretnote', string, fret },
      facet,
      category: 'Nota en el mástil',
      directionLabel: 'posición → nombre',
      front: {
        title: `Cuerda ${string}, traste ${fret}`,
        subtitle: '¿Qué nota suena en esta posición?',
        positions: [pos],
      },
      back: {
        title: name,
        details: `Nota ${name} (MIDI ${midi})`,
        positions: [pos],
      },
      audioMidis: [midi],
    };
  }

  if (facet === 'name>pos') {
    return {
      id: `fretnote:s${string}f${fret}|name>pos`,
      subject: { type: 'fretnote', string, fret },
      facet,
      category: 'Nota en el mástil',
      directionLabel: 'nombre → posición',
      front: {
        title: `${name} en la cuerda ${string}`,
        subtitle: '¿En qué traste se encuentra?',
      },
      back: {
        title: `Traste ${fret}`,
        details: `Cuerda ${string}, traste ${fret}`,
        positions: [pos],
      },
      audioMidis: [midi],
    };
  }

  return null;
}

function resolveNotestring(
  pitchClass: PitchClass,
  string: StringNumber,
  facet: CardFacet,
  tuning: Tuning,
): ResolvedCard | null {
  if (string < 1 || string > 6 || pitchClass < 0 || pitchClass > 11) return null;

  const name = pcName(pitchClass);
  const matchingFrets: number[] = [];

  for (let f = 0; f <= 24; f++) {
    const midi = positionToMidi(tuning, { string, fret: f });
    if ((((midi % 12) + 12) % 12) === pitchClass) {
      matchingFrets.push(f);
    }
  }

  if (matchingFrets.length === 0) return null;

  const positions: FretPosition[] = matchingFrets.map((fret) => ({ string, fret }));
  const fretsText =
    matchingFrets.length === 1
      ? `Traste ${matchingFrets[0]}`
      : `Trastes ${matchingFrets.join(' y ')}`;

  if (facet === 'name>pos') {
    return {
      id: `notestring:${pitchClass}:s${string}|name>pos`,
      subject: { type: 'notestring', pitchClass, string },
      facet,
      category: 'Nota en una cuerda',
      directionLabel: 'nombre → posición',
      front: {
        title: `${name} en la ${string}ª cuerda`,
        subtitle: '¿En qué trastes se encuentra?',
      },
      back: {
        title: fretsText,
        details: `Cuerda ${string}: ${matchingFrets.join(', ')}`,
        positions,
      },
      audioMidis: positions.map((p) => positionToMidi(tuning, p)),
    };
  }

  if (facet === 'pos>name') {
    return {
      id: `notestring:${pitchClass}:s${string}|pos>name`,
      subject: { type: 'notestring', pitchClass, string },
      facet,
      category: 'Nota en una cuerda',
      directionLabel: 'posición → nombre',
      front: {
        title: `${fretsText} en la ${string}ª cuerda`,
        subtitle: '¿Qué nota suena en estas posiciones?',
        positions,
      },
      back: {
        title: name,
        details: `Nota ${name}`,
        positions,
      },
      audioMidis: positions.map((p) => positionToMidi(tuning, p)),
    };
  }

  return null;
}

function resolveQuality(qualityId: ChordQualityId, facet: CardFacet): ResolvedCard | null {
  const quality = CHORD_QUALITIES.find((q) => q.id === qualityId);
  if (!quality) return null;

  const formulaTones = formulaOfChord({ root: 0, quality: qualityId });
  const formulaStr = formulaTones.map((t) => t.degree).join(' ');
  const degrees = formulaTones.map((t) => t.degree);
  const fullName = `${quality.name} (${quality.symbol || quality.id})`;

  if (facet === 'name>formula') {
    return {
      id: `quality:${qualityId}|name>formula`,
      subject: { type: 'quality', qualityId },
      facet,
      category: 'Calidad de acorde',
      directionLabel: 'nombre → fórmula',
      front: {
        title: fullName,
        subtitle: '¿Cuál es su fórmula de intervalos?',
      },
      back: {
        title: formulaStr,
        degrees,
        details: formulaTones.map((t) => `${t.degree} (${t.intervalLong})`).join(' · '),
      },
      sandboxContext: { chordQuality: qualityId, mode: 'chord' },
    };
  }

  if (facet === 'formula>name') {
    return {
      id: `quality:${qualityId}|formula>name`,
      subject: { type: 'quality', qualityId },
      facet,
      category: 'Calidad de acorde',
      directionLabel: 'fórmula → nombre',
      front: {
        title: formulaStr,
        subtitle: '¿Qué calidad de acorde corresponde a esta fórmula?',
      },
      back: {
        title: fullName,
        degrees,
        details: `Símbolo: ${quality.symbol || quality.id}`,
      },
      sandboxContext: { chordQuality: qualityId, mode: 'chord' },
    };
  }

  return null;
}

function resolveChord(
  pitchClass: PitchClass,
  qualityId: ChordQualityId,
  facet: CardFacet,
): ResolvedCard | null {
  const quality = CHORD_QUALITIES.find((q) => q.id === qualityId);
  if (!quality) return null;

  const rootName = pcName(pitchClass);
  const chordName = `${rootName}${quality.symbol}`;
  const formulaTones = formulaOfChord({ root: pitchClass, quality: qualityId });
  const noteNames = formulaTones.map((t) => pcName(t.pc));
  const notesStr = noteNames.join(' · ');
  const degrees = formulaTones.map((t) => t.degree);

  if (facet === 'name>notes') {
    return {
      id: `chord:${pitchClass}:${qualityId}|name>notes`,
      subject: { type: 'chord', pitchClass, qualityId },
      facet,
      category: 'Acorde',
      directionLabel: 'nombre → notas',
      front: {
        title: chordName,
        subtitle: '¿Qué notas forman este acorde?',
      },
      back: {
        title: notesStr,
        notes: noteNames,
        degrees,
        details: `${chordName} = ${notesStr}`,
      },
      sandboxContext: { root: pitchClass, chordQuality: qualityId, mode: 'chord' },
    };
  }

  if (facet === 'notes>name') {
    return {
      id: `chord:${pitchClass}:${qualityId}|notes>name`,
      subject: { type: 'chord', pitchClass, qualityId },
      facet,
      category: 'Acorde',
      directionLabel: 'notas → nombre',
      front: {
        title: notesStr,
        subtitle: '¿Qué acorde forman estas notas?',
      },
      back: {
        title: chordName,
        notes: noteNames,
        degrees,
      },
      sandboxContext: { root: pitchClass, chordQuality: qualityId, mode: 'chord' },
    };
  }

  if (facet === 'name>formula') {
    return {
      id: `chord:${pitchClass}:${qualityId}|name>formula`,
      subject: { type: 'chord', pitchClass, qualityId },
      facet,
      category: 'Acorde',
      directionLabel: 'nombre → fórmula',
      front: {
        title: chordName,
        subtitle: '¿Cuál es la fórmula de este acorde?',
      },
      back: {
        title: degrees.join(' '),
        degrees,
        notes: noteNames,
      },
      sandboxContext: { root: pitchClass, chordQuality: qualityId, mode: 'chord' },
    };
  }

  return null;
}

function resolveVoicing(
  templateId: string,
  root: PitchClass,
  facet: CardFacet,
  tuning: Tuning,
): ResolvedCard | null {
  const openShape = OPEN_VOICING_SHAPES.find((s) => s.id === templateId);
  const movableShape = MOVABLE_VOICING_SHAPES.find((s) => s.id === templateId);

  let voicing: ReturnType<typeof resolveOpenShape> | null = null;

  if (openShape) {
    if (openShape.root !== root) return null;
    try {
      voicing = resolveOpenShape(openShape, tuning);
    } catch {
      return null;
    }
  } else if (movableShape) {
    try {
      voicing = resolveMovableShape(movableShape, root, tuning);
    } catch {
      return null;
    }
  }

  if (!voicing) return null;

  // Si algún traste supera 24 o es negativo, no se puede resolver en este mástil
  const hasInvalidFret = voicing.frets.some(
    (f) => typeof f === 'number' && (f < 0 || f > 24),
  );
  if (hasInvalidFret) return null;

  const quality = getChordQuality(voicing.quality);
  const rootName = pcName(root);
  const chordName = `${rootName}${quality.symbol}`;

  const familyLabels: Record<string, string> = {
    open: 'forma abierta',
    'barre-E': 'cejilla en 6ª cuerda',
    'barre-A': 'cejilla en 5ª cuerda',
    'strings-1-4': 'cuerdas 1–4',
    'strings-1-3': 'cuerdas 1–3',
  };
  const familyLabel = familyLabels[voicing.family] ?? voicing.family;
  const fretsText = voicing.frets.join(' ');
  const noteNames = voicing.positions.map((p) => {
    const m = positionToMidi(tuning, p);
    return pcName((((m % 12) + 12) % 12) as PitchClass);
  });

  if (facet === 'name>shape') {
    return {
      id: `voicing:${templateId}@${root}|name>shape`,
      subject: { type: 'voicing', templateId, root },
      facet,
      category: 'Digitación',
      directionLabel: 'nombre → forma',
      front: {
        title: `${chordName}, ${familyLabel}`,
        subtitle: '¿Qué digitación se toca?',
      },
      back: {
        title: fretsText,
        details: `${chordName} (${familyLabel}) · Dedos: ${voicing.fingers}`,
        notes: noteNames,
        positions: voicing.positions,
        voicingFrets: voicing.frets as SixStringFrets,
      },
      audioMidis: voicing.midis,
      sandboxContext: { root, chordQuality: voicing.quality, mode: 'chord' },
    };
  }

  if (facet === 'shape>name') {
    return {
      id: `voicing:${templateId}@${root}|shape>name`,
      subject: { type: 'voicing', templateId, root },
      facet,
      category: 'Digitación',
      directionLabel: 'forma → nombre',
      front: {
        title: fretsText,
        subtitle: '¿Qué acorde representa esta digitación?',
        positions: voicing.positions,
        voicingFrets: voicing.frets as SixStringFrets,
      },
      back: {
        title: `${chordName} (${familyLabel})`,
        details: `Notas: ${noteNames.join(' · ')}`,
        notes: noteNames,
        positions: voicing.positions,
        voicingFrets: voicing.frets as SixStringFrets,
      },
      audioMidis: voicing.midis,
      sandboxContext: { root, chordQuality: voicing.quality, mode: 'chord' },
    };
  }

  return null;
}

const MAJOR_MODE_ORDINALS: Readonly<Record<string, string>> = {
  major: 'I grado de la escala mayor',
  dorian: 'II grado de la escala mayor',
  phrygian: 'III grado de la escala mayor',
  lydian: 'IV grado de la escala mayor',
  mixolydian: 'V grado de la escala mayor',
  minor: 'VI grado de la escala mayor',
  locrian: 'VII grado de la escala mayor',
};

function resolveScaletype(scaleId: ScaleTypeId, facet: CardFacet): ResolvedCard | null {
  const scale = SCALE_TYPES.find((s) => s.id === scaleId);
  if (!scale) return null;

  const formulaTones = formulaOfScale({ tonic: 0, type: scaleId });
  const formulaStr = formulaTones.map((t) => t.degree).join(' ');
  const degrees = formulaTones.map((t) => t.degree);

  if (facet === 'name>formula') {
    return {
      id: `scaletype:${scaleId}|name>formula`,
      subject: { type: 'scaletype', scaleId },
      facet,
      category: 'Tipo de escala',
      directionLabel: 'nombre → fórmula',
      front: {
        title: scale.name,
        subtitle: '¿Cuál es su fórmula de intervalos?',
      },
      back: {
        title: formulaStr,
        degrees,
        details: formulaTones.map((t) => `${t.degree} (${t.intervalLong})`).join(' · '),
      },
      sandboxContext: { scaleType: scaleId, mode: 'scale' },
    };
  }

  if (facet === 'formula>name') {
    return {
      id: `scaletype:${scaleId}|formula>name`,
      subject: { type: 'scaletype', scaleId },
      facet,
      category: 'Tipo de escala',
      directionLabel: 'fórmula → nombre',
      front: {
        title: formulaStr,
        subtitle: '¿A qué escala corresponde esta fórmula?',
      },
      back: {
        title: scale.name,
        degrees,
      },
      sandboxContext: { scaleType: scaleId, mode: 'scale' },
    };
  }

  if (facet === 'mode>parent') {
    const parentDesc =
      MAJOR_MODE_ORDINALS[scaleId] ??
      (scale.family ? `Modo de la familia ${scale.family}` : 'Escala independiente');

    return {
      id: `scaletype:${scaleId}|mode>parent`,
      subject: { type: 'scaletype', scaleId },
      facet,
      category: 'Tipo de escala',
      directionLabel: 'modo → escala madre',
      front: {
        title: scale.name,
        subtitle: '¿A qué grado y escala madre corresponde este modo?',
      },
      back: {
        title: parentDesc,
        details: `${scale.name}: ${parentDesc}`,
      },
      sandboxContext: { scaleType: scaleId, mode: 'scale' },
    };
  }

  return null;
}

function resolveScale(
  tonic: PitchClass,
  scaleId: ScaleTypeId,
  facet: CardFacet,
): ResolvedCard | null {
  const scale = SCALE_TYPES.find((s) => s.id === scaleId);
  if (!scale) return null;

  const tonicName = pcName(tonic);
  const scaleName = `${tonicName} ${scale.name.toLowerCase()}`;
  const formulaTones = formulaOfScale({ tonic, type: scaleId });
  const noteNames = formulaTones.map((t) => pcName(t.pc));
  const notesStr = noteNames.join(' · ');
  const degrees = formulaTones.map((t) => t.degree);

  if (facet === 'name>notes') {
    return {
      id: `scale:${tonic}:${scaleId}|name>notes`,
      subject: { type: 'scale', tonic, scaleId },
      facet,
      category: 'Escala',
      directionLabel: 'nombre → notas',
      front: {
        title: scaleName,
        subtitle: '¿Qué notas forman esta escala?',
      },
      back: {
        title: notesStr,
        notes: noteNames,
        degrees,
        details: `${scaleName} = ${notesStr}`,
      },
      sandboxContext: { root: tonic, scaleType: scaleId, mode: 'scale' },
    };
  }

  if (facet === 'notes>name') {
    return {
      id: `scale:${tonic}:${scaleId}|notes>name`,
      subject: { type: 'scale', tonic, scaleId },
      facet,
      category: 'Escala',
      directionLabel: 'notas → nombre',
      front: {
        title: notesStr,
        subtitle: '¿Qué escala forman estas notas?',
      },
      back: {
        title: scaleName,
        notes: noteNames,
        degrees,
      },
      sandboxContext: { root: tonic, scaleType: scaleId, mode: 'scale' },
    };
  }

  if (facet === 'name>parent') {
    const parentTonic = ((tonic - (scale.parentOffset ?? 0) + 12) % 12) as PitchClass;
    const parentName = `${pcName(parentTonic)} mayor`;
    const parentTitle = `Modo de ${parentName}`;

    return {
      id: `scale:${tonic}:${scaleId}|name>parent`,
      subject: { type: 'scale', tonic, scaleId },
      facet,
      category: 'Escala',
      directionLabel: 'nombre → escala madre',
      front: {
        title: scaleName,
        subtitle: '¿Cuál es su escala madre?',
      },
      back: {
        title: parentTitle,
        details: `${scaleName} es el ${MAJOR_MODE_ORDINALS[scaleId] ?? 'modo'} de ${parentName}`,
      },
      sandboxContext: { root: tonic, scaleType: scaleId, mode: 'scale' },
    };
  }

  if (facet === 'name>formula') {
    return {
      id: `scale:${tonic}:${scaleId}|name>formula`,
      subject: { type: 'scale', tonic, scaleId },
      facet,
      category: 'Escala',
      directionLabel: 'nombre → fórmula',
      front: {
        title: scaleName,
        subtitle: '¿Cuál es su fórmula de intervalos?',
      },
      back: {
        title: degrees.join(' '),
        degrees,
        notes: noteNames,
      },
      sandboxContext: { root: tonic, scaleType: scaleId, mode: 'scale' },
    };
  }

  return null;
}

const MAJOR_TRIAD_DEGREES: readonly { roman: string; offset: number; quality: ChordQualityId }[] = [
  { roman: 'I', offset: 0, quality: 'maj' },
  { roman: 'ii', offset: 2, quality: 'm' },
  { roman: 'iii', offset: 4, quality: 'm' },
  { roman: 'IV', offset: 5, quality: 'maj' },
  { roman: 'V', offset: 7, quality: 'maj' },
  { roman: 'vi', offset: 9, quality: 'm' },
  { roman: 'vii°', offset: 11, quality: 'dim' },
];

const MAJOR_SEVENTH_DEGREES: readonly { roman: string; offset: number; quality: ChordQualityId }[] = [
  { roman: 'Imaj7', offset: 0, quality: 'maj7' },
  { roman: 'ii7', offset: 2, quality: 'm7' },
  { roman: 'iii7', offset: 4, quality: 'm7' },
  { roman: 'IVmaj7', offset: 5, quality: 'maj7' },
  { roman: 'V7', offset: 7, quality: '7' },
  { roman: 'vi7', offset: 9, quality: 'm7' },
  { roman: 'viiø7', offset: 11, quality: 'm7b5' },
];

const MINOR_TRIAD_DEGREES: readonly { roman: string; offset: number; quality: ChordQualityId }[] = [
  { roman: 'i', offset: 0, quality: 'm' },
  { roman: 'ii°', offset: 2, quality: 'dim' },
  { roman: '♭III', offset: 3, quality: 'maj' },
  { roman: 'iv', offset: 5, quality: 'm' },
  { roman: 'v', offset: 7, quality: 'm' },
  { roman: '♭VI', offset: 8, quality: 'maj' },
  { roman: '♭VII', offset: 10, quality: 'maj' },
];

const MINOR_SEVENTH_DEGREES: readonly { roman: string; offset: number; quality: ChordQualityId }[] = [
  { roman: 'i7', offset: 0, quality: 'm7' },
  { roman: 'iiø7', offset: 2, quality: 'm7b5' },
  { roman: '♭IIImaj7', offset: 3, quality: 'maj7' },
  { roman: 'iv7', offset: 5, quality: 'm7' },
  { roman: 'v7', offset: 7, quality: 'm7' },
  { roman: '♭VImaj7', offset: 8, quality: 'maj7' },
  { roman: '♭VII7', offset: 10, quality: '7' },
];

function resolveDegree(
  subject: DegreeSubject,
  facet: CardFacet,
): ResolvedCard | null {
  const { tonic, mode, degree, chordKind } = subject;
  if (degree < 1 || degree > 7) return null;

  const table =
    mode === 'major'
      ? chordKind === 'triads'
        ? MAJOR_TRIAD_DEGREES
        : MAJOR_SEVENTH_DEGREES
      : chordKind === 'triads'
        ? MINOR_TRIAD_DEGREES
        : MINOR_SEVENTH_DEGREES;

  const entry = table[degree - 1];
  if (!entry) return null;

  const chordRoot = ((tonic + entry.offset) % 12) as PitchClass;
  const quality = getChordQuality(entry.quality);
  const chordName = `${pcName(chordRoot)}${quality.symbol}`;
  const tonicName = pcName(tonic);
  const modeName = mode === 'major' ? 'mayor' : 'menor';

  if (facet === 'roman>chord') {
    return {
      id: `degree:${tonic}:${mode}:${degree}:${chordKind}|roman>chord`,
      subject,
      facet,
      category: 'Grado en tonalidad',
      directionLabel: 'romano → acorde',
      front: {
        title: `${entry.roman} de ${tonicName} ${modeName}`,
        subtitle: '¿Qué acorde corresponde a este grado diatónico?',
      },
      back: {
        title: chordName,
        details: `Fundamental: ${pcName(chordRoot)} · Grado ${degree} (${modeName})`,
      },
      sandboxContext: { root: chordRoot, chordQuality: entry.quality, mode: 'chord' },
    };
  }

  if (facet === 'chord>roman') {
    return {
      id: `degree:${tonic}:${mode}:${degree}:${chordKind}|chord>roman`,
      subject,
      facet,
      category: 'Grado en tonalidad',
      directionLabel: 'acorde → romano',
      front: {
        title: `${chordName} (en ${tonicName} ${modeName})`,
        subtitle: '¿Qué número romano representa?',
      },
      back: {
        title: entry.roman,
        details: `${entry.roman} de ${tonicName} ${modeName}`,
      },
      sandboxContext: { root: chordRoot, chordQuality: entry.quality, mode: 'chord' },
    };
  }

  return null;
}

function resolveProgression(
  progressionId: string,
  tonic: PitchClass,
  facet: CardFacet,
): ResolvedCard | null {
  const template = PROGRESSIONS.find((p) => p.id === progressionId);
  if (!template) return null;

  const tonicName = pcName(tonic);
  const stepNames: string[] = [];

  for (const step of template.steps) {
    const stepRoot = ((tonic + step.offset) % 12) as PitchClass;
    const quality = getChordQuality(step.quality);
    stepNames.push(`${pcName(stepRoot)}${quality.symbol}`);
  }

  const chordsStr = stepNames.join(' – ');
  const romansStr = template.steps.map((s) => s.roman).join('–');

  if (facet === 'roman>chords') {
    return {
      id: `progression:${progressionId}:${tonic}|roman>chords`,
      subject: { type: 'progression', progressionId: template.id, tonic },
      facet,
      category: 'Progresión en tonalidad',
      directionLabel: 'romanos → acordes',
      front: {
        title: `${romansStr} en ${tonicName}`,
        subtitle: '¿Qué acordes forman esta progresión?',
      },
      back: {
        title: chordsStr,
        notes: stepNames,
        details: `${romansStr} en ${tonicName} = ${chordsStr}`,
      },
    };
  }

  if (facet === 'chords>roman') {
    return {
      id: `progression:${progressionId}:${tonic}|chords>roman`,
      subject: { type: 'progression', progressionId: template.id, tonic },
      facet,
      category: 'Progresión en tonalidad',
      directionLabel: 'acordes → romanos',
      front: {
        title: `${chordsStr} (en ${tonicName})`,
        subtitle: '¿Qué progresión en números romanos representa?',
      },
      back: {
        title: romansStr,
        notes: stepNames,
        details: `${chordsStr} = ${romansStr}`,
      },
    };
  }

  return null;
}

// ============================================================================
// Resolutor Principal (§6.1)
// ============================================================================

/**
 * Resuelve una tarjeta a partir de su ID estable y la afinación actual.
 * Devuelve `null` si el ID es sintácticamente inválido o si no se puede resolver
 * en la afinación especificada (p. ej. afinaciones sin digitaciones en el catálogo).
 */
export function resolveCard(
  cardId: string,
  tuning: Tuning = STANDARD_TUNING,
): ResolvedCard | null {
  const parsed = parseCardId(cardId);
  if (!parsed) return null;

  const { subject, facet } = parsed;

  switch (subject.type) {
    case 'interval':
      return resolveInterval(subject.semitones, facet);
    case 'fretnote':
      return resolveFretnote(subject.string, subject.fret, facet, tuning);
    case 'notestring':
      return resolveNotestring(subject.pitchClass, subject.string, facet, tuning);
    case 'quality':
      return resolveQuality(subject.qualityId, facet);
    case 'chord':
      return resolveChord(subject.pitchClass, subject.qualityId, facet);
    case 'voicing':
      return resolveVoicing(subject.templateId, subject.root, facet, tuning);
    case 'scaletype':
      return resolveScaletype(subject.scaleId, facet);
    case 'scale':
      return resolveScale(subject.tonic, subject.scaleId, facet);
    case 'degree':
      return resolveDegree(subject, facet);
    case 'progression':
      return resolveProgression(subject.progressionId, subject.tonic, facet);
    default:
      return null;
  }
}
