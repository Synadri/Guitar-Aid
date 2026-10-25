import type { KeyboardEvent } from 'react';
import { midiToName, pitchClassOf, type NameMode, type PitchClass } from '../../theory';
import { DEFAULT_PIANO_RANGE, type KeyMark, type MarkRole, type Orientation } from '../../state';
import styles from './Piano.module.css';

/**
 * Dirección vertical del teclado de piano:
 * - `false` (por defecto): notas agudas arriba y notas graves abajo.
 * - `true`: invertir la dirección para situar las notas graves arriba y las agudas abajo.
 */
export const PIANO_VERTICAL_LOW_AT_TOP = false;

export interface PianoRange {
  from: number;
  to: number;
}

export interface PianoProps {
  range?: PianoRange;
  orientation?: Orientation;
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
  preview: styles.role_preview,
};

const PAD_X = 8;
const PAD_Y = 8;
const WHITE_WIDTH = 26;
const WHITE_HEIGHT = 136;
const BLACK_WIDTH = 16;
const BLACK_HEIGHT = 84;

interface KeyLayout {
  midi: number;
  pc: PitchClass;
  isBlack: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function buildKeyLayouts(
  from: number,
  to: number,
  orientation: Orientation,
): {
  whiteKeys: KeyLayout[];
  blackKeys: KeyLayout[];
  totalWidth: number;
  totalHeight: number;
} {
  const isVertical = orientation === 'vertical';
  const rawKeys: {
    midi: number;
    pc: PitchClass;
    isBlack: boolean;
    centerFromLow: number;
    thickness: number;
    length: number;
  }[] = [];
  let whiteCount = 0;

  for (let midi = from; midi <= to; midi++) {
    const pc = pitchClassOf(midi);
    const isBlack = BLACK_PCS.has(pc);
    if (!isBlack) {
      const centerFromLow = (whiteCount + 0.5) * WHITE_WIDTH;
      rawKeys.push({
        midi,
        pc,
        isBlack: false,
        centerFromLow,
        thickness: WHITE_WIDTH,
        length: WHITE_HEIGHT,
      });
      whiteCount++;
    } else {
      const centerFromLow = whiteCount * WHITE_WIDTH;
      rawKeys.push({
        midi,
        pc,
        isBlack: true,
        centerFromLow,
        thickness: BLACK_WIDTH,
        length: BLACK_HEIGHT,
      });
    }
  }

  const totalSpan = Math.max(1, whiteCount) * WHITE_WIDTH;
  const whiteKeys: KeyLayout[] = [];
  const blackKeys: KeyLayout[] = [];

  for (const k of rawKeys) {
    if (isVertical) {
      const axisCenter = PIANO_VERTICAL_LOW_AT_TOP
        ? PAD_Y + k.centerFromLow
        : PAD_Y + (totalSpan - k.centerFromLow);
      const layout: KeyLayout = {
        midi: k.midi,
        pc: k.pc,
        isBlack: k.isBlack,
        x: PAD_X,
        y: axisCenter - k.thickness / 2,
        width: k.length,
        height: k.thickness,
        centerX: PAD_X + k.length / 2,
        centerY: axisCenter,
      };
      if (k.isBlack) {
        blackKeys.push(layout);
      } else {
        whiteKeys.push(layout);
      }
    } else {
      const axisCenter = PAD_X + k.centerFromLow;
      const layout: KeyLayout = {
        midi: k.midi,
        pc: k.pc,
        isBlack: k.isBlack,
        x: axisCenter - k.thickness / 2,
        y: PAD_Y,
        width: k.thickness,
        height: k.length,
        centerX: axisCenter,
        centerY: PAD_Y + k.length / 2,
      };
      if (k.isBlack) {
        blackKeys.push(layout);
      } else {
        whiteKeys.push(layout);
      }
    }
  }

  const totalWidth = isVertical ? PAD_X * 2 + WHITE_HEIGHT : PAD_X * 2 + totalSpan;
  const totalHeight = isVertical ? PAD_Y * 2 + totalSpan : PAD_Y * 2 + WHITE_HEIGHT;
  return { whiteKeys, blackKeys, totalWidth, totalHeight };
}

export function Piano({
  range = DEFAULT_PIANO_RANGE,
  orientation = 'horizontal',
  marks = [],
  nameMode = 'sharps',
  onKeyClick,
}: PianoProps) {
  const isVertical = orientation === 'vertical';
  const { whiteKeys, blackKeys, totalWidth, totalHeight } = buildKeyLayouts(
    range.from,
    range.to,
    orientation,
  );

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

  const renderKey = (key: KeyLayout) => {
    const noteName = midiToName(key.midi, nameMode);
    const mark = marksByMidi.get(key.midi);
    const roleClass = mark ? ROLE_CLASS[mark.role] : undefined;
    const isC = key.pc === 0;
    const octaveLabel = isC ? midiToName(key.midi, 'sharps') : undefined;
    const octaveX = isVertical ? PAD_X + WHITE_HEIGHT - 14 : key.centerX;
    const octaveY = isVertical ? key.centerY : PAD_Y + WHITE_HEIGHT - 9;
    const markCx = isVertical
      ? key.isBlack
        ? PAD_X + BLACK_HEIGHT - 18
        : PAD_X + WHITE_HEIGHT - 38
      : key.centerX;
    const markCy = isVertical
      ? key.centerY
      : key.isBlack
        ? PAD_Y + BLACK_HEIGHT - 18
        : PAD_Y + WHITE_HEIGHT - 32;
    const markRadius = key.isBlack ? 7.5 : 9.5;

    return (
      <g
        key={`key-${key.midi}`}
        className={`${styles.key} ${key.isBlack ? styles.blackKey : styles.whiteKey} ${roleClass ?? ''}`}
        role="button"
        tabIndex={0}
        aria-label={noteName}
        aria-pressed={mark ? true : false}
        data-midi={key.midi}
        data-note={noteName}
        data-key-type={key.isBlack ? 'black' : 'white'}
        data-role={mark?.role}
        onClick={() => handleActivate(key.midi)}
        onKeyDown={(e) => handleKeyDown(e, key.midi)}
      >
        <rect
          className={key.isBlack ? styles.blackKeyRect : styles.whiteKeyRect}
          x={key.x}
          y={key.y}
          width={key.width}
          height={key.height}
          rx={key.isBlack ? 2 : 3}
        />
        {octaveLabel && (
          <text
            className={styles.octaveLabel}
            x={octaveX}
            y={octaveY}
            textAnchor="middle"
            dominantBaseline="central"
            data-octave-label={octaveLabel}
          >
            {octaveLabel}
          </text>
        )}
        {mark && (
          <g className={styles.mark} data-mark-role={mark.role}>
            <circle
              className={styles.markCircle}
              cx={markCx}
              cy={markCy}
              r={markRadius}
              strokeDasharray={mark.role === 'preview' ? '3 2' : undefined}
            />
            {mark.role === 'root' && (
              <circle
                className={styles.rootInnerRing}
                cx={markCx}
                cy={markCy}
                r={markRadius - 2.5}
              />
            )}
            {mark.label !== undefined && (
              <text
                className={styles.markLabel}
                x={markCx}
                y={markCy}
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
    <div
      className={`${styles.container} ${isVertical ? styles.containerVertical : ''}`}
      data-testid="piano"
      data-orientation={orientation}
    >
      <svg
        className={`${styles.svg} ${isVertical ? styles.svgVertical : ''}`}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="group"
        aria-label="Teclado de piano"
        data-orientation={orientation}
      >
        {/* Primero las teclas blancas y encima las negras */}
        {whiteKeys.map(renderKey)}
        {blackKeys.map(renderKey)}
      </svg>
    </div>
  );
}
