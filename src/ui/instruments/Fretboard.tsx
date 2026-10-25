import type { KeyboardEvent } from 'react';
import {
  DEFAULT_FRETS,
  midiToName,
  pcName,
  pitchClassOf,
  positionToMidi,
  type FretPosition,
  type NameMode,
  type StringNumber,
  type Tuning,
} from '../../theory';
import type { FretMark, MarkRole, Orientation } from '../../state';
import styles from './Fretboard.module.css';

export interface FretboardProps {
  tuning: Tuning;
  frets?: number;
  leftHanded?: boolean;
  orientation?: Orientation;
  marks?: readonly FretMark[];
  nameMode?: NameMode;
  onPositionClick?: (position: FretPosition) => void;
}

const STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const STRING_WIDTHS: Record<StringNumber, number> = {
  1: 1.2,
  2: 1.5,
  3: 1.9,
  4: 2.4,
  5: 2.9,
  6: 3.5,
};

const SINGLE_INLAY_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_INLAY_FRETS = new Set([12, 24]);

const ROLE_CLASS: Record<MarkRole, string | undefined> = {
  pinned: styles.role_pinned,
  equivalent: styles.role_equivalent,
  tone: styles.role_tone,
  root: styles.role_root,
  preview: styles.role_preview,
};

const TOP_PAD = 24;
const BOTTOM_PAD = 30;
const STRING_GAP = 28;
const TUNING_COL_WIDTH = 28;
const OPEN_COL_WIDTH = 34;
const NUT_WIDTH = 6;
const FRET_WIDTH = 38;
const SIDE_PAD = 12;

const VERT_TOP_PAD = 12;
const VERT_BOTTOM_PAD = 16;
const VERT_LEFT_PAD = 30;
const VERT_RIGHT_PAD = 24;

export function Fretboard({
  tuning,
  frets = DEFAULT_FRETS,
  leftHanded = false,
  orientation = 'horizontal',
  marks = [],
  nameMode = 'sharps',
  onPositionClick,
}: FretboardProps) {
  const isVertical = orientation === 'vertical';
  const boardSpan = (STRINGS.length - 1) * STRING_GAP;
  const neckSpan = frets * FRET_WIDTH;

  const totalWidth = isVertical
    ? VERT_LEFT_PAD + boardSpan + VERT_RIGHT_PAD
    : SIDE_PAD * 2 + TUNING_COL_WIDTH + OPEN_COL_WIDTH + NUT_WIDTH + neckSpan;
  const totalHeight = isVertical
    ? VERT_TOP_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH + NUT_WIDTH + neckSpan + VERT_BOTTOM_PAD
    : TOP_PAD + boardSpan + BOTTOM_PAD;

  // Coordenada X horizontal (reflejada si leftHanded está activo).
  const mirrorX = (x: number, width = 0): number => (leftHanded ? totalWidth - x - width : x);

  // Geometría horizontal
  const tuningCenterX = mirrorX(SIDE_PAD + TUNING_COL_WIDTH / 2);
  const openCenterX = mirrorX(SIDE_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH / 2);
  const nutX = mirrorX(SIDE_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH, NUT_WIDTH);
  const neckStartX = SIDE_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH + NUT_WIDTH;
  const boardRectX = mirrorX(neckStartX, neckSpan);

  const fretCenterX = (fret: number): number => {
    if (fret === 0) return openCenterX;
    return mirrorX(neckStartX + (fret - 0.5) * FRET_WIDTH);
  };

  const fretWireX = (fret: number): number => mirrorX(neckStartX + fret * FRET_WIDTH);
  const stringY = (string: StringNumber): number => TOP_PAD + (string - 1) * STRING_GAP;

  // Geometría vertical (cejuela arriba, trastes hacia abajo, cuerda 6 a la izquierda y 1 a la derecha;
  // con leftHanded se refleja de izquierda a derecha).
  const vertBoardRectX = mirrorX(VERT_LEFT_PAD, boardSpan);
  const tuningCenterY = VERT_TOP_PAD + TUNING_COL_WIDTH / 2;
  const openCenterY = VERT_TOP_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH / 2;
  const nutY = VERT_TOP_PAD + TUNING_COL_WIDTH + OPEN_COL_WIDTH;
  const neckStartY = nutY + NUT_WIDTH;

  const fretCenterY = (fret: number): number => {
    if (fret === 0) return openCenterY;
    return neckStartY + (fret - 0.5) * FRET_WIDTH;
  };

  const fretWireY = (fret: number): number => neckStartY + fret * FRET_WIDTH;
  const stringX = (string: StringNumber): number =>
    mirrorX(VERT_LEFT_PAD + (6 - string) * STRING_GAP);
  const vertFretNumberX = mirrorX(VERT_LEFT_PAD / 2);

  const marksByPos = new Map<string, FretMark>();
  for (const m of marks) {
    marksByPos.set(`${m.string}:${m.fret}`, m);
  }

  const handleActivate = (pos: FretPosition) => {
    onPositionClick?.(pos);
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, pos: FretPosition) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handleActivate(pos);
    }
  };

  const fretNumbers = Array.from({ length: frets }, (_, i) => i + 1);
  const allFrets = Array.from({ length: frets + 1 }, (_, i) => i);

  return (
    <div
      className={`${styles.container} ${isVertical ? styles.containerVertical : ''}`}
      data-testid="fretboard"
      data-orientation={orientation}
      data-mirrored={leftHanded ? 'true' : 'false'}
    >
      <svg
        className={`${styles.svg} ${isVertical ? styles.svgVertical : ''}`}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="group"
        aria-label="Mástil de guitarra"
        data-orientation={orientation}
        data-mirrored={leftHanded ? 'true' : 'false'}
      >
        {/* Fondo del diapasón (trastes 1..frets) */}
        <rect
          className={styles.board}
          x={isVertical ? vertBoardRectX : boardRectX}
          y={isVertical ? neckStartY : TOP_PAD}
          width={isVertical ? boardSpan : neckSpan}
          height={isVertical ? neckSpan : boardSpan}
          rx={2}
        />

        {/* Puntos de referencia (inlays) */}
        {fretNumbers.map((fret) => {
          if (SINGLE_INLAY_FRETS.has(fret) && fret <= frets) {
            const cx = isVertical ? vertBoardRectX + boardSpan / 2 : fretCenterX(fret);
            const cy = isVertical ? fretCenterY(fret) : TOP_PAD + boardSpan / 2;
            return (
              <circle
                key={`inlay-${fret}`}
                className={styles.inlay}
                cx={cx}
                cy={cy}
                r={5.5}
                data-inlay-fret={fret}
              />
            );
          }
          if (DOUBLE_INLAY_FRETS.has(fret) && fret <= frets) {
            if (isVertical) {
              const cxLeft = vertBoardRectX + STRING_GAP * 1.5;
              const cxRight = vertBoardRectX + STRING_GAP * 3.5;
              const cy = fretCenterY(fret);
              return (
                <g key={`inlay-${fret}`} data-inlay-fret={fret}>
                  <circle className={styles.inlay} cx={cxLeft} cy={cy} r={5.5} />
                  <circle className={styles.inlay} cx={cxRight} cy={cy} r={5.5} />
                </g>
              );
            }
            const cx = fretCenterX(fret);
            const cyTop = TOP_PAD + STRING_GAP * 1.5;
            const cyBottom = TOP_PAD + STRING_GAP * 3.5;
            return (
              <g key={`inlay-${fret}`} data-inlay-fret={fret}>
                <circle className={styles.inlay} cx={cx} cy={cyTop} r={5.5} />
                <circle className={styles.inlay} cx={cx} cy={cyBottom} r={5.5} />
              </g>
            );
          }
          return null;
        })}

        {/* Líneas de trastes */}
        {fretNumbers.map((fret) => {
          if (isVertical) {
            const y = fretWireY(fret);
            return (
              <line
                key={`fret-${fret}`}
                className={styles.fretLine}
                x1={vertBoardRectX}
                y1={y}
                x2={vertBoardRectX + boardSpan}
                y2={y}
              />
            );
          }
          const x = fretWireX(fret);
          return (
            <line
              key={`fret-${fret}`}
              className={styles.fretLine}
              x1={x}
              y1={TOP_PAD}
              x2={x}
              y2={TOP_PAD + boardSpan}
            />
          );
        })}

        {/* Cejuela */}
        <rect
          className={styles.nut}
          x={isVertical ? vertBoardRectX - 1 : nutX}
          y={isVertical ? nutY : TOP_PAD - 1}
          width={isVertical ? boardSpan + 2 : NUT_WIDTH}
          height={isVertical ? NUT_WIDTH : boardSpan + 2}
          rx={1}
          data-testid="fretboard-nut"
        />

        {/* Cuerdas y etiquetas de afinación */}
        {STRINGS.map((string) => {
          const openMidi = positionToMidi(tuning, { string, fret: 0 });
          const openNoteName = pcName(pitchClassOf(openMidi), nameMode);

          if (isVertical) {
            const x = stringX(string);
            return (
              <g key={`string-row-${string}`}>
                <line
                  className={styles.stringLine}
                  x1={x}
                  y1={nutY}
                  x2={x}
                  y2={neckStartY + neckSpan}
                  strokeWidth={STRING_WIDTHS[string]}
                  data-string-line={string}
                />
                <text
                  className={styles.tuningLabel}
                  x={x}
                  y={tuningCenterY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  data-tuning-string={string}
                >
                  {openNoteName}
                </text>
              </g>
            );
          }

          const y = stringY(string);
          const lineStartX = leftHanded ? boardRectX : nutX;
          const lineEndX = leftHanded ? nutX + NUT_WIDTH : boardRectX + neckSpan;
          return (
            <g key={`string-row-${string}`}>
              <line
                className={styles.stringLine}
                x1={lineStartX}
                y1={y}
                x2={lineEndX}
                y2={y}
                strokeWidth={STRING_WIDTHS[string]}
                data-string-line={string}
              />
              <text
                className={styles.tuningLabel}
                x={tuningCenterX}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                data-tuning-string={string}
              >
                {openNoteName}
              </text>
            </g>
          );
        })}

        {/* Numeración de trastes */}
        {fretNumbers.map((fret) => (
          <text
            key={`fret-num-${fret}`}
            className={styles.fretNumber}
            x={isVertical ? vertFretNumberX : fretCenterX(fret)}
            y={isVertical ? fretCenterY(fret) : TOP_PAD + boardSpan + 18}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {fret}
          </text>
        ))}

        {/* Posiciones interactivas (6 cuerdas × (frets + 1) trastes) */}
        {STRINGS.map((string) => {
          return allFrets.map((fret) => {
            const cx = isVertical ? stringX(string) : fretCenterX(fret);
            const cy = isVertical ? fretCenterY(fret) : stringY(string);
            const pos: FretPosition = { string, fret };
            const midi = positionToMidi(tuning, pos);
            const noteName = midiToName(midi, nameMode);
            const mark = marksByPos.get(`${string}:${fret}`);
            const fretSpanSize = fret === 0 ? OPEN_COL_WIDTH - 2 : FRET_WIDTH - 2;
            const hitWidth = isVertical ? STRING_GAP - 2 : fretSpanSize;
            const hitHeight = isVertical ? fretSpanSize : STRING_GAP - 2;
            const roleClass = mark ? ROLE_CLASS[mark.role] : undefined;

            return (
              <g
                key={`pos-${string}-${fret}`}
                className={`${styles.position} ${roleClass ?? ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Cuerda ${string}, traste ${fret}, ${noteName}`}
                aria-pressed={mark ? true : false}
                data-string={string}
                data-fret={fret}
                data-note={noteName}
                data-role={mark?.role}
                onClick={() => handleActivate(pos)}
                onKeyDown={(e) => handleKeyDown(e, pos)}
              >
                <rect
                  className={styles.hitArea}
                  x={cx - hitWidth / 2}
                  y={cy - hitHeight / 2}
                  width={hitWidth}
                  height={hitHeight}
                  rx={4}
                />
                {mark && (
                  <g className={styles.mark} data-mark-role={mark.role}>
                    <circle
                      className={styles.markCircle}
                      cx={cx}
                      cy={cy}
                      r={mark.role === 'root' || mark.role === 'pinned' ? 11.5 : 10.5}
                      strokeDasharray={mark.role === 'preview' ? '3.5 2' : undefined}
                    />
                    {mark.role === 'root' && (
                      <circle className={styles.rootInnerRing} cx={cx} cy={cy} r={8.5} />
                    )}
                    {mark.label !== undefined && (
                      <text
                        className={styles.markLabel}
                        x={cx}
                        y={cy}
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
          });
        })}
      </svg>
    </div>
  );
}
