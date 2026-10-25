import { pcName, type NameMode, type PitchClass, type Reason, type ReasonCode } from '../../theory';

type ReasonParams = Record<string, string | number> | undefined;
type ReasonFormatter = (params: ReasonParams, nameMode: NameMode) => string;

/**
 * Traducciones de los códigos estructurados de razón (`ReasonCode`) a texto legible en español.
 * Centralizado en un único archivo para poder ajustar la redacción sin tocar los componentes.
 */
export const REASON_FORMATTERS: Record<ReasonCode, ReasonFormatter> = {
  containsChordTones: (params) => {
    const n = Number(params?.n ?? 0);
    const of = Number(params?.of ?? n);
    if (n === of) {
      return `contiene las ${n} notas del acorde`;
    }
    return `contiene ${n} de las ${of} notas del acorde`;
  },
  rootMatches: () => 'la raíz coincide',
  invertedBass: (params, nameMode) => {
    const bass = Number(params?.bass ?? 0) as PitchClass;
    return `con el bajo en ${pcName(bass, nameMode)}`;
  },
  omitsOptionalTones: (params) => {
    const count = Number(params?.count ?? 1);
    return count === 1 ? 'omite 1 nota opcional' : `omite ${count} notas opcionales`;
  },
  scaleContainsAllNotes: (params) => `contiene las ${params?.n ?? 0} notas`,
  tonicMatches: () => 'la tónica coincide',
  noteRoleInChord: (params) =>
    `es ${params?.intervalLong ?? 'nota del acorde'} (${params?.degree ?? ''})`,
  scaleContainsNote: (params) => `contiene la nota (grado ${params?.degree ?? ''})`,
  scaleExtraNotes: (params) => {
    const count = Number(params?.count ?? 0);
    if (count === 0) return 'sin notas adicionales';
    return count === 1 ? '1 nota adicional' : `${count} notas adicionales`;
  },
  scaleCommonness: () => 'escala de uso frecuente',
  sharedParentScale: () => 'comparte escala madre',
  relativeScale: () => 'escala relativa',
  closeScaleVariant: () => 'variante cercana',
  appearsInKey: (params) => `grado ${params?.degree ?? ''} en ${params?.key ?? ''}`,
  progressionCommonness: () => 'progresión habitual',
};

/** Traduce una razón estructurada del módulo de teoría a texto en español. */
export function formatReason(reason: Reason, nameMode: NameMode = 'sharps'): string {
  const formatter = REASON_FORMATTERS[reason.code];
  return formatter(reason.params, nameMode);
}

/** Textos fijos del panel de información. */
export const INFO_PANEL_TEXTS = {
  regionLabel: 'Información de la selección',
  heading: 'Información',
  rootHeading: 'Raíz',
  rootLabel: 'Raíz',
  rootAutoOption: 'Automática',
  effectiveRootLabel: 'Raíz efectiva',
  emptyPrompt: 'Pulsa una posición en el mástil o una tecla del piano para ver su información.',
  selectedNotesHeading: 'Notas seleccionadas',
  noteColumnHeader: 'Nota',
  fromRootColumnHeader: 'Intervalo desde la raíz',
  fromPreviousColumnHeader: 'Desde la anterior',
  notesScrollLabel: 'Lista de notas, con scroll',
  chordsHeading: 'Acordes posibles',
  chordsScrollLabel: 'Lista de acordes posibles, con scroll',
  noChordRecognized: 'No se reconoce ningún acorde',
  contextHeading: 'Contexto del menú',
  warningsHeading: 'Avisos',
  unplayableWarning: (notes: readonly string[]) =>
    `No se puede tocar en esta afinación: ${notes.join(', ')}`,
} as const;
