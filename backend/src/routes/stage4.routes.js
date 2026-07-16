import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFamily, completeStage } from '../services/familyService.js';
import { getSuggestedClauses, saveClauseSelection, generateContractPdf, markContractSigned } from '../services/contractService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '../../generated');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/:familyId/clauses',
  asyncHandler(async (req, res) => {
    const clauses = await getSuggestedClauses(req.params.familyId);
    res.json(clauses);
  })
);

router.post(
  '/:familyId/clauses',
  asyncHandler(async (req, res) => {
    const { selected_clause_ids } = req.body;
    if (!Array.isArray(selected_clause_ids)) {
      return res.status(400).json({ error: 'selected_clause_ids должен быть массивом.' });
    }
    await saveClauseSelection(req.params.familyId, selected_clause_ids);
    res.json({ message: 'Выбор пунктов договора сохранён.' });
  })
);

router.post(
  '/:familyId/generate',
  asyncHandler(async (req, res) => {
    const filename = await generateContractPdf(req.params.familyId);
    res.json({ filename, download_url: `/api/stage4/${req.params.familyId}/download` });
  })
);

router.get(
  '/:familyId/download',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT generated_file FROM family_contracts WHERE family_id = $1', [req.params.familyId]);
    const filename = rows[0]?.generated_file;
    if (!filename) return res.status(404).json({ error: 'Договор ещё не сформирован.' });
    res.download(path.join(GENERATED_DIR, filename), 'Договор.pdf');
  })
);

router.post(
  '/:familyId/sign',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT generated_file FROM family_contracts WHERE family_id = $1', [req.params.familyId]);
    if (!rows[0]?.generated_file) {
      return res.status(400).json({ error: 'Сначала сформируйте договор.' });
    }
    await markContractSigned(req.params.familyId);
    const result = await completeStage(req.params.familyId, 4);
    res.json({ ...result, family: await getFamily(req.params.familyId) });
  })
);

export default router;
