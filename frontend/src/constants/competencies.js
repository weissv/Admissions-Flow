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

export const SYSTEM_FLAGS = [
  { key: 'RESOURCE', label: 'Ресурс семьи (опора)', color: 'emerald', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'CHECK', label: 'Проверить (неясность)', color: 'amber', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'RISK', label: 'Риск (требует условий)', color: 'rose', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'CONTRACT', label: 'В договор (Этап 4)', color: 'purple', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'FOLLOW', label: 'На контроль (Этап 6)', color: 'blue', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
];

export const EVALUATION_CUSTOM_FLAGS = SYSTEM_FLAGS;

export const STAGE0_TAGS = [
  'Высокая тревожность',
  'Потребительская позиция',
  'Жалобы на прошлую школу',
  'Ориентация на развитие',
];
