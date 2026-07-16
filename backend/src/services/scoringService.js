import { pool } from '../db/pool.js';
import { STAGE_WEIGHTS } from '../constants/stages.js';
import { COMPETENCY_KEYS } from '../constants/competencies.js';

/**
 * Average all numeric competency_scores recorded for a given family & stage.
 * Keys prefixed with "_" (e.g. "_observation") are metadata, not scores, and ignored.
 */
async function averageEvaluationScore(familyId, stageNumber) {
  const { rows } = await pool.query(
    `SELECT competency_scores FROM stage_evaluations
     WHERE family_id = $1 AND stage_number = $2 AND competency_scores IS NOT NULL`,
    [familyId, stageNumber]
  );

  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const scores = row.competency_scores || {};
    for (const [key, value] of Object.entries(scores)) {
      if (key.startsWith('_')) continue;
      const num = Number(value);
      if (!Number.isNaN(num)) {
        sum += num;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Average the "weight" field of questionnaire answers (SJT options are
 * pre-weighted 0-4 by the admin when the question bank is authored).
 */
async function averageQuestionnaireScore(familyId, stageNumber) {
  const { rows } = await pool.query(
    `SELECT q_and_a FROM questionnaire_responses
     WHERE family_id = $1 AND stage_number = $2`,
    [familyId, stageNumber]
  );

  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const items = Array.isArray(row.q_and_a) ? row.q_and_a : [];
    for (const item of items) {
      const num = Number(item.weight);
      if (!Number.isNaN(num)) {
        sum += num;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Computes the normalized 0.00-4.00 score S_i for a single stage, combining
 * evaluator ratings and questionnaire weights when both exist.
 */
export async function computeStageScore(familyId, stageNumber) {
  const [evalScore, qScore] = await Promise.all([
    averageEvaluationScore(familyId, stageNumber),
    averageQuestionnaireScore(familyId, stageNumber),
  ]);

  const parts = [evalScore, qScore].filter((v) => v !== null);
  if (parts.length === 0) return 0;
  const combined = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.max(0, Math.min(4, combined));
}

/**
 * Recomputes IOP = Σ (W_i × S_i) across all 7 stages and persists it.
 * Returns { iop, breakdown } where breakdown lists each stage's S_i and contribution.
 */
export async function recomputeIOP(familyId) {
  const breakdown = [];
  let iop = 0;

  for (const stageNumber of Object.keys(STAGE_WEIGHTS).map(Number)) {
    const weight = STAGE_WEIGHTS[stageNumber];
    const score = await computeStageScore(familyId, stageNumber);
    const contribution = weight * score;
    iop += contribution;
    breakdown.push({ stage: stageNumber, weight, score: round2(score), contribution: round2(contribution) });
  }

  iop = round2(iop);

  await pool.query('UPDATE families SET iop_score = $1, updated_at = NOW() WHERE id = $2', [iop, familyId]);

  return { iop, breakdown };
}

/**
 * Averages every competency across ALL stage_evaluations recorded for a
 * family — powers the Radar Chart on the Family Passport.
 */
export async function aggregateCompetencies(familyId) {
  const { rows } = await pool.query(
    `SELECT competency_scores FROM stage_evaluations WHERE family_id = $1 AND competency_scores IS NOT NULL`,
    [familyId]
  );

  const sums = {};
  const counts = {};
  for (const key of COMPETENCY_KEYS) {
    sums[key] = 0;
    counts[key] = 0;
  }

  for (const row of rows) {
    const scores = row.competency_scores || {};
    for (const key of COMPETENCY_KEYS) {
      const num = Number(scores[key]);
      if (!Number.isNaN(num) && scores[key] !== undefined) {
        sums[key] += num;
        counts[key] += 1;
      }
    }
  }

  return COMPETENCY_KEYS.map((key) => ({
    key,
    score: counts[key] > 0 ? round2(sums[key] / counts[key]) : 0,
  }));
}

export function round2(num) {
  return Math.round(num * 100) / 100;
}

export function compatibilityLevel(iop) {
  if (iop >= 3.30) return { level: 'high', label: 'Высокая совместимость', color: 'green' };
  if (iop >= 2.60) return { level: 'conditional', label: 'Совместимость при условиях', color: 'yellow' };
  if (iop >= 2.00) return { level: 'doubtful', label: 'Зона сомнений', color: 'orange' };
  return { level: 'low', label: 'Низкая совместимость', color: 'red' };
}
