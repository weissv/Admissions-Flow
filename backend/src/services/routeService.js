import { RISK_FLAGS } from '../constants/competencies.js';

const flagSeverity = Object.fromEntries(RISK_FLAGS.map((f) => [f.key, f.severity]));

/**
 * Determines the recommended support route based on the IOP score and
 * the family's active risk flags according to Mezon v3.4 Methodology.
 *
 * Thresholds:
 * - 3.30 - 4.00: Standard Enrollment (High Compatibility)
 * - 2.60 - 3.29: Conditional Enrollment (Specific contract clauses & checkpoints)
 * - 2.00 - 2.59: Zone of Doubt (Preventive probe / test task required)
 * - < 2.00: Low Compatibility (Crisis / Refusal)
 */
export function determineRoute(iop, riskFlags = []) {
  const hasCritical = riskFlags.some((f) => flagSeverity[f] === 'critical' || f === 'RISK');
  const hasModerate = riskFlags.some((f) => flagSeverity[f] === 'moderate' || f === 'CHECK');

  if (iop < 2.00 || (hasCritical && iop < 2.30)) return 'Crisis';
  if (hasCritical || (iop >= 2.00 && iop < 2.60)) return 'Intense';
  if (hasModerate || (iop >= 2.60 && iop < 3.30)) return 'Preventive';
  return 'Standard';
}

export const ROUTE_LABELS = {
  Standard: 'Стандартный маршрут (Высокая совместимость)',
  Preventive: 'Условный / Профилактический маршрут (С контрольными точками)',
  Intense: 'Усиленный маршрут (Зона сомнений / Доп. проба)',
  Crisis: 'Кризисный маршрут / Низкая совместимость',
};
