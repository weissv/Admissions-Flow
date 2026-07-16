import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { pool } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '../../generated');

/**
 * Returns every contract clause, flagging which ones are auto-suggested
 * by the family's current risk_flags and which (if any) were manually
 * selected previously.
 */
export async function getSuggestedClauses(familyId) {
  const familyRes = await pool.query('SELECT risk_flags FROM families WHERE id = $1', [familyId]);
  if (familyRes.rows.length === 0) throw new Error('Семья не найдена');
  const riskFlags = familyRes.rows[0].risk_flags || [];

  const clausesRes = await pool.query('SELECT * FROM contract_clauses ORDER BY id');
  const contractRes = await pool.query('SELECT * FROM family_contracts WHERE family_id = $1', [familyId]);
  const existingSelection = contractRes.rows[0]?.selected_clause_ids ?? null;

  return clausesRes.rows.map((clause) => ({
    id: clause.id,
    risk_flag: clause.risk_flag,
    clause_title: clause.clause_title,
    clause_text: clause.clause_text,
    auto_suggested: riskFlags.includes(clause.risk_flag),
    selected: existingSelection ? existingSelection.includes(clause.id) : riskFlags.includes(clause.risk_flag),
  }));
}

export async function saveClauseSelection(familyId, selectedClauseIds) {
  await pool.query(
    `INSERT INTO family_contracts (family_id, selected_clause_ids, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (family_id) DO UPDATE SET selected_clause_ids = $2, updated_at = NOW()`,
    [familyId, selectedClauseIds]
  );
}

export async function generateContractPdf(familyId) {
  const familyRes = await pool.query('SELECT * FROM families WHERE id = $1', [familyId]);
  if (familyRes.rows.length === 0) throw new Error('Семья не найдена');
  const family = familyRes.rows[0];

  const contractRes = await pool.query('SELECT * FROM family_contracts WHERE family_id = $1', [familyId]);
  const selectedIds = contractRes.rows[0]?.selected_clause_ids ?? [];

  let clauses = [];
  if (selectedIds.length > 0) {
    const clausesRes = await pool.query('SELECT * FROM contract_clauses WHERE id = ANY($1::int[]) ORDER BY id', [selectedIds]);
    clauses = clausesRes.rows;
  }

  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const filename = `contract_family_${familyId}_${Date.now()}.pdf`;
  const filePath = path.join(GENERATED_DIR, filename);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(18).text('Договор об образовательном партнерстве', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Ребёнок: ${family.child_name}, класс: ${family.child_class}`);
  doc.text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`);
  doc.moveDown();

  if (clauses.length > 0) {
    doc.fontSize(14).text('Индивидуальные приложения к договору', { underline: true });
    doc.moveDown(0.5);
    for (const clause of clauses) {
      doc.fontSize(12).text(clause.clause_title, { continued: false });
      doc.fontSize(10).text(clause.clause_text);
      doc.moveDown();
    }
  }

  doc.fontSize(14).text('Основные положения', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).text(
    'Настоящий договор регулирует взаимодействие между образовательной организацией и семьёй ' +
      'обучающегося на принципах партнерства, взаимного уважения и разделённой ответственности за ' +
      'образовательный результат ребёнка.'
  );

  doc.moveDown(3);
  doc.fontSize(10).text('_____________________ (Школа)                    _____________________ (Родители)');

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  await pool.query(
    `INSERT INTO family_contracts (family_id, selected_clause_ids, generated_file, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (family_id) DO UPDATE SET generated_file = $3, updated_at = NOW()`,
    [familyId, selectedIds, filename]
  );

  return filename;
}

export async function markContractSigned(familyId) {
  await pool.query(
    `INSERT INTO family_contracts (family_id, is_signed, signed_at, updated_at)
     VALUES ($1, TRUE, NOW(), NOW())
     ON CONFLICT (family_id) DO UPDATE SET is_signed = TRUE, signed_at = NOW(), updated_at = NOW()`,
    [familyId]
  );
}
