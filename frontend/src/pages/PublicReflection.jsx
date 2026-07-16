import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { GraduationCap, CheckCircle2 } from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

export default function PublicReflection() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/public/reflection/${token}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.error || 'Ссылка недействительна.'));
  }, [token]);

  async function submit() {
    setError('');
    const q_and_a = data.questions.map((q) => ({
      question_id: q.id,
      question: q.question,
      answer_text: q.type === 'scale' ? String(answers[q.id] ?? 2) : (answers[q.id] || ''),
      weight: q.type === 'scale' ? Number(answers[q.id] ?? 2) : null,
    }));
    if (q_and_a.some((a) => q_and_a && a.answer_text === '' && data.questions.find((q) => q.id === a.question_id)?.type === 'open')) {
      setError('Пожалуйста, ответьте на все вопросы.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/public/reflection/${token}`, { q_and_a });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось отправить рефлексию.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <CenterMessage text={error} isError />;
  if (!data) return <CenterMessage text="Загрузка…" />;
  if (submitted || data.already_used) return <CenterMessage text="Спасибо! Ваша рефлексия получена." success />;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
            <GraduationCap className="text-white" size={22} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Вечерняя рефлексия</h1>
          <p className="text-slate-500 text-sm mt-1 text-center">Несколько коротких вопросов для семьи {data.family.child_name}</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <div className="space-y-4">
          {data.questions.map((q) => (
            <div key={q.id} className="card p-5">
              <div className="font-medium text-slate-800 mb-3">{q.question}</div>
              {q.type === 'scale' ? (
                <div>
                  <input
                    type="range" min={0} max={4}
                    value={answers[q.id] ?? 2}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: Number(e.target.value) }))}
                    className="w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Совсем не готовы</span>
                    <span>Полностью готовы</span>
                  </div>
                </div>
              ) : (
                <textarea
                  className="input min-h-[100px]"
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Ваш ответ…"
                />
              )}
            </div>
          ))}
        </div>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full mt-6">
          {submitting ? 'Отправляем…' : 'Отправить рефлексию'}
        </button>
      </div>
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
