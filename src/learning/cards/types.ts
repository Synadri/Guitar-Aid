import type { PitchClass } from '../../theory';
import type { ChordQualityId } from '../../theory/data/chords';
import type { ProgressionId } from '../../theory/data/progressions';
import type { ScaleTypeId } from '../../theory/data/scales';
import type { SixStringFrets, VoicingFamily } from '../../theory/data/voicings/standard';
import type { FretPosition, StringNumber } from '../../theory/fretboard';

// ============================================================================
// 1. Sujetos y Facetas de Tarjeta (§6.1)
// ============================================================================

export type IntervalFacet = 'name>semitones' | 'semitones>name';
export type FretnoteFacet = 'pos>name' | 'name>pos';
export type NotestringFacet = 'name>pos' | 'pos>name';
export type QualityFacet = 'name>formula' | 'formula>name';
export type ChordFacet = 'name>notes' | 'notes>name' | 'name>formula';
export type VoicingFacet = 'name>shape' | 'shape>name';
export type ScaletypeFacet = 'name>formula' | 'formula>name' | 'mode>parent';
export type ScaleFacet = 'name>notes' | 'notes>name' | 'name>parent' | 'name>formula';
export type DegreeFacet = 'roman>chord' | 'chord>roman';
export type ProgressionFacet = 'roman>chords' | 'chords>roman';

export type CardFacet =
  | IntervalFacet
  | FretnoteFacet
  | NotestringFacet
  | QualityFacet
  | ChordFacet
  | VoicingFacet
  | ScaletypeFacet
  | ScaleFacet
  | DegreeFacet
  | ProgressionFacet;

export interface IntervalSubject {
  type: 'interval';
  semitones: number;
}

export interface FretnoteSubject {
  type: 'fretnote';
  string: StringNumber;
  fret: number;
}

export interface NotestringSubject {
  type: 'notestring';
  pitchClass: PitchClass;
  string: StringNumber;
}

export interface QualitySubject {
  type: 'quality';
  qualityId: ChordQualityId;
}

export interface ChordSubject {
  type: 'chord';
  pitchClass: PitchClass;
  qualityId: ChordQualityId;
}

export interface VoicingSubject {
  type: 'voicing';
  templateId: string;
  root: PitchClass;
}

export interface ScaletypeSubject {
  type: 'scaletype';
  scaleId: ScaleTypeId;
}

export interface ScaleSubject {
  type: 'scale';
  tonic: PitchClass;
  scaleId: ScaleTypeId;
}

export interface DegreeSubject {
  type: 'degree';
  tonic: PitchClass;
  mode: 'major' | 'minor';
  degree: number; // 1..7
  chordKind: 'triads' | 'sevenths';
}

export interface ProgressionSubject {
  type: 'progression';
  progressionId: ProgressionId;
  tonic: PitchClass;
}

export type CardSubject =
  | IntervalSubject
  | FretnoteSubject
  | NotestringSubject
  | QualitySubject
  | ChordSubject
  | VoicingSubject
  | ScaletypeSubject
  | ScaleSubject
  | DegreeSubject
  | ProgressionSubject;

export type CardSubjectType = CardSubject['type'];

export interface ParsedCard {
  cardId: string;
  subjectStr: string;
  facetStr: string;
  subject: CardSubject;
  facet: CardFacet;
}

// ============================================================================
// 2. Tarjeta Resuelta (para renderizado y audio)
// ============================================================================

export interface ResolvedCardSide {
  title: string;
  subtitle?: string;
  details?: string;
  notes?: readonly string[];
  degrees?: readonly string[];
  positions?: readonly FretPosition[];
  voicingFrets?: SixStringFrets;
}

export interface ResolvedCardSandboxContext {
  root?: PitchClass;
  chordQuality?: ChordQualityId;
  scaleType?: ScaleTypeId;
  mode?: 'chord' | 'scale';
}

export interface ResolvedCard {
  id: string;
  subject: CardSubject;
  facet: CardFacet;
  category: string;
  directionLabel: string;
  front: ResolvedCardSide;
  back: ResolvedCardSide;
  audioMidis?: readonly number[];
  sandboxContext?: ResolvedCardSandboxContext;
}

// ============================================================================
// 3. Reglas de Constructor de Mazos (DeckSource) (§6.2)
// ============================================================================

export interface VoicingsDeckSource {
  type: 'voicings';
  qualities: readonly ChordQualityId[];
  families: readonly VoicingFamily[];
  roots?: readonly PitchClass[];
  facets: readonly VoicingFacet[];
}

export interface ChordsDeckSource {
  type: 'chords';
  qualities: readonly ChordQualityId[];
  roots: readonly PitchClass[];
  facets: readonly ChordFacet[];
}

export interface QualitiesDeckSource {
  type: 'qualities';
  qualities: readonly ChordQualityId[];
  facets: readonly QualityFacet[];
}

export interface ScalesDeckSource {
  type: 'scales';
  scaleTypes: readonly ScaleTypeId[];
  tonics: readonly PitchClass[];
  facets: readonly ScaleFacet[];
}

export interface ScaleTypesDeckSource {
  type: 'scaleTypes';
  scaleTypes: readonly ScaleTypeId[];
  facets: readonly ScaletypeFacet[];
}

export interface ScaleModesDeckSource {
  type: 'scaleModes';
  parentScale: 'major' | 'harmonicMinor' | 'melodicMinor';
  parentTonic: PitchClass;
  facets: readonly (ScaleFacet | ScaletypeFacet)[];
}

export interface DegreesDeckSource {
  type: 'degrees';
  tonics: readonly PitchClass[];
  modes: readonly ('major' | 'minor')[];
  degrees: readonly number[];
  chordKinds: readonly ('triads' | 'sevenths')[];
  facets: readonly DegreeFacet[];
}

export interface ProgressionsDeckSource {
  type: 'progressions';
  progressionIds: readonly ProgressionId[];
  tonics: readonly PitchClass[];
  facets: readonly ProgressionFacet[];
}

export interface IntervalsDeckSource {
  type: 'intervals';
  semitones: readonly number[];
  facets: readonly IntervalFacet[];
}

export interface FretNotesDeckSource {
  type: 'fretNotes';
  strings: readonly StringNumber[];
  fretRange: readonly [number, number];
  naturalsOnly?: boolean;
  facets: readonly FretnoteFacet[];
}

export interface StringNotesDeckSource {
  type: 'stringNotes';
  strings: readonly StringNumber[];
  pitchClasses: readonly PitchClass[];
  facets: readonly NotestringFacet[];
}

export type DeckSource =
  | VoicingsDeckSource
  | ChordsDeckSource
  | QualitiesDeckSource
  | ScalesDeckSource
  | ScaleTypesDeckSource
  | ScaleModesDeckSource
  | DegreesDeckSource
  | ProgressionsDeckSource
  | IntervalsDeckSource
  | FretNotesDeckSource
  | StringNotesDeckSource;

// ============================================================================
// 4. Mazo y Mazos Predefinidos (§6.2, §6.4)
// ============================================================================

export interface DeckLimits {
  newPerDay: number;
  reviewsPerDay: number;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  sources: readonly DeckSource[];
  cardIds: readonly string[];
  limits: DeckLimits;
  createdAt: number;
}

export interface DeckPreset {
  id: 'beginner' | 'intermediate' | 'advanced';
  name: string;
  description: string;
  sources: readonly DeckSource[];
  limits: DeckLimits;
}
