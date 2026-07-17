import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function Stage1Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['1'] === 'Completed';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [respondentType, setRespondentType] = useState('mother');
  const [answers, setAnswers] = useState({});

  async function load() {
    const { data } = await api.get(`/stage1/${familyId}`);
    setData(data);
  }
  useEffect(() => { load(); }, [familyId]);

  useEffect(() => {
    if (!data) return;
    const existing = data.responses[respondentType];
    if (!existing) {
      setAnswers({});
      return;
    }

    setAnswers(Object.fromEntries((existing.q_and_a || []).map((answer) => [
      answer.question_id,
      { selected_option_id: answer.selected_option_id, comment: answer.comment || '' },
    ])));
  }, [data, respondentType]);

  function updateAnswer(questionId, patch) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), ...patch },
    }));
  }

  async function saveManualResponse() {
    setSaving(true);
    setError('');
    try {
      await api.post(`/stage1/${familyId}/manual-response`, {
        respondent_type: respondentType,
        answers,
      });
      await load();
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError('');
    try {
      await api.post(`/stage1/${familyId}/approve`);
      await reload();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  if (!data) return <div className="text-slate-400">Загрузка…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Этап 1. Анкета</h1>
        <p className="text-slate-500 text-sm">Сотрудник вручную вносит ответы анкеты. Ссылки родителям не генерируются.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Анкета 1 утверждена. Семья приглашена на очную встречу.</Alert>}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Статус ручного ввода</h2>
        <div className="grid grid-cols-2 gap-4">
          {['mother', 'father'].map((r) => (
            <div key={r} className="flex items-center gap-2">
              {data.received[r] ? <CheckCircle2 className="text-emerald-500" size={18} /> : <XCircle className="text-slate-300" size={18} />}
              <span className="text-sm">{r === 'mother' ? 'Мать' : 'Отец'}: {data.received[r] ? 'ответы внесены' : 'не внесены'}</span>
            </div>
          ))}
        </div>
      </div>

      {!isCompleted && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800">Ручной ввод ответов</h2>
            <select className="input max-w-[220px]" value={respondentType} onChange={(e) => setRespondentType(e.target.value)}>
              <option value="mother">Мать</option>
              <option value="father">Отец</option>
            </select>
          </div>

          <div className="space-y-5">
            {data.questions.map((q) => (
              <div key={q.id} className="border-b border-slate-100 pb-4 last:border-0">
                <label className="label">{q.question}</label>
                <select
                  className="input"
                  value={answers[q.id]?.selected_option_id || ''}
                  onChange={(e) => updateAnswer(q.id, { selected_option_id: Number(e.target.value) })}
                >
                  <option value="">Выберите вариант</option>
                  {q.options.map((option) => (
                    <option key={option.id} value={option.id}>{option.id}. {option.text}</option>
                  ))}
                </select>
                {q.requires_comment && (
                  <textarea
                    className="input min-h-[70px] mt-2"
                    placeholder="Комментарий"
                    value={answers[q.id]?.comment || ''}
                    onChange={(e) => updateAnswer(q.id, { comment: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <button onClick={saveManualResponse} disabled={saving} className="btn-secondary w-full">
            {saving ? 'Сохраняем…' : `Сохранить ответы: ${respondentType === 'mother' ? 'мать' : 'отец'}`}
          </button>
        </div>
      )}

      {data.disagreements.length > 0 && (
        <div className="card p-5 border-amber-200">
          <h2 className="font-semibold text-amber-700 flex items-center gap-2 mb-3">
            <AlertTriangle size={18} /> Разногласия родителей ({data.disagreements.length})
          </h2>
          <div className="space-y-4">
            {data.disagreements.map((d) => (
              <div key={d.question_id} className="rounded-xl bg-amber-50 p-4">
                <div className="text-sm font-medium text-slate-800 mb-2">{d.question}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Мать</div>
                    <div>{d.mother.comment || `Вариант №${d.mother.selected_option_id}`}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Отец</div>
                    <div>{d.father.comment || `Вариант №${d.father.selected_option_id}`}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Внесённые ответы</h2>
        <div className="space-y-3">
          {data.questions.map((q) => (
            <div key={q.id} className="border-b border-slate-100 pb-3 last:border-0">
              <div className="text-sm font-medium text-slate-700 mb-1">{q.question}</div>
              <div className="flex gap-2 text-xs">
                {['mother', 'father'].map((r) => {
                  const resp = data.responses[r];
                  const answer = resp?.q_and_a?.find((a) => a.question_id === q.id);
                  return (
                    <Badge key={r} color={answer ? 'blue' : 'slate'}>
                      {r === 'mother' ? 'М' : 'О'}: {answer ? `в.${answer.selected_option_id} (вес ${answer.weight})` : '—'}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isCompleted && (
        <button onClick={approve} disabled={approving} className="btn-primary w-full">
          {approving ? 'Утверждаем…' : 'Утвердить Анкету 1 и перейти к Этапу 2'}
        </button>
      )}
    </div>
  );
}
