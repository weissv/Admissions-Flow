import express from 'express';
import multer from 'multer';

import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, addRiskFlags, ensureStageInProgress } from '../services/familyService.js';
import { transcribeAudio, highlightKeywords } from '../services/whisperService.js';
import { STAGE0_TAG_TO_FLAG } from '../constants/competencies.js';

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---- Get Stage 0 details -----------------------------------------------
router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const { rows } = await pool.query('SELECT * FROM stage0_records WHERE family_id = $1', [req.params.familyId]);
    const record = rows[0] || null;

    res.json({ family, record: record || family.stage0_data || {} });
  })
);

// ---- Save / update Stage 0 detailed checklist -------------------------
router.patch(
  '/:familyId',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 0);
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const {
      admin_name,
      contact_format,
      applicant_identity,
      trigger_quote,
      primary_motive,
      alternatives_considered,
      first_questions, // [{order: 1, text: "...", category: "price|rules|..."}]
      dominant_pronoun,
      speech_markers,
      prev_school_tone,
      blame_attribution,
      family_responsibility_recognition,
      initial_indicators,
      admin_route,
      call_tags,
      call_log,
    } = req.body;

    const stage0Data = {
      ...family.stage0_data,
      admin_name,
      contact_format,
      applicant_identity,
      trigger_quote,
      primary_motive,
      alternatives_considered,
      first_questions,
      dominant_pronoun,
      speech_markers,
      prev_school_tone,
      blame_attribution,
      family_responsibility_recognition,
      initial_indicators,
      admin_route,
      call_tags,
      call_log,
    };

    // Upsert into stage0_records table
    await pool.query(
      `INSERT INTO stage0_records (
        family_id, admin_name, contact_format, applicant_identity, trigger_quote, primary_motive,
        alternatives_considered, first_questions, dominant_pronoun, speech_markers, prev_school_tone,
        blame_attribution, family_responsibility_recognition, initial_indicators, admin_route
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (family_id) DO UPDATE SET
        admin_name = EXCLUDED.admin_name,
        contact_format = EXCLUDED.contact_format,
        applicant_identity = EXCLUDED.applicant_identity,
        trigger_quote = EXCLUDED.trigger_quote,
        primary_motive = EXCLUDED.primary_motive,
        alternatives_considered = EXCLUDED.alternatives_considered,
        first_questions = EXCLUDED.first_questions,
        dominant_pronoun = EXCLUDED.dominant_pronoun,
        speech_markers = EXCLUDED.speech_markers,
        prev_school_tone = EXCLUDED.prev_school_tone,
        blame_attribution = EXCLUDED.blame_attribution,
        family_responsibility_recognition = EXCLUDED.family_responsibility_recognition,
        initial_indicators = EXCLUDED.initial_indicators,
        admin_route = EXCLUDED.admin_route,
        updated_at = NOW()`,
      [
        req.params.familyId,
        admin_name || 'Администратор',
        contact_format || 'Phone',
        applicant_identity || 'Mother',
        trigger_quote || '',
        primary_motive || '',
        alternatives_considered || '',
        JSON.stringify(first_questions || []),
        dominant_pronoun || 'MyChild',
        speech_markers || [],
        prev_school_tone || 'Neutral',
        blame_attribution || 'School',
        family_responsibility_recognition || 2,
        JSON.stringify(initial_indicators || {}),
        admin_route || 'Standard Route',
      ]
    );

    // Also persist stage0_data and admin_route_recommendation on families table
    await pool.query(
      'UPDATE families SET stage0_data = $1, admin_route_recommendation = $2, updated_at = NOW() WHERE id = $3',
      [stage0Data, admin_route || 'Standard Route', req.params.familyId]
    );

    // Flag assignment based on tags and indicators
    const newFlags = [];
    if (Array.isArray(call_tags)) {
      call_tags.forEach((t) => {
        if (STAGE0_TAG_TO_FLAG[t]) newFlags.push(STAGE0_TAG_TO_FLAG[t]);
      });
    }
    if (prev_school_tone === 'Conflict' || blame_attribution === 'School') {
      newFlags.push('PREV_SCHOOL_COMPLAINTS');
      newFlags.push('CHECK');
    }
    if (first_questions && first_questions.some((q) => q.category === 'price')) {
      newFlags.push('CHECK');
    }

    if (newFlags.length > 0) {
      const evidence = {};
      newFlags.forEach((f) => {
        evidence[f] = { stage: 0, quote: trigger_quote || call_log || 'Данные первичного контакта', source: 'Первичный звонок' };
      });
      await addRiskFlags(req.params.familyId, newFlags, evidence);
    }

    res.json(await getFamily(req.params.familyId));
  })
);

// ---- Speech-to-Text (Whisper) for call log -----------------------------
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

// ---- Complete Stage 0: unlocks Stage 1 -------------------------------
router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.familyId);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const result = await completeStage(req.params.familyId, 0);
    res.json(result);
  })
);

export default router;
