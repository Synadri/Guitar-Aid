import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING } from '../../theory/data/tunings';
import { buildDeckCardIds } from './builder';
import { resolveCard } from './facets';
import { formatCardId, isCardIdValid, parseCardId } from './ids';
import {
  ADVANCED_PRESET,
  BEGINNER_PRESET,
  createDeckFromPreset,
  INTERMEDIATE_PRESET,
  PRESET_DECKS,
} from './presets';
import type { DeckSource } from './types';

describe('Tarjetas — parser y formateador de IDs (ids.ts)', () => {
  it('formatea y parsea correctamente los 10 sujetos en sus dos sentidos', () => {
    // 1. Intervalo
    const id1 = formatCardId({ type: 'interval', semitones: 3 }, 'name>semitones');
    expect(id1).toBe('interval:3|name>semitones');
    const p1 = parseCardId(id1);
    expect(p1).not.toBeNull();
    expect(p1?.subject).toEqual({ type: 'interval', semitones: 3 });
    expect(p1?.facet).toBe('name>semitones');

    // 2. Nota en el mástil
    const id2 = formatCardId({ type: 'fretnote', string: 5, fret: 7 }, 'pos>name');
    expect(id2).toBe('fretnote:s5f7|pos>name');
    const p2 = parseCardId(id2);
    expect(p2?.subject).toEqual({ type: 'fretnote', string: 5, fret: 7 });

    // 3. Nota en una cuerda
    const id3 = formatCardId({ type: 'notestring', pitchClass: 7, string: 6 }, 'name>pos');
    expect(id3).toBe('notestring:7:s6|name>pos');
    const p3 = parseCardId(id3);
    expect(p3?.subject).toEqual({ type: 'notestring', pitchClass: 7, string: 6 });

    // 4. Calidad de acorde
    const id4 = formatCardId({ type: 'quality', qualityId: 'm7b5' }, 'name>formula');
    expect(id4).toBe('quality:m7b5|name>formula');
    const p4 = parseCardId(id4);
    expect(p4?.subject).toEqual({ type: 'quality', qualityId: 'm7b5' });

    // 5. Acorde concreto
    const id5 = formatCardId({ type: 'chord', pitchClass: 9, qualityId: 'm7' }, 'name>notes');
    expect(id5).toBe('chord:9:m7|name>notes');
    const p5 = parseCardId(id5);
    expect(p5?.subject).toEqual({ type: 'chord', pitchClass: 9, qualityId: 'm7' });

    // 6. Digitación
    const id6 = formatCardId({ type: 'voicing', templateId: 'open-C-maj', root: 0 }, 'name>shape');
    expect(id6).toBe('voicing:open-C-maj@0|name>shape');
    const p6 = parseCardId(id6);
    expect(p6?.subject).toEqual({ type: 'voicing', templateId: 'open-C-maj', root: 0 });

    // 7. Tipo de escala
    const id7 = formatCardId({ type: 'scaletype', scaleId: 'dorian' }, 'mode>parent');
    expect(id7).toBe('scaletype:dorian|mode>parent');
    const p7 = parseCardId(id7);
    expect(p7?.subject).toEqual({ type: 'scaletype', scaleId: 'dorian' });

    // 8. Escala concreta
    const id8 = formatCardId({ type: 'scale', tonic: 2, scaleId: 'dorian' }, 'name>notes');
    expect(id8).toBe('scale:2:dorian|name>notes');
    const p8 = parseCardId(id8);
    expect(p8?.subject).toEqual({ type: 'scale', tonic: 2, scaleId: 'dorian' });

    // 9. Grado en tonalidad
    const id9 = formatCardId(
      { type: 'degree', tonic: 7, mode: 'major', degree: 6, chordKind: 'triads' },
      'roman>chord',
    );
    expect(id9).toBe('degree:7:major:6:triads|roman>chord');
    const p9 = parseCardId(id9);
    expect(p9?.subject).toEqual({
      type: 'degree',
      tonic: 7,
      mode: 'major',
      degree: 6,
      chordKind: 'triads',
    });

    // 10. Progresión en tonalidad
    const id10 = formatCardId({ type: 'progression', progressionId: 'ii-V-I', tonic: 0 }, 'roman>chords');
    expect(id10).toBe('progression:ii-V-I:0|roman>chords');
    const p10 = parseCardId(id10);
    expect(p10?.subject).toEqual({ type: 'progression', progressionId: 'ii-V-I', tonic: 0 });
  });

  it('rechaza IDs mal formados o con facetas incompatibles', () => {
    expect(parseCardId('')).toBeNull();
    expect(parseCardId('invalido')).toBeNull();
    expect(parseCardId('interval:3')).toBeNull(); // sin faceta
    expect(parseCardId('interval:3|name>shape')).toBeNull(); // faceta incompatible con intervalo
    expect(parseCardId('fretnote:s7f5|pos>name')).toBeNull(); // cuerda 7 no existe
    expect(parseCardId('chord:13:maj|name>notes')).toBeNull(); // pitch class 13 inválido
    expect(isCardIdValid('voicing:open-C-maj@0|name>shape')).toBe(true);
    expect(isCardIdValid('voicing:open-C-maj@0|bad>facet')).toBe(false);
  });
});

describe('Tarjetas — resolutor de facetas (facets.ts)', () => {
  it('resuelve interval:3|name>semitones a 3ª menor → 3 semitonos', () => {
    const card = resolveCard('interval:3|name>semitones');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('3ª menor');
    expect(card?.back.title).toBe('3 semitonos');
  });

  it('resuelve fretnote:s5f7|pos>name a posición (5, 7) → E', () => {
    const card = resolveCard('fretnote:s5f7|pos>name', STANDARD_TUNING);
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('Cuerda 5, traste 7');
    expect(card?.back.title).toBe('E');
  });

  it('resuelve notestring:7:s6|name>pos a G en la 6ª → trastes 3 y 15', () => {
    const card = resolveCard('notestring:7:s6|name>pos', STANDARD_TUNING);
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('G en la 6ª cuerda');
    expect(card?.back.title).toBe('Trastes 3 y 15');
    expect(card?.back.positions).toEqual([
      { string: 6, fret: 3 },
      { string: 6, fret: 15 },
    ]);
  });

  it('resuelve quality:m7b5|name>formula a m7♭5 → 1 ♭3 ♭5 ♭7', () => {
    const card = resolveCard('quality:m7b5|name>formula');
    expect(card).not.toBeNull();
    expect(card?.back.title).toBe('1 ♭3 ♭5 ♭7');
  });

  it('resuelve chord:9:m7|name>notes a Am7 → A · C · E · G', () => {
    const card = resolveCard('chord:9:m7|name>notes');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('Am7');
    expect(card?.back.title).toBe('A · C · E · G');
  });

  it('resuelve voicing:open-C-maj@0|name>shape a C, forma abierta → x 3 2 0 1 0', () => {
    const card = resolveCard('voicing:open-C-maj@0|name>shape', STANDARD_TUNING);
    expect(card).not.toBeNull();
    expect(card?.front.title).toContain('C');
    expect(card?.back.title).toBe('x 3 2 0 1 0');
    expect(card?.back.voicingFrets).toEqual(['x', 3, 2, 0, 1, 0]);
  });

  it('resuelve scaletype:dorian|mode>parent a II grado de la escala mayor', () => {
    const card = resolveCard('scaletype:dorian|mode>parent');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('Dórico');
    expect(card?.back.title).toBe('II grado de la escala mayor');
  });

  it('resuelve scale:2:dorian|name>notes a D dórico → D · E · F · G · A · B · C', () => {
    const card = resolveCard('scale:2:dorian|name>notes');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('D dórico');
    expect(card?.back.title).toBe('D · E · F · G · A · B · C');
  });

  it('resuelve scale:2:dorian|name>parent a modo de C mayor', () => {
    const card = resolveCard('scale:2:dorian|name>parent');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('D dórico');
    expect(card?.back.title).toBe('Modo de C mayor');
  });

  it('resuelve degree:7:major:6:triads|roman>chord a vi de G mayor → Em', () => {
    const card = resolveCard('degree:7:major:6:triads|roman>chord');
    expect(card).not.toBeNull();
    expect(card?.front.title).toBe('vi de G mayor');
    expect(card?.back.title).toBe('Em');
  });

  it('resuelve progression:ii-V-I:0|roman>chords a ii–V–I en C → Dm – G – C', () => {
    const card = resolveCard('progression:ii-V-I:0|roman>chords');
    expect(card).not.toBeNull();
    expect(card?.front.title).toContain('ii–V–I');
    expect(card?.back.title).toBe('Dm – G – C');
  });

  it('omite tarjetas que no se pueden resolver en afinaciones no soportadas', () => {
    // Open G no tiene diccionario de voicings estándar directo o una plantilla inexistente
    expect(resolveCard('voicing:plantilla-inexistente@0|name>shape')).toBeNull();
    expect(resolveCard('voicing:open-C-maj@2|name>shape')).toBeNull(); // open C tiene raíz 0, no 2
  });
});

describe('Tarjetas — constructor de mazos por reglas (builder.ts)', () => {
  it('(i) el mazo de ejemplo «tríadas maj/m en open y cejilla + modos de C mayor» cumple la especificación', () => {
    const sources: DeckSource[] = [
      {
        type: 'voicings',
        qualities: ['maj', 'm'],
        families: ['open', 'barre-E', 'barre-A'],
        roots: [0, 2, 4, 5, 7, 9, 11],
        facets: ['name>shape', 'shape>name'],
      },
      {
        type: 'scaleModes',
        parentScale: 'major',
        parentTonic: 0,
        facets: ['name>notes', 'name>formula', 'name>parent'],
      },
    ];

    const cardIds = buildDeckCardIds(sources);

    // Contiene voicing:open-C-maj@0|name>shape
    expect(cardIds).toContain('voicing:open-C-maj@0|name>shape');

    // Contiene scale:2:dorian|name>notes
    expect(cardIds).toContain('scale:2:dorian|name>notes');

    // Todas las tarjetas deben originarse estrictamente de esas fuentes
    for (const id of cardIds) {
      const parsed = parseCardId(id);
      expect(parsed).not.toBeNull();

      if (parsed?.subject.type === 'voicing') {
        const shape = parsed.subject.templateId;
        const isMajOrM = shape.includes('maj') || shape.includes('m');
        expect(isMajOrM).toBe(true);
      } else if (parsed?.subject.type === 'scale') {
        expect(['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian']).toContain(
          parsed.subject.scaleId,
        );
      } else if (parsed?.subject.type === 'scaletype') {
        expect(['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian']).toContain(
          parsed.subject.scaleId,
        );
      } else {
        throw new Error(`Tarjeta inesperada que no procede de las reglas: ${id}`);
      }
    }
  });
});

describe('Tarjetas — mazos predefinidos (presets.ts)', () => {
  it('(l) existen los 3 mazos predefinidos y todos sus IDs se resuelven en afinación estándar', () => {
    expect(PRESET_DECKS).toHaveLength(3);
    expect(BEGINNER_PRESET.id).toBe('beginner');
    expect(INTERMEDIATE_PRESET.id).toBe('intermediate');
    expect(ADVANCED_PRESET.id).toBe('advanced');

    for (const preset of PRESET_DECKS) {
      const deck = createDeckFromPreset(preset, () => `test-${preset.id}`, 1000);
      expect(deck.name).toBe(preset.name);
      expect(deck.cardIds.length).toBeGreaterThan(0);
      expect(deck.limits.newPerDay).toBe(20);
      expect(deck.limits.reviewsPerDay).toBe(200);

      // Comprobar que CADA ID generado se resuelve sin errores en afinación estándar
      for (const cardId of deck.cardIds) {
        const resolved = resolveCard(cardId, STANDARD_TUNING);
        if (!resolved) {
          throw new Error(`En el mazo ${preset.name}, la tarjeta ${cardId} no se pudo resolver en afinación estándar`);
        }
        expect(resolved.id).toBe(cardId);
        expect(resolved.front.title).toBeTruthy();
        expect(resolved.back.title).toBeTruthy();
      }
    }
  });

  it('añadir un mazo predefinido crea una copia editable con progreso e ID propio', () => {
    const deck1 = createDeckFromPreset(BEGINNER_PRESET);
    const deck2 = createDeckFromPreset(BEGINNER_PRESET);

    expect(deck1.id).not.toBe(deck2.id);
    expect(deck1.cardIds).toEqual(deck2.cardIds);
  });
});
