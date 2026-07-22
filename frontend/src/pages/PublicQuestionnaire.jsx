import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });

export default function PublicQuestionnaire() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [targetGrade, setTargetGrade] = useState('1-2');
  const [answers, setAnswers] = useState({});
  const [justifications, setJustifications] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/public/questionnaire/${token}`)
      .then((res) => {
        setData(res.data);
        if (res.data.family?.target_grade) {
          setTargetGrade(res.data.family.target_grade);
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Ссылка недействительна.'));
  }, [token]);

  function selectOption(qId, optId, weight) {
    setAnswers((a) => ({ ...a, [qId]: { selected_option_id: optId, weight } }));
  }

  async function submit() {
    setError('');
    const q_and_a = (data.questions || []).map((q) => {
      if (q.type === 'sjt' || q.type === 'choice') {
        return {
          question_id: q.id,
          question: q.question,
          selected_option_id: answers[q.id]?.selected_option_id ?? null,
          weight: answers[q.id]?.weight ?? null,
          justification_text: justifications[q.id] || '',
        };
      }
      return {
        question_id: q.id,
        question: q.question,
        answer_text: justifications[q.id] || '',
      };
    });

    // Enforce mandatory answers for all SJTs and mandatory justification
    for (const q of data.questions) {
      if (q.type === 'sjt') {
        if (!answers[q.id]?.selected_option_id) {
          setError(`Пожалуйста, выберите вариант ответа для вопроса: "${q.question.slice(0, 50)}…"`);
          return;
        }
        if (q.requires_justification && (!justifications[q.id] || !justifications[q.id].trim())) {
          setError(`Пожалуйста, напишите краткое обоснование для вашего выбора в вопросе: "${q.question.slice(0, 50)}…"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await api.post(`/public/questionnaire/${token}`, { q_and_a, target_grade: targetGrade });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось отправить анкету.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <CenterMessage text={error} isError />;
  if (!data) return <CenterMessage text="Загрузка анкеты…" />;
  if (submitted || data.already_used) return <CenterMessage text="Спасибо! Ваши ответы приняты." success />;

  const respondentLabel =
    data.respondent_type === 'mother'
      ? 'Анкета Матери'
      : data.respondent_type === 'father'
      ? 'Анкета Отца'
      : 'Анкета Родителей';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Header title="Онлайн-анкета знакомства (Школа Мезон v3.4)" />

        <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{data.family.child_name}</h2>
          <p className="text-slate-500 text-sm mt-1">{respondentLabel} · Класс: {data.family.child_class}</p>

          <div className="mt-4 text-left max-w-xs mx-auto">
            <label className="text-xs font-semibold text-slate-600 uppercase">Целевая возрастная группа</label>
            <select
              className="input mt-1 text-sm font-medium"
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
            >
              {(data.age_groups || []).map((ag) => (
                <option key={ag.id} value={ag.id}>{ag.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 flex items-start gap-3 border border-red-200">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span>{error}</span>
          </div>
        )}

        {(data.blocks || []).map((block) => {
          const blockQuestions = (data.questions || []).filter((q) => q.block_id === block.id);
          if (blockQuestions.length === 0) return null;

          return (
            <div key={block.id} className="card p-6 space-y-5 bg-white shadow-sm border border-slate-200">
              <h3 className="text-md font-bold text-indigo-900 border-b pb-2">{block.title}</h3>

              {blockQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-3 pt-2">
                  <div className="font-semibold text-slate-800 text-base">{idx + 1}. {q.question}</div>

                  {q.options && (
                    <div className="space-y-2">
                      {q.options.map((o) => (
                        <label
                          key={o.id}
                          className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer text-sm transition-colors ${
                            answers[q.id]?.selected_option_id === o.id
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            name={q.id}
                            checked={answers[q.id]?.selected_option_id === o.id}
                            onChange={() => selectOption(q.id, o.id, o.weight)}
                          />
                          <span>{o.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(q.requires_justification || q.type === 'open') && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">
                        {q.justification_prompt || 'Обоснуйте ваш выбор (обязательное поле):'}
                      </label>
                      <textarea
                        className="input min-h-[80px]"
                        placeholder="Напишите краткий текстовый комментарий с вашей логикой…"
                        value={justifications[q.id] || ''}
                        onChange={(e) => setJustifications((j) => ({ ...j, [q.id]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        <button onClick={submit} disabled={submitting} className="btn-primary w-full py-3.5 text-base font-semibold shadow-md">
          {submitting ? 'Отправляем анкету…' : 'Отправить анкету'}
        </button>
      </div>
    </div>
  );
}

function Header({ title }) {
  return (
    <div className="flex flex-col items-center mb-4 text-center">
      <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3 text-white shadow-md">
        <GraduationCap size={24} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
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
