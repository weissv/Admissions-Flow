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
      if (!Number.isNaN(num) && Number.isFinite(num)) {
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
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        sum += num;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Stage 0 score computation from stage0_records / initial_indicators
 */
async function getStage0Score(familyId) {
  const { rows } = await pool.query(
    `SELECT initial_indicators, family_responsibility_recognition FROM stage0_records WHERE family_id = $1`,
    [familyId]
  );
  if (rows.length === 0 || !rows[0].initial_indicators) return null;

  const indicators = rows[0].initial_indicators;
  let sum = 0;
  let count = 0;
  for (const key of ['request_clarity', 'educational_motivation', 'family_resource', 'communication_readiness', 'readiness_for_rules']) {
    const val = Number(indicators[key]);
    if (!Number.isNaN(val)) {
      sum += val;
      count++;
    }
  }
  // Convert 0-3 initial scale to 0-4 equivalent if present
  return count > 0 ? (sum / count) * (4 / 3) : null;
}

/**
 * Computes the normalized 0.00-4.00 score S_i for a single stage.
 */
export async function computeStageScore(familyId, stageNumber) {
  if (stageNumber === 0) {
    const s0 = await getStage0Score(familyId);
    const eval0 = await averageEvaluationScore(familyId, 0);
    const parts = [s0, eval0].filter((v) => v !== null);
    if (parts.length > 0) return Math.max(0, Math.min(4, parts.reduce((a, b) => a + b, 0) / parts.length));
  }

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
 * Formula: IOP = (S0*0.10) + (S1*0.15) + (S2*0.25) + (S3*0.15) + (S4*0.10) + (S5*0.10) + (S6*0.15)
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
 * Averages every competency across ALL stage_evaluations recorded for a family.
 * Validates evidence proof sources for scores <= 1 or >= 3 (requires >= 2 proof sources).
 */
export async function aggregateCompetencies(familyId) {
  const { rows } = await pool.query(
    `SELECT competency_scores, proof_sources FROM stage_evaluations WHERE family_id = $1 AND competency_scores IS NOT NULL`,
    [familyId]
  );

  const sums = {};
  const counts = {};
  const proofs = {};
  for (const key of COMPETENCY_KEYS) {
    sums[key] = 0;
    counts[key] = 0;
    proofs[key] = [];
  }

  for (const row of rows) {
    const scores = row.competency_scores || {};
    const rowProofs = row.proof_sources || {};

    for (const key of COMPETENCY_KEYS) {
      const num = Number(scores[key]);
      if (!Number.isNaN(num) && scores[key] !== undefined && scores[key] !== null) {
        sums[key] += num;
        counts[key] += 1;
      }
      if (Array.isArray(rowProofs[key])) {
        proofs[key].push(...rowProofs[key]);
      }
    }
  }

  return COMPETENCY_KEYS.map((key) => {
    const avgScore = counts[key] > 0 ? round2(sums[key] / counts[key]) : 0;
    const proofCount = proofs[key].length;
    // Rule v3.4: Extreme scores (0-1 or 3-4) MUST have at least 2 proof sources
    const isExtreme = avgScore <= 1.0 || avgScore >= 3.0;
    const hasSufficientProof = !isExtreme || proofCount >= 2;

    return {
      key,
      score: avgScore,
      proofCount,
      proofs: proofs[key],
      isExtreme,
      hasSufficientProof,
    };
  });
}

export function round2(num) {
  return Math.round(num * 100) / 100;
}

export function compatibilityLevel(iop) {
  if (iop >= 3.30) return { level: 'high', label: 'Высокая совместимость (Стандартный маршрут)', color: 'green' };
  if (iop >= 2.60) return { level: 'conditional', label: 'Совместимость при условиях (Условный маршрут)', color: 'yellow' };
  if (iop >= 2.00) return { level: 'doubtful', label: 'Зона сомнений (Профилактический маршрут)', color: 'orange' };
  return { level: 'low', label: 'Низкая совместимость (Кризисный маршрут / Отказ)', color: 'red' };
}
