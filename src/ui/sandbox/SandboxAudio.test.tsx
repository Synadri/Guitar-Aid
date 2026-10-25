// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ARPEGGIO_SPACING,
  createAudioEngine,
  type AudioContextLike,
  type AudioEngine,
  type AudioNodeLike,
} from '../../audio';
import {
  SETTINGS_STORAGE_KEY,
  createMemoryStorage,
  createSandboxStore,
  createSettingsStore,
  selectedVoicing,
  type MemoryStorage,
  type PersistedSettings,
} from '../../state';
import { SandboxView } from './SandboxView';

afterEach(() => {
  cleanup();
});

function createSilentAudioContext(): AudioContextLike {
  const destination: AudioNodeLike = {
    connect: () => destination,
    disconnect: () => {},
  };
  return {
    currentTime: 0,
    state: 'running',
    destination,
    resume: () => Promise.resolve(),
    createOscillator: () => ({
      type: 'triangle',
      frequency: { value: 440 },
      onended: null,
      connect: () => destination,
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    }),
    createGain: () => ({
      gain: { value: 1 },
      connect: () => destination,
      disconnect: () => {},
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { value: 1000 },
      connect: () => destination,
      disconnect: () => {},
    }),
  };
}

function setupIsolated(storage: MemoryStorage = createMemoryStorage()) {
  const sandboxStore = createSandboxStore();
  const settingsStore = createSettingsStore({
    storage,
    syncWithSandbox: sandboxStore,
  });
  const engine: AudioEngine = createAudioEngine({
    createContext: createSilentAudioContext,
    initialVolume: settingsStore.getState().volume,
    initialSoundEnabled: settingsStore.getState().soundEnabled,
  });
  const playNoteSpy = vi.spyOn(engine, 'playNote');
  const playEventsSpy = vi.spyOn(engine, 'playEvents');
  const setVolumeSpy = vi.spyOn(engine, 'setVolume');
  const setSoundEnabledSpy = vi.spyOn(engine, 'setSoundEnabled');

  return {
    sandboxStore,
    settingsStore,
    storage,
    engine,
    playNoteSpy,
    playEventsSpy,
    setVolumeSpy,
    setSoundEnabledSpy,
  };
}

describe('SandboxView — integración de sonido en la interfaz (U6)', () => {
  it('(f) en la interfaz: pulsar una posición del mástil o una tecla del piano toca el MIDI correcto, quitarla no toca nada, y con el sonido desactivado no toca', () => {
    const { sandboxStore, settingsStore, engine, playNoteSpy } = setupIsolated();
    render(
      <SandboxView
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={engine}
      />,
    );

    // 1. Pulsar cuerda 5, traste 7 (E3 = MIDI 52) añade/fija la nota → suena 52
    const pos57 = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    fireEvent.click(pos57);
    expect(playNoteSpy).toHaveBeenCalledTimes(1);
    expect(playNoteSpy).toHaveBeenLastCalledWith(52);

    // 2. Pulsar otra posición equivalente (cuerda 6, traste 12 = E3) también la fija → suena 52
    const pos612 = screen.getByRole('button', { name: 'Cuerda 6, traste 12, E3' });
    fireEvent.click(pos612);
    expect(playNoteSpy).toHaveBeenCalledTimes(2);
    expect(playNoteSpy).toHaveBeenLastCalledWith(52);

    // 3. Quitar/desfijar (5, 7) y (6, 12) NO toca nada
    playNoteSpy.mockClear();
    fireEvent.click(pos57);
    fireEvent.click(pos612);
    expect(playNoteSpy).not.toHaveBeenCalled();

    // 4. Pulsar la tecla C4 (MIDI 60) en el piano añade la nota → suena 60
    const keyC4 = screen.getByRole('button', { name: 'C4' });
    fireEvent.click(keyC4);
    expect(playNoteSpy).toHaveBeenCalledTimes(1);
    expect(playNoteSpy).toHaveBeenLastCalledWith(60);

    // 5. Quitar la tecla activa C4 del piano NO toca nada
    playNoteSpy.mockClear();
    fireEvent.click(keyC4);
    expect(playNoteSpy).not.toHaveBeenCalled();

    // 6. Con el interruptor de sonido desactivado, poner notas en guitarra o piano NO toca nada
    const soundCheckbox = screen.getByLabelText('Sonido');
    fireEvent.click(soundCheckbox);
    playNoteSpy.mockClear();

    fireEvent.click(pos57);
    fireEvent.click(keyC4);
    expect(playNoteSpy).not.toHaveBeenCalled();
  });

  it('(g) “Reproducir” muestra los modos correctos según el contexto y llama a los eventos esperados (Arpegio de C3 E3 G3 → tres eventos en orden)', () => {
    const { sandboxStore, settingsStore, engine, playEventsSpy } = setupIsolated();
    render(
      <SandboxView
        sandboxStore={sandboxStore}
        settingsStore={settingsStore}
        audioEngine={engine}
      />,
    );

    const playbackGroup = screen.getByRole('group', { name: 'Reproducir' });

    // Sin selección: ningún modo disponible
    expect(within(playbackGroup).queryByRole('button', { name: 'Acorde' })).toBeNull();
    expect(within(playbackGroup).queryByRole('button', { name: 'Arpegio' })).toBeNull();
    expect(within(playbackGroup).queryByRole('button', { name: 'Escala' })).toBeNull();

    // Pulsar G3 (55), C3 (48) y E3 (52) en el piano (en orden desordenado)
    fireEvent.click(screen.getByRole('button', { name: 'G3' }));
    fireEvent.click(screen.getByRole('button', { name: 'C3' }));
    fireEvent.click(screen.getByRole('button', { name: 'E3' }));

    // Con notas pulsadas en foco: muestra Acorde y Arpegio, y no Escala
    const btnChord = within(playbackGroup).getByRole('button', { name: 'Acorde' });
    const btnArpeggio = within(playbackGroup).getByRole('button', { name: 'Arpegio' });
    expect(within(playbackGroup).queryByRole('button', { name: 'Escala' })).toBeNull();

    // Pulsar "Arpegio": llama a playEvents con los tres eventos de C3 (48), E3 (52), G3 (55) en orden
    playEventsSpy.mockClear();
    fireEvent.click(btnArpeggio);
    expect(playEventsSpy).toHaveBeenCalledTimes(1);
    const arpCallEvents = playEventsSpy.mock.calls[0]?.[0] ?? [];
    expect(arpCallEvents).toHaveLength(3);
    expect(arpCallEvents.map((e) => e.midi)).toEqual([48, 52, 55]);
    expect(arpCallEvents.map((e) => e.start)).toEqual([
      0,
      DEFAULT_ARPEGGIO_SPACING,
      Number((2 * DEFAULT_ARPEGGIO_SPACING).toFixed(6)),
    ]);

    // Pulsar "Acorde": los tres eventos empiezan en start = 0
    playEventsSpy.mockClear();
    fireEvent.click(btnChord);
    expect(playEventsSpy).toHaveBeenCalledTimes(1);
    const chordCallEvents = playEventsSpy.mock.calls[0]?.[0] ?? [];
    expect(chordCallEvents.map((e) => e.midi)).toEqual([48, 52, 55]);
    expect(chordCallEvents.every((e) => e.start === 0)).toBe(true);

    // Elegir un acorde del menú (Am7): sigue mostrando Acorde y Arpegio y toca las notas reales del voicing elegido
    fireEvent.change(screen.getByLabelText('Tónica del acorde'), { target: { value: '9' } }); // A
    fireEvent.change(screen.getByLabelText('Calidad del acorde'), { target: { value: 'm7' } });

    expect(within(playbackGroup).getByRole('button', { name: 'Acorde' })).toBeTruthy();
    expect(within(playbackGroup).getByRole('button', { name: 'Arpegio' })).toBeTruthy();
    expect(within(playbackGroup).queryByRole('button', { name: 'Escala' })).toBeNull();

    const activeVoicing = selectedVoicing(sandboxStore.getState())!;
    expect(activeVoicing).not.toBeNull();
    const expectedVoicingMidis = [...new Set(activeVoicing.midis)].sort((a, b) => a - b);

    playEventsSpy.mockClear();
    fireEvent.click(within(playbackGroup).getByRole('button', { name: 'Arpegio' }));
    expect(playEventsSpy).toHaveBeenCalledTimes(1);
    expect(playEventsSpy.mock.calls[0]?.[0].map((e) => e.midi)).toEqual(expectedVoicingMidis);

    // En una afinación abierta sin digitación (Open G), toca las notas del acorde en una octava razonable (A3 C4 E4 G4)
    fireEvent.change(screen.getByLabelText('Afinación'), { target: { value: 'openG' } });
    playEventsSpy.mockClear();
    fireEvent.click(within(playbackGroup).getByRole('button', { name: 'Acorde' }));
    expect(playEventsSpy).toHaveBeenCalledTimes(1);
    expect(playEventsSpy.mock.calls[0]?.[0].map((e) => e.midi)).toEqual([57, 60, 64, 67]);

    // Elegir una escala del menú (C Mayor): muestra únicamente "Escala" y toca C3..C4 (8 notas)
    fireEvent.change(screen.getByLabelText('Tónica de la escala'), { target: { value: '0' } }); // C
    expect(within(playbackGroup).queryByRole('button', { name: 'Acorde' })).toBeNull();
    expect(within(playbackGroup).queryByRole('button', { name: 'Arpegio' })).toBeNull();
    const btnScale = within(playbackGroup).getByRole('button', { name: 'Escala' });

    playEventsSpy.mockClear();
    fireEvent.click(btnScale);
    expect(playEventsSpy).toHaveBeenCalledTimes(1);
    expect(playEventsSpy.mock.calls[0]?.[0].map((e) => e.midi)).toEqual([
      48, 50, 52, 53, 55, 57, 59, 60,
    ]);
  });

  it('(h) el interruptor y el volumen se guardan en los ajustes', () => {
    const sharedStorage = createMemoryStorage();
    const first = setupIsolated(sharedStorage);
    const { unmount } = render(
      <SandboxView
        sandboxStore={first.sandboxStore}
        settingsStore={first.settingsStore}
        audioEngine={first.engine}
      />,
    );

    const soundCheckbox = screen.getByLabelText<HTMLInputElement>('Sonido');
    const volumeSlider = screen.getByLabelText<HTMLInputElement>('Volumen');
    expect(soundCheckbox.checked).toBe(true);
    expect(Number(volumeSlider.value)).toBeCloseTo(0.8, 5);

    // Cambiar volumen a 0.35 y desactivar el sonido desde la barra
    fireEvent.change(volumeSlider, { target: { value: '0.35' } });
    fireEvent.click(soundCheckbox);

    expect(first.settingsStore.getState().volume).toBeCloseTo(0.35, 5);
    expect(first.settingsStore.getState().soundEnabled).toBe(false);
    expect(first.engine.getVolume()).toBeCloseTo(0.35, 5);
    expect(first.engine.isSoundEnabled()).toBe(false);

    // Verificar que quedó persistido en storage
    const raw = sharedStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: PersistedSettings };
    expect(parsed.state.volume).toBeCloseTo(0.35, 5);
    expect(parsed.state.soundEnabled).toBe(false);

    unmount();

    // Un montaje nuevo leyendo del mismo storage restaura soundEnabled y volume y los aplica al motor
    const second = setupIsolated(sharedStorage);
    render(
      <SandboxView
        sandboxStore={second.sandboxStore}
        settingsStore={second.settingsStore}
        audioEngine={second.engine}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>('Sonido').checked).toBe(false);
    expect(Number(screen.getByLabelText<HTMLInputElement>('Volumen').value)).toBeCloseTo(0.35, 5);
    expect(second.engine.getVolume()).toBeCloseTo(0.35, 5);
    expect(second.engine.isSoundEnabled()).toBe(false);
  });
});
