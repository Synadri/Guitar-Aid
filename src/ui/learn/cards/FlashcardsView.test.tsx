/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDecksStore,
  createSandboxStore,
  createSettingsStore,
  createMemoryStorage,
} from '../../../state';
import type { AudioEngine } from '../../../audio';
import { FlashcardsView } from './FlashcardsView';
import { LearnView } from '../LearnView';

function createMockAudioEngine(): AudioEngine {
  return {
    playNote: vi.fn(),
    playEvents: vi.fn().mockReturnValue([]),
    stopAll: vi.fn(),
    setSoundEnabled: vi.fn(),
    isSoundEnabled: vi.fn().mockReturnValue(true),
    setVolume: vi.fn(),
    getVolume: vi.fn().mockReturnValue(0.7),
    getActiveVoiceCount: vi.fn().mockReturnValue(0),
  };
}

describe('Hito A8 — UI: Tarjetas (src/ui/learn/cards/FlashcardsView.tsx)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  function setupCardsTest() {
    const decksStorage = createMemoryStorage();
    const settingsStorage = createMemoryStorage();
    let fakeTime = 1700000000000;

    const decksStore = createDecksStore({
      storage: decksStorage,
      storageName: 'test:decks:ui',
      now: () => fakeTime,
    });

    const sandboxStore = createSandboxStore();

    const settingsStore = createSettingsStore({
      storage: settingsStorage,
      storageName: 'test:settings:ui',
      initialOverrides: {
        soundEnabled: true,
        nameMode: 'sharps',
      },
    });

    const audioEngine = createMockAudioEngine();
    const onNavigateToSandbox = vi.fn();
    const onOpenInSandbox = vi.fn();

    return {
      decksStore,
      sandboxStore,
      settingsStore,
      audioEngine,
      onNavigateToSandbox,
      onOpenInSandbox,
      advanceTime: (ms: number) => {
        fakeTime += ms;
      },
    };
  }

  it('renderiza el layout de 2 columnas con la lista de mazos y el lienzo de estudio', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Columna izquierda: Lista de mazos con título y subtítulo
    expect(screen.getByRole('heading', { level: 2, name: 'Mazos' })).toBeDefined();
    expect(screen.getByText('Nuevas · Aprendiendo · Repaso')).toBeDefined();

    // El mazo inicial Principiante está en la lista y activo
    const beginnerItem = screen.getByTestId('deck-item-deck-beginner');
    expect(beginnerItem).toBeDefined();
    expect(beginnerItem.getAttribute('aria-selected')).toBe('true');

    // Botones de acción inferior
    expect(screen.getByTestId('btn-new-deck')).toBeDefined();
    expect(screen.getByTestId('btn-add-preset')).toBeDefined();

    // Columna derecha: Escenario de mazo con botón de comenzar estudio
    expect(screen.getByTestId('deck-overview')).toBeDefined();
    expect(screen.getByTestId('btn-start-study')).toBeDefined();
  });

  it('inicia la sesión al pulsar "Comenzar estudio" y presenta el anverso de la primera tarjeta', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Pulsar comenzar estudio
    fireEvent.click(screen.getByTestId('btn-start-study'));

    // Debe mostrarse el anverso con título, subtítulo, y botón "Mostrar respuesta · Espacio"
    expect(screen.getByTestId('card-front')).toBeDefined();
    expect(screen.getByTestId('btn-reveal-answer')).toBeDefined();
    expect(screen.getByTestId('btn-reveal-answer').textContent).toContain(
      'Mostrar respuesta · Espacio',
    );

    // Los 4 botones SRS deben estar deshabilitados antes de revelar la respuesta
    const btnAgain = screen.getByTestId('srs-btn-again') as HTMLButtonElement;
    const btnGood = screen.getByTestId('srs-btn-good') as HTMLButtonElement;
    expect(btnAgain.disabled).toBe(true);
    expect(btnGood.disabled).toBe(true);
  });

  it('revela la respuesta al pulsar <Espacio> o el botón, y anuncia por aria-live', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Iniciar sesión
    fireEvent.click(screen.getByTestId('btn-start-study'));

    // Pulsar la tecla Espacio
    fireEvent.keyDown(window, { key: ' ' });

    // Debe aparecer el reverso revelado con etiqueta RESPUESTA
    expect(screen.getByTestId('revealed-content')).toBeDefined();
    expect(screen.getByText('RESPUESTA')).toBeDefined();
    expect(screen.getByText('Respuesta mostrada')).toBeDefined();

    // Los 4 botones SRS ahora están habilitados y muestran la vista previa de intervalos
    const btnAgain = screen.getByTestId('srs-btn-again') as HTMLButtonElement;
    const btnHard = screen.getByTestId('srs-btn-hard') as HTMLButtonElement;
    const btnGood = screen.getByTestId('srs-btn-good') as HTMLButtonElement;
    const btnEasy = screen.getByTestId('srs-btn-easy') as HTMLButtonElement;

    expect(btnAgain.disabled).toBe(false);
    expect(btnHard.disabled).toBe(false);
    expect(btnGood.disabled).toBe(false);
    expect(btnEasy.disabled).toBe(false);

    // Verificación de atajos impresos 1–4
    expect(btnAgain.textContent).toContain('1');
    expect(btnHard.textContent).toContain('2');
    expect(btnGood.textContent).toContain('3');
    expect(btnEasy.textContent).toContain('4');
  });

  it('valora la tarjeta al pulsar teclas 1–4 y avanza en la cola', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-start-study'));

    // Revelar respuesta con clic
    fireEvent.click(screen.getByTestId('btn-reveal-answer'));

    const initialCardId = decksStore.getState().session?.currentCardId;
    expect(initialCardId).toBeDefined();

    // Pulsar tecla '3' (Bien)
    fireEvent.keyDown(window, { key: '3' });

    // La sesión debe avanzar a la siguiente tarjeta (o terminar si cola vacía) con respuesta oculta de nuevo
    const nextSession = decksStore.getState().session;
    if (nextSession) {
      expect(nextSession.isAnswerRevealed).toBe(false);
      expect(screen.getByTestId('btn-reveal-answer')).toBeDefined();
    }
  });

  it('reproduce sonido al pulsar "Escuchar"', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-start-study'));
    fireEvent.click(screen.getByTestId('btn-reveal-answer'));

    const listenBtn = screen.getByTestId('btn-listen-card');
    fireEvent.click(listenBtn);

    expect(audioEngine.playEvents).toHaveBeenCalled();
  });

  it('abre el elemento en Sandbox al pulsar "Abrir en Sandbox"', () => {
    const {
      decksStore,
      sandboxStore,
      settingsStore,
      audioEngine,
      onNavigateToSandbox,
    } = setupCardsTest();

    // Mazo con acordes para asegurar que tiene sandboxContext
    decksStore.getState().createDeck({
      name: 'Mazo Acordes',
      sources: [
        {
          type: 'chords',
          qualities: ['maj'],
          roots: [0], // C maj
          facets: ['name>notes'],
        },
      ],
    });

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
        onNavigateToSandbox={onNavigateToSandbox}
      />,
    );

    // Iniciar sesión en el mazo recién creado
    fireEvent.click(screen.getByTestId('btn-start-study'));
    fireEvent.click(screen.getByTestId('btn-reveal-answer'));

    const sandboxBtn = screen.getByTestId('btn-open-sandbox-card');
    fireEvent.click(sandboxBtn);

    // Debe haber escrito el contexto en sandboxStore y navegado
    const ctx = sandboxStore.getState().context;
    expect(ctx).toBeDefined();
    expect(ctx?.kind).toBe('chord');
    expect(onNavigateToSandbox).toHaveBeenCalled();
  });

  it('abre el constructor de mazos al pulsar "+ Nuevo mazo"', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-new-deck'));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByTestId('deck-name-input')).toBeDefined();
  });

  it('abre el selector de predefinidos al pulsar "Añadir predefinido"', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-add-preset'));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByTestId('presets-list')).toBeDefined();
    expect(screen.getByTestId('preset-card-intermediate')).toBeDefined();
  });

  it('ignora atajos de teclado cuando el foco está sobre un input o con modificadores', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <div>
        <input data-testid="dummy-input" type="text" />
        <FlashcardsView
          decksStore={decksStore}
          sandboxStore={sandboxStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />
      </div>,
    );

    fireEvent.click(screen.getByTestId('btn-start-study'));

    const input = screen.getByTestId('dummy-input');
    input.focus();

    // Espacio con foco en el input no debe revelar la respuesta
    fireEvent.keyDown(input, { key: ' ' });
    expect(decksStore.getState().session?.isAnswerRevealed).toBe(false);

    // Modificador Ctrl+Espacio tampoco debe revelar la respuesta
    fireEvent.keyDown(window, { key: ' ', ctrlKey: true });
    expect(decksStore.getState().session?.isAnswerRevealed).toBe(false);
  });

  it('integración en LearnView: conmutar a la pestaña "Tarjetas" renderiza FlashcardsView', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <LearnView
        initialTab="drills"
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Cambiar a la pestaña Tarjetas
    const cardsTab = screen.getByRole('tab', { name: 'Tarjetas' });
    fireEvent.click(cardsTab);

    expect(screen.getByTestId('flashcards-view')).toBeDefined();
    expect(screen.getByTestId('deck-item-deck-beginner')).toBeDefined();
  });
});
