/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckBuilderModal } from './DeckBuilderModal';

describe('Hito A8 — DeckBuilderModal (src/ui/learn/cards/DeckBuilderModal.tsx)', () => {
  afterEach(() => {
    cleanup();
  });

  it('no renderiza nada si isOpen es false', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    const { container } = render(
      <DeckBuilderModal isOpen={false} onClose={handleClose} onSaveDeck={handleSave} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renderiza diálogo accesible con role="dialog" y aria-modal="true" cuando isOpen es true', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(<DeckBuilderModal isOpen={true} onClose={handleClose} onSaveDeck={handleSave} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('cierra el diálogo al pulsar la tecla Escape', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(<DeckBuilderModal isOpen={true} onClose={handleClose} onSaveDeck={handleSave} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('cierra el diálogo al pulsar el botón Cancelar', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(<DeckBuilderModal isOpen={true} onClose={handleClose} onSaveDeck={handleSave} />);

    fireEvent.click(screen.getByTestId('deck-builder-cancel'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('muestra el conteo en vivo de tarjetas y actualiza al añadir bloques', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(<DeckBuilderModal isOpen={true} onClose={handleClose} onSaveDeck={handleSave} />);

    const countBadge = screen.getByTestId('total-card-count');
    expect(countBadge.textContent).toContain('tarjetas');
    const initialText = countBadge.textContent;

    // Añadir bloque de intervalos
    fireEvent.click(screen.getByTestId('add-block-intervals'));
    expect(countBadge.textContent).not.toBe(initialText);
  });

  it('guarda el mazo con nombre, límites y reglas al pulsar Guardar mazo', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(<DeckBuilderModal isOpen={true} onClose={handleClose} onSaveDeck={handleSave} />);

    const nameInput = screen.getByTestId('deck-name-input');
    fireEvent.change(nameInput, { target: { value: 'Mi mazo personalizado' } });

    const newPerDayInput = screen.getByTestId('new-per-day-input');
    fireEvent.change(newPerDayInput, { target: { value: '25' } });

    const saveBtn = screen.getByTestId('deck-builder-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      name: 'Mi mazo personalizado',
      limits: { newPerDay: 25, reviewsPerDay: 200 },
      sources: expect.any(Array),
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('permite cambiar a la pestaña de mazos predefinidos y añadir uno', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    const handleAddPreset = vi.fn();

    render(
      <DeckBuilderModal
        isOpen={true}
        onClose={handleClose}
        onSaveDeck={handleSave}
        onAddPreset={handleAddPreset}
      />,
    );

    // Cambiar a la pestaña de predefinidos
    fireEvent.click(screen.getByTestId('tab-presets'));

    // Deben mostrarse los 3 predefinidos
    expect(screen.getByTestId('preset-card-beginner')).toBeDefined();
    expect(screen.getByTestId('preset-card-intermediate')).toBeDefined();
    expect(screen.getByTestId('preset-card-advanced')).toBeDefined();

    // Añadir el mazo Principiante
    fireEvent.click(screen.getByTestId('add-preset-btn-beginner'));
    expect(handleAddPreset).toHaveBeenCalledWith('beginner');
    expect(handleClose).toHaveBeenCalled();
  });
});
