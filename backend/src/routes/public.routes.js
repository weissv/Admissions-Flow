import express from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { STAGE1_QUESTIONS, STAGE1_BLOCKS, AGE_GROUPS, STAGE3_QUESTIONS } from '../constants/questionBanks.js';
import { ensureStageInProgress } from '../services/familyService.js';
import { computeParentDelta, computeReflectionDelta } from '../services/deltaService.js';

const router = express.Router();

async function resolveLink(token, expectedStage) {
  const { rows } = await pool.query('SELECT * FROM access_links WHERE token = $1', [token]);
  const link = rows[0];
  if (!link) {
    const err = new Error('Ссылка недействительна.');
    err.status = 404;
    throw err;
  }
  if (link.stage_number !== expectedStage) {
    const err = new Error('Эта ссылка не относится к данному этапу.');
    err.status = 400;
    throw err;
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    const err = new Error('Срок действия ссылки истёк.');
    err.status = 410;
    throw err;
  }
  return link;
}

// ---- Stage 1: Public Questionnaire (Mom/Dad link) -----------------------
router.get(
  '/questionnaire/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 1);
    const { rows } = await pool.query('SELECT child_name, child_class, target_grade FROM families WHERE id = $1', [link.family_id]);
    res.json({
      family: rows[0],
      respondent_type: link.respondent_type,
      already_used: link.is_used,
      blocks: STAGE1_BLOCKS,
      questions: STAGE1_QUESTIONS,
      age_groups: AGE_GROUPS,
    });
  })
);

router.post(
  '/questionnaire/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 1);
    const { q_and_a, target_grade } = req.body;
    if (!Array.isArray(q_and_a) || q_and_a.length === 0) {
      return res.status(400).json({ error: 'Заполните анкету перед отправкой.' });
    }

    const respondentType = link.respondent_type || 'joint';

    await pool.query(
      `DELETE FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1 AND respondent_type = $2`,
      [link.family_id, respondentType]
    );

    await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, target_grade, q_and_a)
       VALUES ($1, 1, $2, $3, $4)`,
      [link.family_id, respondentType, target_grade || '1-2', JSON.stringify(q_and_a)]
    );
    await pool.query('UPDATE access_links SET is_used = TRUE WHERE id = $1', [link.id]);
    await ensureStageInProgress(link.family_id, 1);

    // Compute parent delta if both parents responded
    await computeParentDelta(link.family_id);

    res.status(201).json({ message: 'Спасибо! Ваши ответы приняты.' });
  })
);

// ---- Stage 3: Evening Reflection ---------------------------------------
router.get(
  '/reflection/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 3);
    const { rows } = await pool.query('SELECT child_name, child_class FROM families WHERE id = $1', [link.family_id]);
    res.json({
      family: rows[0],
      respondent_type: link.respondent_type,
      already_used: link.is_used,
      questions: STAGE3_QUESTIONS,
    });
  })
);

router.post(
  '/reflection/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 3);
    const { q_and_a } = req.body;
    if (!Array.isArray(q_and_a) || q_and_a.length === 0) {
      return res.status(400).json({ error: 'Заполните рефлексию перед отправкой.' });
    }

    await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, q_and_a)
       VALUES ($1, 3, $2, $3)`,
      [link.family_id, link.respondent_type || 'joint', JSON.stringify(q_and_a)]
    );
    await pool.query('UPDATE access_links SET is_used = TRUE WHERE id = $1', [link.id]);
    await ensureStageInProgress(link.family_id, 3);

    // Calculate Reflection Delta
    await computeReflectionDelta(link.family_id);

    res.status(201).json({ message: 'Спасибо! Вечерняя рефлексия сохранена.' });
  })
);

export default router;
