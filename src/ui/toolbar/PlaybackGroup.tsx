import styles from './PlaybackGroup.module.css';

export interface PlaybackGroupProps {
  onPlayChord: () => void;
  onPlayArpeggio: () => void;
  onPlayScale: () => void;
  disabled?: boolean;
  canPlayChordAndArpeggio?: boolean;
  canPlayScale?: boolean;
}

export function PlaybackGroup({
  onPlayChord,
  onPlayArpeggio,
  onPlayScale,
  disabled = false,
  canPlayChordAndArpeggio = false,
  canPlayScale = false,
}: PlaybackGroupProps) {
  const isChordDisabled = disabled || !canPlayChordAndArpeggio;
  const isScaleDisabled = disabled || !canPlayScale;

  return (
    <div className={styles.group} data-testid="playback-group" role="group" aria-label="Reproducir">
      <button
        type="button"
        className={styles.playbackBtn}
        onClick={onPlayChord}
        disabled={isChordDisabled}
        data-testid="play-chord"
        title={isChordDisabled ? 'No disponible sin acorde o notas activas' : 'Reproducir acorde'}
      >
        <span className={styles.playIcon} aria-hidden="true">
          ▶
        </span>
        <span>Acorde</span>
      </button>

      <button
        type="button"
        className={styles.playbackBtn}
        onClick={onPlayArpeggio}
        disabled={isChordDisabled}
        data-testid="play-arpeggio"
        title={isChordDisabled ? 'No disponible sin acorde o notas activas' : 'Reproducir arpegio'}
      >
        <span className={styles.playIcon} aria-hidden="true">
          ▶
        </span>
        <span>Arpegio</span>
      </button>

      <button
        type="button"
        className={styles.playbackBtn}
        onClick={onPlayScale}
        disabled={isScaleDisabled}
        data-testid="play-scale"
        title={isScaleDisabled ? 'No disponible sin escala activa' : 'Reproducir escala'}
      >
        <span className={styles.playIcon} aria-hidden="true">
          ▶
        </span>
        <span>Escala</span>
      </button>
    </div>
  );
}
