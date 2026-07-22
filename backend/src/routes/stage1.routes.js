import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { getFamily, completeStage, addRiskFlags, ensureStageInProgress } from '../services/familyService.js';
import { computeParentDelta } from '../services/deltaService.js';
import { STAGE1_QUESTIONS, STAGE1_BLOCKS, AGE_GROUPS } from '../constants/questionBanks.js';

const router = express.Router();
router.use(requireAuth);

// ---- Admin view: responses received + parental delta --------------------
router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1 ORDER BY created_at ASC`,
      [req.params.familyId]
    );

    const { rows: deltaRows } = await pool.query(
      `SELECT * FROM parent_deltas WHERE family_id = $1`,
      [req.params.familyId]
    );

    const byRespondent = {};
    for (const row of rows) byRespondent[row.respondent_type] = row;

    let deltaResult = deltaRows[0] || null;
    if (byRespondent.mother && byRespondent.father && !deltaResult) {
      deltaResult = await computeParentDelta(req.params.familyId);
    }

    res.json({
      blocks: STAGE1_BLOCKS,
      questions: STAGE1_QUESTIONS,
      age_groups: AGE_GROUPS,
      responses: byRespondent,
      received: { mother: !!byRespondent.mother, father: !!byRespondent.father },
      delta: deltaResult,
    });
  })
);

// ---- Manual entry by staff on behalf of parent --------------------------
router.post(
  '/:familyId/manual-response',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 1);

    const { respondent_type = 'mother', target_grade = '1-2', answers = {} } = req.body;
    const safeRespondentType = ['mother', 'father'].includes(respondent_type) ? respondent_type : 'mother';

    const qAndA = [];
    for (const question of STAGE1_QUESTIONS) {
      const answer = answers[question.id];
      if (!answer) continue;

      if (question.type === 'sjt' || question.type === 'choice') {
        const selectedOptionId = Number(answer.selected_option_id);
        const option = (question.options || []).find((o) => o.id === selectedOptionId);
        if (!option) continue;

        qAndA.push({
          question: question.question,
          question_id: question.id,
          selected_option_id: option.id,
          weight: option.weight,
          justification_text: answer.justification_text || answer.comment || '',
          entered_by_staff: true,
        });
      } else {
        qAndA.push({
          question: question.question,
          question_id: question.id,
          answer_text: answer.answer_text || answer.comment || '',
          entered_by_staff: true,
        });
      }
    }

    await pool.query(
      `DELETE FROM questionnaire_responses
       WHERE family_id = $1 AND stage_number = 1 AND respondent_type = $2`,
      [req.params.familyId, safeRespondentType]
    );

    const { rows } = await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, target_grade, q_and_a)
       VALUES ($1, 1, $2, $3, $4) RETURNING *`,
      [req.params.familyId, safeRespondentType, target_grade, JSON.stringify(qAndA)]
    );

    // Trigger delta computation if both parents submitted
    const delta = await computeParentDelta(req.params.familyId);

    res.status(201).json({ response: rows[0], delta });
  })
);

// ---- Approve Stage 1 and unlock Stage 2 ---------------------------------
router.post(
  '/:familyId/approve',
  asyncHandler(async (req, res) => {
    const delta = await computeParentDelta(req.params.familyId);
    if (delta.disagreements && delta.disagreements.length > 0) {
      await addRiskFlags(req.params.familyId, ['PARENTAL_DISAGREEMENT', 'CHECK'], {
        PARENTAL_DISAGREEMENT: { stage: 1, quote: 'Несогласованные позиции родителей в анкете 1', source: 'Анкета 1' },
      });
    }

    const result = await completeStage(req.params.familyId, 1);
    res.json({ ...result, delta, family: await getFamily(req.params.familyId) });
  })
);

export default router;
