import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { GraduationCap, CheckCircle2, Moon } from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

export default function PublicReflection() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [justifications, setJustifications] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/public/reflection/${token}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.error || 'Ссылка недействительна.'));
  }, [token]);

  function selectOption(qId, optId, weight) {
    setAnswers((a) => ({ ...a, [qId]: { selected_option_id: optId, weight } }));
  }

  async function submit() {
    setError('');
    const q_and_a = (data.questions || []).map((q) => {
      if (q.type === 'sjt') {
        return {
          question_id: q.id,
          question: q.question,
          selected_option_id: answers[q.id]?.selected_option_id ?? null,
          weight: answers[q.id]?.weight ?? null,
          justification_text: justifications[q.id] || '',
        };
      }
      if (q.type === 'scale') {
        return {
          question_id: q.id,
          question: q.question,
          weight: Number(answers[q.id] ?? 4),
          answer_text: `Оценка готовности: ${answers[q.id] ?? 4}/4`,
        };
      }
      return {
        question_id: q.id,
        question: q.question,
        answer_text: justifications[q.id] || '',
      };
    });

    setSubmitting(true);
    try {
      await api.post(`/public/reflection/${token}`, { q_and_a });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось отправить вечернюю рефлексию.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <CenterMessage text={error} isError />;
  if (!data) return <CenterMessage text="Загрузка страницы вечерней рефлексии…" />;
  if (submitted || data.already_used) return <CenterMessage text="Спасибо! Ваша вечерняя рефлексия получена." success />;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3 text-white shadow-md">
            <Moon size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Вечерняя рефлексия семьи</h1>
          <p className="text-slate-500 text-sm mt-1">Осмысление очной встречи для семьи {data.family.child_name}</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 border border-red-200">{error}</div>}

        <div className="space-y-5">
          {(data.questions || []).map((q, idx) => (
            <div key={q.id} className="card p-5 bg-white border border-slate-200 space-y-3">
              <div className="font-semibold text-slate-800 text-base">{idx + 1}. {q.question}</div>

              {q.options && (
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer text-sm ${
                        answers[q.id]?.selected_option_id === o.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-medium'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-0.5 text-indigo-600"
                        name={q.id}
                        checked={answers[q.id]?.selected_option_id === o.id}
                        onChange={() => selectOption(q.id, o.id, o.weight)}
                      />
                      <span>{o.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'scale' && (
                <div className="space-y-2 pt-2">
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={answers[q.id] ?? 4}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: Number(e.target.value) }))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>0 — Совсем не готовы</span>
                    <span>4 — Полностью готовы как партнеры</span>
                  </div>
                </div>
              )}

              {(q.requires_justification || q.type === 'open') && (
                <textarea
                  className="input min-h-[90px] mt-2"
                  placeholder="Ваш развернутый ответ или пояснение…"
                  value={justifications[q.id] || ''}
                  onChange={(e) => setJustifications((j) => ({ ...j, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full py-3.5 text-base font-semibold shadow-md">
          {submitting ? 'Отправляем рефлексию…' : 'Отправить вечернюю рефлексию'}
        </button>
      </div>
    </div>
  );
}

function CenterMessage({ text, isError, success }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="text-center max-w-sm bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        {success && <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={48} />}
        <p className={isError ? 'text-red-600 font-medium' : 'text-slate-700 font-medium'}>{text}</p>
      </div>
    </div>
  );
}
