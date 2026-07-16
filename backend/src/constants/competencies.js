// The 12 core competencies of the "Educational Partnership Index" (ИОП).
// `key` is used inside JSONB competency_scores objects; `label` is the
// Russian text shown throughout the UI.
export const COMPETENCIES = [
  { key: 'responsibility', label: 'Ответственность семьи' },
  { key: 'error_tolerance', label: 'Толерантность к ошибке' },
  { key: 'trust_in_teacher', label: 'Доверие к учителю' },
  { key: 'boundary_keeping', label: 'Способность держать рамку' },
  { key: 'organization', label: 'Организованность семьи' },
  { key: 'self_reflection', label: 'Саморефлексия' },
  { key: 'resourcefulness', label: 'Ресурсность' },
  { key: 'parental_alignment', label: 'Согласованность родителей' },
  { key: 'child_subjectivity_support', label: 'Поддержка субъектности ребенка' },
  { key: 'communication_constructiveness', label: 'Конструктивность коммуникации' },
  { key: 'workload_tolerance', label: 'Толерантность к нагрузке' },
  { key: 'school_model_understanding', label: 'Понимание модели школы' },
];

export const COMPETENCY_KEYS = COMPETENCIES.map((c) => c.key);

export const RISK_FLAGS = [
  { key: 'CONSUMER', label: 'Потребительская позиция', severity: 'critical' },
  { key: 'HIGH_ANXIETY', label: 'Высокая тревожность', severity: 'moderate' },
  { key: 'HYPER_CUSTODY', label: 'Гиперопека', severity: 'moderate' },
  { key: 'PARENTAL_DISAGREEMENT', label: 'Разногласия родителей', severity: 'moderate' },
  { key: 'AGGRESSION', label: 'Агрессивная коммуникация', severity: 'critical' },
  { key: 'BOUNDARY_VIOLATION', label: 'Требование исключений из правил', severity: 'critical' },
  { key: 'PREV_SCHOOL_COMPLAINTS', label: 'Жалобы на прошлую школу', severity: 'moderate' },
  { key: 'LOW_WORKLOAD_TOLERANCE', label: 'Низкая толерантность к нагрузке', severity: 'moderate' },
  { key: 'DEVELOPMENT_ORIENTED', label: 'Ориентация на развитие', severity: 'positive' },
  { key: 'CRISIS_WARNING', label: 'Два подряд негативных недельных среза (EWS)', severity: 'critical' },
];

export const STAGE0_TAGS = [
  'Высокая тревожность',
  'Потребительская позиция',
  'Жалобы на прошлую школу',
  'Ориентация на развитие',
];

export const STAGE0_TAG_TO_FLAG = {
  'Высокая тревожность': 'HIGH_ANXIETY',
  'Потребительская позиция': 'CONSUMER',
  'Жалобы на прошлую школу': 'PREV_SCHOOL_COMPLAINTS',
  'Ориентация на развитие': 'DEVELOPMENT_ORIENTED',
};

export const EVALUATION_CUSTOM_FLAGS = ['RISK', 'RESOURCE', 'CONTRACT', 'FOLLOW'];
