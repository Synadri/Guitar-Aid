// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '../../audio';
import { loadPresetSongModel, PRESET_POP_DIATONIC } from '../../song';
import {
  createMemorySongStorage,
  createSandboxStore,
  createSettingsStore,
  createSongStore,
} from '../../state';
import { SongAnalysisPanel } from './SongAnalysisPanel';

afterEach(() => {
  cleanup();
});

function createMockAudioEngine(): AudioEngine {
  return {
    playNote: vi.fn(),
    playEvents: vi.fn(() => []),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 0.8),
    setSoundEnabled: vi.fn(),
    isSoundEnabled: vi.fn(() => true),
    getActiveVoiceCount: vi.fn(() => 0),
    stopAll: vi.fn(),
  };
}

function setupSongAnalysisPanel(options?: {
  presetId?: string;
  selectedBarRange?: [number, number] | null;
  currentBar?: number;
  inspectedBar?: number | null;
}) {
  const songStorage = createMemorySongStorage();
  const initialSong = loadPresetSongModel(options?.presetId ?? PRESET_POP_DIATONIC.id);
  const songStore = createSongStore({
    storage: songStorage,
    initialSong,
  });

  if (options?.currentBar !== undefined) {
    songStore.getState().setCurrentBar(options.currentBar);
  }
  if (options?.selectedBarRange !== undefined) {
    songStore.getState().setSelectedBarRange(options.selectedBarRange);
  }
  if (options?.inspectedBar !== undefined) {
    songStore.getState().setInspectedBar(options.inspectedBar);
  }

  const settingsStore = createSettingsStore({
    storageName: `test-settings-analysis-${Math.random()}`,
  });
  const sandboxStore = createSandboxStore();
  const mockAudio = createMockAudioEngine();

  const onOpenInSandbox = vi.fn();
  const onCreateSrsDeck = vi.fn();
  const onPracticeInDrills = vi.fn();

  const renderResult = render(
    <SongAnalysisPanel
      songStore={songStore}
      settingsStore={settingsStore}
      sandboxStore={sandboxStore}
      audioEngine={mockAudio}
      onOpenInSandbox={onOpenInSandbox}
      onCreateSrsDeck={onCreateSrsDeck}
      onPracticeInDrills={onPracticeInDrills}
    />,
  );

  return {
    ...renderResult,
    songStore,
    settingsStore,
    sandboxStore,
    mockAudio,
    onOpenInSandbox,
    onCreateSrsDeck,
    onPracticeInDrills,
  };
}

describe('SongAnalysisPanel — Hito C8 Parte 2', () => {
  it('renderiza la cabecera completa con título, subtítulo dinámico y conmutador de FUENTE', () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    expect(screen.getByTestId('song-analysis-panel')).toBeTruthy();
    expect(screen.getByText('Análisis del fragmento')).toBeTruthy();
    expect(screen.getByText(/Analizando: compases 1–4/i)).toBeTruthy();

    const pistaActivaBtn = screen.getByRole('button', { name: 'Pista activa' });
    const todasBtn = screen.getByRole('button', { name: 'Todas' });
    expect(pistaActivaBtn).toBeTruthy();
    expect(todasBtn).toBeTruthy();
    expect(pistaActivaBtn.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      fireEvent.click(todasBtn);
    });
    expect(songStore.getState().analysisSource).toBe('all-tracks');
    expect(todasBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('muestra la sección de Tonalidad y escalas sugeridas con candidatos ordenados, porcentajes y razones', () => {
    setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    expect(screen.getByText('Tonalidad y escalas sugeridas')).toBeTruthy();

    // Candidato #1 en compases 1–4 (Intro): C mayor · Jónico
    const cand1 = screen.getByTestId('scale-candidate-1');
    expect(cand1).toBeTruthy();
    expect(cand1.textContent).toContain('C mayor · Jónico');
    expect(cand1.textContent).toMatch(/%|duración/);

    // Candidatos siguientes presentes
    expect(screen.getByTestId('scale-candidate-2')).toBeTruthy();
  });

  it('permite escuchar la escala candidata con el botón Play', () => {
    const { mockAudio } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    const cand1 = screen.getByTestId('scale-candidate-1');
    const playBtn = cand1.querySelector('button[aria-label*="Escuchar escala"]');
    expect(playBtn).toBeTruthy();

    act(() => {
      fireEvent.click(playBtn!);
    });

    expect(mockAudio.playEvents).toHaveBeenCalled();
  });

  it('activa la previsualización en mástil y piano al pasar el ratón (hover) sobre una escala candidata', () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    const cand1 = screen.getByTestId('scale-candidate-1');

    act(() => {
      fireEvent.mouseEnter(cand1);
    });
    expect(songStore.getState().previewContext).toEqual({
      kind: 'scale',
      root: 0,
      type: 'major',
    });

    act(() => {
      fireEvent.mouseLeave(cand1);
    });
    expect(songStore.getState().previewContext).toBeNull();
  });

  it('permite fijar y restablecer la tonalidad manualmente con el botón Fijar tonalidad', async () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    const pinBtn = screen.getByTestId('pin-scale-1');
    expect(pinBtn.textContent).toContain('Fijar tonalidad');

    await act(async () => {
      fireEvent.click(pinBtn);
    });

    // Debe haberse fijado en los compases 1 a 4
    expect(songStore.getState().barOverrides[1]?.scaleId).toBe('major');
    expect(songStore.getState().barOverrides[4]?.scaleId).toBe('major');
    expect(pinBtn.textContent).toContain('✓ Fijada');

    // Al volver a pulsar, se restablece a automático
    await act(async () => {
      fireEvent.click(pinBtn);
    });
    expect(songStore.getState().barOverrides[1]?.scaleId).toBeUndefined();
    expect(pinBtn.textContent).toContain('Fijar tonalidad');
  });

  it('muestra la tira de progresión de acordes en números romanos y resalta el compás inspeccionado', () => {
    setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 3,
    });

    expect(screen.getByText('Acordes y progresión')).toBeTruthy();

    // Chips de compases 1, 2, 3, 4
    const chip1 = screen.getByTestId('progression-chip-1');
    const chip2 = screen.getByTestId('progression-chip-2');
    const chip3 = screen.getByTestId('progression-chip-3');
    const chip4 = screen.getByTestId('progression-chip-4');

    expect(chip1).toBeTruthy();
    expect(chip2).toBeTruthy();
    expect(chip3).toBeTruthy();
    expect(chip4).toBeTruthy();

    // Compás 3 (Am vi) está inspeccionado (aria-pressed=true)
    expect(chip3.getAttribute('aria-pressed')).toBe('true');
    expect(chip1.getAttribute('aria-pressed')).toBe('false');

    // Texto de coincidencia de plantilla
    expect(screen.getByText(/Coincide con la plantilla/i)).toBeTruthy();
  });

  it('permite anclar un compás diferente al hacer clic en un chip de la progresión', () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 3,
    });

    const chip1 = screen.getByTestId('progression-chip-1');

    act(() => {
      fireEvent.click(chip1);
    });
    expect(songStore.getState().inspectedBar).toBe(1);

    // Clic en el mismo chip lo desancla
    act(() => {
      fireEvent.click(chip1);
    });
    expect(songStore.getState().inspectedBar).toBeNull();
  });

  it('reproduce los acordes de la progresión al pulsar Escuchar progresión', () => {
    const { mockAudio } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    const playProgBtn = screen.getByRole('button', { name: /Escuchar la progresión/i });
    expect(playProgBtn).toBeTruthy();

    act(() => {
      fireEvent.click(playProgBtn);
    });

    expect(mockAudio.playEvents).toHaveBeenCalled();
  });

  it('muestra los candidatos de acorde para el compás inspeccionado con porcentaje y razones', () => {
    setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 2,
    });

    expect(screen.getByText('CANDIDATOS DEL COMPÁS 2')).toBeTruthy();

    const chordCand1 = screen.getByTestId('chord-candidate-1');
    expect(chordCand1).toBeTruthy();
    expect(chordCand1.textContent).toContain('Am');
    expect(chordCand1.textContent).toContain('vi');
    expect(chordCand1.textContent).toMatch(/%/);
  });

  it('activa la previsualización de acorde al pasar el ratón (hover) sobre un candidato de acorde', () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 2,
    });

    const chordCand1 = screen.getByTestId('chord-candidate-1');

    act(() => {
      fireEvent.mouseEnter(chordCand1);
    });

    expect(songStore.getState().previewContext).toEqual({
      kind: 'chord',
      root: 9,
      quality: 'm',
    });

    act(() => {
      fireEvent.mouseLeave(chordCand1);
    });
    expect(songStore.getState().previewContext).toBeNull();
  });

  it('permite fijar y restablecer manualmente un acorde para el compás inspeccionado', async () => {
    const { songStore } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 2,
    });

    const pinChordBtn = screen.getByTestId('pin-chord-1');
    expect(pinChordBtn.textContent).toContain('Fijar');

    await act(async () => {
      fireEvent.click(pinChordBtn);
    });

    expect(songStore.getState().barOverrides[2]?.chordId).toBe('Am');
    expect(pinChordBtn.textContent).toContain('✓ Fijado');

    await act(async () => {
      fireEvent.click(pinChordBtn);
    });
    expect(songStore.getState().barOverrides[2]?.chordId).toBeUndefined();
    expect(pinChordBtn.textContent).toContain('Fijar');
  });

  it('permite enviar escala o acorde al Sandbox mediante el botón Sandbox', () => {
    const { onOpenInSandbox } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
      inspectedBar: 2,
    });

    // Botón Sandbox en escala candidata #1
    const cand1 = screen.getByTestId('scale-candidate-1');
    const sandboxScaleBtn = cand1.querySelector('button[aria-label*="en Sandbox"]');
    expect(sandboxScaleBtn).toBeTruthy();

    act(() => {
      fireEvent.click(sandboxScaleBtn!);
    });
    expect(onOpenInSandbox).toHaveBeenCalledWith({
      kind: 'scale',
      root: 0,
      type: 'major',
    });

    // Botón Sandbox en acorde candidato #1 (Am en compás 2)
    const chordCand1 = screen.getByTestId('chord-candidate-1');
    const sandboxChordBtn = chordCand1.querySelector('button[aria-label*="en Sandbox"]');
    expect(sandboxChordBtn).toBeTruthy();

    act(() => {
      fireEvent.click(sandboxChordBtn!);
    });
    expect(onOpenInSandbox).toHaveBeenCalledWith({
      kind: 'chord',
      root: 9,
      quality: 'm',
    });
  });

  it('conecta los 3 botones del pie: Abrir en Sandbox, Crear/añadir a mazo SRS y Practicar en Ejercicios', () => {
    const { onOpenInSandbox, onCreateSrsDeck, onPracticeInDrills } = setupSongAnalysisPanel({
      selectedBarRange: [1, 4],
    });

    const openSandboxBtn = screen.getByTestId('bridge-open-sandbox');
    const createSrsBtn = screen.getByTestId('bridge-create-srs');
    const practiceDrillsBtn = screen.getByTestId('bridge-practice-drills');

    expect(openSandboxBtn).toBeTruthy();
    expect(createSrsBtn).toBeTruthy();
    expect(practiceDrillsBtn).toBeTruthy();

    act(() => {
      fireEvent.click(openSandboxBtn);
    });
    expect(onOpenInSandbox).toHaveBeenCalled();

    act(() => {
      fireEvent.click(createSrsBtn);
    });
    expect(onCreateSrsDeck).toHaveBeenCalled();

    act(() => {
      fireEvent.click(practiceDrillsBtn);
    });
    expect(onPracticeInDrills).toHaveBeenCalled();
  });
});
