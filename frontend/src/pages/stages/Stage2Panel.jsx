import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { COMPETENCIES, SYSTEM_FLAGS } from '../../constants/competencies.js';
import {
  FileText,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  MessageSquare,
  Sparkles,
  User,
  School,
  AlertCircle,
  Check,
} from 'lucide-react';

const CATEGORY_LABELS = {
  price: 'Стоимость / Условия',
  rules: 'Правила / Границы',
  schedule: 'Режим дня / Полный день',
  discipline: 'Дисциплина / Самостоятельность',
  teachers: 'Учителя / Авторитет',
  academic: 'Учебная программа / Результаты',
  other: 'Другое',
};

const BLAME_LABELS = {
  School: 'Вся вина на прошлой школе',
  Child: 'Вина на ребенке / лени',
  Family: 'Вина на семье',
  Shared: 'Разделенная ответственность',
};

const PRONOUN_LABELS = {
  MyChild: '«Мой ребенок…» (Индивидуальность)',
  We: '«Мы с ним…» (Гиперопека / Слияние)',
  SchoolMust: '«Школа должна…» (Потребительская позиция)',
};

export default function Stage2Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['2'] === 'Completed';
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Observation Form State
  const [observerName, setObserverName] = useState('Наблюдатель');
  const [firstMinutes, setFirstMinutes] = useState({ who_oriented: 'child', punctuality: 'on_time', entrance_tone: 'friendly' });
  const [childBehavior, setChildBehavior] = useState({ initiative: 'high', boundaries: 'holds', contact: 'open', language_freedom: 'free' });
  const [parentBehavior, setParentBehavior] = useState({ listening: 'attentive', role_distribution: 'balanced', rule_reaction: 'constructive', speech_tone: 'calm' });
  const [diagnosticProbe, setDiagnosticProbe] = useState({ probe_type: 'puzzle_task', parent_reaction: 'gives_space', notes: '' });
  const [mezonReactions, setMezonReactions] = useState({ full_day: 'positive', high_density: 'neutral', self_reliance: 'positive', discipline: 'positive' });

  // Competency Ratings 0-4 + Proof Quotes
  const [scores, setScores] = useState(
    Object.fromEntries(COMPETENCIES.map((c) => [c.key, 3]))
  );
  const [proofs, setProofs] = useState(
    Object.fromEntries(COMPETENCIES.map((c) => [c.key, ['', '']]))
  );
  const [customFlags, setCustomFlags] = useState([]);
  const [rawNotes, setRawNotes] = useState('');

  async function loadData() {
    try {
      const [briefingRes, obsRes] = await Promise.all([
        api.get(`/stage2/${familyId}/briefing`),
        api.get(`/stage2/${familyId}`),
      ]);
      setBriefing(briefingRes.data);
      if (obsRes.data.observation) {
        const obs = obsRes.data.observation;
        if (obs.observer_name) setObserverName(obs.observer_name);
        if (obs.first_minutes_log) setFirstMinutes(obs.first_minutes_log);
        if (obs.child_behavior_log) setChildBehavior(obs.child_behavior_log);
        if (obs.parent_behavior_log) setParentBehavior(obs.parent_behavior_log);
        if (obs.diagnostic_probe_log) setDiagnosticProbe(obs.diagnostic_probe_log);
        if (obs.mezon_model_reactions) setMezonReactions(obs.mezon_model_reactions);
      }
      if (obsRes.data.evaluations && obsRes.data.evaluations.length > 0) {
        const ev = obsRes.data.evaluations[0];
        if (ev.competency_scores) setScores(ev.competency_scores);
        if (ev.proof_sources) setProofs(ev.proof_sources);
        if (ev.custom_flags) setCustomFlags(ev.custom_flags);
        if (ev.raw_notes) setRawNotes(ev.raw_notes);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, [familyId]);

  function handleScoreChange(key, val) {
    setScores((prev) => ({ ...prev, [key]: Number(val) }));
  }

  function handleProofChange(key, index, text) {
    setProofs((prev) => {
      const arr = [...(prev[key] || ['', ''])];
      arr[index] = text;
      return { ...prev, [key]: arr };
    });
  }

  function toggleFlag(flagKey) {
    setCustomFlags((prev) =>
      prev.includes(flagKey) ? prev.filter((f) => f !== flagKey) : [...prev, flagKey]
    );
  }

  async function saveObservation() {
    setError('');
    setSaving(true);
    try {
      const cleanProofs = {};
      for (const [k, arr] of Object.entries(proofs)) {
        cleanProofs[k] = (Array.isArray(arr) ? arr : []).filter((p) => p && p.trim().length > 0);
      }

      await api.post(`/stage2/${familyId}/observation`, {
        observer_name: observerName,
        first_minutes_log: firstMinutes,
        child_behavior_log: childBehavior,
        parent_behavior_log: parentBehavior,
        diagnostic_probe_log: diagnosticProbe,
        mezon_model_reactions: mezonReactions,
        competency_scores: scores,
        proof_sources: cleanProofs,
        custom_flags: customFlags,
        raw_notes: rawNotes,
      });

      await api.post(`/stage2/${familyId}/complete`);
      await reload();
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!briefing) return <div className="text-slate-400 p-6">Подготовка рабочего стола очной встречи…</div>;

  const agenda = briefing.agenda || [];
  const quickSheet = briefing.quickSheet || {};
  const stage0 = briefing.stage0Passport || {};
  const delta = briefing.delta || {};
  const disagreements = delta.disagreements || [];

  return (
    <div className="space-y-6">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Этап 2. Очная встреча (Side-by-Side Workspace)</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Контекст и брифинг слева (~40%), протокол наблюдения и компетенции справа (~60%).
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="btn-outline !py-2 !px-4 flex items-center gap-2 bg-white shrink-0 font-medium"
        >
          <Printer size={16} />
          Печать 1-Page Observer Sheet
        </button>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Очная встреча и экспертное наблюдение завершены. Открыта Вечерняя рефлексия (Этап 3).</Alert>}

      {/* SIDE-BY-SIDE GRID WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: PRE-MEETING BRIEFING & FULL STAGE 0/1 BACKGROUND (~40% / 5 cols) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-4">
          {/* Card 1: Stage 0 Full Passport Context */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2 text-indigo-900 font-bold text-base">
              <User size={18} className="text-indigo-600" />
              <span>Паспорт первичного контакта (Этап 0)</span>
            </div>

            {/* Trigger Quote */}
            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 space-y-1">
              <div className="text-xs font-bold uppercase text-indigo-800">Дословный триггер обращения:</div>
              <div className="text-sm font-semibold text-slate-900 italic">«{stage0.trigger_quote}»</div>
              <div className="text-xs text-slate-500 mt-1">
                Мотив: <strong className="text-slate-700">{stage0.primary_motive}</strong> · Альтернативы: <strong className="text-slate-700">{stage0.alternatives_considered}</strong>
              </div>
            </div>

            {/* First 3 Questions Verbatim */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-slate-500">Первые 3 вопроса родителя (дословно):</div>
              {stage0.first_questions && stage0.first_questions.length > 0 ? (
                stage0.first_questions.map((q, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-0.5">
                    <div className="font-semibold text-slate-800">#{idx + 1}: {q.text || 'Не записано'}</div>
                    <div className="text-indigo-700 font-medium">Категория: {CATEGORY_LABELS[q.category] || q.category}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic">Вопросы не зафиксированы</div>
              )}
            </div>

            {/* Speech Markers & Previous School */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div className="text-slate-400 font-semibold mb-0.5">Местоимения:</div>
                <div className="font-semibold text-slate-800">{PRONOUN_LABELS[stage0.dominant_pronoun] || stage0.dominant_pronoun}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div className="text-slate-400 font-semibold mb-0.5">Вина за прошлый результат:</div>
                <div className="font-semibold text-slate-800">{BLAME_LABELS[stage0.blame_attribution] || stage0.blame_attribution}</div>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
              <span>Признание ответственности семьи (0–3):</span>
              <strong className="text-indigo-700 font-extrabold">{stage0.family_responsibility_recognition} / 3</strong>
            </div>

            <div className="text-xs text-slate-600 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 flex justify-between items-center">
              <span>Маршрут администратора:</span>
              <strong className="text-indigo-900 font-bold">{stage0.admin_route}</strong>
            </div>
          </div>

          {/* Card 2: Parent Delta Warnings */}
          {disagreements.length > 0 && (
            <div className="card p-5 bg-rose-50/60 border border-rose-200 space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <AlertTriangle size={18} className="text-rose-600" />
                  <span>Разногласия родителей (Этап 1)</span>
                </div>
                <Badge color="red">{disagreements.length} несовпадения</Badge>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {disagreements.map((d, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-rose-200 text-xs space-y-1">
                    <div className="font-semibold text-slate-800">{d.question}</div>
                    <div className="flex justify-between text-slate-600">
                      <span>Мама: <strong className="text-emerald-700">№{d.mother.option_id}</strong></span>
                      <span>Папа: <strong className="text-blue-700">№{d.father.option_id}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 3: Synthesized Agenda Questions */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 border-b pb-2 text-slate-900 font-bold text-base">
              <Sparkles size={18} className="text-indigo-600" />
              <span>Повестка интервью ({agenda.length} авто-вопроса)</span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {agenda.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-800 uppercase text-[10px]">#{item.order}: {item.category}</span>
                    <span className="text-slate-400 font-mono text-[10px]">{item.target_competency}</span>
                  </div>

                  <div className="font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    «{item.suggested_question}»
                  </div>

                  <div className="text-[11px] text-slate-600">🎯 {item.observation_goal}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE OBSERVATION PROTOCOL & 12 COMPETENCIES LOGGING (~60% / 7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Observer & Probe Details */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
              <Eye size={18} className="text-indigo-600" />
              1. Поведение и Диагностическая Проба
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Наблюдатель (ФИО)</label>
                <input
                  type="text"
                  className="input mt-1"
                  disabled={isCompleted}
                  value={observerName}
                  onChange={(e) => setObserverName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Кто сориентировался при входе</label>
                <select
                  className="input mt-1"
                  disabled={isCompleted}
                  value={firstMinutes.who_oriented}
                  onChange={(e) => setFirstMinutes((fm) => ({ ...fm, who_oriented: e.target.value }))}
                >
                  <option value="child">Ребенок (Высокая субъектность)</option>
                  <option value="parent">Родитель за руку (Опека)</option>
                  <option value="both">Совместно</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Реакция родителя при затруднении ребенка</label>
                <select
                  className="input mt-1"
                  disabled={isCompleted}
                  value={diagnosticProbe.parent_reaction}
                  onChange={(e) => setDiagnosticProbe((dp) => ({ ...dp, parent_reaction: e.target.value }))}
                >
                  <option value="gives_space">Дает пространство / поддерживающий тон</option>
                  <option value="intervenes">Подменяет задачу (делает за ребенка)</option>
                  <option value="demands_perfection">Требует идеальности / ругает</option>
                  <option value="blames_task">Обвиняет задание в избыточности</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Реакция на правила Школы Мезон</label>
                <select
                  className="input mt-1"
                  disabled={isCompleted}
                  value={mezonReactions.full_day}
                  onChange={(e) => setMezonReactions((mr) => ({ ...mr, full_day: e.target.value }))}
                >
                  <option value="positive">Принятие рамок (Полный день / Без гаджетов)</option>
                  <option value="neutral">Нейтральное обсуждение</option>
                  <option value="reluctant">Попытка просить исключения</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: 12 Competencies Evidence-Based Scoring (Soft Indicator, No Software Lock) */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-5">
            <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900 text-base">2. Оценка 12 партнерских компетенций (0–4 баллов)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Оценки сохраняются в любой момент без блокировок.</p>
              </div>
              <Badge color="blue">Шкала 0–4</Badge>
            </div>

            <div className="space-y-5">
              {COMPETENCIES.map((c) => {
                const val = scores[c.key] ?? 3;
                const prList = (proofs[c.key] || []).filter((p) => p && p.trim().length > 0);
                const proofCount = prList.length;
                const isVerified = proofCount >= 2;

                return (
                  <div key={c.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{c.label}</span>

                        {/* SOFT VISUAL STATUS BADGE (NO HARD LOCK) */}
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                            <Check size={12} /> Подтверждено фактами (≥2)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            <AlertCircle size={12} /> Рекомендуется добавить еще факты/цитаты
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-indigo-700 text-base">{val} / 4</span>
                        <input
                          type="range"
                          min="0"
                          max="4"
                          step="1"
                          className="w-32 accent-indigo-600"
                          disabled={isCompleted}
                          value={val}
                          onChange={(e) => handleScoreChange(c.key, e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Proof Sources Inputs (Soft, optional, no blocking) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Bookmark size={13} />
                        Источники доказательности (дословные цитаты / факты):
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          className="input text-xs"
                          placeholder="Факт / цитата 1"
                          disabled={isCompleted}
                          value={proofs[c.key]?.[0] || ''}
                          onChange={(e) => handleProofChange(c.key, 0, e.target.value)}
                        />
                        <input
                          type="text"
                          className="input text-xs"
                          placeholder="Факт / цитата 2"
                          disabled={isCompleted}
                          value={proofs[c.key]?.[1] || ''}
                          onChange={(e) => handleProofChange(c.key, 1, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: System Flags Taxonomy */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900 text-base border-b pb-2">3. Системные флаги очной встречи</h2>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_FLAGS.map((f) => (
                <button
                  type="button"
                  key={f.key}
                  disabled={isCompleted}
                  onClick={() => toggleFlag(f.key)}
                  className={`pill transition-colors ${customFlags.includes(f.key) ? f.bg : 'border-slate-200 bg-white text-slate-600'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card 4: Raw Notes & Submit */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900 text-base">4. Текстовые выводы и заметки</h2>
            <textarea
              className="input min-h-[110px]"
              disabled={isCompleted}
              placeholder="Дополнительные наблюдения, невербальные проявления, особые детали…"
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
            />
          </div>

          {/* Action Button - ALWAYS PERMITS SAVING WITHOUT SOFTWARE LOCK */}
          {!isCompleted && (
            <button
              onClick={saveObservation}
              disabled={saving}
              className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              {saving ? 'Сохраняем результаты…' : 'Зафиксировать очную встречу и перейти к Вечерней рефлексии (Этап 3)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
