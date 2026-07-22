// The 12 core competencies of the Mezon v3.4 "Educational Partnership Index" (ИОП).
export const COMPETENCIES = [
  { key: 'responsibility', label: 'Ответственность семьи (границы школа/семья)' },
  { key: 'error_tolerance', label: 'Толерантность к ошибкам и неудачам' },
  { key: 'teacher_trust', label: 'Доверие к педагогам и авторитету школы' },
  { key: 'frame_holding', label: 'Способность придерживаться рамок и правил' },
  { key: 'organization', label: 'Организованность семьи и бытовой режим' },
  { key: 'self_reflection', label: 'Взрослая саморефлексия и гибкость' },
  { key: 'resourcefulness', label: 'Реальный ресурс и вовлеченность семьи' },
  { key: 'parent_alignment', label: 'Согласованность между родителями' },
  { key: 'agency_support', label: 'Поддержка субъектности и самостоятельности ребенка' },
  { key: 'constructive_comm', label: 'Культура конструктивной коммуникации' },
  { key: 'load_tolerance', label: 'Толерантность к учебной и временной нагрузке' },
  { key: 'mezon_understanding', label: 'Понимание образовательной модели Школы' },
];

export const COMPETENCY_KEYS = COMPETENCIES.map((c) => c.key);

// The 5 standardized system flags (Mezon v3.4 Flag Taxonomy)
export const SYSTEM_FLAGS = [
  { key: 'RESOURCE', label: 'Ресурс семьи (опора для диалога)', color: 'green', type: 'positive' },
  { key: 'CHECK', label: 'Неясность / Противоречие (проверить на Этапе 2)', color: 'yellow', type: 'warning' },
  { key: 'RISK', label: 'Повторяющийся риск (требует условий)', color: 'red', type: 'risk' },
  { key: 'CONTRACT', label: 'Фиксация в договоре (Этап 4)', color: 'purple', type: 'contract' },
  { key: 'FOLLOW', label: 'Контроль на испытательном сроке (Этап 6)', color: 'blue', type: 'follow' },
];

export const SYSTEM_FLAG_KEYS = SYSTEM_FLAGS.map((f) => f.key);

// Legacy risk flags for backward compatibility & route engine mapping
export const RISK_FLAGS = [
  { key: 'CONSUMER', label: 'Потребительская позиция', severity: 'critical' },
  { key: 'HIGH_ANXIETY', label: 'Высокая тревожность', severity: 'moderate' },
  { key: 'HYPER_CUSTODY', label: 'Гиперопека / подмена задач ребенка', severity: 'moderate' },
  { key: 'PARENTAL_DISAGREEMENT', label: 'Разногласия родителей', severity: 'moderate' },
  { key: 'AGGRESSION', label: 'Агрессивная/конфликтная коммуникация', severity: 'critical' },
  { key: 'BOUNDARY_VIOLATION', label: 'Требование исключений из правил', severity: 'critical' },
  { key: 'PREV_SCHOOL_COMPLAINTS', label: 'Обвинение прошлой школы', severity: 'moderate' },
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

export const EVALUATION_CUSTOM_FLAGS = ['RESOURCE', 'CHECK', 'RISK', 'CONTRACT', 'FOLLOW'];

