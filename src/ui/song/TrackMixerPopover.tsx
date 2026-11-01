import { useEffect, useRef } from 'react';
import type { SongTrack } from '../../song';
import type { TrackMixerItem } from '../../audio';
import styles from './TrackMixerPopover.module.css';

export type MetronomeSubdivision = '1' | '1/3' | '1/4' | '1/8' | '1/16';

export const METRONOME_SUBDIVISIONS: readonly MetronomeSubdivision[] = [
  '1',
  '1/3',
  '1/4',
  '1/8',
  '1/16',
];

export interface TrackMixerPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  tracks: readonly SongTrack[];
  activeTrackIndex?: number;
  onSelectTrack?: (trackIndex: number) => void;
  trackMixer: Record<number, TrackMixerItem>;
  onSetMute: (trackIndex: number, muted: boolean) => void;
  onSetSolo: (trackIndex: number, solo: boolean) => void;
  onSetVolume: (trackIndex: number, volume: number) => void;
  masterVolume?: number;
  onSetMasterVolume?: (volume: number) => void;
  countInEnabled: boolean;
  onToggleCountIn: () => void;
  metronomeSubdivision?: MetronomeSubdivision;
  onSetMetronomeSubdivision?: (subdivision: MetronomeSubdivision) => void;
  metronomeVolume?: number;
  onSetMetronomeVolume?: (volume: number) => void;
  onResetMixer?: () => void;
}

/**
 * Resuelve la descripción secundaria de un instrumento para el mezclador.
 * Refleja instrumentos comunes (guitarra eléctrica, acústica, bajo, percusión, teclado)
 * y afinación/cejilla.
 */
export function getTrackDescription(track: SongTrack): string {
  if (track.isPercussion) {
    return 'Percusión';
  }

  const nameLower = track.name.toLowerCase();

  if (nameLower.includes('bajo') || nameLower.includes('bass')) {
    const cuerdas = track.stringCount > 0 ? `${track.stringCount} cuerdas` : track.tuning.name;
    return `Bajo eléctrico · ${cuerdas}`;
  }

  if (
    nameLower.includes('teclado') ||
    nameLower.includes('piano') ||
    nameLower.includes('organ') ||
    nameLower.includes('synth')
  ) {
    return 'Piano · acompañamiento';
  }

  const capo = track.capoFret > 0 ? ` · Capo ${track.capoFret}` : '';
  const tuning = track.tuning?.name || 'Estándar';

  if (
    nameLower.includes('acústica') ||
    nameLower.includes('acoustic') ||
    nameLower.includes('guitarra 2')
  ) {
    return `Guitarra acústica · ${tuning}${capo}`;
  }

  if (
    nameLower.includes('guitar') ||
    nameLower.includes('eléctrica') ||
    nameLower.includes('guitarra 1')
  ) {
    return `Guitarra eléctrica · ${tuning}${capo}`;
  }

  return `${tuning}${capo}`;
}

export function TrackMixerPopover({
  open,
  onClose,
  triggerRef,
  tracks,
  activeTrackIndex = 0,
  onSelectTrack,
  trackMixer,
  onSetMute,
  onSetSolo,
  onSetVolume,
  masterVolume = 0.85,
  onSetMasterVolume,
  countInEnabled,
  onToggleCountIn,
  metronomeSubdivision = '1/4',
  onSetMetronomeSubdivision,
  metronomeVolume = 0.8,
  onSetMetronomeVolume,
  onResetMixer,
}: TrackMixerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const masterPercent = Math.round(masterVolume * 100);

  let subIndex = METRONOME_SUBDIVISIONS.indexOf(metronomeSubdivision);
  if (subIndex === -1) subIndex = 2;
  const subPercent = (subIndex / (METRONOME_SUBDIVISIONS.length - 1)) * 100;
  const metronomeVolPercent = Math.round(metronomeVolume * 100);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Mezclador de pistas"
      data-testid="track-mixer-popover"
    >
      {/* 1. Encabezado */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Mezclador</span>
          <span className={styles.trackCount}>
            · {tracks.length} {tracks.length === 1 ? 'pista' : 'pistas'}
          </span>
        </div>

        {onResetMixer && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={onResetMixer}
            aria-label="Restablecer"
          >
            Restablecer
          </button>
        )}
      </div>

      {/* 2. Tarjeta Maestro (Volumen general) */}
      <div className={styles.masterCard}>
        <span className={styles.masterLabel}>Maestro</span>
        <div className={styles.masterVolumeControl}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onSetMasterVolume?.(Number(e.target.value))}
            aria-label="Volumen maestro"
            className={styles.volumeSlider}
            style={{
              background: `linear-gradient(to right, #00bfa5 0%, #00bfa5 ${masterPercent}%, #16253b ${masterPercent}%, #16253b 100%)`,
            }}
          />
          <span className={styles.volumeText}>{masterPercent}</span>
        </div>
      </div>

      {/* 3. Etiqueta PISTAS */}
      <div className={styles.sectionLabel}>PISTAS</div>

      {/* 4. Lista de Pistas */}
      <div className={styles.trackList} role="list">
        {tracks.map((track) => {
          const item = trackMixer[track.index] ?? {
            muted: false,
            solo: false,
            volume: 1.0,
          };
          const volumePercent = Math.round(item.volume * 100);
          const isActive = track.index === activeTrackIndex;

          return (
            <div
              key={`track-row-${track.index}`}
              className={`${styles.trackRow} ${isActive ? styles.trackRowActive : ''}`}
              role="listitem"
              data-track-index={track.index}
            >
              {/* Radio selector de pista activa */}
              <button
                type="button"
                className={styles.radioBtn}
                onClick={() => onSelectTrack?.(track.index)}
                aria-label={`Seleccionar ${track.name} como pista activa`}
                aria-checked={isActive}
                role="radio"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  {isActive ? (
                    <>
                      <circle cx="9" cy="9" r="7.5" stroke="#00bfa5" strokeWidth="1.5" />
                      <circle cx="9" cy="9" r="4" fill="#00bfa5" />
                    </>
                  ) : (
                    <circle cx="9" cy="9" r="7.5" stroke="#334155" strokeWidth="1.5" />
                  )}
                </svg>
              </button>

              {/* Información de la pista */}
              <div
                className={styles.trackInfo}
                onClick={() => onSelectTrack?.(track.index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTrack?.(track.index);
                  }
                }}
              >
                <div className={styles.trackNameRow}>
                  <span className={styles.trackName}>{track.name}</span>
                  {isActive && <span className={styles.activeBadge}>Activa</span>}
                </div>
                <span className={styles.trackSub}>{getTrackDescription(track)}</span>
              </div>

              {/* Botones Mute / Solo */}
              <div className={styles.btnGroup}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${styles.muteBtn}`}
                  aria-pressed={item.muted}
                  aria-label={`Silenciar ${track.name}`}
                  onClick={() => onSetMute(track.index, !item.muted)}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${styles.soloBtn}`}
                  aria-pressed={item.solo}
                  aria-label={`Solo ${track.name}`}
                  onClick={() => onSetSolo(track.index, !item.solo)}
                >
                  S
                </button>
              </div>

              {/* Control de volumen de la pista */}
              <div className={styles.volumeControl}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={item.volume}
                  onChange={(e) => onSetVolume(track.index, Number(e.target.value))}
                  aria-label={`Volumen de ${track.name}`}
                  className={styles.volumeSlider}
                  style={{
                    background: `linear-gradient(to right, #00bfa5 0%, #00bfa5 ${volumePercent}%, #16253b ${volumePercent}%, #16253b 100%)`,
                  }}
                />
                <span className={styles.volumeText}>{volumePercent}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Pie: Cuenta atrás y Subdivisión de Metrónomo */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.countInBtn}
          aria-pressed={countInEnabled}
          aria-label="Cuenta atrás de 1 compás"
          onClick={onToggleCountIn}
        >
          <span
            className={`${styles.checkboxBox} ${countInEnabled ? styles.checkboxChecked : ''}`}
            aria-hidden="true"
          >
            {countInEnabled && (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8.5L6.5 11.5L12.5 4.5"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className={styles.countInText}>Cuenta atrás de 1 compás</span>
        </button>

        <div className={styles.subdivisionSection}>
          <div className={styles.subdivisionHeader}>
            <span className={styles.subdivisionTitle}>METRÓNOMO · SUBDIVISIÓN</span>
            <span className={styles.subdivisionValue}>{metronomeSubdivision}</span>
          </div>

          <input
            type="range"
            min="0"
            max={METRONOME_SUBDIVISIONS.length - 1}
            step="1"
            value={subIndex}
            onChange={(e) => {
              const nextSub = METRONOME_SUBDIVISIONS[Number(e.target.value)];
              if (nextSub) onSetMetronomeSubdivision?.(nextSub);
            }}
            aria-label="Subdivisión del metrónomo"
            className={styles.subdivisionSlider}
            style={{
              background: `linear-gradient(to right, #00bfa5 0%, #00bfa5 ${subPercent}%, #16253b ${subPercent}%, #16253b 100%)`,
            }}
          />

          <div
            className={styles.subdivisionTicks}
            role="radiogroup"
            aria-label="Subdivisión del metrónomo"
          >
            {METRONOME_SUBDIVISIONS.map((sub) => {
              const isSelected = sub === metronomeSubdivision;
              return (
                <button
                  key={`tick-${sub}`}
                  type="button"
                  className={`${styles.tickItem} ${isSelected ? styles.tickSelected : ''}`}
                  onClick={() => onSetMetronomeSubdivision?.(sub)}
                  aria-label={`Subdivisión ${sub}`}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <span className={styles.tickDash} />
                  <span className={styles.tickLabel}>{sub}</span>
                </button>
              );
            })}
          </div>

          {/* Control de volumen del metrónomo */}
          <div className={styles.metronomeVolumeRow}>
            <span className={styles.metronomeVolumeLabel}>Vol.</span>
            <div className={styles.metronomeVolumeControl}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={metronomeVolume}
                onChange={(e) => onSetMetronomeVolume?.(Number(e.target.value))}
                aria-label="Volumen del metrónomo"
                className={styles.volumeSlider}
                style={{
                  background: `linear-gradient(to right, #00bfa5 0%, #00bfa5 ${metronomeVolPercent}%, #16253b ${metronomeVolPercent}%, #16253b 100%)`,
                }}
              />
              <span className={styles.volumeText}>{metronomeVolPercent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
