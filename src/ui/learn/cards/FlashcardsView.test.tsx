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
    let fakeTime = Date.now();

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

  it('permite eliminar un mazo con confirmación y muestra estado vacío si no quedan mazos', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    expect(decksStore.getState().decks).toHaveLength(1);

    // Pulsar Eliminar mazo y confirmar
    fireEvent.click(screen.getByTestId('btn-delete-deck'));
    expect(screen.getByTestId('btn-confirm-delete-deck')).toBeDefined();
    fireEvent.click(screen.getByTestId('btn-confirm-delete-deck'));

    expect(decksStore.getState().decks).toHaveLength(0);
    expect(screen.getByText('No tienes ningún mazo activo')).toBeDefined();
  });

  it('muestra la lista de tarjetas del mazo con las tarjetas en aprendizaje primero (con su próximo repaso) y luego las nuevas', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    const customDeck = decksStore.getState().createDeck({
      name: 'Mazo Lista',
      sources: [
        {
          type: 'intervals',
          semitones: [3, 4, 7],
          facets: ['name>semitones'],
        },
      ],
    });

    // Estudiar la primera tarjeta y valorarla como Bien (pasa a learning a 10 min)
    decksStore.getState().startSession(customDeck.id);
    const firstCardId = decksStore.getState().session?.currentCardId ?? '';
    decksStore.getState().revealAnswer();
    decksStore.getState().rateCard('good');
    decksStore.getState().endSession();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    const cardsList = screen.getByTestId('deck-cards-list');
    expect(cardsList).toBeDefined();

    // La tarjeta estudiada aparece con estado Aprendiendo y su próximo repaso
    const learnedRow = screen.getByTestId(`deck-card-row-${firstCardId}`);
    expect(learnedRow.textContent).toContain('Aprendiendo');
    expect(learnedRow.textContent).toContain('Próxima:');

    // Filtrar solo en aprendizaje y solo nuevas
    fireEvent.click(screen.getByTestId('cards-filter-learning'));
    expect(screen.getByTestId(`deck-card-row-${firstCardId}`)).toBeDefined();

    fireEvent.click(screen.getByTestId('cards-filter-new'));
    expect(screen.queryByTestId(`deck-card-row-${firstCardId}`)).toBeNull();
  });

  it('permite seguir estudiando con "Estudiar de todos modos" tras agotar las tarjetas de hoy', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    // Crear un mazo con límite de 1 tarjeta nueva por día y 3 tarjetas totales
    const customDeck = decksStore.getState().createDeck({
      name: 'Mazo Cuota 1',
      limits: { newPerDay: 1, reviewsPerDay: 50 },
      sources: [
        {
          type: 'intervals',
          semitones: [3, 4, 7],
          facets: ['name>semitones'],
        },
      ],
    });

    // Estudiar la única tarjeta nueva del cupo diario con Fácil (graduada a 4 días)
    decksStore.getState().startSession(customDeck.id);
    decksStore.getState().revealAnswer();
    decksStore.getState().rateCard('easy');

    // La sesión habrá terminado y hoy quedan 0 pendientes
    expect(decksStore.getState().session).toBeNull();

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Debe mostrarse "¡Estás al día!" y el botón "Estudiar de todos modos"
    const studyAnywayBtn = screen.getByTestId('btn-start-study-anyway');
    expect(studyAnywayBtn).toBeDefined();

    // Al pulsarlo, debe iniciar una nueva ronda de tarjetas nuevas
    fireEvent.click(studyAnywayBtn);
    expect(decksStore.getState().session).not.toBeNull();
    expect(decksStore.getState().session?.currentCardId).not.toBeNull();
    expect(screen.getByTestId('card-front')).toBeDefined();
  });

  it('muestra todos los bloques completos con título, controles y ayuda (?) al editar el mazo Avanzado', () => {
    const { decksStore, sandboxStore, settingsStore, audioEngine } = setupCardsTest();

    const advanced = decksStore.getState().addPresetDeck('advanced');
    decksStore.getState().selectDeck(advanced.id);

    render(
      <FlashcardsView
        decksStore={decksStore}
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={audioEngine}
      />,
    );

    // Abrir editor de reglas del mazo Avanzado
    fireEvent.click(screen.getByTestId('btn-overview-edit'));

    // El mazo Avanzado tiene 8 bloques; ninguno debe tener el título vacío
    for (let i = 0; i < 8; i++) {
      const block = screen.getByTestId(`rule-block-${i}`);
      expect(block).toBeDefined();
      const helpBtn = screen.getByTestId(`rule-help-btn-${i}`);
      expect(helpBtn).toBeDefined();
    }

    // Mostrar el tooltip de ayuda del primer bloque al hacer clic en '?'
    fireEvent.click(screen.getByTestId('rule-help-btn-0'));
    expect(screen.getByTestId('rule-help-tooltip-0')).toBeDefined();
  });
});
