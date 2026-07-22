import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage, ensureStageInProgress } from '../services/familyService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => cb(null, `family_${req.params.familyId}_${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM test_tasks WHERE family_id = $1', [req.params.familyId]);
    res.json(rows[0] || null);
  })
);

router.post(
  '/:familyId/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await ensureStageInProgress(req.params.familyId, 5);
    const {
      child_product_description = '',
      parent_self_report = '',
      who_present = '',
      exact_help_provided = '',
      intervention_moments = '',
      honesty_statement = '',
    } = req.body;

    const filePath = req.file ? req.file.filename : null;

    const selfReportJson = {
      who_present,
      exact_help_provided,
      intervention_moments,
      honesty_statement,
      text_summary: parent_self_report,
    };

    const { rows } = await pool.query(
      `INSERT INTO test_tasks (
        family_id, file_path, child_product_description, parent_self_report, family_self_report
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (family_id) DO UPDATE SET
        file_path = COALESCE($2, test_tasks.file_path),
        child_product_description = EXCLUDED.child_product_description,
        parent_self_report = EXCLUDED.parent_self_report,
        family_self_report = EXCLUDED.family_self_report,
        created_at = NOW()
      RETURNING *`,
      [req.params.familyId, filePath, child_product_description, parent_self_report, JSON.stringify(selfReportJson)]
    );
    res.status(201).json(rows[0]);
  })
);

router.post(
  '/:familyId/review',
  asyncHandler(async (req, res) => {
    const {
      independence_score = 2,
      honesty_score = 2,
      quality_score = 2,
      reviewer_name = 'Проверяющий',
      reviewer_notes = '',
      proof_quotes = [],
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO test_tasks (family_id, independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes, is_reviewed)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (family_id) DO UPDATE SET independence_score = $2, honesty_score = $3, quality_score = $4,
       reviewer_name = $5, reviewer_notes = $6, is_reviewed = TRUE
       RETURNING *`,
      [req.params.familyId, independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes]
    );

    const competencyScores = {
      agency_support: independence_score,
      self_reflection: honesty_score,
      organization: quality_score,
    };

    const proofSources = {
      agency_support: proof_quotes.length ? proof_quotes : [`Самостоятельность: ${independence_score}/4 (Тестовое задание)`],
      self_reflection: proof_quotes.length ? proof_quotes : [`Честность отчета: ${honesty_score}/4 (Самоотчет)`],
      organization: proof_quotes.length ? proof_quotes : [`Качество выполнения: ${quality_score}/4`],
    };

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, proof_sources, raw_notes, is_completed)
       VALUES ($1, 5, $2, $3, $4, $5, TRUE)`,
      [req.params.familyId, reviewer_name, JSON.stringify(competencyScores), JSON.stringify(proofSources), reviewer_notes]
    );

    const result = await completeStage(req.params.familyId, 5);
    res.json({ ...result, family: await getFamily(req.params.familyId), test_task: rows[0] });
  })
);

export default router;
