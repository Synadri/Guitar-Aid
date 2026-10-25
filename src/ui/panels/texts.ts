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
  noteRoleInChord: (params) => {
    const interval =
      params?.intervalLong ?? params?.interval ?? params?.category ?? 'nota del acorde';
    const degree = params?.degree ?? params?.role ?? '';
    return degree ? `es ${interval} (${degree})` : `es ${interval}`;
  },
  chordExtraNotes: (params) => {
    const count = Number(params?.count ?? 0);
    if (count === 0) return 'sin notas sobrantes';
    return count === 1 ? '1 nota adicional' : `${count} notas adicionales`;
  },
  scaleContainsNote: (params) => `contiene la nota (grado ${params?.degree ?? ''})`,
  scaleExtraNotes: (params) => {
    const count = Number(params?.count ?? 0);
    if (count === 0) return 'sin notas adicionales';
    return count === 1 ? '1 nota adicional' : `${count} notas adicionales`;
  },
  scaleCommonness: () => 'escala de uso frecuente',
  sharedParentScale: (params, nameMode) => {
    if (params?.parentTonic !== undefined) {
      const parentTonic = Number(params.parentTonic) as PitchClass;
      return `comparte escala madre (${pcName(parentTonic, nameMode)})`;
    }
    return 'comparte escala madre';
  },
  relativeScale: () => 'escala relativa',
  closeScaleVariant: () => 'variante cercana',
  appearsInKey: (params, nameMode) => {
    const degree = params?.degree ?? '';
    if (params?.key !== undefined && params.key !== '') {
      return `grado ${degree} en ${params.key}`;
    }
    if (params?.tonic !== undefined) {
      const tonic = Number(params.tonic) as PitchClass;
      const modeText = params?.mode === 'minor' ? 'menor' : 'mayor';
      return `grado ${degree} en ${pcName(tonic, nameMode)} ${modeText}`;
    }
    return `grado ${degree}`;
  },
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

/** Textos fijos del panel de sugerencias. */
export const SUGGESTIONS_PANEL_TEXTS = {
  regionLabel: 'Sugerencias teóricas',
  heading: 'Sugerencias',
  modeGroupLabel: 'Modo de sugerencias',
  chordsModeLabel: 'Acordes',
  scalesModeLabel: 'Escalas',
  tabsLabel: 'Capa analizada',
  notesTabLabel: 'Notas pulsadas',
  contextTabLabel: 'Menú',
  emptyPrompt: 'Selecciona una nota, un acorde o una escala para ver sugerencias teóricas.',
  noSuggestions: 'No hay sugerencias disponibles para esta selección.',
  chordsListLabel: 'Sugerencias de acordes',
  scalesListLabel: 'Sugerencias de escalas',
  scalesOnTonicListLabel: (tonicName: string) => `Escalas con tónica ${tonicName}`,
  scalesContainingListLabel: (tonicName: string) => `Escalas que contienen ${tonicName}`,
  progressionsListLabel: 'Progresiones que incluyen el acorde',
  showMoreButton: 'Ver más',
  diatonicDegreeReason: (roman: string, scaleName: string) => `grado ${roman} de ${scaleName}`,
  withinScaleReason: (roman: string, scaleName: string) =>
    `formado con notas de ${scaleName} (${roman})`,
  progressionChordReason: (roman: string, keyName: string, templateName: string) =>
    `grado ${roman} en ${keyName} (${templateName})`,
} as const;
