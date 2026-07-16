import { RISK_FLAGS } from '../constants/competencies.js';

const flagSeverity = Object.fromEntries(RISK_FLAGS.map((f) => [f.key, f.severity]));

/**
 * Determines the recommended support route based on the IOP score and
 * the family's active risk flags. This is an explicit, auditable rule
 * set rather than a black box — administrators can read exactly why a
 * route was assigned.
 */
export function determineRoute(iop, riskFlags = []) {
  const hasCritical = riskFlags.some((f) => flagSeverity[f] === 'critical');
  const hasModerate = riskFlags.some((f) => flagSeverity[f] === 'moderate');

  if (iop < 2.00 || (hasCritical && iop < 2.60)) return 'Crisis';
  if (hasCritical || (iop < 2.60 && hasModerate)) return 'Intense';
  if (hasModerate || (iop >= 2.00 && iop < 3.30)) return 'Preventive';
  return 'Standard';
}

export const ROUTE_LABELS = {
  Standard: 'Стандартный',
  Preventive: 'Профилактический',
  Intense: 'Усиленный',
  Crisis: 'Кризисный',
};
