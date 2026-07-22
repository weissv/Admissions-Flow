import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, addRiskFlags, recalcFamily, ensureStageInProgress } from '../services/familyService.js';

const router = express.Router();
router.use(requireAuth);

const NEGATIVE_KEYS = ['punctuality_issue', 'off_channel_communication', 'aggressive_complaints', 'sr_intervention', 'agreement_violation'];

function weekIsNegative(checklist = {}) {
  return NEGATIVE_KEYS.some((key) => checklist[key] === true);
}

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows: logs } = await pool.query(
      'SELECT * FROM probation_weekly_logs WHERE family_id = $1 ORDER BY week_number ASC',
      [req.params.familyId]
    );

    const { rows: checkpointRows } = await pool.query(
      'SELECT * FROM probation_checkpoints WHERE family_id = $1',
      [req.params.familyId]
    );

    let consecutiveNegative = 0;
    let alert = false;
    const withFlags = logs.map((log) => {
      const negative = weekIsNegative(log.checklist_answers);
      if (negative) {
        consecutiveNegative += 1;
        if (consecutiveNegative >= 2) alert = true;
      } else {
        consecutiveNegative = 0;
      }
      return { ...log, is_negative_week: negative };
    });

    res.json({
      logs: withFlags,
      ews_alert: alert,
      checkpoint: checkpointRows[0] || null,
    });
  })
);

router.post(
  '/:familyId/log',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 6);
    const { week_number = 1, checklist_answers = {}, notes = '', created_by = 'Куратор' } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO probation_weekly_logs (family_id, week_number, checklist_answers, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (family_id, week_number) DO UPDATE SET checklist_answers = $3, notes = $4, created_by = $5
       RETURNING *`,
      [req.params.familyId, week_number, checklist_answers, notes, created_by]
    );

    const negativeCount = NEGATIVE_KEYS.filter((k) => checklist_answers[k]).length;
    const weekScore = Math.max(0, Math.min(4, 4 - (negativeCount / NEGATIVE_KEYS.length) * 4));

    const proofQuotes = [notes || `Неделя ${week_number}: оценка ${round2(weekScore)}`].filter(Boolean);

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, proof_sources, raw_notes, is_completed)
       VALUES ($1, 6, $2, $3, $4, $5, TRUE)`,
      [
        req.params.familyId,
        created_by || 'Куратор',
        JSON.stringify({
          frame_holding: weekScore,
          constructive_comm: weekScore,
          load_tolerance: weekScore,
          organization: weekScore,
        }),
        JSON.stringify({
          frame_holding: proofQuotes,
          constructive_comm: proofQuotes,
          load_tolerance: proofQuotes,
          organization: proofQuotes,
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
      await addRiskFlags(req.params.familyId, ['CRISIS_WARNING', 'FOLLOW'], {
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
  '/:familyId/checkpoint',
  asyncHandler(async (req, res) => {
    const { checkpoint_week = 4, summary_notes = '', final_route_assignment = 'Standard', curator_name = 'Куратор' } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO probation_checkpoints (family_id, checkpoint_week, summary_notes, final_route_assignment, curator_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (family_id) DO UPDATE SET checkpoint_week = $2, summary_notes = $3, final_route_assignment = $4, curator_name = $5
       RETURNING *`,
      [req.params.familyId, checkpoint_week, summary_notes, final_route_assignment, curator_name]
    );

    res.status(201).json(rows[0]);
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

function round2(num) {
  return Math.round(num * 100) / 100;
}

export default router;
