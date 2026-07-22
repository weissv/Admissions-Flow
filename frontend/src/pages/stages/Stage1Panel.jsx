import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { CheckCircle2, XCircle, AlertTriangle, Link as LinkIcon, UserCheck } from 'lucide-react';

export default function Stage1Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['1'] === 'Completed';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [respondentType, setRespondentType] = useState('mother');
  const [targetGrade, setTargetGrade] = useState(detail.family.target_grade || '1-2');
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

    setAnswers(
      Object.fromEntries(
        (existing.q_and_a || []).map((answer) => [
          answer.question_id,
          {
            selected_option_id: answer.selected_option_id,
            justification_text: answer.justification_text || answer.comment || '',
            answer_text: answer.answer_text || '',
          },
        ])
      )
    );
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
        target_grade: targetGrade,
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

  if (!data) return <div className="text-slate-400">Загрузка данных анкет…</div>;

  const delta = data.delta || {};
  const disagreements = delta.disagreements || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Этап 1. Онлайн-знакомство и Двухродительский Дельта-анализ</h1>
        <p className="text-slate-500 text-sm">
          Сбор данных от Матери и Отца по 6 структурным блокам с 5 forced-choice SJT и автоматическим вычислением разногласий.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Анкета 1 утверждена. Семья допущена к очной встрече (Этап 2).</Alert>}

      {/* Submission status cards */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base mb-3">Статус поступления анкет родителей</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['mother', 'father'].map((r) => (
            <div
              key={r}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                data.received[r] ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {data.received[r] ? <CheckCircle2 className="text-emerald-600" size={22} /> : <XCircle className="text-slate-400" size={22} />}
                <div>
                  <div className="font-semibold text-slate-800">{r === 'mother' ? 'Мать' : 'Отец'}</div>
                  <div className="text-xs text-slate-500">{data.received[r] ? 'Анкета получена и обработана' : 'Ожидается отправка'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parent Delta Engine Warnings */}
      {disagreements.length > 0 && (
        <div className="card p-5 border-rose-200 bg-rose-50/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-rose-200 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-rose-600" size={20} />
              <h2 className="font-bold text-rose-900 text-base">
                Delta Engine: Обнаружены разногласия родителей ({disagreements.length})
              </h2>
            </div>
            <Badge color="red">RISK: Parent Alignment</Badge>
          </div>

          <div className="space-y-4">
            {disagreements.map((d, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-rose-200 shadow-2xs space-y-3">
                <div className="text-sm font-semibold text-slate-800">{d.question}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-100">
                    <div className="text-xs font-bold text-emerald-800 uppercase mb-1">Мать</div>
                    <div className="text-slate-800 font-medium">Вариант #{d.mother.option_id} (Вес: {d.mother.weight})</div>
                    {d.mother.justification && (
                      <div className="text-xs text-slate-600 mt-1 italic">«{d.mother.justification}»</div>
                    )}
                  </div>
                  <div className="bg-blue-50/60 rounded-lg p-3 border border-blue-100">
                    <div className="text-xs font-bold text-blue-800 uppercase mb-1">Отец</div>
                    <div className="text-slate-800 font-medium">Вариант #{d.father.option_id} (Вес: {d.father.weight})</div>
                    {d.father.justification && (
                      <div className="text-xs text-slate-600 mt-1 italic">«{d.father.justification}»</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Input Section */}
      {!isCompleted && (
        <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
            <h2 className="font-semibold text-slate-800 text-base">Ввод / Корректировка ответов сотрудником</h2>
            <div className="flex items-center gap-3">
              <select
                className="input max-w-[180px] font-semibold text-slate-800"
                value={respondentType}
                onChange={(e) => setRespondentType(e.target.value)}
              >
                <option value="mother">Мать</option>
                <option value="father">Отец</option>
              </select>

              <select
                className="input max-w-[180px]"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
              >
                {(data.age_groups || []).map((ag) => (
                  <option key={ag.id} value={ag.id}>{ag.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {data.questions.map((q) => (
              <div key={q.id} className="border-b border-slate-100 pb-4 last:border-0 space-y-2">
                <label className="text-sm font-semibold text-slate-800">{q.question}</label>

                {q.options && (
                  <select
                    className="input"
                    value={answers[q.id]?.selected_option_id || ''}
                    onChange={(e) => updateAnswer(q.id, { selected_option_id: Number(e.target.value) })}
                  >
                    <option value="">Выберите вариант ответа SJT</option>
                    {q.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        [{option.weight} балла] {option.id}. {option.text}
                      </option>
                    ))}
                  </select>
                )}

                {(q.requires_justification || q.type === 'open') && (
                  <textarea
                    className="input min-h-[70px]"
                    placeholder="Обоснование выбора или открытый ответ…"
                    value={answers[q.id]?.justification_text || answers[q.id]?.answer_text || ''}
                    onChange={(e) => updateAnswer(q.id, { justification_text: e.target.value, answer_text: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <button onClick={saveManualResponse} disabled={saving} className="btn-secondary w-full py-2.5">
            {saving ? 'Сохраняем…' : `Сохранить ответы: ${respondentType === 'mother' ? 'Мать' : 'Отец'}`}
          </button>
        </div>
      )}

      {/* Action to approve */}
      {!isCompleted && (
        <button onClick={approve} disabled={approving} className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm">
          {approving ? 'Утверждаем анкету…' : 'Утвердить Анкету 1 и сгенерировать брифинг для Этапа 2'}
        </button>
      )}
    </div>
  );
}
