import { pool } from '../db/pool.js';
import { getFamily } from './familyService.js';

/**
 * Pre-Meeting Briefing Synthesizer (Stage 2 Step 0)
 * Aggregates Stage 0 verbatim questions & categories + Stage 1 SJT answers and Mom/Dad Delta
 * to auto-generate 3-7 prioritized agenda discussion topics with suggested questions and observation goals.
 */
export async function generateStage2Briefing(familyId) {
  const family = await getFamily(familyId);
  if (!family) throw new Error('Семья не найдена');

  // Fetch Stage 0 detailed record
  const { rows: stage0Rows } = await pool.query('SELECT * FROM stage0_records WHERE family_id = $1', [familyId]);
  const stage0 = stage0Rows[0] || {};
  const stage0Data = family.stage0_data || {};

  // Fetch Stage 1 responses & deltas
  const { rows: stage1Rows } = await pool.query('SELECT * FROM questionnaire_responses WHERE family_id = $1 AND stage_number = 1', [familyId]);
  const { rows: deltaRows } = await pool.query('SELECT * FROM parent_deltas WHERE family_id = $1', [familyId]);
  const delta = deltaRows[0] || {};

  const agenda = [];

  // Stage 0 Background Passport Object
  const firstQuestions = stage0.first_questions || stage0Data.first_questions || [
    { order: 1, text: '', category: 'price' },
    { order: 2, text: '', category: 'rules' },
    { order: 3, text: '', category: 'academic' },
  ];

  const stage0Passport = {
    admin_name: stage0.admin_name || stage0Data.admin_name || 'Администратор',
    contact_format: stage0.contact_format || stage0Data.contact_format || 'Phone',
    applicant_identity: stage0.applicant_identity || stage0Data.applicant_identity || 'Mother',
    trigger_quote: stage0.trigger_quote || stage0Data.trigger_quote || 'Не зафиксировано',
    primary_motive: stage0.primary_motive || stage0Data.primary_motive || 'Качественное образование',
    alternatives_considered: stage0.alternatives_considered || stage0Data.alternatives_considered || 'Частные школы',
    first_questions,
    dominant_pronoun: stage0.dominant_pronoun || stage0Data.dominant_pronoun || 'MyChild',
    prev_school_tone: stage0.prev_school_tone || stage0Data.prev_school_tone || 'Neutral',
    blame_attribution: stage0.blame_attribution || stage0Data.blame_attribution || 'School',
    family_responsibility_recognition: stage0.family_responsibility_recognition ?? stage0Data.family_responsibility_recognition ?? 2,
    initial_indicators: stage0.initial_indicators || stage0Data.initial_indicators || {
      request_clarity: 2,
      educational_motivation: 2,
      family_resource: 2,
      communication_readiness: 2,
      readiness_for_rules: 2,
      initial_risk: 0,
    },
    admin_route: stage0.admin_route || stage0Data.admin_route || family.admin_route_recommendation || 'Standard Route',
  };

  // Rule 1: First 3 Questions check (Price/Rules/Discipline triggers)
  const priceQuestions = firstQuestions.filter((q) => q.category === 'price' || (q.text && q.text.toLowerCase().includes('стоимость')));
  if (priceQuestions.length > 0) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Мотив и рамка ценности',
      trigger: 'Первые вопросы родителя касались стоимости / финансовых условий.',
      suggested_question: 'Что для вас, помимо финансового удобства, станет главным маркером сильной школы к концу первого года?',
      observation_goal: 'Оценить, преобладает ли потребительская позиция или стремление к образовательному партнерству.',
      target_competency: 'responsibility',
    });
  }

  // Rule 2: Prev School Story check
  if (stage0Passport.prev_school_tone === 'Conflict' || stage0Passport.blame_attribution === 'School') {
    agenda.push({
      order: agenda.length + 1,
      category: 'Опыт прошлой школы',
      trigger: 'Родитель выражает претензии к предыдущей школе с отчуждением своей ответственности.',
      suggested_question: 'Какой урок семья извлекла из опыта предыдущей школы, и что вы готовы делать иначе в новых условиях?',
      observation_goal: 'Проверить способность к принятию взрослой ответственности за результат ребенка.',
      target_competency: 'self_reflection',
    });
  }

  // Rule 3: Mom vs Dad Delta check
  if (delta.disagreements && delta.disagreements.length > 0) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Согласованность родителей',
      trigger: `Обнаружены расхождения в ответах Матери и Отца на Этапе 1 (${delta.disagreements.length} несовпадений).`,
      suggested_question: 'В ситуациях высокой нагрузки на ребенка, кто из родителей берет на себя поддержку режимов, а кто отвечает за требования?',
      observation_goal: 'Наблюдать вербальный и невербальный контакт между супругами при обсуждении школьных правил.',
      target_competency: 'parent_alignment',
    });
  }

  // Rule 4: Homework Panic SJT check (Hypercustody risk)
  const sjtPanicChoice = stage1Rows.some((r) =>
    (r.q_and_a || []).some((item) => item.question_id === 'sjt1_homework_panic' && item.selected_option_id === 1)
  );
  if (sjtPanicChoice) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Самостоятельность и гиперопека',
      trigger: 'Родитель выбрал подмену задачи ребенка ("сяду и сделаю задание за него").',
      suggested_question: 'Если ребенок сталкивается с неразрешимой задачей поздно вечером, где для вас проходит грань между помощью и решением за ребенка?',
      observation_goal: 'Проверить готовность давать ребенку право на ошибку и естественные последствия.',
      target_competency: 'agency_support',
    });
  }

  // Rule 5: Rule Disagreement SJT check (Boundary holding)
  const sjtRuleChoice = stage1Rows.some((r) =>
    (r.q_and_a || []).some((item) => item.question_id === 'sjt5_rule_disagreement' && item.selected_option_id === 1)
  );
  if (sjtRuleChoice) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Соблюдение рамок школы',
      trigger: 'Родитель склонен обучать ребенка обходить неудобные школьные правила.',
      suggested_question: 'Как вы поступаете, когда внутренние правила организации противоречат личным привычкам вашей семьи?',
      observation_goal: 'Оценить уважение к авторитету школы и способность держать общественную рамку.',
      target_competency: 'frame_holding',
    });
  }

  // Ensure minimum 3 agenda questions
  if (agenda.length < 3) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Обучение и адаптация',
      trigger: 'Стандартный регламент очной встречи.',
      suggested_question: 'Как ребенок реагирует на утомление в течение полного дня и как вы поддерживаете домашний режим в будни?',
      observation_goal: 'Оценить толерантность к учебной нагрузке и организованность семьи.',
      target_competency: 'load_tolerance',
    });
  }
  if (agenda.length < 3) {
    agenda.push({
      order: agenda.length + 1,
      category: 'Доверие школе',
      trigger: 'Стандартный регламент очной встречи.',
      suggested_question: 'Что в нашей образовательной модели вызывает у вас наибольший отклик, а в чем остаются вопросы?',
      observation_goal: 'Проверить глубину понимания принципов Школы Мезон.',
      target_competency: 'mezon_understanding',
    });
  }

  // Build 1-page Quick Observer Sheet layout data
  const quickSheet = {
    child_name: family.child_name,
    child_class: family.child_class,
    target_grade: family.target_grade || '1-2',
    admin_trigger: stage0Passport.trigger_quote,
    first_questions: firstQuestions.map((q) => `${q.order || '#'}: ${q.text || q}`).join('; '),
    parent_delta_count: delta.disagreements ? delta.disagreements.length : 0,
    top_agenda_items: agenda.slice(0, 5),
    observation_checklist: [
      'Кто первым сориентировался при входе (ребенок / родитель)?',
      'Как родитель реагирует при затруднении ребенка в пробе?',
      'Тон общения супругов между собой.',
      'Реакция на правила полного дня и сдачи гаджетов.',
    ],
  };

  // Upsert to DB
  await pool.query(
    `INSERT INTO stage2_briefings (family_id, agenda_questions, quick_sheet_summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (family_id) DO UPDATE SET agenda_questions = EXCLUDED.agenda_questions, quick_sheet_summary = EXCLUDED.quick_sheet_summary`,
    [familyId, JSON.stringify(agenda), JSON.stringify(quickSheet)]
  );

  return { agenda, quickSheet, stage0Passport, delta };
}
