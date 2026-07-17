import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { getFamily, completeStage, addRiskFlags, ensureStageInProgress } from '../services/familyService.js';
import { STAGE1_QUESTIONS } from '../constants/questionBanks.js';

const router = express.Router();
router.use(requireAuth);

// ---- Admin view: responses received + parental disagreements -----------
router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1 ORDER BY created_at ASC`,
      [req.params.familyId]
    );

    const byRespondent = {};
    for (const row of rows) byRespondent[row.respondent_type] = row;

    const disagreements = [];
    if (byRespondent.mother && byRespondent.father) {
      const motherAnswers = Object.fromEntries((byRespondent.mother.q_and_a || []).map((a) => [a.question_id, a]));
      const fatherAnswers = Object.fromEntries((byRespondent.father.q_and_a || []).map((a) => [a.question_id, a]));
      for (const q of STAGE1_QUESTIONS) {
        const m = motherAnswers[q.id];
        const f = fatherAnswers[q.id];
        if (m && f && m.selected_option_id !== f.selected_option_id) {
          disagreements.push({
            question_id: q.id,
            question: q.question,
            mother: m,
            father: f,
          });
        }
      }
    }

    res.json({
      questions: STAGE1_QUESTIONS,
      responses: byRespondent,
      received: { mother: !!byRespondent.mother, father: !!byRespondent.father },
      disagreements,
    });
  })
);

router.post(
  '/:familyId/manual-response',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 1);

    const { respondent_type = 'mother', answers = {} } = req.body;
    const safeRespondentType = ['mother', 'father'].includes(respondent_type) ? respondent_type : 'mother';

    const qAndA = [];
    for (const question of STAGE1_QUESTIONS) {
      const answer = answers[question.id];
      const selectedOptionId = Number(answer?.selected_option_id);
      const option = question.options.find((o) => o.id === selectedOptionId);
      if (!option) continue;

      qAndA.push({
        question: question.question,
        question_id: question.id,
        selected_option_id: option.id,
        weight: option.weight,
        comment: answer?.comment || '',
        entered_by_staff: true,
      });
    }

    await pool.query(
      `DELETE FROM questionnaire_responses
       WHERE family_id = $1 AND stage_number = 1 AND respondent_type = $2`,
      [req.params.familyId, safeRespondentType]
    );

    const { rows } = await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, q_and_a)
       VALUES ($1, 1, $2, $3) RETURNING *`,
      [req.params.familyId, safeRespondentType, JSON.stringify(qAndA)]
    );

    res.status(201).json(rows[0]);
  })
);

// ---- Approve Stage 1 and unlock Stage 2 ---------------------------------
router.post(
  '/:familyId/approve',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1`,
      [req.params.familyId]
    );

    const motherRow = rows.find((r) => r.respondent_type === 'mother');
    const fatherRow = rows.find((r) => r.respondent_type === 'father');
    if (motherRow && fatherRow) {
      const motherAnswers = Object.fromEntries((motherRow.q_and_a || []).map((a) => [a.question_id, a]));
      const fatherAnswers = Object.fromEntries((fatherRow.q_and_a || []).map((a) => [a.question_id, a]));
      const hasDisagreement = STAGE1_QUESTIONS.some(
        (q) => motherAnswers[q.id] && fatherAnswers[q.id] && motherAnswers[q.id].selected_option_id !== fatherAnswers[q.id].selected_option_id
      );
      if (hasDisagreement) {
        await addRiskFlags(req.params.familyId, ['PARENTAL_DISAGREEMENT'], {
          PARENTAL_DISAGREEMENT: { stage: 1, quote: 'Разные ответы матери и отца на вопросы SJT', source: 'Анкета 1' },
        });
      }
    }

    const result = await completeStage(req.params.familyId, 1);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
