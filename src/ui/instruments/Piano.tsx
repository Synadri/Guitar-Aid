import { useEffect, useRef, type KeyboardEvent } from 'react';
import { midiToName, pitchClassOf, type NameMode, type PitchClass } from '../../theory';
import { DEFAULT_PIANO_RANGE, type KeyMark, type MarkRole } from '../../state';
import styles from './Piano.module.css';

export interface PianoRange {
  from: number;
  to: number;
}

export interface PianoProps {
  range?: PianoRange;
  marks?: readonly KeyMark[];
  nameMode?: NameMode;
  onKeyClick?: (midi: number) => void;
}

const BLACK_PCS = new Set<PitchClass>([1, 3, 6, 8, 10]);

const ROLE_CLASS: Record<MarkRole, string | undefined> = {
  pinned: styles.role_pinned,
  equivalent: styles.role_equivalent,
  tone: styles.role_tone,
  root: styles.role_root,
  'scale-bg': styles.role_scale_bg,
  preview: styles.role_preview,
  question: styles.role_question,
  wrong: styles.role_wrong,
  missed: styles.role_missed,
  correct: styles.role_correct,
};

const TOTAL_WIDTH = 1316;
const TOTAL_HEIGHT = 108;
const WHITE_WIDTH = 36;
const WHITE_HEIGHT = 84;
const BLACK_WIDTH = 22;
const BLACK_HEIGHT = 52;
const PAD_Y = 4;

interface KeyLayout {
  midi: number;
  pc: PitchClass;
  isBlack: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  markX: number;
  markY: number;
  cLabel?: string;
}

function buildKeyLayouts(
  from: number,
  to: number,
): {
  whiteKeys: KeyLayout[];
  blackKeys: KeyLayout[];
  totalWidth: number;
  totalHeight: number;
} {
  const whiteKeys: KeyLayout[] = [];
  const blackKeys: KeyLayout[] = [];
  let whiteCount = 0;

  // Primero calculamos cuántas teclas blancas hay en el rango
  for (let midi = from; midi <= to; midi++) {
    const pc = pitchClassOf(midi);
    if (!BLACK_PCS.has(pc)) {
      whiteCount++;
    }
  }

  const whiteSpan = whiteCount * WHITE_WIDTH;
  const padX = Math.max(10, Math.round((TOTAL_WIDTH - whiteSpan) / 2));

  let currentWhiteIndex = 0;

  for (let midi = from; midi <= to; midi++) {
    const pc = pitchClassOf(midi);
    const isBlack = BLACK_PCS.has(pc);

    if (!isBlack) {
      const x = padX + currentWhiteIndex * WHITE_WIDTH;
      const markX = x + WHITE_WIDTH / 2;
      const markY = PAD_Y + WHITE_HEIGHT - 16;
      const octave = Math.floor(midi / 12) - 1;
      const cLabel = pc === 0 ? `C${octave}` : undefined;

      whiteKeys.push({
        midi,
        pc,
        isBlack: false,
        x,
        y: PAD_Y,
        width: WHITE_WIDTH,
        height: WHITE_HEIGHT,
        markX,
        markY,
        cLabel,
      });

      currentWhiteIndex++;
    } else {
      // La tecla negra se centra en la línea entre la tecla blanca anterior y la siguiente
      const dividingLineX = padX + currentWhiteIndex * WHITE_WIDTH;
      const x = dividingLineX - BLACK_WIDTH / 2;
      const markX = dividingLineX;
      const markY = PAD_Y + BLACK_HEIGHT - 18;

      blackKeys.push({
        midi,
        pc,
        isBlack: true,
        x,
        y: PAD_Y,
        width: BLACK_WIDTH,
        height: BLACK_HEIGHT,
        markX,
        markY,
      });
    }
  }

  return { whiteKeys, blackKeys, totalWidth: TOTAL_WIDTH, totalHeight: TOTAL_HEIGHT };
}

export function Piano({
  range = DEFAULT_PIANO_RANGE,
  marks = [],
  nameMode = 'sharps',
  onKeyClick,
}: PianoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { whiteKeys, blackKeys, totalWidth, totalHeight } = buildKeyLayouts(range.from, range.to);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || marks.length === 0) return;
    if (el.scrollWidth <= el.clientWidth) return;
    const primaryMark = marks.find((m) => m.role === 'pinned' || m.role === 'root') ?? marks[0];
    if (!primaryMark) return;
    const keyLayout =
      whiteKeys.find((k) => k.midi === primaryMark.midi) ??
      blackKeys.find((k) => k.midi === primaryMark.midi);
    if (!keyLayout) return;
    const ratio = keyLayout.markX / totalWidth;
    const targetScroll = Math.max(0, ratio * el.scrollWidth - el.clientWidth / 2);
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    } else {
      el.scrollLeft = targetScroll;
    }
  }, [marks, whiteKeys, blackKeys, totalWidth]);

  const marksByMidi = new Map<number, KeyMark>();
  for (const m of marks) {
    marksByMidi.set(m.midi, m);
  }

  const handleActivate = (midi: number) => {
    onKeyClick?.(midi);
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, midi: number) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handleActivate(midi);
    }
  };

  const renderKey = (layout: KeyLayout) => {
    const mark = marksByMidi.get(layout.midi);
    const noteName = midiToName(layout.midi, nameMode);
    const isPressed = mark !== undefined;
    const roleClass = mark ? ROLE_CLASS[mark.role] : undefined;
    const hasRootRing = mark ? mark.role === 'root' || mark.isRoot === true : false;

    return (
      <g
        key={`key-${layout.midi}`}
        className={`${styles.key} ${roleClass ?? ''}`}
        role="button"
        tabIndex={0}
        aria-label={noteName}
        aria-pressed={isPressed ? 'true' : 'false'}
        data-midi={layout.midi}
        data-key-type={layout.isBlack ? 'black' : 'white'}
        data-role={mark?.role}
        data-is-root={hasRootRing ? 'true' : undefined}
        onClick={() => handleActivate(layout.midi)}
        onKeyDown={(e) => handleKeyDown(e, layout.midi)}
      >
        <rect
          className={layout.isBlack ? styles.blackKey : styles.whiteKey}
          x={layout.x}
          y={layout.y}
          width={layout.width}
          height={layout.height}
          rx={3}
        />

        {layout.cLabel && (
          <text
            className={styles.octaveLabel}
            x={layout.markX}
            y={TOTAL_HEIGHT - 10}
            textAnchor="middle"
            dominantBaseline="central"
            data-octave-label={layout.cLabel}
          >
            {layout.cLabel}
          </text>
        )}

        {mark && (
          <g
            className={styles.mark}
            data-mark-role={mark.role}
            data-is-root={hasRootRing ? 'true' : undefined}
          >
            <circle
              className={styles.markCircle}
              cx={layout.markX}
              cy={layout.markY}
              r={
                mark.role === 'scale-bg'
                  ? 9
                  : mark.role === 'root' || mark.role === 'pinned'
                    ? 11
                    : 10
              }
              strokeDasharray={
                mark.role === 'preview' ? '3.5 2' : mark.role === 'scale-bg' ? '2 2' : undefined
              }
            />
            {hasRootRing && (
              <circle
                className={styles.rootInnerRing}
                cx={layout.markX}
                cy={layout.markY}
                r={8.5}
                data-testid="root-inner-ring"
              />
            )}
            {mark.label !== undefined && (
              <text
                className={styles.markLabel}
                x={layout.markX}
                y={layout.markY}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {mark.label}
              </text>
            )}
          </g>
        )}
      </g>
    );
  };

  return (
    <div ref={containerRef} className={styles.container} data-testid="piano">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="group"
        aria-label="Teclado de piano"
      >
        {/* Teclas blancas primero en el DOM */}
        {whiteKeys.map(renderKey)}
        {/* Teclas negras superpuestas */}
        {blackKeys.map(renderKey)}
      </svg>
    </div>
  );
}
