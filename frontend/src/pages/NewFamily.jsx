import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client.js';
import Alert from '../components/ui/Alert.jsx';
import { STAGE0_TAGS } from '../constants/stages.js';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const TAG_COLORS = {
  'Высокая тревожность': 'border-amber-300 bg-amber-50 text-amber-700',
  'Потребительская позиция': 'border-red-300 bg-red-50 text-red-700',
  'Жалобы на прошлую школу': 'border-orange-300 bg-orange-50 text-orange-700',
  'Ориентация на развитие': 'border-emerald-300 bg-emerald-50 text-emerald-700',
};

export default function NewFamily() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    child_name: '',
    child_class: '',
    father_name: '', father_phone: '', father_email: '',
    mother_name: '', mother_phone: '', mother_email: '',
    call_tags: [],
    call_log: '',
    q1: '', q2: '', q3: '',
  });

  function toggleTag(tag) {
    setForm((f) => ({
      ...f,
      call_tags: f.call_tags.includes(tag) ? f.call_tags.filter((t) => t !== tag) : [...f.call_tags, tag],
    }));
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        child_name: form.child_name,
        child_class: Number(form.child_class),
        parents_info: {
          father: { name: form.father_name, phone: form.father_phone, email: form.father_email },
          mother: { name: form.mother_name, phone: form.mother_phone, email: form.mother_email },
        },
        call_tags: form.call_tags,
        call_log: form.call_log,
        first_questions: [form.q1, form.q2, form.q3],
      };
      const { data } = await api.post('/families', payload);
      navigate(`/families/${data.id}/stage/0`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Не удалось создать заявку.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> К списку семей
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Этап 0. Первичный контакт</h1>
        <p className="text-slate-500 text-sm mb-6">Зафиксируйте данные первого звонка или обращения.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert type="error">{error}</Alert>}

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Данные о ребёнке</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Имя ребёнка</label>
                <input className="input" required value={form.child_name} onChange={(e) => set('child_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Целевой класс</label>
                <input className="input" type="number" min="0" max="11" required value={form.child_class} onChange={(e) => set('child_class', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Контакты родителей</h2>
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Имя матери" value={form.mother_name} onChange={(e) => set('mother_name', e.target.value)} />
              <input className="input" placeholder="Телефон" value={form.mother_phone} onChange={(e) => set('mother_phone', e.target.value)} />
              <input className="input" placeholder="Email" value={form.mother_email} onChange={(e) => set('mother_email', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Имя отца" value={form.father_name} onChange={(e) => set('father_name', e.target.value)} />
              <input className="input" placeholder="Телефон" value={form.father_phone} onChange={(e) => set('father_phone', e.target.value)} />
              <input className="input" placeholder="Email" value={form.father_email} onChange={(e) => set('father_email', e.target.value)} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Быстрые теги звонка</h2>
            <div className="flex flex-wrap gap-2">
              {STAGE0_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={clsx('pill', form.call_tags.includes(tag) ? TAG_COLORS[tag] : 'border-slate-200 bg-white text-slate-600')}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div>
              <label className="label">Лог разговора</label>
              <textarea className="input min-h-[120px]" placeholder="Кратко запишите содержание разговора…" value={form.call_log} onChange={(e) => set('call_log', e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Диктофон и транскрибация доступны на следующем экране.</p>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Первые три вопроса родителей</h2>
            <input className="input" placeholder="Вопрос 1" required value={form.q1} onChange={(e) => set('q1', e.target.value)} />
            <input className="input" placeholder="Вопрос 2" required value={form.q2} onChange={(e) => set('q2', e.target.value)} />
            <input className="input" placeholder="Вопрос 3" required value={form.q3} onChange={(e) => set('q3', e.target.value)} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Сохраняем…' : 'Сохранить и продолжить'}
          </button>
        </form>
      </main>
    </div>
  );
}
