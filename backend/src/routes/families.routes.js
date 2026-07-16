import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, addRiskFlags, removeRiskFlag, recalcFamily } from '../services/familyService.js';
import { aggregateCompetencies } from '../services/scoringService.js';
import { STAGE0_TAG_TO_FLAG } from '../constants/competencies.js';

const router = express.Router();
router.use(requireAuth);

// ---- List families -------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { route_status, stage, search } = req.query;
    const clauses = [];
    const params = [];

    if (route_status) {
      params.push(route_status);
      clauses.push(`route_status = $${params.length}::route_type`);
    }
    if (stage !== undefined) {
      params.push(Number(stage));
      clauses.push(`current_stage = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`child_name ILIKE $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, child_name, child_class, current_stage, stage_statuses, iop_score, route_status, risk_flags, created_at, updated_at
       FROM families ${where} ORDER BY updated_at DESC`,
      params
    );
    res.json(rows);
  })
);

// ---- Create family (Stage 0 lead capture) ---------------------------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { child_name, child_class, parents_info, call_tags = [], call_log = '', first_questions = [] } = req.body;

    if (!child_name || !child_class || !parents_info) {
      return res.status(400).json({ error: 'Укажите имя ребёнка, класс и контакты родителей.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO families (child_name, child_class, parents_info, stage0_data)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [child_name, child_class, parents_info, { call_tags, call_log, first_questions, transcript: '' }]
    );
    const family = rows[0];

    const flags = call_tags.map((t) => STAGE0_TAG_TO_FLAG[t]).filter(Boolean);
    if (flags.length) {
      const evidence = {};
      flags.forEach((f) => {
        evidence[f] = { stage: 0, quote: call_log?.slice(0, 280) || '(тег без цитаты)', source: 'Первичный звонок' };
      });
      await addRiskFlags(family.id, flags, evidence);
    }

    const { iop, route } = await recalcFamily(family.id);
    const updated = await getFamily(family.id);
    res.status(201).json({ ...updated, iop_score: iop, route_status: route });
  })
);

// ---- Family detail (full 360° view) ---------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const family = await getFamily(req.params.id);
    if (!family) return res.status(404).json({ error: 'Семья не найдена' });

    const [evaluations, questionnaires, probation, testTask, contract, links] = await Promise.all([
      pool.query('SELECT * FROM stage_evaluations WHERE family_id = $1 ORDER BY created_at DESC', [family.id]),
      pool.query('SELECT * FROM questionnaire_responses WHERE family_id = $1 ORDER BY created_at DESC', [family.id]),
      pool.query('SELECT * FROM probation_weekly_logs WHERE family_id = $1 ORDER BY week_number ASC', [family.id]),
      pool.query('SELECT * FROM test_tasks WHERE family_id = $1', [family.id]),
      pool.query('SELECT * FROM family_contracts WHERE family_id = $1', [family.id]),
      pool.query('SELECT * FROM access_links WHERE family_id = $1 ORDER BY created_at DESC', [family.id]),
    ]);

    res.json({
      family,
      evaluations: evaluations.rows,
      questionnaires: questionnaires.rows,
      probation: probation.rows,
      test_task: testTask.rows[0] || null,
      contract: contract.rows[0] || null,
      access_links: links.rows,
    });
  })
);

// ---- Update basic family info -----------------------------------------
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const allowed = ['child_name', 'child_class', 'parents_info'];
    const updates = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        params.push(req.body[key]);
        updates.push(`${key} = $${params.length}`);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет данных для обновления.' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE families SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(rows[0]);
  })
);

// ---- Risk flags: manual add / remove -----------------------------------
router.post(
  '/:id/risk-flags',
  asyncHandler(async (req, res) => {
    const { flag, quote, source } = req.body;
    if (!flag) return res.status(400).json({ error: 'Укажите флаг риска.' });
    await addRiskFlags(req.params.id, [flag], { [flag]: { stage: null, quote: quote || '', source: source || 'Вручную' } });
    const { route } = await recalcFamily(req.params.id);
    const family = await getFamily(req.params.id);
    res.json({ ...family, route_status: route });
  })
);

router.delete(
  '/:id/risk-flags/:flag',
  asyncHandler(async (req, res) => {
    await removeRiskFlag(req.params.id, req.params.flag);
    const { route } = await recalcFamily(req.params.id);
    const family = await getFamily(req.params.id);
    res.json({ ...family, route_status: route });
  })
);

// ---- Passport competencies (radar chart source) ------------------------
router.get(
  '/:id/competencies',
  asyncHandler(async (req, res) => {
    const data = await aggregateCompetencies(req.params.id);
    res.json(data);
  })
);

// ---- Generate a parent access link (Stage 1 / Stage 3 forms) -----------
router.post(
  '/:id/access-links',
  asyncHandler(async (req, res) => {
    const { stage_number, respondent_type = null, expires_in_days = 14 } = req.body;
    if (![1, 3].includes(Number(stage_number))) {
      return res.status(400).json({ error: 'Ссылки можно генерировать только для этапов 1 и 3.' });
    }
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);
    const { rows } = await pool.query(
      `INSERT INTO access_links (family_id, token, stage_number, respondent_type, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, token, stage_number, respondent_type, expiresAt]
    );
    const link = rows[0];
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const path = stage_number === 1 ? 'questionnaire' : 'reflection';
    res.status(201).json({ ...link, url: `${base}/public/${path}/${token}` });
  })
);

export default router;
