import express from 'express';

import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, ensureStageInProgress } from '../services/familyService.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM stage_evaluations
       WHERE family_id = $1 AND stage_number = 2 AND competency_scores ? '_stage2_test_result_entry'
       ORDER BY created_at DESC`,
      [req.params.familyId]
    );
    res.json({ test_results: rows });
  })
);

// ---- Save manually entered Stage 2 test results -------------------------
router.post(
  '/:familyId/test-result',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 2);
    const { employee_name = '', test_name = '', score, max_score, result_0_4, notes = '' } = req.body;

    const parsedNormalized = result_0_4 === '' || result_0_4 === undefined || result_0_4 === null ? null : Number(result_0_4);
    const normalized = Number.isFinite(parsedNormalized) ? Math.max(0, Math.min(4, parsedNormalized)) : null;
    const parsedRawScore = score === '' || score === undefined || score === null ? null : Number(score);
    const parsedMaxScore = max_score === '' || max_score === undefined || max_score === null ? null : Number(max_score);
    const rawScore = Number.isFinite(parsedRawScore) ? parsedRawScore : null;
    const maxScore = Number.isFinite(parsedMaxScore) ? parsedMaxScore : null;

    const competencyScores = {
      _stage2_test_result_entry: true,
      _test_details: {
        test_name,
        score: rawScore,
        max_score: maxScore,
        entered_manually: true,
      },
    };
    if (normalized !== null) competencyScores.stage2_test_result = normalized;

    const { rows } = await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, is_completed)
       VALUES ($1, 2, $2, $3, $4, TRUE) RETURNING *`,
      [req.params.familyId, employee_name || 'Сотрудник', JSON.stringify(competencyScores), notes]
    );

    res.status(201).json(rows[0]);
  })
);

router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const result = await completeStage(req.params.familyId, 2);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
