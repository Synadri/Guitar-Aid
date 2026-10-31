/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDecksStore,
  createDrillsStore,
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  defaultDrillConfig,
} from '../../../state';
import { LearnView } from '../LearnView';
import { ProgressView } from './ProgressView';

describe('Hito A9 — Sección Progreso, copia de seguridad y cierre (ProgressView)', () => {
  afterEach(() => {
    cleanup();
  });

  function createIsolatedEnv(clock = 1_700_000_000_000) {
    const drillsStorage = createMemoryStorage();
    const decksStorage = createMemoryStorage();
    const settingsStorage = createMemoryStorage();

    const drillsStore = createDrillsStore({
      storage: drillsStorage,
      storageName: 'test:progress:drills',
      seed: 101,
      now: () => clock,
    });
    const decksStore = createDecksStore({
      storage: decksStorage,
      storageName: 'test:progress:decks',
      now: () => clock,
    });
    const settingsStore = createSettingsStore({
      storage: settingsStorage,
      storageName: 'test:progress:settings',
    });
    const sandboxStore = createSandboxStore();

    return {
      drillsStore,
      decksStore,
      settingsStore,
      sandboxStore,
      drillsStorage,
      decksStorage,
      clock,
    };
  }

  it('renderiza el mapa de aciertos del mástil (0–12 y 0–24) con estados dominada, regular, débil y sin datos y mantiene el pie fijo sin saltos de layout al hacer hover', () => {
    const { drillsStore, decksStore, settingsStore } = createIsolatedEnv();

    drillsStore.setState({
      itemStats: {
        // C3 en cuerda 5 traste 3: 19/20 aciertos -> 95% (Dominada)
        'pos:s5f3': {
          attempts: 25,
          hits: 22,
          recentResults: [
            true, true, true, true, true,
            true, true, true, true, true,
            true, true, true, true, true,
            true, true, true, true, false,
          ],
          averageTimeMs: 1800,
        },
        // A3 en cuerda 3 traste 2: 7/10 aciertos -> 70% (Regular)
        'pos:s3f2': {
          attempts: 10,
          hits: 7,
          recentResults: [true, true, false, true, true, false, true, true, false, true],
          averageTimeMs: 2400,
        },
        // F2 en cuerda 6 traste 1: 4/10 aciertos -> 40% (Débil)
        'pos:s6f1': {
          attempts: 10,
          hits: 4,
          recentResults: [false, true, false, false, true, false, true, false, false, true],
          averageTimeMs: 3900,
        },
      },
    });

    render(
      <ProgressView
        drillsStore={drillsStore}
        decksStore={decksStore}
        settingsStore={settingsStore}
      />,
    );

    // El contenedor del tooltip existe siempre con altura fija para evitar saltos al hacer hover
    const tooltip = screen.getByTestId('heatmap-active-tooltip');
    expect(tooltip.textContent).toContain('Pasa el cursor por una posición');

    const cellMastered = screen.getByTestId('heatmap-cell-s5-f3');
    expect(cellMastered.getAttribute('data-status')).toBe('mastered');
    expect(cellMastered.getAttribute('aria-label')).toContain('C (cuerda 5, traste 3)');
    expect(cellMastered.getAttribute('aria-label')).toContain('Dominada: 95 % de acierto');
    expect(cellMastered.getAttribute('aria-label')).toContain('1,8 s');

    const cellRegular = screen.getByTestId('heatmap-cell-s3-f2');
    expect(cellRegular.getAttribute('data-status')).toBe('learning');
    expect(cellRegular.getAttribute('aria-label')).toContain('Regular: 70 % de acierto');

    const cellWeak = screen.getByTestId('heatmap-cell-s6-f1');
    expect(cellWeak.getAttribute('data-status')).toBe('weak');
    expect(cellWeak.getAttribute('aria-label')).toContain('Débil: 40 % de acierto');

    const cellUntested = screen.getByTestId('heatmap-cell-s1-f0');
    expect(cellUntested.getAttribute('data-status')).toBe('untested');
    expect(cellUntested.getAttribute('aria-label')).toContain('Sin datos (0 intentos)');

    // Enfocar o pasar el ratón actualiza el texto in situ sin montar/desmontar nodos
    fireEvent.focus(cellMastered);
    expect(tooltip.textContent).toContain('C (cuerda 5, traste 3)');
    expect(tooltip.textContent).toContain('95 % de acierto');

    // Cambiar el rango a 0–24 muestra hasta el traste 24
    expect(screen.queryByTestId('heatmap-cell-s1-f24')).toBeNull();
    fireEvent.click(screen.getByTestId('heatmap-range-24'));
    expect(screen.getByTestId('heatmap-cell-s1-f24')).toBeTruthy();
  });

  it('tanto A1 como A2 alimentan las estadísticas por posición en el mapa de aciertos del mástil', () => {
    const { drillsStore, decksStore, settingsStore } = createIsolatedEnv();

    // Simulamos una pregunta de A1 en modo 'all' con posiciones esperadas (5, 3) y (2, 1)
    drillsStore.setState({
      drillId: 'A1',
      phase: 'question',
      currentQuestion: {
        id: 'q-a1-c',
        drill: 'A1',
        itemKey: 'note:0',
        prompt: { pitchClass: 0, noteName: 'C', title: 'Encuentra C', eyebrow: 'A1' },
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
    });

    // El usuario acierta (5, 3) y olvida (2, 1)
    drillsStore.getState().submitAnswer({
      kind: 'positions',
      positions: [{ string: 5, fret: 3 }],
    });

    render(
      <ProgressView
        drillsStore={drillsStore}
        decksStore={decksStore}
        settingsStore={settingsStore}
      />,
    );

    expect(screen.getByTestId('heatmap-cell-s5-f3').getAttribute('data-status')).toBe('mastered');
    expect(screen.getByTestId('heatmap-cell-s2-f1').getAttribute('data-status')).toBe('weak');
  });

  it('muestra etiquetas visibles en las barras de sesiones (porcentaje, ejercicio y tiempo), filtro por ejercicio, selector de mazo y gráfica de evolución de la retención', () => {
    const { drillsStore, decksStore, settingsStore, clock } = createIsolatedEnv();

    // Registrar 3 sesiones en el historial de ejercicios
    drillsStore.setState({
      history: [
        {
          id: 's-1',
          date: '2026-10-29T10:00:00.000Z',
          drillId: 'B1',
          config: defaultDrillConfig('B1'),
          totalQuestions: 20,
          correctCount: 14,
          accuracy: 70,
          averageTimeMs: 3200,
        },
        {
          id: 's-2',
          date: '2026-10-30T10:00:00.000Z',
          drillId: 'B2',
          config: defaultDrillConfig('B2'),
          totalQuestions: 20,
          correctCount: 17,
          accuracy: 85,
          averageTimeMs: 2800,
        },
        {
          id: 's-3',
          date: '2026-10-31T10:00:00.000Z',
          drillId: 'A2',
          config: defaultDrillConfig('A2'),
          totalQuestions: 20,
          correctCount: 19,
          accuracy: 95,
          averageTimeMs: 1900,
        },
      ],
    });

    // Crear un segundo mazo y estudiar tarjetas en el primero
    const firstDeckId = decksStore.getState().decks[0]!.id;
    const secondDeck = decksStore.getState().createDeck({
      name: 'Mazo Escalas',
      sources: [{ type: 'intervals', semitones: [3, 4], facets: ['name>semitones'] }],
    });

    // Estudiar 4 tarjetas en el primer mazo: 3 aprobadas y 1 'again' -> 75% retención
    decksStore.getState().startSession(firstDeckId);
    decksStore.getState().rateCard('good');
    decksStore.getState().rateCard('easy');
    decksStore.getState().rateCard('good');
    decksStore.getState().rateCard('again');

    render(
      <ProgressView
        drillsStore={drillsStore}
        decksStore={decksStore}
        settingsStore={settingsStore}
        now={() => clock}
      />,
    );

    // 3 barras con datos + 7 pistas vacías = 10 columnas
    expect(screen.getByTestId('session-bar-0').getAttribute('data-accuracy')).toBe('70');
    expect(screen.getByTestId('session-bar-1').getAttribute('data-accuracy')).toBe('85');
    expect(screen.getByTestId('session-bar-2').getAttribute('data-accuracy')).toBe('95');
    expect(screen.getAllByTestId('session-bar-empty')).toHaveLength(7);

    // Etiquetas visibles sin necesidad de hover: porcentajes, códigos de ejercicio y resumen medio
    const sessionsCard = screen.getByTestId('progress-sessions-card');
    expect(within(sessionsCard).getByText('70%')).toBeTruthy();
    expect(within(sessionsCard).getByText('85%')).toBeTruthy();
    expect(within(sessionsCard).getByText('95%')).toBeTruthy();
    expect(within(sessionsCard).getByText('B1')).toBeTruthy();
    expect(within(sessionsCard).getByText('B2')).toBeTruthy();
    expect(within(sessionsCard).getByText('A2')).toBeTruthy();
    expect(screen.getByTestId('sessions-summary-badge').textContent).toContain('Media: 83 %');

    // Filtrar sesiones por ejercicio 'A2' muestra solo la sesión de A2 (95%)
    fireEvent.change(screen.getByTestId('sessions-drill-filter'), { target: { value: 'A2' } });
    expect(screen.getByTestId('session-bar-0').getAttribute('data-accuracy')).toBe('95');
    expect(screen.getAllByTestId('session-bar-empty')).toHaveLength(9);

    // Métricas de tarjetas y evolución de retención
    const retentionBox = screen.getByTestId('metric-retention');
    expect(within(retentionBox).getByText('75 %')).toBeTruthy();
    expect(screen.getByTestId('retention-day-0').getAttribute('aria-label')).toContain(
      '75 % de retención (3/4 repasos superados)',
    );

    // Filtrar por el segundo mazo ('Mazo Escalas', sin repasos aún) actualiza métricas y curva
    fireEvent.change(screen.getByTestId('progress-deck-select'), {
      target: { value: secondDeck.id },
    });
    expect(within(retentionBox).getByText('100 %')).toBeTruthy();
    expect(within(screen.getByTestId('metric-new')).getByText('2')).toBeTruthy();
  });

  it('lista los 5 intervalos más débiles con recuento de aciertos/intentos y porcentaje de precisión', () => {
    const { drillsStore, decksStore, settingsStore, sandboxStore } = createIsolatedEnv();

    drillsStore.setState({
      itemStats: {
        'interval:♭5|pair:3-2': { attempts: 10, hits: 5 }, // 50%
        'interval:M6|string:4': { attempts: 10, hits: 6 }, // 60%
        'interval:m7|pair:5-3': { attempts: 10, hits: 7 }, // 70%
        'interval:M3|string:5': { attempts: 10, hits: 8 }, // 80%
        'interval:P4|pair:6-5': { attempts: 10, hits: 9 }, // 90%
        'interval:P5|pair:6-5': { attempts: 10, hits: 10 }, // 100%
      },
    });

    render(
      <LearnView
        initialTab="progress"
        drillsStore={drillsStore}
        decksStore={decksStore}
        settingsStore={settingsStore}
        sandboxStore={sandboxStore}
      />,
    );

    const weakSection = screen.getByTestId('progress-weak-intervals');
    const items = within(weakSection).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toContain('♭5');
    expect(items[0]?.textContent).toContain('5/10');
    expect(items[0]?.textContent).toContain('50 %');
    expect(items[1]?.textContent).toContain('M6');
    expect(items[1]?.textContent).toContain('6/10');
    expect(items[1]?.textContent).toContain('60 %');
  });

  it('Criterio (m) — Exportar e importar JSON en la UI restaura un estado idéntico y persiste tras recarga simulada', async () => {
    const env1 = createIsolatedEnv(2_000_000_000);

    // 1. Poblar datos en env1 (crear mazo, repasar tarjetas, registrar estadísticas e historial de ejercicios)
    const customDeck = env1.decksStore.getState().createDeck({
      name: 'Mazo Backup UI',
      sources: [{ type: 'intervals', semitones: [3, 4, 7], facets: ['name>semitones'] }],
    });
    env1.decksStore.getState().startSession(customDeck.id);
    env1.decksStore.getState().rateCard('good');
    env1.decksStore.getState().rateCard('easy');

    env1.drillsStore.getState().startSession('B1', {}, 1);
    env1.drillsStore.getState().submitAnswer({ kind: 'positions', positions: [{ string: 5, fret: 7 }] });
    env1.drillsStore.getState().nextQuestion();

    let exportedContent = '';
    let exportedFilename = '';

    const { unmount } = render(
      <ProgressView
        drillsStore={env1.drillsStore}
        decksStore={env1.decksStore}
        settingsStore={env1.settingsStore}
        now={() => env1.clock}
        onExportJson={(json, filename) => {
          exportedContent = json;
          exportedFilename = filename;
        }}
      />,
    );

    // 2. Exportar JSON desde el botón de la UI
    fireEvent.click(screen.getByTestId('backup-export-btn'));
    expect(exportedFilename).toMatch(/^guitar-aid-backup-.*\.json$/);
    expect(exportedContent.length).toBeGreaterThan(50);
    expect(screen.getByTestId('backup-status-msg').textContent).toContain(
      'Copia de seguridad exportada correctamente',
    );

    unmount();

    // 3. Crear un segundo entorno completamente limpio (env2) e importar el archivo JSON desde el input de la UI
    const env2 = createIsolatedEnv(2_000_000_000);
    expect(env2.decksStore.getState().decks).toHaveLength(1);
    expect(env2.drillsStore.getState().history).toHaveLength(0);

    const { unmount: unmount2 } = render(
      <ProgressView
        drillsStore={env2.drillsStore}
        decksStore={env2.decksStore}
        settingsStore={env2.settingsStore}
        now={() => env2.clock}
      />,
    );

    const fileInput = screen.getByTestId('backup-file-input') as HTMLInputElement;
    const file = new File([exportedContent], 'backup.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('backup-status-msg').textContent).toContain(
        'Copia de seguridad restaurada correctamente',
      );
    });

    // Verificar que el estado de env2 coincide exactamente con env1
    expect(env2.decksStore.getState().decks).toEqual(env1.decksStore.getState().decks);
    expect(env2.decksStore.getState().cardsSRS).toEqual(env1.decksStore.getState().cardsSRS);
    expect(env2.decksStore.getState().history).toEqual(env1.decksStore.getState().history);
    expect(env2.drillsStore.getState().itemStats).toEqual(env1.drillsStore.getState().itemStats);
    expect(env2.drillsStore.getState().history).toEqual(env1.drillsStore.getState().history);

    unmount2();

    // 4. Simular recarga del navegador montando nuevos stores sobre el mismo almacenamiento de env2
    const reloadedDrillsStore = createDrillsStore({
      storage: env2.drillsStorage,
      storageName: 'test:progress:drills',
      now: () => env2.clock,
    });
    const reloadedDecksStore = createDecksStore({
      storage: env2.decksStorage,
      storageName: 'test:progress:decks',
      now: () => env2.clock,
    });

    render(
      <ProgressView
        drillsStore={reloadedDrillsStore}
        decksStore={reloadedDecksStore}
        settingsStore={env2.settingsStore}
        now={() => env2.clock}
      />,
    );

    expect(reloadedDecksStore.getState().decks).toHaveLength(2);
    expect(reloadedDrillsStore.getState().history).toHaveLength(1);
    expect(screen.getByTestId('session-bar-0')).toBeTruthy();
  });

  it('muestra una alerta de error accesible si se intenta importar un archivo JSON corrupto sin alterar el estado actual', async () => {
    const env = createIsolatedEnv();
    const initialDecksCount = env.decksStore.getState().decks.length;

    render(
      <ProgressView
        drillsStore={env.drillsStore}
        decksStore={env.decksStore}
        settingsStore={env.settingsStore}
      />,
    );

    const fileInput = screen.getByTestId('backup-file-input') as HTMLInputElement;
    const badFile = new File(['{ json corrupto !!!'], 'corrupt.json', {
      type: 'application/json',
    });

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('no es un JSON válido');
    });

    expect(env.decksStore.getState().decks).toHaveLength(initialDecksCount);
    spy.mockRestore();
  });
});
