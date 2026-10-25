import { describe, expect, it, vi } from 'vitest';
import { getTuning, STANDARD_TUNING } from '../../theory';
import { createSandboxStore, sandboxStore } from '../sandbox';
import {
  createMemoryStorage,
  createSettingsStore,
  initialSettingsState,
  SETTINGS_STORAGE_KEY,
  settingsStore,
} from './store';

const dropD = getTuning('dropD')!;

function createTestSettings(initialOverrides = {}) {
  const storage = createMemoryStorage();
  const store = createSettingsStore({
    storage,
    storageName: 'test:settings',
    initialOverrides,
  });
  return {
    store,
    storage,
    get: () => store.getState(),
  };
}

describe('Hito S2 — Store de ajustes: valores por defecto y acciones', () => {
  it('inicializa con los valores por defecto especificados en Requisitos §6.7 y plan_fase1', () => {
    const { get } = createTestSettings();
    expect(get().tuning).toEqual(STANDARD_TUNING);
    expect(get().orientation).toBe('horizontal');
    expect(get().visibleInstruments).toEqual({ fretboard: true, piano: true });
    expect(get().leftHanded).toBe(false);
    expect(get().nameMode).toBe('sharps');
    expect(get().labels).toBe('note');
    expect(get().suggestionsMode).toBe('chords');
    expect(get().volume).toBe(0.8);
    expect(get().soundEnabled).toBe(true);
    expect(get().showAllPositions).toBe(true);
  });

  it('permite cambiar la afinación por objeto Tuning o por ID string', () => {
    const { get } = createTestSettings();

    get().setTuning(dropD);
    expect(get().tuning.id).toBe('dropD');

    get().setTuning('halfDown');
    expect(get().tuning.id).toBe('halfDown');

    // Un id inexistente no debe alterar la afinación actual
    get().setTuning('nonexistent-tuning');
    expect(get().tuning.id).toBe('halfDown');
  });

  it('permite cambiar la orientación entre horizontal y vertical', () => {
    const { get } = createTestSettings();
    get().setOrientation('vertical');
    expect(get().orientation).toBe('vertical');
    get().setOrientation('horizontal');
    expect(get().orientation).toBe('horizontal');
  });

  it('gestiona la visibilidad de instrumentos y previene ocultar ambos simultáneamente', () => {
    const { get } = createTestSettings();

    // Ocultar guitarra
    get().toggleInstrument('fretboard');
    expect(get().visibleInstruments).toEqual({ fretboard: false, piano: true });

    // Intentar ocultar el piano cuando la guitarra ya está oculta no debe tener efecto
    get().toggleInstrument('piano');
    expect(get().visibleInstruments).toEqual({ fretboard: false, piano: true });

    // Mostrar guitarra de nuevo
    get().toggleInstrument('fretboard');
    expect(get().visibleInstruments).toEqual({ fretboard: true, piano: true });

    // Ocultar piano
    get().toggleInstrument('piano');
    expect(get().visibleInstruments).toEqual({ fretboard: true, piano: false });

    // setVisibleInstruments parcial
    get().setVisibleInstruments({ fretboard: true, piano: true });
    expect(get().visibleInstruments).toEqual({ fretboard: true, piano: true });

    // setVisibleInstruments rechazando ocultar ambos
    get().setVisibleInstruments({ fretboard: false, piano: false });
    expect(get().visibleInstruments).toEqual({ fretboard: true, piano: true });
  });

  it('permite alternar el modo zurdo', () => {
    const { get } = createTestSettings();
    get().setLeftHanded(true);
    expect(get().leftHanded).toBe(true);
    get().setLeftHanded(false);
    expect(get().leftHanded).toBe(false);
  });

  it('permite alternar el modo de nombres (sostenidos / bemoles)', () => {
    const { get } = createTestSettings();
    get().setNameMode('flats');
    expect(get().nameMode).toBe('flats');
    get().setNameMode('sharps');
    expect(get().nameMode).toBe('sharps');
  });

  it('permite cambiar el tipo de etiquetas (note, interval, degree, none)', () => {
    const { get } = createTestSettings();
    get().setLabels('interval');
    expect(get().labels).toBe('interval');
    get().setLabels('degree');
    expect(get().labels).toBe('degree');
    get().setLabels('none');
    expect(get().labels).toBe('none');
    get().setLabels('note');
    expect(get().labels).toBe('note');
  });

  it('permite cambiar el modo de sugerencias entre chords y scales', () => {
    const { get } = createTestSettings();
    get().setSuggestionsMode('scales');
    expect(get().suggestionsMode).toBe('scales');
    get().setSuggestionsMode('chords');
    expect(get().suggestionsMode).toBe('chords');
  });

  it('acota el volumen entre 0 y 1 y tolera valores fuera de rango', () => {
    const { get } = createTestSettings();
    get().setVolume(0.5);
    expect(get().volume).toBe(0.5);

    get().setVolume(-0.2);
    expect(get().volume).toBe(0);

    get().setVolume(1.8);
    expect(get().volume).toBe(1);

    get().setVolume(Number.NaN);
    expect(get().volume).toBe(0.8);
  });

  it('permite alternar el sonido global y mostrar todas las posiciones', () => {
    const { get } = createTestSettings();
    get().setSoundEnabled(false);
    expect(get().soundEnabled).toBe(false);

    get().setShowAllPositions(false);
    expect(get().showAllPositions).toBe(false);
  });

  it('resetSettings restablece todas las preferencias a sus valores originales', () => {
    const { get } = createTestSettings();
    get().setTuning(dropD);
    get().setOrientation('vertical');
    get().setVisibleInstruments({ fretboard: false });
    get().setLeftHanded(true);
    get().setNameMode('flats');
    get().setLabels('interval');
    get().setSuggestionsMode('scales');
    get().setVolume(0.2);
    get().setSoundEnabled(false);
    get().setShowAllPositions(false);

    get().resetSettings();
    expect(get()).toMatchObject(initialSettingsState());
  });
});

describe('Hito S2 — Criterio 8: persistencia en storage', () => {
  it('serializa únicamente los ajustes y no persiste la selección ni funciones', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore({
      storage,
      storageName: 'test:persist',
    });

    store.getState().setOrientation('vertical');
    store.getState().setTuning('dropD');
    store.getState().setLeftHanded(true);

    const raw = storage.getItem('test:persist');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);

    expect(parsed.state).toMatchObject({
      tuningId: 'dropD',
      orientation: 'vertical',
      leftHanded: true,
      nameMode: 'sharps',
      labels: 'note',
      volume: 0.8,
    });
    // Comprobar que no hay notas ni funciones en la serialización
    expect(parsed.state.notes).toBeUndefined();
    expect(parsed.state.context).toBeUndefined();
    expect(parsed.state.setOrientation).toBeUndefined();
  });

  it('criterio 8: recuerda ocultar instrumentos, orientación y afinación tras simular recarga', () => {
    const storage = createMemoryStorage();

    // Sesión 1: el usuario cambia ajustes
    const session1 = createSettingsStore({ storage, storageName: 'test:session' });
    session1.getState().setOrientation('vertical');
    session1.getState().setVisibleInstruments({ fretboard: false, piano: true });
    session1.getState().setTuning('dropD');
    session1.getState().setVolume(0.35);

    // Sesión 2: simular recarga de página leyendo el mismo storage
    const session2 = createSettingsStore({ storage, storageName: 'test:session' });
    expect(session2.getState().orientation).toBe('vertical');
    expect(session2.getState().visibleInstruments).toEqual({ fretboard: false, piano: true });
    expect(session2.getState().tuning.id).toBe('dropD');
    expect(session2.getState().volume).toBe(0.35);
  });

  it('aplica valores de reserva seguros si el storage contiene datos corruptos o antiguos', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'test:corrupt',
      JSON.stringify({
        state: {
          tuningId: 'unknown-alien-tuning',
          orientation: 'diagonal',
          visibleInstruments: { fretboard: false, piano: false },
          labels: 'invalid-label',
          volume: 'muy-alto',
        },
        version: 0,
      }),
    );

    const store = createSettingsStore({ storage, storageName: 'test:corrupt' });
    expect(store.getState().tuning).toEqual(STANDARD_TUNING);
    expect(store.getState().orientation).toBe('horizontal');
    // Al menos un instrumento visible
    expect(
      store.getState().visibleInstruments.fretboard || store.getState().visibleInstruments.piano,
    ).toBe(true);
    expect(store.getState().labels).toBe('note');
    expect(store.getState().volume).toBe(0.8);
  });
});

describe('Hito S2 — Fija una sola fuente de verdad (Settings ↔ Sandbox)', () => {
  it('Arranque: con dropD ya guardado en el almacenamiento, un store nuevo hace que el Sandbox esté en Drop D sin llamar a nada más', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'saved:settings',
      JSON.stringify({
        state: { tuningId: 'dropD', showAllPositions: false },
        version: 0,
      }),
    );

    const sandbox = createSandboxStore();
    const settings = createSettingsStore({
      storage,
      storageName: 'saved:settings',
      syncWithSandbox: sandbox,
    });

    // Sin ninguna llamada manual por parte de la UI, el Sandbox arranca en Drop D
    expect(settings.getState().tuning.id).toBe('dropD');
    expect(sandbox.getState().tuning.id).toBe('dropD');
    expect(sandbox.getState().showAllPositions).toBe(false);
  });

  it('Cambio desde los ajustes: fija E3, cambia la afinación desde settingsStore, y el Sandbox recoloca la nota (una sola vez)', () => {
    const storage = createMemoryStorage();
    const sandbox = createSandboxStore();
    const settings = createSettingsStore({ storage, syncWithSandbox: sandbox });

    // Fijamos E3 en cuerda 6, traste 12 en afinación estándar (MIDI 52)
    sandbox.getState().toggleFretPosition({ string: 6, fret: 12 });
    expect(sandbox.getState().notes[0]!.pinned).toEqual([{ string: 6, fret: 12 }]);

    // Espiamos sandbox.getState().setTuning para certificar que la recolocación ocurre exactamente UNA sola vez
    const originalSetTuning = sandbox.getState().setTuning;
    const setTuningSpy = vi.fn((...args: Parameters<typeof originalSetTuning>) =>
      originalSetTuning(...args),
    );
    sandbox.setState({ setTuning: setTuningSpy });

    // Cambiar la afinación desde settingsStore (la puerta de entrada de ajustes)
    settings.getState().setTuning(dropD);

    // 1. Se invocó la recolocación en el Sandbox exactamente una sola vez (sin bucles ni recolocaciones dobles)
    expect(setTuningSpy).toHaveBeenCalledTimes(1);

    // 2. El Sandbox queda en Drop D y E3 se ha recolocado al traste 14 de la cuerda 6
    expect(sandbox.getState().tuning.id).toBe('dropD');
    expect(sandbox.getState().notes[0]!.pinned).toEqual([{ string: 6, fret: 14 }]);
  });

  it('Cambio desde el Sandbox: llamar a setTuning en el Sandbox deja los ajustes en la misma afinación sin rebote ni recolocación doble', () => {
    const storage = createMemoryStorage();
    const sandbox = createSandboxStore();
    const settings = createSettingsStore({ storage, syncWithSandbox: sandbox });

    // Fijamos E3 en cuerda 6 traste 12 en estándar (MIDI 52)
    sandbox.getState().toggleFretPosition({ string: 6, fret: 12 });
    expect(sandbox.getState().notes[0]!.pinned).toEqual([{ string: 6, fret: 12 }]);

    // Espiamos sandbox.getState().setTuning para certificar que solo se invoca la llamada directa (sin eco desde settings)
    const originalSandboxSetTuning = sandbox.getState().setTuning;
    const sandboxSetTuningSpy = vi.fn((...args: Parameters<typeof originalSandboxSetTuning>) =>
      originalSandboxSetTuning(...args),
    );
    sandbox.setState({ setTuning: sandboxSetTuningSpy });

    // Espiamos settingsStore.getState().setTuning para certificar que la sincronización hacia ajustes es única
    const originalSettingsSetTuning = settings.getState().setTuning;
    const settingsSetTuningSpy = vi.fn((...args: Parameters<typeof originalSettingsSetTuning>) =>
      originalSettingsSetTuning(...args),
    );
    settings.setState({ setTuning: settingsSetTuningSpy });

    // Llamada directa a setTuning en el Sandbox
    sandbox.getState().setTuning(dropD);

    // 1. sandbox.setTuning se ejecutó exactamente una sola vez (la directa, sin ningún rebote posterior)
    expect(sandboxSetTuningSpy).toHaveBeenCalledTimes(1);

    // 2. Las notas fijadas se recolocaron una sola vez (E3 pasa de traste 12 a traste 14)
    expect(sandbox.getState().notes[0]!.pinned).toEqual([{ string: 6, fret: 14 }]);

    // 3. settings.setTuning se invocó una sola vez para sincronizar
    expect(settingsSetTuningSpy).toHaveBeenCalledTimes(1);

    // 4. Los ajustes quedan exactamente en la misma afinación que el Sandbox
    expect(settings.getState().tuning.id).toBe(sandbox.getState().tuning.id);
    expect(settings.getState().tuning.id).toBe('dropD');

    // 5. Se persistió el cambio en el almacenamiento
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.state.tuningId).toBe('dropD');
  });

  it('al cambiar showAllPositions en cualquiera de los dos stores, el otro se actualiza', () => {
    const storage = createMemoryStorage();
    const sandbox = createSandboxStore();
    const settings = createSettingsStore({ storage, syncWithSandbox: sandbox });

    expect(settings.getState().showAllPositions).toBe(true);
    expect(sandbox.getState().showAllPositions).toBe(true);

    settings.getState().setShowAllPositions(false);
    expect(sandbox.getState().showAllPositions).toBe(false);

    sandbox.getState().setShowAllPositions(true);
    expect(settings.getState().showAllPositions).toBe(true);
  });

  it('el singleton settingsStore de la aplicación está conectado a sandboxStore', () => {
    expect(settingsStore).toBeDefined();
    // La afinación de ambos singletons es coherente
    expect(settingsStore.getState().tuning.id).toBe(sandboxStore.getState().tuning.id);
  });
});
