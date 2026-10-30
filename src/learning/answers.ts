import type { Degree, FretPosition, IntervalShortName, PitchClass } from '../theory';

/** Tipos de respuesta que puede emitir el usuario o un dispositivo de entrada. */
export interface AnswerPositions {
  kind: 'positions';
  positions: readonly FretPosition[];
}

export interface AnswerPitchClass {
  kind: 'pitchClass';
  pitchClass: PitchClass;
}

export interface AnswerInterval {
  kind: 'interval';
  semitones?: number;
  interval?: IntervalShortName;
}

export interface AnswerLabels {
  kind: 'labels';
  labels: readonly { position: FretPosition; label: Degree | string }[];
}

export interface AnswerChoice {
  kind: 'choice';
  choice: string | number;
}

export interface AnswerMidi {
  kind: 'midi';
  midis: readonly number[];
}

export type AnswerInput =
  | AnswerPositions
  | AnswerPitchClass
  | AnswerInterval
  | AnswerLabels
  | AnswerChoice
  | AnswerMidi;

/** Tipos de respuesta esperada en una pregunta de ejercicio. */
export type ExpectedAnswer =
  | { kind: 'positions'; positions: readonly FretPosition[] }
  | { kind: 'pitchClass'; pitchClass: PitchClass; noteName?: string }
  | { kind: 'interval'; semitones: number; name?: IntervalShortName }
  | { kind: 'labels'; labels: readonly { position: FretPosition; degree: Degree; label?: string }[] }
  | { kind: 'choice'; choice: string | number };

/** Resultado de evaluar una respuesta con `grade()`. */
export interface Grade {
  /** Si la respuesta es completamente correcta. */
  correct: boolean;
  /** Si la respuesta es parcialmente correcta (algunos aciertos, pero faltan o sobran). */
  partial?: boolean;
  /** Puntuación normalizada de 0 a 1. */
  score: number;
  /** Elementos acertados (posiciones, grados, etc.). */
  hits: readonly unknown[];
  /** Elementos esperados que no se marcaron. */
  misses: readonly unknown[];
  /** Elementos marcados que eran incorrectos o sobrantes. */
  extras: readonly unknown[];
  /** Explicación pedagógica de la corrección. */
  explanation?: string;
}

/** Comprueba si dos posiciones del mástil son idénticas (misma cuerda y mismo traste). */
export function samePosition(a: FretPosition, b: FretPosition): boolean {
  return a.string === b.string && a.fret === b.fret;
}

/** Comprueba si una lista de posiciones contiene a `target`. */
export function containsPosition(list: readonly FretPosition[], target: FretPosition): boolean {
  return list.some((p) => samePosition(p, target));
}

/** Elimina posiciones duplicadas de una lista. */
export function deduplicatePositions(positions: readonly FretPosition[]): FretPosition[] {
  const result: FretPosition[] = [];
  for (const pos of positions) {
    if (!containsPosition(result, pos)) {
      result.push(pos);
    }
  }
  return result;
}

/** Interfaz mínima de una pregunta para poder ser calificada por `grade`. */
export interface GradableQuestion {
  expected: ExpectedAnswer;
  mode?: 'all' | 'first';
}

/**
 * Califica la respuesta del usuario contra lo esperado por la pregunta.
 * Función pura, determinista y sin dependencias de UI ni de estado.
 */
export function grade(question: GradableQuestion, input: AnswerInput): Grade {
  const mode = question.mode ?? 'all';
  const expected = question.expected;

  switch (expected.kind) {
    case 'positions': {
      let userPositions: readonly FretPosition[] = [];
      if (input.kind === 'positions') {
        userPositions = deduplicatePositions(input.positions);
      } else if (input.kind === 'midi') {
        // En caso de audio/midi sin posiciones físicas directas, no califica posiciones exactas del mástil
        return {
          correct: false,
          score: 0,
          hits: [],
          misses: expected.positions,
          extras: input.midis,
          explanation: 'La respuesta requiere posiciones en el mástil.',
        };
      } else {
        return {
          correct: false,
          score: 0,
          hits: [],
          misses: expected.positions,
          extras: [input],
          explanation: 'Tipo de respuesta incompatible con posiciones.',
        };
      }

      const expectedPositions = deduplicatePositions(expected.positions);

      if (mode === 'first') {
        // En modo 'first', basta con que la primera posición marcada esté en el conjunto esperado
        if (userPositions.length === 0) {
          return {
            correct: false,
            score: 0,
            hits: [],
            misses: expectedPositions,
            extras: [],
            explanation: 'No se marcó ninguna posición.',
          };
        }
        const first = userPositions[0]!;
        const isMatch = containsPosition(expectedPositions, first);
        if (isMatch) {
          return {
            correct: true,
            score: 1,
            hits: [first],
            misses: [],
            extras: [],
            explanation: `¡Correcto! Marcaste la posición (${first.string}, ${first.fret}).`,
          };
        } else {
          return {
            correct: false,
            score: 0,
            hits: [],
            misses: expectedPositions,
            extras: [first],
            explanation: `Posición (${first.string}, ${first.fret}) incorrecta.`,
          };
        }
      }

      // Modo 'all' (o por defecto)
      const hits: FretPosition[] = [];
      const extras: FretPosition[] = [];
      for (const pos of userPositions) {
        if (containsPosition(expectedPositions, pos)) {
          hits.push(pos);
        } else {
          extras.push(pos);
        }
      }
      const misses = expectedPositions.filter((p) => !containsPosition(userPositions, p));

      const isAllFound = misses.length === 0 && hits.length === expectedPositions.length;
      const hasNoExtras = extras.length === 0;
      const isCorrect = isAllFound && hasNoExtras;
      const isPartial = !isCorrect && hits.length > 0;

      const totalExpected = expectedPositions.length || 1;
      const rawScore = (hits.length - extras.length * 0.5) / totalExpected;
      const score = isCorrect ? 1 : Math.max(0, Math.min(1, Math.round(rawScore * 100) / 100));

      let explanation: string;
      if (isCorrect) {
        explanation = `¡Correcto! Encontraste las ${hits.length} posiciones esperadas.`;
      } else if (isPartial) {
        explanation = `Parcial: ${hits.length} aciertos, ${misses.length} faltantes y ${extras.length} sobrantes.`;
      } else {
        explanation = `Incorrecto: ${misses.length} posiciones esperadas no se marcaron.`;
      }

      return {
        correct: isCorrect,
        partial: isPartial,
        score,
        hits,
        misses,
        extras,
        explanation,
      };
    }

    case 'pitchClass': {
      let userPc: PitchClass | null = null;
      if (input.kind === 'pitchClass') {
        userPc = input.pitchClass;
      } else if (input.kind === 'choice') {
        if (typeof input.choice === 'number') {
          userPc = ((input.choice % 12) + 12) % 12 as PitchClass;
        }
      }

      if (userPc === null) {
        return {
          correct: false,
          score: 0,
          hits: [],
          misses: [expected.pitchClass],
          extras: [input],
          explanation: 'Respuesta no válida para clase de altura.',
        };
      }

      const isCorrect = userPc === expected.pitchClass;
      return {
        correct: isCorrect,
        score: isCorrect ? 1 : 0,
        hits: isCorrect ? [userPc] : [],
        misses: isCorrect ? [] : [expected.pitchClass],
        extras: isCorrect ? [] : [userPc],
        explanation: isCorrect
          ? `¡Correcto! La nota es ${expected.noteName ?? userPc}.`
          : `Incorrecto: la nota esperada era ${expected.noteName ?? expected.pitchClass}.`,
      };
    }

    case 'interval': {
      let userSemis: number | null = null;
      if (input.kind === 'interval') {
        if (input.semitones !== undefined) {
          userSemis = input.semitones;
        }
      } else if (input.kind === 'choice') {
        if (typeof input.choice === 'number') {
          userSemis = input.choice;
        }
      }

      if (userSemis === null) {
        return {
          correct: false,
          score: 0,
          hits: [],
          misses: [expected.semitones],
          extras: [input],
          explanation: 'Respuesta de intervalo no válida.',
        };
      }

      const isCorrect = userSemis === expected.semitones;
      return {
        correct: isCorrect,
        score: isCorrect ? 1 : 0,
        hits: isCorrect ? [userSemis] : [],
        misses: isCorrect ? [] : [expected.semitones],
        extras: isCorrect ? [] : [userSemis],
        explanation: isCorrect
          ? `¡Correcto! El intervalo es de ${expected.semitones} semitonos (${expected.name ?? ''}).`
          : `Incorrecto: el intervalo esperado era de ${expected.semitones} semitonos (${expected.name ?? ''}).`,
      };
    }

    case 'labels': {
      if (input.kind !== 'labels') {
        return {
          correct: false,
          score: 0,
          hits: [],
          misses: expected.labels,
          extras: [input],
          explanation: 'Se esperaban etiquetas para cada nota.',
        };
      }

      const hits: { position: FretPosition; degree: Degree | string }[] = [];
      const misses: { position: FretPosition; degree: Degree | string }[] = [];
      const extras: { position: FretPosition; label: Degree | string }[] = [];

      for (const exp of expected.labels) {
        const found = input.labels.find((l) => samePosition(l.position, exp.position));
        if (!found) {
          misses.push(exp);
        } else if (found.label === exp.degree || found.label === exp.label) {
          hits.push(exp);
        } else {
          misses.push(exp);
          extras.push(found);
        }
      }

      // Cualquier etiqueta de una posición que no estaba en expected se cuenta como extra
      for (const inp of input.labels) {
        const inExp = expected.labels.some((e) => samePosition(e.position, inp.position));
        if (!inExp) {
          extras.push(inp);
        }
      }

      const isCorrect = hits.length === expected.labels.length && extras.length === 0;
      const isPartial = !isCorrect && hits.length > 0;
      const score = isCorrect
        ? 1
        : Math.max(0, Math.round(((hits.length - extras.length * 0.5) / expected.labels.length) * 100) / 100);

      return {
        correct: isCorrect,
        partial: isPartial,
        score,
        hits,
        misses,
        extras,
        explanation: isCorrect
          ? `¡Correcto! Todos los grados (${hits.map((h) => h.degree).join(', ')}) son correctos.`
          : `Parcial: ${hits.length} aciertos de ${expected.labels.length}.`,
      };
    }

    case 'choice': {
      const userChoice = input.kind === 'choice' ? input.choice : null;
      const isCorrect = userChoice === expected.choice;
      return {
        correct: isCorrect,
        score: isCorrect ? 1 : 0,
        hits: isCorrect ? [userChoice] : [],
        misses: isCorrect ? [] : [expected.choice],
        extras: isCorrect ? [] : [userChoice],
        explanation: isCorrect ? '¡Correcto!' : `Opción incorrecta: se esperaba ${expected.choice}.`,
      };
    }
  }
}
