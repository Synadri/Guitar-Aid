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
  compact?: boolean;
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
const WHITE_WIDTH = 36;
const BLACK_WIDTH = 22;

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
  cLabelX?: number;
  cLabelY?: number;
}

function buildKeyLayouts(
  from: number,
  to: number,
  compact = false,
): {
  whiteKeys: KeyLayout[];
  blackKeys: KeyLayout[];
  totalWidth: number;
  totalHeight: number;
} {
  const whiteKeys: KeyLayout[] = [];
  const blackKeys: KeyLayout[] = [];
  let whiteCount = 0;

  // En modo compacto se recortan las partes superiores vacías de las teclas
  const totalHeight = compact ? 56 : 108;
  const whiteHeight = compact ? 52 : 84;
  const blackHeight = compact ? 28 : 52;
  const padY = compact ? 2 : 4;
  const whiteMarkY = compact ? 41 : padY + whiteHeight - 16;
  const blackMarkY = compact ? 15 : padY + blackHeight - 18;

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
      const octave = Math.floor(midi / 12) - 1;
      const cLabel = pc === 0 ? `C${octave}` : undefined;
      // En modo compacto, la etiqueta de octava se sitúa en la muesca superior libre de la tecla Do (x + 13, y = 10)
      // para que nunca colisione ni se mezcle con las marcas de nota en la parte inferior (y = 41)
      const cLabelX = compact ? x + 13 : markX;
      const cLabelY = compact ? 10 : totalHeight - 10;

      whiteKeys.push({
        midi,
        pc,
        isBlack: false,
        x,
        y: padY,
        width: WHITE_WIDTH,
        height: whiteHeight,
        markX,
        markY: whiteMarkY,
        cLabel,
        cLabelX,
        cLabelY,
      });

      currentWhiteIndex++;
    } else {
      // La tecla negra se centra en la línea entre la tecla blanca anterior y la siguiente
      const dividingLineX = padX + currentWhiteIndex * WHITE_WIDTH;
      const x = dividingLineX - BLACK_WIDTH / 2;
      const markX = dividingLineX;

      blackKeys.push({
        midi,
        pc,
        isBlack: true,
        x,
        y: padY,
        width: BLACK_WIDTH,
        height: blackHeight,
        markX,
        markY: blackMarkY,
      });
    }
  }

  return { whiteKeys, blackKeys, totalWidth: TOTAL_WIDTH, totalHeight };
}

export function Piano({
  range = DEFAULT_PIANO_RANGE,
  marks = [],
  nameMode = 'sharps',
  onKeyClick,
  compact = false,
}: PianoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { whiteKeys, blackKeys, totalWidth, totalHeight } = buildKeyLayouts(
    range.from,
    range.to,
    compact,
  );

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
            x={layout.cLabelX ?? layout.markX}
            y={layout.cLabelY ?? totalHeight - 10}
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
            {mark.role === 'wrong' ? (
              <rect
                className={styles.markSquare}
                x={layout.markX - (compact ? 10 : 11)}
                y={layout.markY - (compact ? 10 : 11)}
                width={compact ? 20 : 22}
                height={compact ? 20 : 22}
                rx={compact ? 4 : 5}
              />
            ) : (
              <circle
                className={styles.markCircle}
                cx={layout.markX}
                cy={layout.markY}
                r={
                  compact
                    ? mark.role === 'scale-bg'
                      ? 8.5
                      : 10
                    : mark.role === 'question'
                      ? 11
                      : mark.role === 'scale-bg'
                        ? 9
                        : mark.role === 'root' || mark.role === 'pinned'
                          ? 11
                          : 10
                }
                strokeDasharray={
                  mark.role === 'missed'
                    ? '3.5 2.5'
                    : mark.role === 'preview'
                      ? '3.5 2'
                      : mark.role === 'scale-bg'
                        ? '2 2'
                        : undefined
                }
              />
            )}
            {hasRootRing && (
              <circle
                className={styles.rootInnerRing}
                cx={layout.markX}
                cy={layout.markY}
                r={compact ? 7.5 : 8.5}
                data-testid="root-inner-ring"
              />
            )}
            <text
              className={styles.markLabel}
              x={layout.markX}
              y={layout.markY}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {mark.label !== undefined && mark.label !== ''
                ? mark.label
                : mark.role === 'wrong'
                  ? '×'
                  : mark.role === 'correct'
                    ? '✓'
                    : ''}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${compact ? styles.compact : ''}`}
      data-testid="piano"
      data-compact={compact ? 'true' : undefined}
    >
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
