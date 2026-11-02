// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { SongExportDeckModal } from './SongExportDeckModal';
import {
  createDecksStore,
  type DecksStore,
} from '../../state/decks';
import {
  analyzeSongFragment,
  loadPresetSongModel,
  PRESET_POP_DIATONIC,
} from '../../song';
import { resolveCard } from '../../learning/cards/facets';
import type { StoreApi } from 'zustand/vanilla';

describe('SongExportDeckModal — Hito C9 (Exportación a mazo SRS y Criterio n)', () => {
  afterEach(() => {
    cleanup();
  });

  function setupModal(isOpen = true, customDecksStore?: StoreApi<DecksStore>) {
    const song = loadPresetSongModel(PRESET_POP_DIATONIC.id);
    const fragment = analyzeSongFragment(song, [1, 4]);

    const decksStore: StoreApi<DecksStore> =
      customDecksStore ??
      createDecksStore({
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      });

    const onClose = vi.fn();
    const onDeckCreated = vi.fn();

    const utils = render(
      <SongExportDeckModal
        isOpen={isOpen}
        onClose={onClose}
        fragment={fragment}
        song={song}
        decksStore={decksStore}
        onDeckCreated={onDeckCreated}
      />,
    );

    return {
      ...utils,
      song,
      fragment,
      decksStore,
      onClose,
      onDeckCreated,
    };
  }

  it('no renderiza nada cuando isOpen es false', () => {
    const { queryByTestId } = setupModal(false);
    expect(queryByTestId('song-export-deck-modal')).toBeNull();
  });

  it('renderiza la estructura completa del modal cuando está abierto', () => {
    const { getByTestId, getByText } = setupModal(true);
    expect(getByTestId('song-export-deck-modal')).toBeTruthy();
    expect(getByText('Crear o añadir a mazo SRS')).toBeTruthy();
    expect(getByText(/Pop Diatónico en C\/Am/i)).toBeTruthy();
  });

  it('muestra el nombre sugerido predeterminado del mazo', () => {
    const { getByLabelText } = setupModal(true);
    const input = getByLabelText('Nombre del nuevo mazo') as HTMLInputElement;
    expect(input.value).toContain('Canción: Pop Diatónico en C/Am');
    expect(input.value).toContain('Intro');
  });

  it('calcula y muestra en vivo el número de tarjetas generadas', () => {
    const { getByTestId } = setupModal(true);
    const countEl = getByTestId('preview-card-count');
    expect(countEl.textContent).toContain('tarjetas');
    expect(parseInt(countEl.textContent ?? '0', 10)).toBeGreaterThan(0);
  });

  it('permite conmutar checkboxes de contenido y recalcula las tarjetas en vivo', () => {
    const { getByLabelText, getByTestId } = setupModal(true);
    const chordsCheckbox = getByLabelText(/Tarjetas de acordes/i) as HTMLInputElement;
    expect(chordsCheckbox.checked).toBe(true);

    const initialCount = parseInt(getByTestId('preview-card-count').textContent ?? '0', 10);

    // Desmarcar acordes
    fireEvent.click(chordsCheckbox);
    expect(chordsCheckbox.checked).toBe(false);

    const updatedCount = parseInt(getByTestId('preview-card-count').textContent ?? '0', 10);
    // Debe haber menos tarjetas pero seguir habiendo de voicings/escalas
    expect(updatedCount).toBeLessThan(initialCount);
    expect(updatedCount).toBeGreaterThan(0);
  });

  it('(Criterio n) Crear mazo genera un mazo válido en decksStore cuyas tarjetas se resuelven al 100 % sin errores', () => {
    const { getByTestId, decksStore, onDeckCreated } = setupModal(true);

    const initialDecksCount = decksStore.getState().decks.length;

    // Pulsar botón de crear mazo
    const confirmBtn = getByTestId('confirm-export-deck-btn');
    fireEvent.click(confirmBtn);

    // Verificamos que se creó el mazo en decksStore
    const decks = decksStore.getState().decks;
    expect(decks.length).toBe(initialDecksCount + 1);

    const createdDeck = decks[decks.length - 1]!;
    expect(createdDeck.name).toContain('Pop Diatónico en C/Am');
    expect(createdDeck.sources.length).toBeGreaterThan(0);
    expect(createdDeck.cardIds.length).toBeGreaterThan(0);

    // Verificamos Criterio (n): CADA tarjeta generada se resuelve al 100 % con resolveCard sin lanzar error
    for (const cardId of createdDeck.cardIds) {
      const card = resolveCard(cardId);
      expect(card).not.toBeNull();
      expect(card!.id).toBe(cardId);
      expect(card!.front).toBeDefined();
      expect(card!.back).toBeDefined();
      expect(card!.directionLabel.length).toBeGreaterThan(0);
    }

    expect(onDeckCreated).toHaveBeenCalledWith(createdDeck.id);
  });

  it('permite añadir fuentes a un mazo existente', () => {
    const preStore = createDecksStore({
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });

    // Crear un mazo inicial en preStore antes de montar el modal
    const existingDeck = preStore.getState().createDeck({
      name: 'Mi Mazo de Estudio',
      sources: [],
    });
    const initialSourcesCount = existingDeck.sources.length;

    const { getByLabelText, getByTestId, decksStore, onDeckCreated } = setupModal(true, preStore);

    // Cambiar a opción "Añadir a un mazo existente"
    const existingRadio = getByLabelText(/Añadir a un mazo existente/i);
    fireEvent.click(existingRadio);

    // Seleccionar el mazo en el desplegable
    const select = getByLabelText('Seleccionar mazo de destino') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: existingDeck.id } });

    // Confirmar
    const confirmBtn = getByTestId('confirm-export-deck-btn');
    fireEvent.click(confirmBtn);

    // Verificamos que el mazo existente tiene ahora las nuevas fuentes y tarjetas
    const updated = decksStore.getState().decks.find((d) => d.id === existingDeck.id)!;
    expect(updated.sources.length).toBeGreaterThan(initialSourcesCount);
    expect(updated.cardIds.length).toBeGreaterThan(0);
    expect(onDeckCreated).toHaveBeenCalledWith(existingDeck.id);
  });

  it('cierra el modal al pulsar Cancelar o el botón de cierre ✕', () => {
    const { getByText, getByLabelText, onClose } = setupModal(true);

    const closeBtn = getByLabelText('Cerrar ventana');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const cancelBtn = getByText('Cancelar');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cierra el modal al pulsar la tecla Escape', () => {
    const { onClose } = setupModal(true);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
