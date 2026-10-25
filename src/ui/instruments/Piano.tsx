import type { KeyboardEvent } from 'react';
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
  width: number;
  height: number;
  centerX: number;
}

function buildKeyLayouts(
  from: number,
  to: number,
): {
  whiteKeys: KeyLayout[];
  blackKeys: KeyLayout[];
  totalWidth: number;
} {
  const whiteKeys: KeyLayout[] = [];
  const blackKeys: KeyLayout[] = [];
  let whiteCount = 0;

  for (let midi = from; midi <= to; midi++) {
    const pc = pitchClassOf(midi);
    const isBlack = BLACK_PCS.has(pc);
    if (!isBlack) {
      const x = PAD_X + whiteCount * WHITE_WIDTH;
      whiteKeys.push({
        midi,
        pc,
        isBlack: false,
        x,
        width: WHITE_WIDTH,
        height: WHITE_HEIGHT,
        centerX: x + WHITE_WIDTH / 2,
      });
      whiteCount++;
    } else {
      const centerX = PAD_X + whiteCount * WHITE_WIDTH;
      blackKeys.push({
        midi,
        pc,
        isBlack: true,
        x: centerX - BLACK_WIDTH / 2,
        width: BLACK_WIDTH,
        height: BLACK_HEIGHT,
        centerX,
      });
    }
  }

  const totalWidth = PAD_X * 2 + Math.max(1, whiteCount) * WHITE_WIDTH;
  return { whiteKeys, blackKeys, totalWidth };
}

export function Piano({
  range = DEFAULT_PIANO_RANGE,
  marks = [],
  nameMode = 'sharps',
  onKeyClick,
}: PianoProps) {
  const { whiteKeys, blackKeys, totalWidth } = buildKeyLayouts(range.from, range.to);
  const totalHeight = PAD_Y * 2 + WHITE_HEIGHT;

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
    const markCy = key.isBlack ? PAD_Y + BLACK_HEIGHT - 18 : PAD_Y + WHITE_HEIGHT - 32;
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
          y={PAD_Y}
          width={key.width}
          height={key.height}
          rx={key.isBlack ? 2 : 3}
        />
        {octaveLabel && (
          <text
            className={styles.octaveLabel}
            x={key.centerX}
            y={PAD_Y + WHITE_HEIGHT - 9}
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
              cx={key.centerX}
              cy={markCy}
              r={markRadius}
              strokeDasharray={mark.role === 'preview' ? '3 2' : undefined}
            />
            {mark.role === 'root' && (
              <circle
                className={styles.rootInnerRing}
                cx={key.centerX}
                cy={markCy}
                r={markRadius - 2.5}
              />
            )}
            {mark.label !== undefined && (
              <text
                className={styles.markLabel}
                x={key.centerX}
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
    <div className={styles.container} data-testid="piano">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="group"
        aria-label="Teclado de piano"
      >
        {/* Primero las teclas blancas y encima las negras */}
        {whiteKeys.map(renderKey)}
        {blackKeys.map(renderKey)}
      </svg>
    </div>
  );
}
