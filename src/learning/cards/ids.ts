import type { PitchClass } from '../../theory';
import type { ChordQualityId } from '../../theory/data/chords';
import type { ProgressionId } from '../../theory/data/progressions';
import type { ScaleTypeId } from '../../theory/data/scales';
import type { StringNumber } from '../../theory/fretboard';
import type {
  CardFacet,
  CardSubject,
  ParsedCard,
} from './types';

/**
 * Formatea un sujeto y una faceta en un identificador de tarjeta estable (§6.1).
 * Formato: `<sujeto>|<faceta>`
 */
export function formatCardId(subject: CardSubject, facet: CardFacet): string {
  let subjectStr = '';

  switch (subject.type) {
    case 'interval':
      subjectStr = `interval:${subject.semitones}`;
      break;
    case 'fretnote':
      subjectStr = `fretnote:s${subject.string}f${subject.fret}`;
      break;
    case 'notestring':
      subjectStr = `notestring:${subject.pitchClass}:s${subject.string}`;
      break;
    case 'quality':
      subjectStr = `quality:${subject.qualityId}`;
      break;
    case 'chord':
      subjectStr = `chord:${subject.pitchClass}:${subject.qualityId}`;
      break;
    case 'voicing':
      subjectStr = `voicing:${subject.templateId}@${subject.root}`;
      break;
    case 'scaletype':
      subjectStr = `scaletype:${subject.scaleId}`;
      break;
    case 'scale':
      subjectStr = `scale:${subject.tonic}:${subject.scaleId}`;
      break;
    case 'degree':
      subjectStr = `degree:${subject.tonic}:${subject.mode}:${subject.degree}:${subject.chordKind}`;
      break;
    case 'progression':
      subjectStr = `progression:${subject.progressionId}:${subject.tonic}`;
      break;
  }

  return `${subjectStr}|${facet}`;
}

const VALID_FACETS_BY_SUBJECT: Readonly<Record<CardSubject['type'], readonly CardFacet[]>> = {
  interval: ['name>semitones', 'semitones>name'],
  fretnote: ['pos>name', 'name>pos'],
  notestring: ['name>pos', 'pos>name'],
  quality: ['name>formula', 'formula>name'],
  chord: ['name>notes', 'notes>name', 'name>formula'],
  voicing: ['name>shape', 'shape>name'],
  scaletype: ['name>formula', 'formula>name', 'mode>parent'],
  scale: ['name>notes', 'notes>name', 'name>parent', 'name>formula'],
  degree: ['roman>chord', 'chord>roman'],
  progression: ['roman>chords', 'chords>roman'],
};

/**
 * Parsea un identificador de tarjeta en su sujeto estructurado y faceta.
 * Devuelve `null` si el formato o alguno de los parámetros es inválido.
 */
export function parseCardId(cardId: string): ParsedCard | null {
  if (typeof cardId !== 'string') return null;

  const parts = cardId.split('|');
  if (parts.length !== 2) return null;

  const [subjectStr, facetStr] = parts as [string, string];
  if (!subjectStr || !facetStr) return null;

  // 1. interval:<semitonos>
  const intervalMatch = subjectStr.match(/^interval:(\d+)$/);
  if (intervalMatch) {
    const semitones = parseInt(intervalMatch[1]!, 10);
    const subject: CardSubject = { type: 'interval', semitones };
    if (!VALID_FACETS_BY_SUBJECT.interval.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 2. fretnote:s<c>f<t>
  const fretnoteMatch = subjectStr.match(/^fretnote:s([1-6])f(\d+)$/);
  if (fretnoteMatch) {
    const string = parseInt(fretnoteMatch[1]!, 10) as StringNumber;
    const fret = parseInt(fretnoteMatch[2]!, 10);
    const subject: CardSubject = { type: 'fretnote', string, fret };
    if (!VALID_FACETS_BY_SUBJECT.fretnote.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 3. notestring:<pc>:s<c>
  const notestringMatch = subjectStr.match(/^notestring:(\d+):s([1-6])$/);
  if (notestringMatch) {
    const pc = parseInt(notestringMatch[1]!, 10);
    if (pc < 0 || pc > 11) return null;
    const string = parseInt(notestringMatch[2]!, 10) as StringNumber;
    const subject: CardSubject = { type: 'notestring', pitchClass: pc as PitchClass, string };
    if (!VALID_FACETS_BY_SUBJECT.notestring.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 4. quality:<id>
  const qualityMatch = subjectStr.match(/^quality:([a-zA-Z0-9#]+)$/);
  if (qualityMatch) {
    const qualityId = qualityMatch[1]! as ChordQualityId;
    const subject: CardSubject = { type: 'quality', qualityId };
    if (!VALID_FACETS_BY_SUBJECT.quality.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 5. chord:<pc>:<id>
  const chordMatch = subjectStr.match(/^chord:(\d+):([a-zA-Z0-9#]+)$/);
  if (chordMatch) {
    const pc = parseInt(chordMatch[1]!, 10);
    if (pc < 0 || pc > 11) return null;
    const qualityId = chordMatch[2]! as ChordQualityId;
    const subject: CardSubject = { type: 'chord', pitchClass: pc as PitchClass, qualityId };
    if (!VALID_FACETS_BY_SUBJECT.chord.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 6. voicing:<plantilla>@<pc>
  const voicingMatch = subjectStr.match(/^voicing:([^@]+)@(\d+)$/);
  if (voicingMatch) {
    const templateId = voicingMatch[1]!;
    const pc = parseInt(voicingMatch[2]!, 10);
    if (pc < 0 || pc > 11) return null;
    const subject: CardSubject = { type: 'voicing', templateId, root: pc as PitchClass };
    if (!VALID_FACETS_BY_SUBJECT.voicing.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 7. scaletype:<id>
  const scaletypeMatch = subjectStr.match(/^scaletype:([a-zA-Z0-9]+)$/);
  if (scaletypeMatch) {
    const scaleId = scaletypeMatch[1]! as ScaleTypeId;
    const subject: CardSubject = { type: 'scaletype', scaleId };
    if (!VALID_FACETS_BY_SUBJECT.scaletype.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 8. scale:<pc>:<id>
  const scaleMatch = subjectStr.match(/^scale:(\d+):([a-zA-Z0-9]+)$/);
  if (scaleMatch) {
    const pc = parseInt(scaleMatch[1]!, 10);
    if (pc < 0 || pc > 11) return null;
    const scaleId = scaleMatch[2]! as ScaleTypeId;
    const subject: CardSubject = { type: 'scale', tonic: pc as PitchClass, scaleId };
    if (!VALID_FACETS_BY_SUBJECT.scale.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 9. degree:<pc>:<modo>:<grado>:<triads|sevenths>
  const degreeMatch = subjectStr.match(/^degree:(\d+):(major|minor):([1-7]):(triads|sevenths)$/);
  if (degreeMatch) {
    const pc = parseInt(degreeMatch[1]!, 10);
    if (pc < 0 || pc > 11) return null;
    const mode = degreeMatch[2]! as 'major' | 'minor';
    const degree = parseInt(degreeMatch[3]!, 10);
    const chordKind = degreeMatch[4]! as 'triads' | 'sevenths';
    const subject: CardSubject = {
      type: 'degree',
      tonic: pc as PitchClass,
      mode,
      degree,
      chordKind,
    };
    if (!VALID_FACETS_BY_SUBJECT.degree.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  // 10. progression:<id>:<pc>
  const progressionMatch = subjectStr.match(/^progression:([^:]+):(\d+)$/);
  if (progressionMatch) {
    const progressionId = progressionMatch[1]! as ProgressionId;
    const pc = parseInt(progressionMatch[2]!, 10);
    if (pc < 0 || pc > 11) return null;
    const subject: CardSubject = {
      type: 'progression',
      progressionId,
      tonic: pc as PitchClass,
    };
    if (!VALID_FACETS_BY_SUBJECT.progression.includes(facetStr as CardFacet)) return null;
    return { cardId, subjectStr, facetStr, subject, facet: facetStr as CardFacet };
  }

  return null;
}

/** Comprueba si un string corresponde a un ID de tarjeta válido. */
export function isCardIdValid(cardId: string): boolean {
  return parseCardId(cardId) !== null;
}
