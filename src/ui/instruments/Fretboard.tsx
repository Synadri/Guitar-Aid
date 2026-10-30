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
  leftHanded?: boolean;
  marks?: readonly FretMark[];
  mutedStrings?: readonly StringNumber[];
  nameMode?: NameMode;
  onPositionClick?: (position: FretPosition) => void;
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

function rawFretWireX(n: number): number {
  if (n <= 0) return NUT_X;
  return NUT_X + (1236 * (1 - Math.pow(2, -n / 12))) / 0.75;
}

export function Fretboard({
  tuning,
  frets = DEFAULT_FRETS,
  leftHanded = false,
  marks = [],
  mutedStrings = [],
  nameMode = 'sharps',
  onPositionClick,
  onPositionRightClick,
}: FretboardProps) {
  const mutedSet = new Set<StringNumber>(mutedStrings);
  const neckEndWireX = rawFretWireX(frets);
  const neckSpan = neckEndWireX - (NUT_X + NUT_WIDTH);

  // Coordenada horizontal reflejada en modo zurdo
  const mirrorX = (x: number, width = 0): number => (leftHanded ? TOTAL_WIDTH - x - width : x);

  const tuningCenterX = mirrorX(TUNING_LABEL_X);
  const openCenterX = mirrorX(OPEN_X);
  const nutX = mirrorX(NUT_X, NUT_WIDTH);
  const boardRectX = mirrorX(NUT_X + NUT_WIDTH, neckSpan);

  const fretWireX = (n: number): number => mirrorX(rawFretWireX(n));

  const fretCenterX = (n: number): number => {
    if (n === 0) return openCenterX;
    const center = (rawFretWireX(n - 1) + rawFretWireX(n)) / 2;
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
    if (onPositionRightClick) {
      e.preventDefault();
      onPositionRightClick(pos);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, pos: FretPosition) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handleActivate(pos);
    }
  };

  const fretNumbers = Array.from({ length: frets }, (_, i) => i + 1);
  const allFrets = Array.from({ length: frets + 1 }, (_, i) => i);

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
        {fretNumbers.map((fret) => {
          if (SINGLE_INLAY_FRETS.has(fret) && fret <= frets) {
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
          if (DOUBLE_INLAY_FRETS.has(fret) && fret <= frets) {
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
          const openMidi = positionToMidi(tuning, { string, fret: 0 });
          const openNoteName = pcName(pitchClassOf(openMidi), nameMode);
          const y = STRING_Y[string];
          const lineStartX = leftHanded ? boardRectX : nutX;
          const lineEndX = leftHanded ? nutX + NUT_WIDTH : boardRectX + neckSpan;
          const isMuted = mutedSet.has(string) && !marksByPos.has(`${string}:0`);
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

        {/* Posiciones interactivas (6 cuerdas × (frets + 1) trastes) */}
        {STRINGS.map((string) => {
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
              const span = Math.abs(rawFretWireX(fret) - rawFretWireX(fret - 1));
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
                tabIndex={0}
                aria-label={`Cuerda ${string}, traste ${fret}, ${noteName}`}
                aria-pressed={mark ? true : false}
                data-string={string}
                data-fret={fret}
                data-note={noteName}
                data-role={mark?.role}
                data-is-root={hasRootRing ? 'true' : undefined}
                onClick={() => handleActivate(pos)}
                onContextMenu={(e) => handleContextMenu(e, pos)}
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
                  <g
                    className={styles.mark}
                    data-mark-role={mark.role}
                    data-is-root={hasRootRing ? 'true' : undefined}
                  >
                    <circle
                      className={styles.markCircle}
                      cx={cx}
                      cy={cy}
                      r={
                        mark.role === 'root' || mark.role === 'pinned'
                          ? 11.5
                          : mark.role === 'scale-bg'
                            ? 9
                            : 10.5
                      }
                      strokeDasharray={
                        mark.role === 'preview'
                          ? '3.5 2'
                          : mark.role === 'scale-bg'
                            ? '2 2'
                            : undefined
                      }
                    />
                    {hasRootRing && (
                      <circle
                        className={styles.rootInnerRing}
                        cx={cx}
                        cy={cy}
                        r={8.5}
                        data-testid="root-inner-ring"
                      />
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
