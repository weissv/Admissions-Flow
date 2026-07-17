import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Stage3Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['3'] === 'Completed';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);

  async function load() {
    const { data } = await api.get(`/stage3/${familyId}`);
    setData(data);
  }
  useEffect(() => { load(); }, [familyId]);

  async function calculate() {
    setError('');
    setCalculating(true);
    try {
      await api.post(`/stage3/${familyId}/calculate`);
      await reload();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCalculating(false);
    }
  }

  if (!data) return <div className="text-slate-400">Загрузка…</div>;

  const shift = data.analysis.shift;
  const ShiftIcon = shift === null ? Minus : shift > 0.3 ? TrendingUp : shift < -0.3 ? TrendingDown : Minus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Этап 3. Вечерняя рефлексия</h1>
        <p className="text-slate-500 text-sm">Анализ сдвига тональности между Анкетой 1 и вечерней рефлексией.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Рефлексия обработана. Предварительный ИОП рассчитан.</Alert>}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Анализ тональности</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-800">{data.analysis.stage1_score?.toFixed(2)}</div>
            <div className="text-xs text-slate-500">Оценка на Этапе 1</div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <ShiftIcon size={28} className={shift > 0.3 ? 'text-emerald-500' : shift < -0.3 ? 'text-red-500' : 'text-slate-400'} />
            <div className="text-xs text-slate-500 mt-1">{shift !== null ? shift.toFixed(2) : '—'}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{data.analysis.stage3_tone_score?.toFixed(2) ?? '—'}</div>
            <div className="text-xs text-slate-500">Тон рефлексии</div>
          </div>
        </div>
        <div className="text-center text-sm font-medium text-slate-700 mt-4">{data.analysis.interpretation}</div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Ответы семьи</h2>
        {data.responses.length === 0 && <div className="text-sm text-slate-400">Ответ пока не получен.</div>}
        {data.responses.map((r) => (
          <div key={r.id} className="space-y-3">
            {(r.q_and_a || []).map((qa) => {
              const q = data.questions.find((x) => x.id === qa.question_id);
              return (
                <div key={qa.question_id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="text-sm font-medium text-slate-700 mb-1">{q?.question}</div>
                  <div className="text-sm text-slate-600">{qa.answer_text ?? qa.weight}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!isCompleted && (
        <button onClick={calculate} disabled={calculating} className="btn-primary w-full">
          {calculating ? 'Рассчитываем…' : 'Рассчитать предварительный ИОП и перейти к контракту'}
        </button>
      )}
    </div>
  );
}
