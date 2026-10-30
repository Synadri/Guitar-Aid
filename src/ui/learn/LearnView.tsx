import { useState } from 'react';
import styles from './LearnView.module.css';

export type LearnTab = 'drills' | 'cards' | 'formulas' | 'progress';

export interface LearnViewProps {
  initialTab?: LearnTab;
  streakDays?: number;
}

export function LearnView({ initialTab = 'drills', streakDays = 0 }: LearnViewProps) {
  const [activeTab, setActiveTab] = useState<LearnTab>(initialTab);

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
          <span className={styles.streakBadge} aria-label={`Racha de ${streakDays} días`}>
            <span className={styles.streakIcon} aria-hidden="true">
              🔥
            </span>
            Racha: {streakDays} días
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
            className={styles.placeholderCard}
            data-testid="learn-panel-drills"
          >
            <h2 className={styles.placeholderTitle}>Ejercicios</h2>
            <p className={styles.placeholderDesc}>
              Práctica intensiva de reconocimiento y construcción de notas e intervalos en el
              mástil y el piano con visión lineal y corrección automática.
            </p>
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
            className={styles.placeholderCard}
            data-testid="learn-panel-formulas"
          >
            <h2 className={styles.placeholderTitle}>Fórmulas</h2>
            <p className={styles.placeholderDesc}>
              Traductor bidireccional interactivo entre nombres y fórmulas de intervalos de acordes
              y escalas con regla cromática lineal.
            </p>
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
