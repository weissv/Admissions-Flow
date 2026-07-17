import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage } from '../services/familyService.js';

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
    const { parent_self_report = '' } = req.body;
    const filePath = req.file ? req.file.filename : null;

    const { rows } = await pool.query(
      `INSERT INTO test_tasks (family_id, file_path, parent_self_report)
       VALUES ($1, $2, $3)
       ON CONFLICT (family_id) DO UPDATE SET file_path = COALESCE($2, test_tasks.file_path), parent_self_report = $3
       RETURNING *`,
      [req.params.familyId, filePath, parent_self_report]
    );
    res.status(201).json(rows[0]);
  })
);

router.post(
  '/:familyId/review',
  asyncHandler(async (req, res) => {
    const { independence_score = 0, honesty_score = 0, quality_score = 0, reviewer_name = '', reviewer_notes = '' } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO test_tasks (family_id, independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes, is_reviewed)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (family_id) DO UPDATE SET independence_score = $2, honesty_score = $3, quality_score = $4,
       reviewer_name = $5, reviewer_notes = $6, is_reviewed = TRUE
       RETURNING *`,
      [req.params.familyId, independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes]
    );

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, is_completed)
       VALUES ($1, 5, $2, $3, $4, TRUE)`,
      [
        req.params.familyId,
        reviewer_name || 'Сотрудник',
        JSON.stringify({
          child_subjectivity_support: independence_score,
          self_reflection: honesty_score,
          organization: quality_score,
        }),
        reviewer_notes,
      ]
    );

    const result = await completeStage(req.params.familyId, 5);
    res.json({ ...result, family: await getFamily(req.params.familyId), test_task: rows[0] });
  })
);

export default router;
