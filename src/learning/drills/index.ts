import type { Rng } from '../rng';
import type { DrillStatsMap } from './adaptive';
import { generateC1, generateC2 } from './build';
import { generateB1, generateB2, generateB3, generateB4 } from './intervals';
import { generateA1, generateA2 } from './notes';
import { generateB5 } from './shapes';
import type { DrillConfig, DrillId, DrillQuestion } from './types';

export * from './adaptive';
export * from './build';
export * from './intervals';
export * from './notes';
export * from './shapes';
export * from './types';

/**
 * Generador maestro para cualquier ejercicio del catálogo (A1–C2).
 * Pasa de forma transparente el generador pseudoaleatorio inyectado (Rng),
 * la configuración de sesión y el mapa de estadísticas adaptativas.
 */
export function generateDrillQuestion(
  drillId: DrillId,
  rng: Rng,
  config?: DrillConfig,
  stats?: DrillStatsMap,
): DrillQuestion {
  switch (drillId) {
    case 'A1':
      return generateA1(rng, config, stats);
    case 'A2':
      return generateA2(rng, config, stats);
    case 'B1':
      return generateB1(rng, config, stats);
    case 'B2':
      return generateB2(rng, config, stats);
    case 'B3':
      return generateB3(rng, config, stats);
    case 'B4':
      return generateB4(rng, config, stats);
    case 'B5':
      return generateB5(rng, config, stats);
    case 'C1':
      return generateC1(rng, config, stats);
    case 'C2':
      return generateC2(rng, config, stats);
    default: {
      const _exhaustive: never = drillId;
      throw new Error(`Ejercicio no soportado: ${_exhaustive}`);
    }
  }
}
