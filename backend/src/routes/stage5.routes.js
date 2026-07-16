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
    const { independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes = '' } = req.body;
    if ([independence_score, honesty_score, quality_score].some((v) => v === undefined || v === null)) {
      return res.status(400).json({ error: 'Заполните все три шкалы оценки (0-4).' });
    }
    if (!reviewer_name) return res.status(400).json({ error: 'Укажите имя проверяющего.' });

    const { rows } = await pool.query(
      `UPDATE test_tasks SET independence_score = $1, honesty_score = $2, quality_score = $3,
       reviewer_name = $4, reviewer_notes = $5, is_reviewed = TRUE WHERE family_id = $6 RETURNING *`,
      [independence_score, honesty_score, quality_score, reviewer_name, reviewer_notes, req.params.familyId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Задание-тест не найдено. Сначала загрузите работу.' });

    await pool.query(
      `INSERT INTO stage_evaluations (family_id, stage_number, evaluator_name, competency_scores, raw_notes, is_completed)
       VALUES ($1, 5, $2, $3, $4, TRUE)`,
      [
        req.params.familyId,
        reviewer_name,
        {
          child_subjectivity_support: independence_score,
          self_reflection: honesty_score,
          organization: quality_score,
        },
        reviewer_notes,
      ]
    );

    const result = await completeStage(req.params.familyId, 5);
    res.json({ ...result, family: await getFamily(req.params.familyId), test_task: rows[0] });
  })
);

export default router;
