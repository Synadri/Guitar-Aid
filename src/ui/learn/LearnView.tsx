import { useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import {
  sandboxStore as defaultSandboxStore,
  settingsStore as defaultSettingsStore,
  drillsStore as defaultDrillsStore,
  decksStore as defaultDecksStore,
  type SandboxStore,
  type SettingsStore,
  type DrillsStore,
} from '../../state';
import { audioEngine as defaultAudioEngine, type AudioEngine } from '../../audio';
import { getStudyDayKey } from '../../learning/srs/queue';
import { FormulasView } from './formulas/FormulasView';
import { DrillsView } from './drills/DrillsView';
import styles from './LearnView.module.css';

export type LearnTab = 'drills' | 'cards' | 'formulas' | 'progress';

export interface LearnViewProps {
  initialTab?: LearnTab;
  streakDays?: number;
  sandboxStore?: StoreApi<SandboxStore>;
  settingsStore?: StoreApi<SettingsStore>;
  drillsStore?: StoreApi<DrillsStore>;
  audioEngine?: AudioEngine;
  onNavigateToSandbox?: () => void;
}

/** Calcula la racha activa de días consecutivos con al menos una sesión o repaso (corte a las 04:00). */
function computeActiveStreak(
  drillsHistory: readonly { date: string }[],
  decksHistory: readonly { at: number }[],
  now: number = Date.now(),
): number {
  const activeDays = new Set<string>();
  for (const d of drillsHistory) {
    const ts = new Date(d.date).getTime();
    if (!isNaN(ts)) {
      activeDays.add(getStudyDayKey(ts));
    }
  }
  for (const h of decksHistory) {
    if (typeof h.at === 'number') {
      activeDays.add(getStudyDayKey(h.at));
    }
  }

  const todayKey = getStudyDayKey(now);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayKey = getStudyDayKey(now - oneDayMs);

  let currentCheckDay = now;
  let streak = 0;

  if (activeDays.has(todayKey)) {
    streak = 1;
    currentCheckDay = now - oneDayMs;
  } else if (activeDays.has(yesterdayKey)) {
    streak = 1;
    currentCheckDay = now - 2 * oneDayMs;
  } else {
    return 0;
  }

  while (true) {
    const dayKey = getStudyDayKey(currentCheckDay);
    if (activeDays.has(dayKey)) {
      streak++;
      currentCheckDay -= oneDayMs;
    } else {
      break;
    }
  }

  return streak;
}

export function LearnView({
  initialTab = 'drills',
  streakDays,
  sandboxStore = defaultSandboxStore,
  settingsStore = defaultSettingsStore,
  drillsStore = defaultDrillsStore,
  audioEngine = defaultAudioEngine,
  onNavigateToSandbox,
}: LearnViewProps) {
  const [activeTab, setActiveTab] = useState<LearnTab>(initialTab);

  const drillsHistory = useStore(drillsStore, (s) => s.history);
  const decksHistory = useStore(defaultDecksStore, (s) => s.history);

  const resolvedStreak =
    streakDays !== undefined
      ? streakDays
      : computeActiveStreak(drillsHistory, decksHistory);

  return (
    <div
      className={styles.learnContainer}
      data-testid="learn-container"
      role="region"
      aria-label="Modo Aprender"
    >
      {/* Barra superior de Aprender */}
      <header className={styles.topBar}>
        <div className={styles.tabList} role="tablist" aria-label="Secciones de Aprender">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'drills'}
            aria-controls="learn-tabpanel-drills"
            id="learn-tab-drills"
            className={`${styles.tabButton} ${activeTab === 'drills' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('drills')}
          >
            Ejercicios
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cards'}
            aria-controls="learn-tabpanel-cards"
            id="learn-tab-cards"
            className={`${styles.tabButton} ${activeTab === 'cards' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            Tarjetas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'formulas'}
            aria-controls="learn-tabpanel-formulas"
            id="learn-tab-formulas"
            className={`${styles.tabButton} ${activeTab === 'formulas' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('formulas')}
          >
            Fórmulas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'progress'}
            aria-controls="learn-tabpanel-progress"
            id="learn-tab-progress"
            className={`${styles.tabButton} ${activeTab === 'progress' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            Progreso
          </button>
        </div>

        <div className={styles.topBarRight}>
          <span className={styles.streakBadge} aria-label={`Racha de ${resolvedStreak} días`}>
            <span className={styles.streakIcon} aria-hidden="true">
              🔥
            </span>
            Racha: {resolvedStreak} días
          </span>
        </div>
      </header>

      {/* Área de contenido de la sección activa */}
      <main className={styles.contentArea}>
        {activeTab === 'drills' && (
          <div
            id="learn-tabpanel-drills"
            role="tabpanel"
            aria-labelledby="learn-tab-drills"
            style={{ width: '100%', height: '100%' }}
            data-testid="learn-panel-drills"
          >
            <DrillsView
              drillsStore={drillsStore}
              settingsStore={settingsStore}
              audioEngine={audioEngine}
            />
          </div>
        )}

        {activeTab === 'cards' && (
          <div
            id="learn-tabpanel-cards"
            role="tabpanel"
            aria-labelledby="learn-tab-cards"
            className={styles.placeholderCard}
            data-testid="learn-panel-cards"
          >
            <h2 className={styles.placeholderTitle}>Tarjetas</h2>
            <p className={styles.placeholderDesc}>
              Memorización a largo plazo con repetición espaciada (SM-2): mazos personalizados de
              acordes, escalas, digitaciones y progresiones.
            </p>
          </div>
        )}

        {activeTab === 'formulas' && (
          <div
            id="learn-tabpanel-formulas"
            role="tabpanel"
            aria-labelledby="learn-tab-formulas"
            style={{ width: '100%', height: '100%' }}
            data-testid="learn-panel-formulas"
          >
            <FormulasView
              sandboxStore={sandboxStore}
              settingsStore={settingsStore}
              audioEngine={audioEngine}
              onOpenInSandbox={(ctx) => {
                sandboxStore.getState().setContext(ctx);
                onNavigateToSandbox?.();
              }}
            />
          </div>
        )}

        {activeTab === 'progress' && (
          <div
            id="learn-tabpanel-progress"
            role="tabpanel"
            aria-labelledby="learn-tab-progress"
            className={styles.placeholderCard}
            data-testid="learn-panel-progress"
          >
            <h2 className={styles.placeholderTitle}>Progreso</h2>
            <p className={styles.placeholderDesc}>
              Mapa de aciertos del mástil, análisis de intervalos débiles, estadísticas de tarjetas y
              copia de seguridad en JSON.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
