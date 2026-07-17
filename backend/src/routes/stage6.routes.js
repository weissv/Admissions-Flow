import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, addRiskFlags, recalcFamily, ensureStageInProgress } from '../services/familyService.js';

const router = express.Router();
router.use(requireAuth);

// Checklist keys are phrased negatively — `true` means a red flag for the week.
const NEGATIVE_KEYS = ['punctuality_issue', 'off_channel_communication', 'aggressive_complaints'];

function weekIsNegative(checklist = {}) {
  return NEGATIVE_KEYS.some((key) => checklist[key] === true);
}

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM probation_weekly_logs WHERE family_id = $1 ORDER BY week_number ASC',
      [req.params.familyId]
    );

    let consecutiveNegative = 0;
    let alert = false;
    const withFlags = rows.map((log, idx) => {
      const negative = weekIsNegative(log.checklist_answers);
      if (negative) {
        consecutiveNegative += 1;
        if (consecutiveNegative >= 2) alert = true;
      } else {
        consecutiveNegative = 0;
      }
      return { ...log, is_negative_week: negative };
    });

    res.json({ logs: withFlags, ews_alert: alert });
  })
);

router.post(
  '/:familyId/log',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 6);
    const { week_number = 1, checklist_answers = {}, notes = '', created_by = '' } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO probation_weekly_logs (family_id, week_number, checklist_answers, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (family_id, week_number) DO UPDATE SET checklist_answers = $3, notes = $4, created_by = $5
       RETURNING *`,
      [req.params.familyId, week_number, checklist_answers, notes, created_by]
    );

    const negativeCount = NEGATIVE_KEYS.filter((k) => checklist_answers[k]).length;
    const weekScore = Math.max(0, 4 - (negativeCount / NEGATIVE_KEYS.length) * 4);

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, is_completed)
       VALUES ($1, 6, $2, $3, $4, TRUE)`,
      [
        req.params.familyId,
        created_by || 'Куратор',
        JSON.stringify({
          boundary_keeping: weekScore,
          communication_constructiveness: weekScore,
          workload_tolerance: weekScore,
        }),
        notes,
      ]
    );

    const { rows: allLogs } = await pool.query(
      'SELECT * FROM probation_weekly_logs WHERE family_id = $1 ORDER BY week_number ASC',
      [req.params.familyId]
    );
    let consecutiveNegative = 0;
    let alert = false;
    for (const log of allLogs) {
      if (weekIsNegative(log.checklist_answers)) {
        consecutiveNegative += 1;
        if (consecutiveNegative >= 2) alert = true;
      } else {
        consecutiveNegative = 0;
      }
    }

    if (alert) {
      await addRiskFlags(req.params.familyId, ['CRISIS_WARNING'], {
        CRISIS_WARNING: {
          stage: 6,
          quote: `Две недели подряд с негативными отметками (неделя ${week_number})`,
          source: 'Мониторинг испытательного срока',
        },
      });
    }

    const { iop, route } = await recalcFamily(req.params.familyId);
    res.status(201).json({ log: rows[0], ews_alert: alert, iop, route });
  })
);

router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.familyId);
    const statuses = { ...family.stage_statuses, 6: 'Completed' };
    await pool.query('UPDATE families SET stage_statuses = $1, updated_at = NOW() WHERE id = $2', [statuses, req.params.familyId]);
    const { iop, route } = await recalcFamily(req.params.familyId);
    res.json({ iop, route, family: await getFamily(req.params.familyId) });
  })
);

export default router;
