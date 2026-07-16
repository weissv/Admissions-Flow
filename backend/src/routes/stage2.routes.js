import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, ensureStageInProgress, addRiskFlags } from '../services/familyService.js';
import { INTERVIEW_GUIDE } from '../constants/interviewGuide.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM stage_evaluations WHERE family_id = $1 AND stage_number = 2 ORDER BY created_at DESC`,
      [req.params.familyId]
    );
    res.json({ guide: INTERVIEW_GUIDE, evaluations: rows });
  })
);

// ---- Save the observation clicker + competency ratings -----------------
router.post(
  '/:familyId/evaluation',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 2);
    const { evaluator_name, competency_scores = {}, observation = {}, raw_notes = '', custom_flags = [] } = req.body;
    if (!evaluator_name) return res.status(400).json({ error: 'Укажите имя интервьюера.' });

    const scoresWithObservation = { ...competency_scores, _observation: observation };

    const { rows } = await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, custom_flags, is_completed)
       VALUES ($1, 2, $2, $3, $4, $5, TRUE) RETURNING *`,
      [req.params.familyId, evaluator_name, scoresWithObservation, raw_notes, custom_flags]
    );

    const flags = [];
    const evidence = {};
    if (observation.demands_exceptions) {
      flags.push('BOUNDARY_VIOLATION');
      evidence.BOUNDARY_VIOLATION = { stage: 2, quote: raw_notes.slice(0, 280) || 'Родители требовали индивидуальных исключений из правил.', source: 'Очная встреча' };
    }
    if (observation.interrupt_each_other) {
      flags.push('PARENTAL_DISAGREEMENT');
      evidence.PARENTAL_DISAGREEMENT = { stage: 2, quote: raw_notes.slice(0, 280) || 'Родители перебивали друг друга на встрече.', source: 'Очная встреча' };
    }
    if (flags.length) await addRiskFlags(req.params.familyId, flags, evidence);

    res.status(201).json(rows[0]);
  })
);

router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM stage_evaluations WHERE family_id = $1 AND stage_number = 2 AND is_completed = TRUE`,
      [req.params.familyId]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Заполните карту наблюдения перед завершением встречи.' });
    }

    const result = await completeStage(req.params.familyId, 2);

    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const { rows: linkRows } = await pool.query(
      `INSERT INTO access_links (family_id, token, stage_number, respondent_type, expires_at)
       VALUES ($1, $2, 3, 'joint', $3) RETURNING *`,
      [req.params.familyId, token, expiresAt]
    );

    res.json({ ...result, family: await getFamily(req.params.familyId), reflection_link: { ...linkRows[0], url: `${base}/public/reflection/${token}` } });
  })
);

export default router;
