import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, addRiskFlags, ensureStageInProgress } from '../services/familyService.js';
import { transcribeAudio, highlightKeywords } from '../services/whisperService.js';
import { STAGE0_TAG_TO_FLAG } from '../constants/competencies.js';

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---- Save / update the call log, tags & first questions ----------------
router.patch(
  '/:familyId',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 0);
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const { call_tags, call_log, first_questions } = req.body;
    const stage0Data = { ...family.stage0_data };
    if (call_tags !== undefined) stage0Data.call_tags = call_tags;
    if (call_log !== undefined) stage0Data.call_log = call_log;
    if (first_questions !== undefined) stage0Data.first_questions = first_questions;

    await pool.query('UPDATE families SET stage0_data = $1, updated_at = NOW() WHERE id = $2', [stage0Data, req.params.familyId]);

    if (Array.isArray(call_tags)) {
      const flags = call_tags.map((t) => STAGE0_TAG_TO_FLAG[t]).filter(Boolean);
      if (flags.length) {
        const evidence = {};
        flags.forEach((f) => {
          evidence[f] = { stage: 0, quote: (call_log || stage0Data.call_log || '').slice(0, 280), source: 'Первичный звонок' };
        });
        await addRiskFlags(req.params.familyId, flags, evidence);
      }
    }

    res.json(await getFamily(req.params.familyId));
  })
);

// ---- Speech-to-Text (Whisper) for the call log --------------------------
router.post(
  '/:familyId/transcribe',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл аудио не найден.' });

    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
    const keywords = highlightKeywords(transcript);

    const family = await getFamily(req.params.familyId);
    const stage0Data = { ...family.stage0_data, transcript };
    await pool.query('UPDATE families SET stage0_data = $1, updated_at = NOW() WHERE id = $2', [stage0Data, req.params.familyId]);

    res.json({ transcript, keywords });
  })
);

// ---- Complete Stage 0: generate Stage-1 links & unlock Stage 1 ---------
router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const questions = family.stage0_data?.first_questions || [];
    if (questions.filter(Boolean).length < 3) {
      return res.status(400).json({ error: 'Заполните все 3 первых вопроса родителей перед завершением этапа.' });
    }

    const result = await completeStage(req.params.familyId, 0);

    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const links = [];
    for (const respondent of ['mother', 'father']) {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const { rows } = await pool.query(
        `INSERT INTO access_links (family_id, token, stage_number, respondent_type, expires_at)
         VALUES ($1, $2, 1, $3, $4) RETURNING *`,
        [req.params.familyId, token, respondent, expiresAt]
      );
      links.push({ ...rows[0], url: `${base}/public/questionnaire/${token}` });
    }

    res.json({ ...result, links });
  })
);

export default router;
