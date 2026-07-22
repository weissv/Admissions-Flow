import { pool } from '../db/pool.js';
import { addRiskFlags } from './familyService.js';

/**
 * Computes Mom vs Dad Discrepancy Matrix for Stage 1.
 * Triggers RISK: Parent Alignment (PARENTAL_DISAGREEMENT) if significant gaps exist.
 */
export async function computeParentDelta(familyId) {
  const { rows } = await pool.query(
    `SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1`,
    [familyId]
  );

  const motherRow = rows.find((r) => r.respondent_type === 'mother');
  const fatherRow = rows.find((r) => r.respondent_type === 'father');

  if (!motherRow || !fatherRow) {
    return { calculated: false, message: 'Ожидаются ответы обоих родителей (Мать и Отец)' };
  }

  const motherAnswers = Object.fromEntries((motherRow.q_and_a || []).map((a) => [a.question_id, a]));
  const fatherAnswers = Object.fromEntries((fatherRow.q_and_a || []).map((a) => [a.question_id, a]));

  const disagreements = [];
  let totalDiff = 0;
  let totalQuestions = 0;

  for (const [qId, mAns] of Object.entries(motherAnswers)) {
    const fAns = fatherAnswers[qId];
    if (!fAns) continue;

    totalQuestions++;
    const mWeight = Number(mAns.weight) || 0;
    const fWeight = Number(fAns.weight) || 0;
    const diff = Math.abs(mWeight - fWeight);
    totalDiff += diff;

    if (mAns.selected_option_id !== fAns.selected_option_id || diff >= 2) {
      disagreements.push({
        question_id: qId,
        question: mAns.question,
        mother: { option_id: mAns.selected_option_id, weight: mWeight, justification: mAns.justification_text || mAns.comment || '' },
        father: { option_id: fAns.selected_option_id, weight: fWeight, justification: fAns.justification_text || fAns.comment || '' },
        discrepancy_degree: diff >= 2 ? 'High' : 'Medium',
      });
    }
  }

  const discrepancyScore = totalQuestions > 0 ? Math.round((totalDiff / (totalQuestions * 4)) * 100) / 100 : 0;

  await pool.query(
    `INSERT INTO parent_deltas (family_id, discrepancy_score, disagreements)
     VALUES ($1, $2, $3)
     ON CONFLICT (family_id) DO UPDATE SET discrepancy_score = EXCLUDED.discrepancy_score, disagreements = EXCLUDED.disagreements, calculated_at = NOW()`,
    [familyId, discrepancyScore, JSON.stringify(disagreements)]
  );

  if (disagreements.length > 0) {
    await addRiskFlags(familyId, ['PARENTAL_DISAGREEMENT', 'CHECK'], {
      PARENTAL_DISAGREEMENT: { stage: 1, quote: `Разногласия родителей по ${disagreements.length} вопросам анкеты`, source: 'Дельта-анализ' },
      CHECK: { stage: 1, quote: `Выявлены несогласованные позиции родителей (дискрепация ${discrepancyScore})`, source: 'Дельта-анализ' },
    });
  }

  return { calculated: true, discrepancyScore, disagreements };
}

/**
 * Computes Reflection Delta (Stage 2 meeting commitments vs Stage 3 evening reflection).
 */
export async function computeReflectionDelta(familyId) {
  const { rows: stage2Obs } = await pool.query(`SELECT * FROM stage2_observations WHERE family_id = $1`, [familyId]);
  const { rows: stage3Rows } = await pool.query(`SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 3`, [familyId]);

  const obs = stage2Obs[0] || {};
  const stage3 = stage3Rows[0] || {};
  const qAndA = stage3.q_and_a || [];

  const shifts = [];

  const ruleReadiness = qAndA.find((q) => q.question_id === 'refl5_rule_readiness');
  if (ruleReadiness) {
    const val = Number(ruleReadiness.weight || ruleReadiness.selected_option_id);
    if (val < 3) {
      shifts.push({
        topic: 'Готовность к соблюдению правил',
        stage2_promise: 'Заявлена полная поддержка на очной встрече',
        stage3_reflection: `В вечерней рефлексии оценка снизилась до ${val}/4`,
        flag: 'CHECK',
      });
    }
  }

  const quitReaction = qAndA.find((q) => q.question_id === 'refl2_quit_reaction');
  if (quitReaction && quitReaction.selected_option_id === 1) {
    shifts.push({
      topic: 'Реакция на трудности ребенка',
      stage2_promise: 'Готовность работать с тьютором',
      stage3_reflection: 'В рефлексии выбран вариант немедленного забора документов',
      flag: 'RISK',
    });
  }

  return { shifts_count: shifts.length, shifts };
}
