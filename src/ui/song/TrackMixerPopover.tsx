import { useEffect, useRef } from 'react';
import type { SongTrack } from '../../song';
import type { TrackMixerItem } from '../../audio';
import styles from './TrackMixerPopover.module.css';

export interface TrackMixerPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  tracks: readonly SongTrack[];
  trackMixer: Record<number, TrackMixerItem>;
  onSetMute: (trackIndex: number, muted: boolean) => void;
  onSetSolo: (trackIndex: number, solo: boolean) => void;
  onSetVolume: (trackIndex: number, volume: number) => void;
  countInEnabled: boolean;
  onToggleCountIn: () => void;
  onResetMixer?: () => void;
}

export function TrackMixerPopover({
  open,
  onClose,
  triggerRef,
  tracks,
  trackMixer,
  onSetMute,
  onSetSolo,
  onSetVolume,
  countInEnabled,
  onToggleCountIn,
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

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Mezclador de pistas"
      data-testid="track-mixer-popover"
    >
      <div className={styles.header}>
        <span className={styles.title}>Mezclador</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar mezclador"
        >
          ✕
        </button>
      </div>

      <div className={styles.trackList} role="list">
        {tracks.map((track) => {
          const item = trackMixer[track.index] ?? {
            muted: false,
            solo: false,
            volume: 1.0,
          };
          const volumePercent = Math.round(item.volume * 100);

          return (
            <div
              key={`track-row-${track.index}`}
              className={styles.trackRow}
              role="listitem"
              data-track-index={track.index}
            >
              <div className={styles.trackInfo}>
                <span className={styles.trackName}>{track.name}</span>
                <span className={styles.trackSub}>
                  {track.isPercussion ? 'Batería' : track.tuning.name}
                  {track.capoFret > 0 ? ` · Capo ${track.capoFret}` : ''}
                </span>
              </div>

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

              <div className={styles.volumeControl}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={item.volume}
                  onChange={(e) => onSetVolume(track.index, Number(e.target.value))}
                  aria-label={`Volumen de ${track.name}`}
                  className={styles.volumeSlider}
                />
                <span className={styles.volumeText}>{volumePercent}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.countInBtn}
          aria-pressed={countInEnabled}
          onClick={onToggleCountIn}
        >
          <span>Cuenta atrás (1 compás)</span>
        </button>

        {onResetMixer && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={onResetMixer}
          >
            Restablecer
          </button>
        )}
      </div>
    </div>
  );
}
