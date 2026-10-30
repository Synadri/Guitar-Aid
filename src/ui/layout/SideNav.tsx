import styles from './SideNav.module.css';

export type AppMode = 'sandbox' | 'learn' | 'cancion' | 'tests';

export interface SideNavProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function SideNav({ currentMode, onSelectMode, expanded, onToggleExpand }: SideNavProps) {
  return (
    <div className={styles.navWrapper}>
      <nav
        className={`${styles.navContainer} ${expanded ? styles.expanded : styles.collapsed}`}
        aria-label="Navegación principal"
      >
        {/* Cabecera / Logo */}
        <div className={styles.header}>
          <div className={styles.brandGroup}>
            <div className={styles.logoIcon} aria-hidden="true">
              <span className={styles.logoBar} />
              <span className={styles.logoBar} />
              <span className={styles.logoBar} />
            </div>
            {expanded && <span className={styles.brandName}>Guitar Aid</span>}
          </div>
          {expanded && (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={onToggleExpand}
              aria-label="Colapsar menú"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
        </div>

        {expanded && <div className={styles.sectionLabel}>Modos</div>}

        {/* Lista de modos */}
        <div className={styles.modesList} role="list">
          {/* 1. Sandbox */}
          <button
            type="button"
            className={styles.modeItem}
            aria-current={currentMode === 'sandbox' ? 'page' : undefined}
            onClick={() => onSelectMode('sandbox')}
            aria-label="Modo Sandbox: Guitarra y piano sincronizados"
          >
            <div className={styles.modeIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </div>
            {expanded ? (
              <div className={styles.modeTextCol}>
                <div className={styles.modeTitleRow}>
                  <span className={styles.modeTitle}>Sandbox</span>
                </div>
                <span className={styles.modeDesc}>Guitarra y piano sincronizados</span>
              </div>
            ) : (
              <span className={styles.modeLabel}>Sandbox</span>
            )}
          </button>

          {/* 2. Aprender */}
          <button
            type="button"
            className={styles.modeItem}
            aria-current={currentMode === 'learn' || currentMode === 'tests' ? 'page' : undefined}
            onClick={() => onSelectMode('learn')}
            aria-label="Modo Aprender: Ejercicios, tarjetas y fórmulas (Fase 2)"
          >
            <div className={styles.modeIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              {!expanded && <span className={styles.collapsedBadge}>F2</span>}
            </div>
            {expanded ? (
              <div className={styles.modeTextCol}>
                <div className={styles.modeTitleRow}>
                  <span className={styles.modeTitle}>Aprender</span>
                  <span className={styles.expandedBadge}>Fase 2</span>
                </div>
                <span className={styles.modeDesc}>Ejercicios, tarjetas y fórmulas</span>
              </div>
            ) : (
              <span className={styles.modeLabel}>Aprender</span>
            )}
          </button>

          {/* 3. Canción */}
          <button
            type="button"
            className={styles.modeItem}
            aria-current={currentMode === 'cancion' ? 'page' : undefined}
            onClick={() => onSelectMode('cancion')}
            aria-label="Modo Canción: Tabs, bucles y análisis (Fase 3)"
          >
            <div className={styles.modeIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {!expanded && <span className={styles.collapsedBadge}>F3</span>}
            </div>
            {expanded ? (
              <div className={styles.modeTextCol}>
                <div className={styles.modeTitleRow}>
                  <span className={styles.modeTitle}>Canción</span>
                  <span className={styles.expandedBadge}>Fase 3</span>
                </div>
                <span className={styles.modeDesc}>Tabs, bucles y análisis</span>
              </div>
            ) : (
              <span className={styles.modeLabel}>Canción</span>
            )}
          </button>
        </div>

        <div className={styles.spacer} />

        {/* Bloque de atajos (solo expandido) */}
        {expanded && (
          <div className={styles.shortcutsCard} aria-label="Atajos de teclado">
            <span className={styles.shortcutsTitle}>Atajos</span>
            <div className={styles.shortcutRow}>
              <span className={styles.kbd}>C</span>
              <span>Limpiar selección</span>
            </div>
            <div className={styles.shortcutRow}>
              <span className={styles.kbd}>M</span>
              <span>Sonido on/off</span>
            </div>
            <div className={styles.shortcutRow}>
              <span className={styles.kbd}>Esc</span>
              <span>Cerrar menús</span>
            </div>
          </div>
        )}

        {/* Pie con botón de expandir y versión */}
        <div className={styles.footer}>
          {!expanded && (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={onToggleExpand}
              aria-label="Expandir menú"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          <span className={styles.versionText}>{expanded ? 'Guitar Aid · Fase 1.1' : 'v1.1'}</span>
        </div>
      </nav>
    </div>
  );
}
