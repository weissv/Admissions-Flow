import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily } from '../services/familyService.js';
import { aggregateCompetencies, recomputeIOP, compatibilityLevel } from '../services/scoringService.js';
import { determineRoute, ROUTE_LABELS } from '../services/routeService.js';
import { COMPETENCIES, RISK_FLAGS } from '../constants/competencies.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const [competencies, iopResult] = await Promise.all([
      aggregateCompetencies(family.id),
      recomputeIOP(family.id),
    ]);

    const route = determineRoute(iopResult.iop, family.risk_flags || []);
    const compat = compatibilityLevel(iopResult.iop);

    const radar = competencies.map((c) => ({
      ...c,
      label: COMPETENCIES.find((comp) => comp.key === c.key)?.label || c.key,
    }));

    const risks = (family.risk_flags || []).map((flag) => {
      const meta = RISK_FLAGS.find((f) => f.key === flag);
      return {
        flag,
        label: meta?.label || flag,
        severity: meta?.severity || 'moderate',
        evidence: family.risk_evidence?.[flag] || [],
      };
    });

    res.json({
      family: { id: family.id, child_name: family.child_name, child_class: family.child_class, current_stage: family.current_stage },
      iop: iopResult.iop,
      iop_breakdown: iopResult.breakdown,
      compatibility: compat,
      route: { code: route, label: ROUTE_LABELS[route] },
      radar,
      risks,
    });
  })
);

export default router;
