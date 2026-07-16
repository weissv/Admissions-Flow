import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Switch from '../../components/ui/Switch.jsx';
import Slider from '../../components/ui/Slider.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { EVALUATION_CUSTOM_FLAGS } from '../../constants/competencies.js';
import clsx from 'clsx';

export default function Stage2Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['2'] === 'Completed';
  const [guide, setGuide] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reflectionLink, setReflectionLink] = useState(null);

  const [evaluatorName, setEvaluatorName] = useState('');
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState([]);
  const [observation, setObservation] = useState({
    talk_balance: 2, // 0 = child talks, 4 = parents talk
    interrupt_each_other: false,
    demands_exceptions: false,
    calm_listening: false,
    disputes_teacher_authority: false,
  });

  async function load() {
    const { data } = await api.get(`/stage2/${familyId}`);
    setGuide(data.guide);
    setEvaluations(data.evaluations);
  }
  useEffect(() => { load(); }, [familyId]);

  function toggleFlag(f) {
    setFlags((arr) => (arr.includes(f) ? arr.filter((x) => x !== f) : [...arr, f]));
  }

  async function submitEvaluation() {
    setError('');
    if (!evaluatorName.trim()) {
      setError('Укажите имя интервьюера.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/stage2/${familyId}/evaluation`, {
        evaluator_name: evaluatorName,
        competency_scores: scores,
        observation,
        raw_notes: notes,
        custom_flags: flags,
      });
      await load();
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function completeMeeting() {
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post(`/stage2/${familyId}/complete`);
      setReflectionLink(data.reflection_link);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Этап 2. Очная встреча</h1>
        <p className="text-slate-500 text-sm">Шпаргалка интервьюера и интерактивная карта наблюдения.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Встреча завершена. Вечерняя анкета отправлена.</Alert>}

      {!isCompleted && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5 space-y-5">
            <h2 className="font-semibold text-slate-800">Шпаргалка</h2>
            {guide.map((g) => (
              <div key={g.competency} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="text-sm font-semibold text-slate-700 mb-1">{g.label}</div>
                <ul className="text-xs text-slate-500 list-disc pl-4 mb-2 space-y-0.5">
                  {g.questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
                <StarRating
                  value={scores[g.competency] || 0}
                  onChange={(v) => setScores((s) => ({ ...s, [g.competency]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="card p-5 space-y-5">
            <h2 className="font-semibold text-slate-800">Интерактивная карта наблюдения</h2>
            <Slider
              label="Кто говорит больше?"
              leftLabel="Ребёнок"
              rightLabel="Родители"
              value={observation.talk_balance}
              onChange={(v) => setObservation((o) => ({ ...o, talk_balance: v }))}
            />
            <Switch
              label="Перебивают ли друг друга?"
              checked={observation.interrupt_each_other}
              onChange={(v) => setObservation((o) => ({ ...o, interrupt_each_other: v }))}
            />
            <Switch
              label="Требуют ли индивидуальных исключений из правил?"
              checked={observation.demands_exceptions}
              onChange={(v) => setObservation((o) => ({ ...o, demands_exceptions: v }))}
            />
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <label className="flex items-center gap-2 text-sm py-1.5">
                <input type="checkbox" checked={observation.calm_listening} onChange={(e) => setObservation((o) => ({ ...o, calm_listening: e.target.checked }))} />
                Спокойно слушают правила
              </label>
              <label className="flex items-center gap-2 text-sm py-1.5">
                <input type="checkbox" checked={observation.disputes_teacher_authority} onChange={(e) => setObservation((o) => ({ ...o, disputes_teacher_authority: e.target.checked }))} />
                Оспаривают авторитет учителей
              </label>
            </div>

            <div>
              <label className="label">Заметки / цитаты</label>
              <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div>
              <label className="label">Флаги</label>
              <div className="flex flex-wrap gap-2">
                {EVALUATION_CUSTOM_FLAGS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFlag(f.key)}
                    className={clsx('pill', flags.includes(f.key) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Интервьюер</label>
              <input className="input" value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} placeholder="ФИО" />
            </div>

            <button onClick={submitEvaluation} disabled={saving} className="btn-secondary w-full">
              {saving ? 'Сохраняем…' : 'Сохранить оценку встречи'}
            </button>
          </div>
        </div>
      )}

      {evaluations.length > 0 && !isCompleted && (
        <button onClick={completeMeeting} disabled={saving} className="btn-primary w-full">
          Завершить встречу и отправить вечернюю анкету
        </button>
      )}

      {reflectionLink && (
        <div className="card p-4 border-emerald-200 text-sm">
          Ссылка на вечернюю рефлексию: <span className="text-slate-600 break-all">{reflectionLink.url}</span>
        </div>
      )}
    </div>
  );
}
