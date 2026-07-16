import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM contract_clauses ORDER BY id');
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { risk_flag, clause_title, clause_text } = req.body;
    if (!risk_flag || !clause_title || !clause_text) {
      return res.status(400).json({ error: 'Заполните все поля пункта договора.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO contract_clauses (risk_flag, clause_title, clause_text) VALUES ($1, $2, $3) RETURNING *`,
      [risk_flag, clause_title, clause_text]
    );
    res.status(201).json(rows[0]);
  })
);

export default router;
