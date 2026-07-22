import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { getFamily, completeStage, ensureStageInProgress } from '../services/familyService.js';
import { computeReflectionDelta } from '../services/deltaService.js';
import { STAGE3_QUESTIONS } from '../constants/questionBanks.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 3`,
      [req.params.familyId]
    );

    const delta = await computeReflectionDelta(req.params.familyId);

    res.json({
      questions: STAGE3_QUESTIONS,
      responses: rows[0] || null,
      reflection_delta: delta,
    });
  })
);

router.post(
  '/:familyId/manual-response',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 3);
    const { respondent_type = 'mother', answers = {} } = req.body;

    const qAndA = [];
    for (const q of STAGE3_QUESTIONS) {
      const ans = answers[q.id];
      if (!ans) continue;

      if (q.type === 'sjt') {
        const optionId = Number(ans.selected_option_id);
        const opt = (q.options || []).find((o) => o.id === optionId);
        qAndA.push({
          question: q.question,
          question_id: q.id,
          selected_option_id: optionId,
          weight: opt?.weight || 0,
          justification_text: ans.justification_text || ans.comment || '',
        });
      } else {
        qAndA.push({
          question: q.question,
          question_id: q.id,
          answer_text: ans.answer_text || ans.comment || '',
          weight: Number(ans.weight) || null,
        });
      }
    }

    await pool.query(
      `DELETE FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 3 AND respondent_type = $2`,
      [req.params.familyId, respondent_type]
    );

    const { rows } = await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, q_and_a)
       VALUES ($1, 3, $2, $3) RETURNING *`,
      [req.params.familyId, respondent_type, JSON.stringify(qAndA)]
    );

    const delta = await computeReflectionDelta(req.params.familyId);

    res.status(201).json({ response: rows[0], delta });
  })
);

router.post(
  '/:familyId/approve',
  asyncHandler(async (req, res) => {
    const result = await completeStage(req.params.familyId, 3);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
