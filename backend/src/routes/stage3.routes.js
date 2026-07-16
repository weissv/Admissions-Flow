import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage } from '../services/familyService.js';
import { computeStageScore } from '../services/scoringService.js';
import { STAGE3_QUESTIONS } from '../constants/questionBanks.js';

const router = express.Router();
router.use(requireAuth);

const PARTNERSHIP_WORDS = ['готов', 'поддерж', 'партнер', 'помогу', 'вместе', 'понима', 'согласен', 'меняться', 'изменю'];
const CONSUMER_WORDS = ['плат', 'обязаны', 'должны сделать', 'требую', 'недовольн', 'вы должны', 'ваша работа'];

function toneScore(text = '') {
  const lower = text.toLowerCase();
  let score = 2; // neutral baseline on a 0-4 scale
  for (const w of PARTNERSHIP_WORDS) if (lower.includes(w)) score += 0.4;
  for (const w of CONSUMER_WORDS) if (lower.includes(w)) score -= 0.5;
  return Math.max(0, Math.min(4, score));
}

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 3 ORDER BY created_at ASC`,
      [req.params.familyId]
    );

    const stage1Score = await computeStageScore(req.params.familyId, 1);

    let combinedTone = null;
    if (rows.length > 0) {
      const allText = rows
        .flatMap((r) => (r.q_and_a || []).map((qa) => qa.answer_text || ''))
        .join(' ');
      combinedTone = toneScore(allText);
    }

    res.json({
      questions: STAGE3_QUESTIONS,
      responses: rows,
      analysis: {
        stage1_score: stage1Score,
        stage3_tone_score: combinedTone,
        shift: combinedTone !== null ? Math.round((combinedTone - stage1Score) * 100) / 100 : null,
        interpretation:
          combinedTone === null
            ? 'Нет данных для анализа'
            : combinedTone - stage1Score > 0.3
            ? 'Заметный сдвиг к партнёрской позиции'
            : combinedTone - stage1Score < -0.3
            ? 'Сдвиг к потребительской позиции — требует внимания'
            : 'Позиция стабильна',
      },
    });
  })
);

router.post(
  '/:familyId/calculate',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 3`,
      [req.params.familyId]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Вечерняя рефлексия ещё не получена от семьи.' });
    }

    const allText = rows.flatMap((r) => (r.q_and_a || []).map((qa) => qa.answer_text || '')).join(' ');
    const scaleAnswer = rows
      .flatMap((r) => r.q_and_a || [])
      .find((qa) => qa.question_id === 'refl4');
    const scaleScore = scaleAnswer ? Number(scaleAnswer.weight ?? scaleAnswer.answer_text) || 0 : null;

    const tone = toneScore(allText);
    const finalScore = scaleScore !== null ? (tone + scaleScore) / 2 : tone;

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, is_completed)
       VALUES ($1, 3, 'Система (авто-анализ рефлексии)', $2, $3, TRUE)`,
      [
        req.params.familyId,
        { self_reflection: finalScore, communication_constructiveness: finalScore },
        'Автоматически рассчитано на основе текста вечерней рефлексии.',
      ]
    );

    const result = await completeStage(req.params.familyId, 3);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
