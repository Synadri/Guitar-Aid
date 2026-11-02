import { useEffect, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  drillsStore as defaultDrillsStore,
  decksStore as defaultDecksStore,
  songStore as defaultSongStore,
  type SandboxStore,
  type SettingsStore,
  type DrillsStore,
  type DecksStore,
  type SongStore,
} from '../../state';
import { audioEngine as defaultAudioEngine, type AudioEngine } from '../../audio';
import { SideNav, type AppMode } from '../layout/SideNav';
import { SandboxView } from '../sandbox/SandboxView';
import { LearnView, type LearnTab } from '../learn/LearnView';
import { SongView } from '../song/SongView';
import styles from './AppShell.module.css';

export interface AppShellProps {
  initialMode?: AppMode;
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  drillsStore?: StoreApi<DrillsStore>;
  decksStore?: StoreApi<DecksStore>;
  songStore?: StoreApi<SongStore>;
  audioEngine?: AudioEngine;
}

export function AppShell({
  initialMode = 'sandbox',
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  drillsStore = defaultDrillsStore,
  decksStore = defaultDecksStore,
  songStore = defaultSongStore,
  audioEngine = defaultAudioEngine,
}: AppShellProps) {
  const [currentMode, setCurrentMode] = useState<AppMode>(initialMode);
  const [learnTab, setLearnTab] = useState<LearnTab>('drills');
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
            initialTab={learnTab}
            sandboxStore={sandboxStore}
            settingsStore={settingsStore}
            drillsStore={drillsStore}
            decksStore={decksStore}
            audioEngine={audioEngine}
            onNavigateToSandbox={() => setCurrentMode('sandbox')}
          />
        )}

        {currentMode === 'cancion' && (
          <SongView
            songStore={songStore}
            settingsStore={settingsStore}
            sandboxStore={sandboxStore}
            drillsStore={drillsStore}
            decksStore={decksStore}
            audioEngine={audioEngine}
            onOpenInSandbox={(ctx) => {
              sandboxStore.getState().setContext(ctx);
              setCurrentMode('sandbox');
            }}
            onNavigateToSandbox={() => setCurrentMode('sandbox')}
            onNavigateToLearn={(tab = 'drills') => {
              setLearnTab(tab);
              setCurrentMode('learn');
            }}
          />
        )}
      </div>
    </div>
  );
}
