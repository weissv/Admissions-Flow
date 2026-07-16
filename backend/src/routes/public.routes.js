import express from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { STAGE1_QUESTIONS, STAGE3_QUESTIONS } from '../constants/questionBanks.js';
import { ensureStageInProgress } from '../services/familyService.js';

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

// ---- Stage 1: SJT + demographic questionnaire ---------------------------
router.get(
  '/questionnaire/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 1);
    const { rows } = await pool.query('SELECT child_name, child_class FROM families WHERE id = $1', [link.family_id]);
    res.json({
      family: rows[0],
      respondent_type: link.respondent_type,
      already_used: link.is_used,
      questions: STAGE1_QUESTIONS,
    });
  })
);

router.post(
  '/questionnaire/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveLink(req.params.token, 1);
    const { q_and_a } = req.body;
    if (!Array.isArray(q_and_a) || q_and_a.length === 0) {
      return res.status(400).json({ error: 'Заполните анкету перед отправкой.' });
    }

    await pool.query(
      `INSERT INTO questionnaire_responses (family_id, stage_number, respondent_type, q_and_a)
       VALUES ($1, 1, $2, $3)`,
      [link.family_id, link.respondent_type || 'joint', q_and_a]
    );
    await pool.query('UPDATE access_links SET is_used = TRUE WHERE id = $1', [link.id]);
    await ensureStageInProgress(link.family_id, 1);

    res.status(201).json({ message: 'Спасибо! Анкета отправлена.' });
  })
);

// ---- Stage 3: evening reflection -----------------------------------------
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
      [link.family_id, link.respondent_type || 'joint', q_and_a]
    );
    await pool.query('UPDATE access_links SET is_used = TRUE WHERE id = $1', [link.id]);
    await ensureStageInProgress(link.family_id, 3);

    res.status(201).json({ message: 'Спасибо! Рефлексия отправлена.' });
  })
);

export default router;
