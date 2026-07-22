import express from 'express';

import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, ensureStageInProgress, addRiskFlags } from '../services/familyService.js';
import { generateStage2Briefing } from '../services/briefingService.js';

const router = express.Router();
router.use(requireAuth);

// ---- Pre-meeting Briefing & Quick Observer Sheet ------------------------
router.get(
  '/:familyId/briefing',
  asyncHandler(async (req, res) => {
    const briefing = await generateStage2Briefing(req.params.familyId);
    res.json(briefing);
  })
);

// ---- Get existing Stage 2 observations & evaluation --------------------
router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows: obsRows } = await pool.query(
      `SELECT * FROM stage2_observations WHERE family_id = $1`,
      [req.params.familyId]
    );

    const { rows: evalRows } = await pool.query(
      `SELECT * FROM stage_evaluations WHERE family_id = $1 AND stage_number = 2 ORDER BY created_at DESC`,
      [req.params.familyId]
    );

    res.json({
      observation: obsRows[0] || null,
      evaluations: evalRows,
    });
  })
);

// ---- Save In-Meeting Observation & Diagnostic Probe Logger --------------
router.post(
  '/:familyId/observation',
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 2);

    const {
      observer_name = 'Наблюдатель',
      first_minutes_log,
      child_behavior_log,
      parent_behavior_log,
      diagnostic_probe_log,
      mezon_model_reactions,
      competency_scores = {},
      proof_sources = {},
      custom_flags = [],
      raw_notes = '',
    } = req.body;

    // Save observation details
    await pool.query(
      `INSERT INTO stage2_observations (
        family_id, observer_name, first_minutes_log, child_behavior_log, parent_behavior_log,
        diagnostic_probe_log, mezon_model_reactions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (family_id) DO UPDATE SET
        observer_name = EXCLUDED.observer_name,
        first_minutes_log = EXCLUDED.first_minutes_log,
        child_behavior_log = EXCLUDED.child_behavior_log,
        parent_behavior_log = EXCLUDED.parent_behavior_log,
        diagnostic_probe_log = EXCLUDED.diagnostic_probe_log,
        mezon_model_reactions = EXCLUDED.mezon_model_reactions,
        created_at = NOW()`,
      [
        req.params.familyId,
        observer_name,
        JSON.stringify(first_minutes_log || {}),
        JSON.stringify(child_behavior_log || {}),
        JSON.stringify(parent_behavior_log || {}),
        JSON.stringify(diagnostic_probe_log || {}),
        JSON.stringify(mezon_model_reactions || {}),
      ]
    );

    // Save evaluation record with proof sources
    const { rows: evalRows } = await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, proof_sources, raw_notes, custom_flags, is_completed)
       VALUES ($1, 2, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [
        req.params.familyId,
        observer_name,
        JSON.stringify(competency_scores),
        JSON.stringify(proof_sources),
        raw_notes,
        custom_flags,
      ]
    );

    // Add risk flags if present in custom_flags or diagnostic probe
    if (custom_flags && custom_flags.length > 0) {
      const evidence = {};
      custom_flags.forEach((f) => {
        evidence[f] = { stage: 2, quote: raw_notes.slice(0, 200) || 'Очная встреча', source: 'Наблюдение очной встречи' };
      });
      await addRiskFlags(req.params.familyId, custom_flags, evidence);
    }

    res.status(201).json({ observation_saved: true, evaluation: evalRows[0] });
  })
);

// ---- Complete Stage 2 ---------------------------------------------------
router.post(
  '/:familyId/complete',
  asyncHandler(async (req, res) => {
    const result = await completeStage(req.params.familyId, 2);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
