import type { PitchClass, StringNumber, Tuning } from '../../../theory';
import { degreeName, positionToMidi, STANDARD_TUNING } from '../../../theory';
import type { SixStringFrets } from '../../../theory/data/voicings/standard';
import styles from './ChordDiagram.module.css';

export interface ChordDiagramProps {
  /**
   * Digitaciones de las 6 cuerdas de grave a aguda (cuerda 6 a cuerda 1):
   * -1 o null = muteada (×)
   * 0 = al aire (○)
   * >0 = número de traste
   */
  frets: SixStringFrets | readonly (number | null)[];
  /** Fundamental del acorde para colorear en turquesa (#14b8a6). */
  root?: PitchClass;
  /** Afinación del instrumento (por defecto estándar EADGBE). */
  tuning?: Tuning;
  /** Etiquetas explícitas por cuerda (índice 0 = cuerda 6 .. índice 5 = cuerda 1). */
  labels?: readonly (string | null | undefined)[];
  /** Si es true, omite textos y grados dentro de los círculos (para el anverso ciego de shape>name). */
  silent?: boolean;
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

const STRING_WIDTHS = [2.5, 2.0, 1.7, 1.4, 1.2, 1.0] as const;

export function ChordDiagram({
  frets,
  root,
  tuning = STANDARD_TUNING,
  labels,
  silent = false,
  width = 180,
  height = 190,
  className = '',
  ariaLabel = 'Diagrama de acorde',
}: ChordDiagramProps) {
  const safeFrets = (frets.length >= 6 ? frets.slice(0, 6) : [-1, -1, -1, -1, -1, -1]) as readonly (
    | number
    | null
  )[];

  const positiveFrets = safeFrets.filter(
    (f): f is number => typeof f === 'number' && f > 0,
  );

  let baseFret = 1;
  let numFrets = 4;

  if (positiveFrets.length > 0) {
    const minPositive = Math.min(...positiveFrets);
    const maxPositive = Math.max(...positiveFrets);
    if (maxPositive <= 4 || minPositive <= 1) {
      baseFret = 1;
      numFrets = Math.max(4, Math.min(5, maxPositive));
    } else {
      baseFret = minPositive;
      numFrets = Math.max(4, Math.min(5, maxPositive - baseFret + 1));
    }
  }

  const topY = 32;
  const bottomY = 172;
  const fretHeight = (bottomY - topY) / numFrets;

  const startX = 38;
  const stringSpacing = 24;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox="0 0 180 190"
      className={`${styles.diagramSvg} ${className}`}
    >
      <title>{ariaLabel}</title>

      {/* Cejuela o traste inicial */}
      {baseFret === 1 ? (
        <rect
          x={startX - 2}
          y={topY - 4}
          width={stringSpacing * 5 + 4}
          height={4}
          rx={1}
          fill="#e2e8f0"
          data-testid="chord-nut"
        />
      ) : (
        <>
          <line
            x1={startX}
            y1={topY}
            x2={startX + stringSpacing * 5}
            y2={topY}
            stroke="#64748b"
            strokeWidth={1.5}
          />
          <text
            x={19}
            y={topY + fretHeight / 2}
            textAnchor="middle"
            className={styles.fretNumber}
            data-testid="chord-base-fret"
          >
            {baseFret}fr
          </text>
        </>
      )}

      {/* Trastes horizontales */}
      {Array.from({ length: numFrets }).map((_, i) => {
        const fretY = topY + (i + 1) * fretHeight;
        return (
          <line
            key={`fret-${i + 1}`}
            x1={startX}
            y1={fretY}
            x2={startX + stringSpacing * 5}
            y2={fretY}
            stroke="#64748b"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Cuerdas verticales */}
      {safeFrets.map((_, i) => {
        const stringX = startX + i * stringSpacing;
        return (
          <line
            key={`string-${i}`}
            x1={stringX}
            y1={topY}
            x2={stringX}
            y2={bottomY}
            stroke="#94a3b8"
            strokeWidth={STRING_WIDTHS[i] ?? 1.2}
          />
        );
      })}

      {/* Símbolos superiores (mute × o aire ○) y notas en trastes */}
      {safeFrets.map((fret, i) => {
        const stringX = startX + i * stringSpacing;
        const stringNum = (6 - i) as StringNumber;

        // Cuerda muteada
        if (fret === -1 || fret === null) {
          return (
            <text
              key={`marker-${i}`}
              x={stringX}
              y={18}
              textAnchor="middle"
              className={styles.muteSymbol}
              aria-hidden="true"
              data-testid={`mute-string-${stringNum}`}
            >
              ×
            </text>
          );
        }

        // Cuerda al aire
        if (fret === 0) {
          return (
            <circle
              key={`marker-${i}`}
              cx={stringX}
              cy={16}
              r={5}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.8}
              aria-hidden="true"
              data-testid={`open-string-${stringNum}`}
            />
          );
        }

        // Nota en traste
        const fretSlot = fret - baseFret;
        if (fretSlot >= 0 && fretSlot < numFrets) {
          const cy = topY + (fretSlot + 0.5) * fretHeight;
          const midi = positionToMidi(tuning, { string: stringNum, fret });
          const pc = (((midi % 12) + 12) % 12) as PitchClass;
          const isRoot = root !== undefined && pc === root;

          let label = labels?.[i];
          if (label === undefined && !silent) {
            if (isRoot) {
              label = '1';
            } else if (root !== undefined) {
              label = degreeName((pc - root + 12) % 12);
            }
          }

          return (
            <g
              key={`note-${i}`}
              data-testid={`chord-note-s${stringNum}-f${fret}`}
              data-is-root={isRoot}
            >
              <circle
                cx={stringX}
                cy={cy}
                r={13}
                className={isRoot ? styles.rootCircle : styles.toneCircle}
              />
              {!silent && label && (
                <text
                  x={stringX}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={styles.circleText}
                >
                  {label}
                </text>
              )}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}
