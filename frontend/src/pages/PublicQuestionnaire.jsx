import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { GraduationCap, CheckCircle2 } from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

export default function PublicQuestionnaire() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/public/questionnaire/${token}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.error || 'Ссылка недействительна.'));
  }, [token]);

  function selectOption(qId, optId, weight) {
    setAnswers((a) => ({ ...a, [qId]: { selected_option_id: optId, weight } }));
  }

  async function submit() {
    setError('');
    const q_and_a = data.questions.map((q) => ({
      question_id: q.id,
      question: q.question,
      selected_option_id: answers[q.id]?.selected_option_id ?? null,
      weight: answers[q.id]?.weight ?? null,
      comment: comments[q.id] || '',
    }));
    if (q_and_a.some((a) => a.selected_option_id === null)) {
      setError('Пожалуйста, ответьте на все вопросы.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/public/questionnaire/${token}`, { q_and_a });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось отправить анкету.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <CenterMessage text={error} isError />;
  if (!data) return <CenterMessage text="Загрузка…" />;
  if (submitted || data.already_used) return <CenterMessage text="Спасибо! Ваши ответы получены." success />;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Header />
        <p className="text-center text-slate-500 text-sm mb-6">
          Анкета для семьи {data.family.child_name} · {data.respondent_type === 'mother' ? 'мать' : data.respondent_type === 'father' ? 'отец' : 'родители'}
        </p>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-5">
          {data.questions.map((q, idx) => (
            <div key={q.id} className="card p-5">
              <div className="text-xs text-slate-400 mb-1">Вопрос {idx + 1} из {data.questions.length}</div>
              <div className="font-medium text-slate-800 mb-3">{q.question}</div>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <label key={o.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer text-sm ${answers[q.id]?.selected_option_id === o.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      className="mt-0.5"
                      name={q.id}
                      checked={answers[q.id]?.selected_option_id === o.id}
                      onChange={() => selectOption(q.id, o.id, o.weight)}
                    />
                    {o.text}
                  </label>
                ))}
              </div>
              {q.requires_comment && (
                <textarea
                  className="input mt-3 min-h-[70px]"
                  placeholder="Почему вы выбрали этот вариант? (необязательно)"
                  value={comments[q.id] || ''}
                  onChange={(e) => setComments((c) => ({ ...c, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full mt-6">
          {submitting ? 'Отправляем…' : 'Отправить анкету'}
        </button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="h-12 w-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
        <GraduationCap className="text-white" size={22} />
      </div>
      <h1 className="text-lg font-bold text-slate-900">Анкета знакомства</h1>
    </div>
  );
}

function CenterMessage({ text, isError, success }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {success && <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={40} />}
        <p className={isError ? 'text-red-600' : 'text-slate-600'}>{text}</p>
      </div>
    </div>
  );
}
