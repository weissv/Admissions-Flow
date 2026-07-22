import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { COMPETENCIES, SYSTEM_FLAGS } from '../../constants/competencies.js';
import { FileText, Printer, Eye, CheckCircle2, AlertCircle, Bookmark } from 'lucide-react';

export default function Stage2Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['2'] === 'Completed';
  const [activeTab, setActiveTab] = useState('briefing'); // 'briefing' | 'observation'
  const [briefing, setBriefing] = useState(null);
  const [existingObs, setExistingObs] = useState(null);
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
        setExistingObs(obsRes.data.observation);
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

    // Enforce 2-proof source rule for scores <= 1 or >= 3
    for (const c of COMPETENCIES) {
      const val = scores[c.key];
      if (val <= 1 || val >= 3) {
        const pr = (proofs[c.key] || []).filter((p) => p && p.trim().length > 0);
        if (pr.length < 2) {
          setError(`Для компетенции "${c.label}" с оценкой ${val}/4 необходимо указать минимум 2 источника доказуемости (факты/цитаты).`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      const cleanProofs = {};
      for (const [k, arr] of Object.entries(proofs)) {
        cleanProofs[k] = arr.filter((p) => p && p.trim().length > 0);
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

  if (!briefing) return <div className="text-slate-400">Генерация предвстречного брифинга…</div>;

  const agenda = briefing.agenda || [];
  const quickSheet = briefing.quickSheet || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Этап 2. Очная встреча, Брифинг и Наблюдение</h1>
        <p className="text-slate-500 text-sm">
          Двухслойный инструмент: Предвстречный синтез вопросов (Step 0) + Бланк доказательного наблюдения (12 компетенций).
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Очная встреча и экспертное наблюдение завершены. Открыта рефлексия (Этап 3).</Alert>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('briefing')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'briefing'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={18} />
          1. Предвстречный Брифинг (Step 0)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('observation')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'observation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Eye size={18} />
          2. Протокол Наблюдения и Пробы (In-Meeting)
        </button>
      </div>

      {/* TAB 1: BRIEFING VIEW */}
      {activeTab === 'briefing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <div>
              <h2 className="font-bold text-indigo-950 text-base">Брифинг ведущего очной встречи</h2>
              <p className="text-xs text-indigo-700">Сформирован автоматически на основе данных Этапа 0 и дельта-анализа Этапа 1</p>
            </div>
            <button
              onClick={() => window.print()}
              className="btn-outline !py-1.5 !px-3 flex items-center gap-2 bg-white"
            >
              <Printer size={16} />
              Печать Quick Observer Sheet
            </button>
          </div>

          {/* Quick Summary Card */}
          <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase text-slate-500">Сводка по семье (1-Page Observer Sheet)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400">Ребенок:</span>
                <div className="font-bold text-slate-800">{quickSheet.child_name} ({quickSheet.child_class} класс)</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Триггер обращения:</span>
                <div className="font-medium text-slate-700">«{quickSheet.admin_trigger}»</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Разногласия родителей:</span>
                <div className="font-semibold text-rose-600">{quickSheet.parent_delta_count} несовпадений в анкетных SJT</div>
              </div>
            </div>
          </div>

          {/* Tailored Agenda Questions */}
          <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Синтезированная повестка интервью ({agenda.length} ключевых тем)</h3>

            <div className="space-y-4">
              {agenda.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                      Тема #{item.order}: {item.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Компетенция: {item.target_competency}</span>
                  </div>

                  <div className="text-xs text-slate-500 italic">Триггер: {item.trigger}</div>

                  <div className="text-sm font-semibold text-slate-900 bg-white p-3 rounded-lg border border-slate-200">
                    ❓ Вопрос родителям: «{item.suggested_question}»
                  </div>

                  <div className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60">
                    🎯 Цель наблюдения: {item.observation_goal}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IN-MEETING OBSERVATION FORM */}
      {activeTab === 'observation' && (
        <div className="space-y-6">
          {/* Observer name & probe logger */}
          <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-900 text-base border-b pb-2">1. Динамика первых минут и диагностическая проба</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">ФИО наблюдателя</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={observerName}
                  disabled={isCompleted}
                  onChange={(e) => setObserverName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Кто первым сориентировался при входе</label>
                <select
                  className="input mt-1"
                  disabled={isCompleted}
                  value={firstMinutes.who_oriented}
                  onChange={(e) => setFirstMinutes((fm) => ({ ...fm, who_oriented: e.target.value }))}
                >
                  <option value="child">Ребенок (высокая субъектность)</option>
                  <option value="parent">Родитель за руку (опека)</option>
                  <option value="both">Совместно</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">Реакция родителя на трудность ребенка в пробе</label>
                <select
                  className="input mt-1"
                  disabled={isCompleted}
                  value={diagnosticProbe.parent_reaction}
                  onChange={(e) => setDiagnosticProbe((dp) => ({ ...dp, parent_reaction: e.target.value }))}
                >
                  <option value="gives_space">Дает пространство / подбадривает</option>
                  <option value="intervenes">Подменяет задачу (делает сам)</option>
                  <option value="demands_perfection">Требует идеальности / ругает</option>
                  <option value="blames_task">Обвиняет задание в неадекватности</option>
                </select>
              </div>
            </div>
          </div>

          {/* 12 Competencies Evidence-Based Scoring */}
          <div className="card p-5 space-y-5 bg-white shadow-sm border border-slate-200">
            <div className="border-b pb-3">
              <h2 className="font-bold text-slate-900 text-base">2. Доказательная оценка 12 партнерских компетенций (0–4 баллов)</h2>
              <p className="text-xs text-rose-600 font-semibold mt-1">
                ⚠️ Правило v3.4: При оценках 0–1 или 3–4 ОБЯЗАТЕЛЬНО укажите минимум 2 источника доказуемости (факты / дословные цитаты).
              </p>
            </div>

            <div className="space-y-6">
              {COMPETENCIES.map((c) => {
                const val = scores[c.key] ?? 3;
                const isExtreme = val <= 1 || val >= 3;

                return (
                  <div key={c.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 text-sm">{c.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-indigo-700 text-base">{val} / 4</span>
                        <input
                          type="range"
                          min="0"
                          max="4"
                          step="1"
                          className="w-36 accent-indigo-600"
                          disabled={isCompleted}
                          value={val}
                          onChange={(e) => handleScoreChange(c.key, e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Proof Sources */}
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Bookmark size={14} />
                        Доказательства (Цитаты / Наблюдаемые действия):
                        {isExtreme && <span className="text-rose-600 font-bold ml-1">(Требуется 2 доказательства)</span>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          className="input text-xs"
                          placeholder="Доказательство 1 (Цитата или факт из пробы)"
                          disabled={isCompleted}
                          value={proofs[c.key]?.[0] || ''}
                          onChange={(e) => handleProofChange(c.key, 0, e.target.value)}
                        />
                        <input
                          type="text"
                          className="input text-xs"
                          placeholder="Доказательство 2 (Цитата или выбор в SJT)"
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

          {/* System Flags Assignment */}
          <div className="card p-5 space-y-3 bg-white shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-900 text-base">3. Назначение системных флагов по итогам встречи</h2>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_FLAGS.map((f) => (
                <button
                  type="button"
                  key={f.key}
                  disabled={isCompleted}
                  onClick={() => toggleFlag(f.key)}
                  className={`pill ${customFlags.includes(f.key) ? f.bg : 'border-slate-200 bg-white text-slate-600'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Raw Notes & Submit */}
          <div className="card p-5 space-y-3 bg-white shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-900 text-base">4. Общие выводы и текстовые наблюдения</h2>
            <textarea
              className="input min-h-[120px]"
              disabled={isCompleted}
              placeholder="Дополнительные детали встречи, невербальные проявления, особые моменты…"
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
            />
          </div>

          {!isCompleted && (
            <button
              onClick={saveObservation}
              disabled={saving}
              className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              {saving ? 'Сохраняем наблюдения…' : 'Зафиксировать результаты очной встречи и перейти к Вечерней рефлексии'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
