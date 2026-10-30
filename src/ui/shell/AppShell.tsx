import { useEffect, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  drillsStore as defaultDrillsStore,
  type SandboxStore,
  type SettingsStore,
  type DrillsStore,
} from '../../state';
import { audioEngine as defaultAudioEngine, type AudioEngine } from '../../audio';
import { SideNav, type AppMode } from '../layout/SideNav';
import { SandboxView } from '../sandbox/SandboxView';
import { LearnView } from '../learn/LearnView';
import styles from './AppShell.module.css';

export interface AppShellProps {
  initialMode?: AppMode;
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  drillsStore?: StoreApi<DrillsStore>;
  audioEngine?: AudioEngine;
}

export function AppShell({
  initialMode = 'sandbox',
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  drillsStore = defaultDrillsStore,
  audioEngine = defaultAudioEngine,
}: AppShellProps) {
  const [currentMode, setCurrentMode] = useState<AppMode>(initialMode);
  const sideNavExpanded = useStore(settingsStore, (s) => s.sideNavExpanded);

  // Atajo global: M (alternar sonido en modo fuera de Sandbox, ya que SandboxView maneja su propio M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if ((e.key === 'm' || e.key === 'M') && currentMode !== 'sandbox') {
        e.preventDefault();
        const nextSound = !settingsStore.getState().soundEnabled;
        settingsStore.getState().setSoundEnabled(nextSound);
        audioEngine?.setSoundEnabled?.(nextSound);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsStore, audioEngine, currentMode]);

  return (
    <div className={styles.appShell} data-testid="app-shell" data-theme="dark">
      {/* 1. Menú lateral de navegación */}
      <SideNav
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        expanded={sideNavExpanded}
        onToggleExpand={() => settingsStore.getState().setSideNavExpanded(!sideNavExpanded)}
      />

      {/* 2. Área principal de contenido */}
      <div className={styles.content}>
        {currentMode === 'sandbox' && (
          <SandboxView
            sandboxStore={sandboxStore}
            settingsStore={settingsStore}
            audioEngine={audioEngine}
          />
        )}

        {(currentMode === 'learn' || currentMode === 'tests') && (
          <LearnView
            sandboxStore={sandboxStore}
            settingsStore={settingsStore}
            drillsStore={drillsStore}
            audioEngine={audioEngine}
            onNavigateToSandbox={() => setCurrentMode('sandbox')}
          />
        )}

        {currentMode === 'cancion' && (
          <div className={styles.comingSoonContainer}>
            <div className={styles.comingSoonCard}>
              <div className={styles.comingSoonIcon} aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h2 className={styles.comingSoonTitle}>Modo Canción — Fase 3</h2>
              <p className={styles.comingSoonDesc}>
                Importa tablaturas, reproduce bucles, visualiza acordes en tiempo real y analiza
                progresiones de tus canciones favoritas.
              </p>
              <button
                type="button"
                className={styles.comingSoonBtn}
                onClick={() => setCurrentMode('sandbox')}
              >
                Volver a Sandbox
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
