import { pool } from '../db/pool.js';
import { MAX_STAGE } from '../constants/stages.js';
import { recomputeIOP } from './scoringService.js';
import { determineRoute } from './routeService.js';

export async function getFamily(id) {
  const { rows } = await pool.query('SELECT * FROM families WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Recomputes IOP + recommended route and persists both on the family row.
 */
export async function recalcFamily(familyId) {
  const { iop, breakdown } = await recomputeIOP(familyId);
  const family = await getFamily(familyId);
  const route = determineRoute(iop, family.risk_flags || []);
  await pool.query('UPDATE families SET route_status = $1, updated_at = NOW() WHERE id = $2', [route, familyId]);
  return { iop, breakdown, route };
}

/**
 * Marks `stageNumber` as Completed and unlocks the next stage
 * (sets it to In_Progress + bumps current_stage). This is the single
 * gate that enforces the strict sequential state machine.
 */
export async function completeStage(familyId, stageNumber) {
  const family = await getFamily(familyId);
  if (!family) throw Object.assign(new Error('Семья не найдена'), { status: 404 });

  const statuses = { ...family.stage_statuses };
  statuses[String(stageNumber)] = 'Completed';

  let currentStage = family.current_stage;
  if (stageNumber < MAX_STAGE) {
    const nextStage = stageNumber + 1;
    statuses[String(nextStage)] = statuses[String(nextStage)] === 'Completed' ? 'Completed' : 'In_Progress';
    currentStage = Math.max(currentStage, nextStage);
  }

  await pool.query(
    'UPDATE families SET stage_statuses = $1, current_stage = $2, updated_at = NOW() WHERE id = $3',
    [statuses, currentStage, familyId]
  );

  const { iop, route } = await recalcFamily(familyId);
  return { iop, route, currentStage, statuses };
}

/**
 * Ensures a stage that is being actively worked on is at least
 * "In_Progress" (used when staff opens a stage form for the first time).
 */
export async function ensureStageInProgress(familyId, stageNumber) {
  const family = await getFamily(familyId);
  if (!family) throw Object.assign(new Error('Семья не найдена'), { status: 404 });
  const statuses = { ...family.stage_statuses };
  if (statuses[String(stageNumber)] === 'Not_Started') {
    statuses[String(stageNumber)] = 'In_Progress';
    await pool.query('UPDATE families SET stage_statuses = $1, updated_at = NOW() WHERE id = $2', [statuses, familyId]);
  }
}

/**
 * Guard used by every stage-specific route: staff cannot submit data for
 * a stage that hasn't been unlocked yet (its predecessor isn't Completed).
 */
export function assertStageUnlocked(family, stageNumber) {
  if (stageNumber === 0) return;
  const prevStatus = family.stage_statuses[String(stageNumber - 1)];
  if (prevStatus !== 'Completed') {
    const err = new Error(`Этап ${stageNumber} заблокирован: сначала завершите этап ${stageNumber - 1}.`);
    err.status = 409;
    throw err;
  }
}

/**
 * Appends new risk flags (deduplicated) and records evidence quotes used
 * for the drill-down in the Family Passport dashboard.
 */
export async function addRiskFlags(familyId, flags, evidence = {}) {
  if (!flags || flags.length === 0) return;
  const family = await getFamily(familyId);
  const currentFlags = new Set(family.risk_flags || []);
  flags.forEach((f) => currentFlags.add(f));

  const riskEvidence = { ...(family.risk_evidence || {}) };
  for (const flag of flags) {
    const entry = evidence[flag];
    if (entry) {
      riskEvidence[flag] = [...(riskEvidence[flag] || []), { ...entry, created_at: new Date().toISOString() }];
    }
  }

  await pool.query(
    'UPDATE families SET risk_flags = $1, risk_evidence = $2, updated_at = NOW() WHERE id = $3',
    [Array.from(currentFlags), riskEvidence, familyId]
  );
}

export async function removeRiskFlag(familyId, flag) {
  const family = await getFamily(familyId);
  const flags = (family.risk_flags || []).filter((f) => f !== flag);
  await pool.query('UPDATE families SET risk_flags = $1, updated_at = NOW() WHERE id = $2', [flags, familyId]);
}
