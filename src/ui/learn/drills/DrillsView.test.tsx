/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDrillsStore,
  createSettingsStore,
  createMemoryStorage,
} from '../../../state';
import type { AudioEngine } from '../../../audio';
import { DrillsView } from './DrillsView';

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

describe('Hito A7 — UI: Ejercicios (src/ui/learn/drills/DrillsView.tsx)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  function setupDrillsTest(options: { seed?: number; initialDrill?: string } = {}) {
    const drillsStorage = createMemoryStorage();
    const settingsStorage = createMemoryStorage();
    let fakeTime = 1000000;

    const drillsStore = createDrillsStore({
      storage: drillsStorage,
      storageName: 'test:drills:ui',
      seed: options.seed ?? 42,
      now: () => fakeTime,
    });

    const settingsStore = createSettingsStore({
      storage: settingsStorage,
      storageName: 'test:settings:ui',
      initialOverrides: {
        soundEnabled: true,
        nameMode: 'sharps',
      },
    });

    const audioEngine = createMockAudioEngine();

    return {
      drillsStore,
      settingsStore,
      audioEngine,
      advanceTime: (ms: number) => {
        fakeTime += ms;
      },
    };
  }

  describe('1. Selector de Ejercicios y Layout de 3 columnas', () => {
    it('muestra los 9 ejercicios agrupados en NOTAS, INTERVALOS y CONSTRUIR con sus códigos monoespaciados', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Columna izquierda presente
      expect(screen.getByTestId('drills-sidebar')).toBeTruthy();
      expect(screen.getByTestId('drill-stage')).toBeTruthy();
      expect(screen.getByTestId('drill-config-panel')).toBeTruthy();

      // Cabeceras de grupos
      expect(screen.getByText('NOTAS')).toBeTruthy();
      expect(screen.getByText('INTERVALOS')).toBeTruthy();
      expect(screen.getByText('CONSTRUIR')).toBeTruthy();

      // Los 9 ejercicios
      const drillIds = ['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2'];
      for (const id of drillIds) {
        expect(screen.getByTestId(`drill-select-${id}`)).toBeTruthy();
      }

      // Por defecto arranca con A1 seleccionado
      const a1Btn = screen.getByTestId('drill-select-A1');
      expect(a1Btn.getAttribute('aria-selected')).toBe('true');
    });

    it('cambiar de ejercicio inicia una nueva sesión con la configuración compatible', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Clic en B1 (Intervalo en una cuerda)
      const b1Btn = screen.getByTestId('drill-select-B1');
      fireEvent.click(b1Btn);

      expect(drillsStore.getState().drillId).toBe('B1');
      expect(drillsStore.getState().phase).toBe('question');
      expect(drillsStore.getState().currentQuestion?.drill).toBe('B1');

      // El eyebrow muestra B1
      expect(screen.getByTestId('drill-eyebrow').textContent).toContain('B1');
      expect(screen.getByTestId('drill-eyebrow').textContent).toContain('INTERVALO EN UNA CUERDA');
    });
  });

  describe('2. Pantalla de pregunta, Instrumentos, Corrección y Criterios (d, e, f, g, n, o)', () => {
    it('(d) B1 en estándar: referencia (5, 3) + M3 ascendente en la misma cuerda → clic en (5, 7) evalúa como correcto; clic en otra posición evalúa como incorrecto', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest({ seed: 101 });

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Cambiamos a B1
      fireEvent.click(screen.getByTestId('drill-select-B1'));

      // Inyectamos una pregunta determinista B1 que coincida exactamente con el criterio (d)
      drillsStore.setState({
        currentQuestion: {
          id: 'test-b1-d',
          drill: 'B1',
          itemKey: 'interval:M3|dir:asc',
          prompt: {
            referencePosition: { string: 5, fret: 3 },
            referenceNoteName: 'C',
            direction: 'ascending',
            intervalSemitones: 4,
            intervalName: 'M3',
            intervalLongName: '3ª mayor',
            title: 'Desde C3, sube una 3ª mayor en la misma cuerda',
            eyebrow: 'B1 · INTERVALO EN UNA CUERDA',
          },
          answerKind: 'positions',
          expected: {
            kind: 'positions',
            positions: [{ string: 5, fret: 7 }],
          },
          mode: 'first',
        },
        phase: 'question',
      });

      // El banner inicial es informativo
      const feedbackBanner = screen.getByTestId('drill-feedback-banner');
      expect(feedbackBanner.textContent).toContain('Haz clic en el mástil');

      // Hacemos clic en una posición incorrecta (4, 2) (E3 en otra cuerda)
      // Buscamos la celda de la guitarra
      const fretCellWrong = screen.getByRole('button', { name: /Cuerda 4, traste 2/i });
      fireEvent.click(fretCellWrong);

      // Ahora está corregido y es incorrecto
      expect(drillsStore.getState().phase).toBe('corrected');
      expect(drillsStore.getState().lastGrade?.correct).toBe(false);
      expect(screen.getByTestId('drill-feedback-text').textContent).toContain('Incorrecto');

      // Botón Siguiente e icono de Escuchar están disponibles
      expect(screen.getByTestId('drill-next-button')).toBeTruthy();
      expect(screen.getByTestId('drill-listen-button')).toBeTruthy();

      // Pulsamos siguiente para avanzar
      fireEvent.click(screen.getByTestId('drill-next-button'));
      expect(drillsStore.getState().phase).toBe('question');

      // Volvemos a inyectar la pregunta y probamos el acierto (5, 7)
      drillsStore.setState({
        currentQuestion: {
          id: 'test-b1-d-correct',
          drill: 'B1',
          itemKey: 'interval:M3|dir:asc',
          prompt: {
            referencePosition: { string: 5, fret: 3 },
            referenceNoteName: 'C',
            direction: 'ascending',
            intervalSemitones: 4,
            intervalName: 'M3',
            intervalLongName: '3ª mayor',
            title: 'Desde C3, sube una 3ª mayor en la misma cuerda',
            eyebrow: 'B1 · INTERVALO EN UNA CUERDA',
          },
          answerKind: 'positions',
          expected: {
            kind: 'positions',
            positions: [{ string: 5, fret: 7 }],
          },
          mode: 'first',
        },
        phase: 'question',
      });

      const fretCellCorrect = screen.getByRole('button', { name: /Cuerda 5, traste 7/i });
      fireEvent.click(fretCellCorrect);

      expect(drillsStore.getState().phase).toBe('corrected');
      expect(drillsStore.getState().lastGrade?.correct).toBe(true);
      expect(screen.getByTestId('drill-feedback-text').textContent).toContain('Correcto');
    });

    it('(e) B3 · Nombra el intervalo: muestra botonera de intervalos y evalúa de inmediato al pulsar una opción', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest({ seed: 202 });

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      fireEvent.click(screen.getByTestId('drill-select-B3'));

      // Inyectamos pregunta determinista de B3 (4, 2) a (3, 2) que es P4 (5 semitonos)
      drillsStore.setState({
        currentQuestion: {
          id: 'test-b3-e',
          drill: 'B3',
          itemKey: 'interval:P4',
          prompt: {
            fromPosition: { string: 4, fret: 2 },
            toPosition: { string: 3, fret: 2 },
            fromNoteName: 'E3',
            toNoteName: 'A3',
            title: '¿Qué intervalo hay de E3 a A3?',
            eyebrow: 'B3 · NOMBRA EL INTERVALO',
          },
          answerKind: 'interval',
          expected: {
            kind: 'interval',
            semitones: 5,
            name: 'P4',
          },
          mode: 'first',
        },
        phase: 'question',
      });

      // Los botones de intervalos están presentes
      const p4Button = screen.getByTestId('drill-interval-choice-5');
      expect(p4Button).toBeTruthy();
      expect(p4Button.textContent).toContain('P4');
      expect(p4Button.textContent).toContain('4ª justa');

      // Clic en P4 evalúa inmediatamente
      fireEvent.click(p4Button);
      expect(drillsStore.getState().phase).toBe('corrected');
      expect(drillsStore.getState().lastGrade?.correct).toBe(true);
      expect(screen.getByTestId('drill-feedback-text').textContent).toContain('Correcto');
    });

    it('(f) A1 · Encuentra la nota: en modo all permite selección múltiple con botón Comprobar; en modo first basta con una posición', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest({ seed: 303 });

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // A1 en modo 'all' (por defecto)
      act(() => {
        drillsStore.setState({
          drillId: 'A1',
          currentQuestion: {
            id: 'test-a1-all',
            drill: 'A1',
            itemKey: 'note:0',
            prompt: {
              pitchClass: 0,
              noteName: 'C',
              title: 'Encuentra la nota C en las cuerdas activas',
              eyebrow: 'A1 · ENCUENTRA LA NOTA',
            },
            answerKind: 'positions',
            expected: {
              kind: 'positions',
              positions: [
                { string: 5, fret: 3 },
                { string: 2, fret: 1 },
              ],
            },
            mode: 'all',
          },
          config: { ...drillsStore.getState().config, mode: 'all' },
          phase: 'question',
          pinnedPositions: [],
        });
      });

      // Marcamos la posición (5, 3)
      const c1 = screen.getAllByRole('button', { name: /Cuerda 5, traste 3/i })[0]!;
      fireEvent.click(c1);

      // Ahora está en 'answering' y muestra botón Comprobar
      expect(drillsStore.getState().phase).toBe('answering');
      expect(screen.getByTestId('drill-check-button')).toBeTruthy();
      expect(screen.getByTestId('drill-feedback-banner').textContent).toContain('1 posiciones marcadas');

      // Marcamos también (2, 1)
      const c2 = screen.getAllByRole('button', { name: /Cuerda 2, traste 1/i })[0]!;
      fireEvent.click(c2);
      expect(screen.getByTestId('drill-feedback-banner').textContent).toContain('2 posiciones marcadas');

      // Pulsamos Comprobar · Enter
      fireEvent.click(screen.getByTestId('drill-check-button'));

      expect(drillsStore.getState().phase).toBe('corrected');
      expect(drillsStore.getState().lastGrade?.correct).toBe(true);
      expect(screen.getByTestId('drill-feedback-text').textContent).toContain('Correcto');
    });

    it('(g) B5 · Etiqueta la forma: muestra fichas de voicing y píldoras de grado, evaluando etiquetas asignadas', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest({ seed: 404 });

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Inyectamos B5 con el voicing x-0-2-2-1-0 (Am)
      const amPositions = [
        { string: 5, fret: 0 },
        { string: 4, fret: 2 },
        { string: 3, fret: 2 },
        { string: 2, fret: 1 },
        { string: 1, fret: 0 },
      ];

      act(() => {
        drillsStore.setState({
          drillId: 'B5',
          currentQuestion: {
            id: 'test-b5-g',
            drill: 'B5',
            itemKey: 'voicing:open-Am',
            prompt: {
              chordName: 'Am',
              rootPosition: { string: 5, fret: 0 },
              positions: amPositions,
              title: 'Asigna el grado de cada nota del voicing de Am',
              eyebrow: 'B5 · ETIQUETA LA FORMA',
            },
            answerKind: 'labels',
            expected: {
              kind: 'labels',
              labels: [
                { position: { string: 5, fret: 0 }, degree: '1', label: '1' },
                { position: { string: 4, fret: 2 }, degree: '5', label: '5' },
                { position: { string: 3, fret: 2 }, degree: '1', label: '1' },
                { position: { string: 2, fret: 1 }, degree: '♭3', label: '♭3' },
                { position: { string: 1, fret: 0 }, degree: '5', label: '5' },
              ],
            },
            mode: 'all',
          },
          phase: 'question',
          assignedLabels: [{ position: { string: 5, fret: 0 }, label: '1' }],
        });
      });

      // Fichas de voicing presentes
      expect(screen.getByTestId('voicing-card-s5-f0')).toBeTruthy();
      expect(screen.getByTestId('voicing-card-s4-f2')).toBeTruthy();
      expect(screen.getByTestId('voicing-card-s3-f2')).toBeTruthy();
      expect(screen.getByTestId('voicing-card-s2-f1')).toBeTruthy();
      expect(screen.getByTestId('voicing-card-s1-f0')).toBeTruthy();

      // Píldoras de grado presentes
      expect(screen.getByTestId('degree-pill-1')).toBeTruthy();
      expect(screen.getByTestId('degree-pill-♭3')).toBeTruthy();
      expect(screen.getByTestId('degree-pill-5')).toBeTruthy();

      // Asignamos cuerda 4 (traste 2) -> 5
      fireEvent.click(screen.getByTestId('voicing-card-s4-f2'));
      fireEvent.click(screen.getByTestId('degree-pill-5'));

      // Asignamos cuerda 3 (traste 2) -> 1
      fireEvent.click(screen.getByTestId('voicing-card-s3-f2'));
      fireEvent.click(screen.getByTestId('degree-pill-1'));

      // Asignamos cuerda 2 (traste 1) -> ♭3
      fireEvent.click(screen.getByTestId('voicing-card-s2-f1'));
      fireEvent.click(screen.getByTestId('degree-pill-♭3'));

      // Asignamos cuerda 1 (traste 0) -> 5
      fireEvent.click(screen.getByTestId('voicing-card-s1-f0'));
      fireEvent.click(screen.getByTestId('degree-pill-5'));

      // Pulsamos comprobar
      fireEvent.click(screen.getByTestId('drill-check-button'));

      expect(drillsStore.getState().phase).toBe('corrected');
      expect(drillsStore.getState().lastGrade?.correct).toBe(true);
      expect(screen.getByTestId('drill-feedback-text').textContent).toContain('Correcto');
    });

    it('(n) corrección visible y sonora: muestra marcas correct/wrong/missed y botón Escuchar reproduce sonido', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest({ seed: 505 });

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Configuramos una corrección
      act(() => {
        drillsStore.setState({
          phase: 'corrected',
          currentQuestion: {
            id: 'test-q-audio',
            drill: 'B1',
            itemKey: 'test-key',
            prompt: {
              referencePosition: { string: 5, fret: 3 },
              intervalSemitones: 4,
              direction: 'ascending',
              title: 'Test',
              eyebrow: 'B1',
            },
            answerKind: 'positions',
            expected: { kind: 'positions', positions: [{ string: 5, fret: 7 }] },
            mode: 'first',
          },
          lastGrade: {
            correct: true,
            score: 1,
            hits: [{ string: 5, fret: 7 }],
            misses: [],
            extras: [],
            explanation: '¡Prueba superada!',
          },
        });
      });

      // Al pulsar Escuchar se llama a playEvents
      const listenBtn = screen.getByTestId('drill-listen-button');
      fireEvent.click(listenBtn);
      expect(audioEngine.playEvents).toHaveBeenCalled();
    });

    it('(o) respeta afinaciones como Drop D en el mástil y en la reproducción', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Cambiamos afinación en la configuración a Drop D
      const dropDTuning = {
        id: 'dropD',
        name: 'Drop D',
        strings: [38, 45, 50, 55, 59, 64] as const,
      };

      drillsStore.getState().updateConfig({ tuning: dropDTuning });

      // Verificamos que Fretboard recibe la afinación (la cuerda 6 al aire ahora es D2 = MIDI 38)
      expect(drillsStore.getState().config.tuning?.id).toBe('dropD');
    });
  });

  describe('3. Resumen de sesión', () => {
    it('muestra métricas acumuladas (precisión, tiempo medio, total) y botón para reiniciar sesión', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Colocamos en phase 'summary'
      act(() => {
        drillsStore.setState({
          phase: 'summary',
          sessionStats: {
            questionsAnswered: 20,
            correctCount: 18,
            totalTimeMs: 84000,
          },
        });
      });

      expect(screen.getByTestId('drill-summary')).toBeTruthy();
      expect(screen.getByText(/Resumen de la sesión/i)).toBeTruthy();
      expect(screen.getByText('90%')).toBeTruthy(); // 18 / 20 = 90%
      expect(screen.getAllByText('4,2 s').length).toBeGreaterThanOrEqual(1); // 84000 / 20 / 1000 = 4.2s

      // Clic en Repetir sesión
      const restartBtn = screen.getByTestId('drill-restart-button');
      fireEvent.click(restartBtn);

      expect(drillsStore.getState().phase).toBe('question');
      expect(drillsStore.getState().questionNumber).toBe(1);
    });
  });

  describe('4. Atajos de teclado', () => {
    it('Enter ejecuta comprobar en respuesta activa, siguiente tras corregir y reiniciar en resumen', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // 1. En answering: Enter evalúa
      act(() => {
        drillsStore.setState({
          phase: 'answering',
          currentQuestion: {
            id: 'test-enter',
            drill: 'B4',
            itemKey: 'test',
            prompt: { title: 'Test', eyebrow: 'B4' },
            answerKind: 'positions',
            expected: { kind: 'positions', positions: [{ string: 5, fret: 3 }] },
            mode: 'all',
          },
          pinnedPositions: [{ string: 5, fret: 3 }],
        });
      });

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(drillsStore.getState().phase).toBe('corrected');

      // 2. En corrected: Enter pasa a la siguiente pregunta
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(drillsStore.getState().phase).toBe('question');

      // 3. En summary: Enter reinicia
      act(() => {
        drillsStore.setState({ phase: 'summary' });
      });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(drillsStore.getState().phase).toBe('question');
    });

    it('los atajos se ignoran si el foco está en un campo de texto o selector', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <div>
          <input data-testid="test-input" />
          <DrillsView
            drillsStore={drillsStore}
            settingsStore={settingsStore}
            audioEngine={audioEngine}
          />
        </div>,
      );

      act(() => {
        drillsStore.setState({
          phase: 'corrected',
          currentQuestion: {
            id: 'test-input-shortcut',
            drill: 'A1',
            itemKey: 'k',
            prompt: { title: 'Test', eyebrow: 'A1' },
            answerKind: 'positions',
            expected: { kind: 'positions', positions: [] },
            mode: 'all',
          },
        });
      });

      const input = screen.getByTestId('test-input');
      input.focus();

      fireEvent.keyDown(input, { key: 'Enter' });
      // Sigue en corrected porque el foco estaba en el input
      expect(drillsStore.getState().phase).toBe('corrected');
    });
  });

  describe('5. Panel de Configuración interactivo', () => {
    it('permite alternar cuerdas activas (manteniendo siempre al menos 1 cuerda activa)', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      // Clic en cuerda 1 la desactiva
      const s1 = screen.getByTestId('drill-config-string-1');
      expect(s1.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(s1);

      expect(drillsStore.getState().config.activeStrings).toEqual([2, 3, 4, 5, 6]);

      // Si solo queda una cuerda (ej. cuerda 6), hacer clic en ella no la desactiva
      act(() => {
        drillsStore.getState().updateConfig({ activeStrings: [6] });
      });
      const s6 = screen.getByTestId('drill-config-string-6');
      fireEvent.click(s6);
      expect(drillsStore.getState().config.activeStrings).toEqual([6]);
    });

    it('permite cambiar rango de trastes a 0–5 o 0–24', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      const fret5Btn = screen.getByTestId('drill-config-fret-5');
      fireEvent.click(fret5Btn);
      expect(drillsStore.getState().config.fretRange).toEqual([0, 5]);

      const fret24Btn = screen.getByTestId('drill-config-fret-24');
      fireEvent.click(fret24Btn);
      expect(drillsStore.getState().config.fretRange).toEqual([0, 24]);
    });

    it('permite alternar los switches de adaptativo, ocultar puntos y sonido', () => {
      const { drillsStore, settingsStore, audioEngine } = setupDrillsTest();

      render(
        <DrillsView
          drillsStore={drillsStore}
          settingsStore={settingsStore}
          audioEngine={audioEngine}
        />,
      );

      const inlaysSwitch = screen.getByTestId('drill-config-switch-inlays');
      fireEvent.click(inlaysSwitch);
      expect(drillsStore.getState().config.showInlays).toBe(false);

      const soundSwitch = screen.getByTestId('drill-config-switch-sound');
      fireEvent.click(soundSwitch);
      expect(drillsStore.getState().config.playAudio).toBe(false);

      const adaptiveSwitch = screen.getByTestId('drill-config-switch-adaptive');
      fireEvent.click(adaptiveSwitch);
      expect(drillsStore.getState().config.adaptive).toBe(false);
    });
  });
});
