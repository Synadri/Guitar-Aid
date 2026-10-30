import type { PitchClass } from '../../theory';
import type { ScaleTypeId } from '../../theory/data/scales';
import { STANDARD_TUNING } from '../../theory/data/tunings';
import {
  MOVABLE_VOICING_SHAPES,
  OPEN_VOICING_SHAPES,
} from '../../theory/data/voicings/standard';
import { positionToMidi } from '../../theory/fretboard';
import { formatCardId } from './ids';
import type {
  CardFacet,
  DeckSource,
} from './types';

const NATURAL_PITCH_CLASSES: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

const MAJOR_SCALE_MODES: readonly { modeId: ScaleTypeId; parentOffset: number }[] = [
  { modeId: 'major', parentOffset: 0 },
  { modeId: 'dorian', parentOffset: 2 },
  { modeId: 'phrygian', parentOffset: 4 },
  { modeId: 'lydian', parentOffset: 5 },
  { modeId: 'mixolydian', parentOffset: 7 },
  { modeId: 'minor', parentOffset: 9 },
  { modeId: 'locrian', parentOffset: 11 },
];

/**
 * Expande una lista declarativa de fuentes (`DeckSource[]`) en una lista materializada
 * de identificadores de tarjeta únicos (`cardIds`), conservando el orden de inserción (§6.2).
 */
export function buildDeckCardIds(sources: readonly DeckSource[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushCard = (cardId: string) => {
    if (!seen.has(cardId)) {
      seen.add(cardId);
      result.push(cardId);
    }
  };

  for (const source of sources) {
    switch (source.type) {
      case 'voicings': {
        const { qualities, families, roots, facets } = source;
        const targetRoots = roots ?? NATURAL_PITCH_CLASSES;

        if (families.includes('open')) {
          const matchingOpen = OPEN_VOICING_SHAPES.filter(
            (s) =>
              qualities.includes(s.quality) &&
              (!roots || roots.includes(s.root)),
          );
          for (const shape of matchingOpen) {
            for (const facet of facets) {
              pushCard(
                formatCardId(
                  { type: 'voicing', templateId: shape.id, root: shape.root },
                  facet,
                ),
              );
            }
          }
        }

        const movableFamilies = families.filter((f) => f !== 'open');
        if (movableFamilies.length > 0) {
          const matchingMovable = MOVABLE_VOICING_SHAPES.filter(
            (s) =>
              movableFamilies.includes(s.family) &&
              qualities.includes(s.quality),
          );
          for (const shape of matchingMovable) {
            for (const root of targetRoots) {
              for (const facet of facets) {
                pushCard(
                  formatCardId(
                    { type: 'voicing', templateId: shape.id, root },
                    facet,
                  ),
                );
              }
            }
          }
        }
        break;
      }

      case 'chords': {
        const { qualities, roots, facets } = source;
        for (const root of roots) {
          for (const quality of qualities) {
            for (const facet of facets) {
              pushCard(
                formatCardId(
                  { type: 'chord', pitchClass: root, qualityId: quality },
                  facet,
                ),
              );
            }
          }
        }
        break;
      }

      case 'qualities': {
        const { qualities, facets } = source;
        for (const quality of qualities) {
          for (const facet of facets) {
            pushCard(formatCardId({ type: 'quality', qualityId: quality }, facet));
          }
        }
        break;
      }

      case 'scales': {
        const { scaleTypes, tonics, facets } = source;
        for (const tonic of tonics) {
          for (const scaleType of scaleTypes) {
            for (const facet of facets) {
              if (facet === 'name>formula') {
                pushCard(formatCardId({ type: 'scaletype', scaleId: scaleType }, facet));
              } else {
                pushCard(
                  formatCardId(
                    { type: 'scale', tonic, scaleId: scaleType },
                    facet,
                  ),
                );
              }
            }
          }
        }
        break;
      }

      case 'scaleTypes': {
        const { scaleTypes, facets } = source;
        for (const scaleType of scaleTypes) {
          for (const facet of facets) {
            pushCard(formatCardId({ type: 'scaletype', scaleId: scaleType }, facet));
          }
        }
        break;
      }

      case 'scaleModes': {
        const { parentScale, parentTonic, facets } = source;
        const modes = parentScale === 'major' ? MAJOR_SCALE_MODES : [];
        for (const m of modes) {
          const modeTonic = ((parentTonic + m.parentOffset) % 12) as PitchClass;
          for (const facet of facets) {
            if (
              facet === 'name>formula' ||
              facet === 'formula>name' ||
              facet === 'mode>parent'
            ) {
              pushCard(
                formatCardId({ type: 'scaletype', scaleId: m.modeId }, facet),
              );
            } else {
              pushCard(
                formatCardId(
                  { type: 'scale', tonic: modeTonic, scaleId: m.modeId },
                  facet as CardFacet,
                ),
              );
            }
          }
        }
        break;
      }

      case 'degrees': {
        const { tonics, modes, degrees, chordKinds, facets } = source;
        for (const tonic of tonics) {
          for (const mode of modes) {
            for (const degree of degrees) {
              for (const chordKind of chordKinds) {
                for (const facet of facets) {
                  pushCard(
                    formatCardId(
                      { type: 'degree', tonic, mode, degree, chordKind },
                      facet,
                    ),
                  );
                }
              }
            }
          }
        }
        break;
      }

      case 'progressions': {
        const { progressionIds, tonics, facets } = source;
        for (const tonic of tonics) {
          for (const progressionId of progressionIds) {
            for (const facet of facets) {
              pushCard(
                formatCardId({ type: 'progression', progressionId, tonic }, facet),
              );
            }
          }
        }
        break;
      }

      case 'intervals': {
        const { semitones, facets } = source;
        for (const s of semitones) {
          for (const facet of facets) {
            pushCard(formatCardId({ type: 'interval', semitones: s }, facet));
          }
        }
        break;
      }

      case 'fretNotes': {
        const { strings, fretRange, naturalsOnly, facets } = source;
        const [minFret, maxFret] = fretRange;
        for (const s of strings) {
          for (let f = minFret; f <= maxFret; f++) {
            if (naturalsOnly) {
              const midi = positionToMidi(STANDARD_TUNING, { string: s, fret: f });
              const pc = (((midi % 12) + 12) % 12) as PitchClass;
              if (!NATURAL_PITCH_CLASSES.includes(pc)) continue;
            }
            for (const facet of facets) {
              pushCard(
                formatCardId({ type: 'fretnote', string: s, fret: f }, facet),
              );
            }
          }
        }
        break;
      }

      case 'stringNotes': {
        const { strings, pitchClasses, facets } = source;
        for (const s of strings) {
          for (const pc of pitchClasses) {
            for (const facet of facets) {
              pushCard(
                formatCardId({ type: 'notestring', pitchClass: pc, string: s }, facet),
              );
            }
          }
        }
        break;
      }
    }
  }

  return result;
}
