import type { KeyboardEvent, MouseEvent } from 'react';
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
import type { FretMark, MarkRole } from '../../state';
import styles from './Fretboard.module.css';

export interface FretboardProps {
  tuning: Tuning;
  frets?: number;
  /** Rango visible de trastes (por defecto { from: 0, to: frets ?? 24 }). */
  fretRange?: { from: number; to: number };
  /** Subconjunto de cuerdas activas (1..6). Las demás se atenúan y no aceptan clic. */
  activeStrings?: ReadonlySet<StringNumber>;
  /** Muestra u oculta los puntos de referencia de los trastes 3, 5, 7, 9, 12… (por defecto true). */
  showInlays?: boolean;
  leftHanded?: boolean;
  marks?: readonly FretMark[];
  mutedStrings?: ReadonlySet<StringNumber> | readonly StringNumber[];
  nameMode?: NameMode;
  onPositionClick?: (position: FretPosition) => void;
  onPositionContextMenu?: (position: FretPosition) => void;
  onPositionRightClick?: (position: FretPosition) => void;
}

const STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
const STRING_WIDTHS: Record<StringNumber, number> = {
  1: 1.0,
  2: 1.4,
  3: 1.8,
  4: 2.2,
  5: 2.7,
  6: 3.2,
};

const SINGLE_INLAY_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_INLAY_FRETS = new Set([12, 24]);

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
const TOTAL_HEIGHT = 214;
const NUT_X = 64;
const NUT_WIDTH = 6;
const OPEN_X = 44;
const TUNING_LABEL_X = 22;

const BOARD_TOP_Y = 16;
const BOARD_BOTTOM_Y = 170;
const BOARD_HEIGHT = BOARD_BOTTOM_Y - BOARD_TOP_Y;

const STRING_Y: Record<StringNumber, number> = {
  1: 28,
  2: 54,
  3: 80,
  4: 106,
  5: 132,
  6: 158,
};

function rawFretWireX(
  n: number,
  fromFret: number = 0,
  toFret: number = DEFAULT_FRETS,
): number {
  if (n <= 0) return NUT_X;
  const totalSpan = 1236;
  if (fromFret === 0) {
    const maxFrac = 1 - Math.pow(2, -toFret / 12);
    const frac = 1 - Math.pow(2, -n / 12);
    return NUT_X + (totalSpan * frac) / (maxFrac || 1);
  } else {
    const minFrac = 1 - Math.pow(2, -(fromFret - 1) / 12);
    const maxFrac = 1 - Math.pow(2, -toFret / 12);
    const frac = 1 - Math.pow(2, -n / 12);
    return NUT_X + (totalSpan * (frac - minFrac)) / (maxFrac - minFrac || 1);
  }
}

export function Fretboard({
  tuning,
  frets = DEFAULT_FRETS,
  fretRange,
  activeStrings,
  showInlays = true,
  leftHanded = false,
  marks = [],
  mutedStrings = [],
  nameMode = 'sharps',
  onPositionClick,
  onPositionContextMenu,
  onPositionRightClick,
}: FretboardProps) {
  const fromFret = fretRange?.from ?? 0;
  const toFret = fretRange?.to ?? frets;
  const mutedSet =
    mutedStrings instanceof Set
      ? mutedStrings
      : new Set<StringNumber>(mutedStrings as readonly StringNumber[]);
  const neckEndWireX = rawFretWireX(toFret, fromFret, toFret);
  const neckSpan = neckEndWireX - (NUT_X + NUT_WIDTH);

  // Coordenada horizontal reflejada en modo zurdo
  const mirrorX = (x: number, width = 0): number => (leftHanded ? TOTAL_WIDTH - x - width : x);

  const tuningCenterX = mirrorX(TUNING_LABEL_X);
  const openCenterX = mirrorX(OPEN_X);
  const nutX = mirrorX(NUT_X, NUT_WIDTH);
  const boardRectX = mirrorX(NUT_X + NUT_WIDTH, neckSpan);

  const fretWireX = (n: number): number => mirrorX(rawFretWireX(n, fromFret, toFret));

  const fretCenterX = (n: number): number => {
    if (n === 0) return openCenterX;
    const prevWire = n - 1 === 0 ? NUT_X : rawFretWireX(n - 1, fromFret, toFret);
    const currWire = rawFretWireX(n, fromFret, toFret);
    const center = (prevWire + currWire) / 2;
    return mirrorX(center);
  };

  const marksByPos = new Map<string, FretMark>();
  for (const m of marks) {
    marksByPos.set(`${m.string}:${m.fret}`, m);
  }

  const handleActivate = (pos: FretPosition) => {
    onPositionClick?.(pos);
  };

  const handleContextMenu = (e: MouseEvent, pos: FretPosition) => {
    if (onPositionContextMenu || onPositionRightClick) {
      e.preventDefault();
      onPositionContextMenu?.(pos);
      onPositionRightClick?.(pos);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, pos: FretPosition) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handleActivate(pos);
    }
  };

  const allFrets: number[] = [];
  for (let f = fromFret; f <= toFret; f++) {
    allFrets.push(f);
  }
  const fretNumbers = allFrets.filter((f) => f > 0);

  const tuningDisplayString = tuning.strings
    .map((s) => pcName(pitchClassOf(s), nameMode))
    .join(' ');
  const footerText = `${tuning.name} · ${tuningDisplayString} · ${frets} trastes`;

  return (
    <div
      className={styles.container}
      data-testid="fretboard"
      data-mirrored={leftHanded ? 'true' : 'false'}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${TOTAL_WIDTH} ${TOTAL_HEIGHT}`}
        role="group"
        aria-label="Mástil de guitarra"
        data-mirrored={leftHanded ? 'true' : 'false'}
      >
        {/* Fondo del diapasón */}
        <rect
          className={styles.board}
          x={boardRectX}
          y={BOARD_TOP_Y}
          width={neckSpan}
          height={BOARD_HEIGHT}
          rx={2}
        />

        {/* Puntos de referencia (inlays) */}
        {showInlays !== false &&
          fretNumbers.map((fret) => {
            if (SINGLE_INLAY_FRETS.has(fret) && fret <= toFret) {
              return (
                <circle
                  key={`inlay-${fret}`}
                  className={styles.inlay}
                  cx={fretCenterX(fret)}
                  cy={(STRING_Y[1] + STRING_Y[6]) / 2}
                  r={5.5}
                  data-inlay-fret={fret}
                />
              );
            }
            if (DOUBLE_INLAY_FRETS.has(fret) && fret <= toFret) {
              const cx = fretCenterX(fret);
              const cyTop = STRING_Y[2] + 4;
              const cyBottom = STRING_Y[5] - 4;
              return (
                <g key={`inlay-${fret}`} data-inlay-fret={fret}>
                  <circle className={styles.inlay} cx={cx} cy={cyTop} r={5.5} />
                  <circle className={styles.inlay} cx={cx} cy={cyBottom} r={5.5} />
                </g>
              );
            }
            return null;
          })}

        {/* Líneas de trastes proporcionales */}
        {fretNumbers.map((fret) => {
          const x = fretWireX(fret);
          return (
            <line
              key={`fret-${fret}`}
              className={styles.fretLine}
              x1={x}
              y1={BOARD_TOP_Y}
              x2={x}
              y2={BOARD_BOTTOM_Y}
            />
          );
        })}

        {/* Cejuela */}
        <rect
          className={styles.nut}
          x={nutX}
          y={BOARD_TOP_Y - 2}
          width={NUT_WIDTH}
          height={BOARD_HEIGHT + 4}
          rx={1}
          data-testid="fretboard-nut"
        />

        {/* Cuerdas, nombres de notas al aire y marcadores de cuerda muteada (×) */}
        {STRINGS.map((string) => {
          const isActive = !activeStrings || activeStrings.has(string);
          const openMidi = positionToMidi(tuning, { string, fret: 0 });
          const openNoteName = pcName(pitchClassOf(openMidi), nameMode);
          const y = STRING_Y[string];
          const lineStartX = leftHanded ? boardRectX : nutX;
          const lineEndX = leftHanded ? nutX + NUT_WIDTH : boardRectX + neckSpan;
          const isMuted = mutedSet.has(string) && !marksByPos.has(`${string}:0`);
          return (
            <g
              key={`string-row-${string}`}
              style={!isActive ? { opacity: 0.28 } : undefined}
              data-active-string={isActive ? 'true' : 'false'}
            >
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
              {isMuted && (
                <text
                  className={styles.mutedMarker}
                  x={openCenterX}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                  data-muted-string={string}
                >
                  ×
                </text>
              )}
            </g>
          );
        })}

        {/* Numeración de trastes (bajo los trastes con marcadores) */}
        {fretNumbers.map((fret) => {
          if (!SINGLE_INLAY_FRETS.has(fret) && !DOUBLE_INLAY_FRETS.has(fret)) {
            return null;
          }
          return (
            <text
              key={`fret-num-${fret}`}
              className={styles.fretNumber}
              x={fretCenterX(fret)}
              y={BOARD_BOTTOM_Y + 14}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {fret}
            </text>
          );
        })}

        {/* Pie derecho informativo */}
        <text
          className={styles.footerText}
          x={leftHanded ? mirrorX(neckEndWireX) : neckEndWireX}
          y={TOTAL_HEIGHT - 12}
          textAnchor={leftHanded ? 'start' : 'end'}
          dominantBaseline="central"
        >
          {footerText}
        </text>

        {/* Posiciones interactivas (6 cuerdas × trastes visibles) */}
        {STRINGS.map((string) => {
          const isActiveString = !activeStrings || activeStrings.has(string);
          return allFrets.map((fret) => {
            const cx = fretCenterX(fret);
            const cy = STRING_Y[string];
            const pos: FretPosition = { string, fret };
            const midi = positionToMidi(tuning, pos);
            const noteName = midiToName(midi, nameMode);
            const mark = marksByPos.get(`${string}:${fret}`);

            // Cálculo del ancho interactivo
            let hitWidth = 32;
            if (fret === 0) {
              hitWidth = 26;
            } else {
              const prevWire = fret - 1 === 0 ? NUT_X : rawFretWireX(fret - 1, fromFret, toFret);
              const span = Math.abs(rawFretWireX(fret, fromFret, toFret) - prevWire);
              hitWidth = Math.max(16, span - 2);
            }
            const hitHeight = 24;

            const roleClass = mark ? ROLE_CLASS[mark.role] : undefined;
            const hasRootRing = mark ? mark.role === 'root' || mark.isRoot === true : false;

            return (
              <g
                key={`pos-${string}-${fret}`}
                className={`${styles.position} ${roleClass ?? ''}`}
                role="button"
                tabIndex={isActiveString ? 0 : -1}
                aria-disabled={!isActiveString ? 'true' : undefined}
                style={!isActiveString ? { pointerEvents: 'none', opacity: 0.28 } : undefined}
                aria-label={`Cuerda ${string}, traste ${fret}, ${noteName}`}
                aria-pressed={mark ? true : false}
                data-string={string}
                data-fret={fret}
                data-note={noteName}
                data-role={mark?.role}
                data-is-root={hasRootRing ? 'true' : undefined}
                onClick={isActiveString ? () => handleActivate(pos) : undefined}
                onContextMenu={isActiveString ? (e) => handleContextMenu(e, pos) : undefined}
                onKeyDown={isActiveString ? (e) => handleKeyDown(e, pos) : undefined}
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
                  <g
                    className={styles.mark}
                    data-mark-role={mark.role}
                    data-is-root={hasRootRing ? 'true' : undefined}
                  >
                    {mark.role === 'wrong' ? (
                      <rect
                        className={styles.markSquare}
                        x={cx - 11}
                        y={cy - 11}
                        width={22}
                        height={22}
                        rx={5}
                      />
                    ) : (
                      <circle
                        className={styles.markCircle}
                        cx={cx}
                        cy={cy}
                        r={
                          mark.role === 'question'
                            ? 12
                            : mark.role === 'root' || mark.role === 'pinned'
                              ? 11.5
                              : mark.role === 'scale-bg'
                                ? 9
                                : 10.5
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
                        cx={cx}
                        cy={cy}
                        r={8.5}
                        data-testid="root-inner-ring"
                      />
                    )}
                    <text
                      className={styles.markLabel}
                      x={cx}
                      y={cy}
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
          });
        })}
      </svg>
    </div>
  );
}
