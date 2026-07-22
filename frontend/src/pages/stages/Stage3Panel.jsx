import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Moon, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Stage3Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['3'] === 'Completed';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);

  async function load() {
    const { data } = await api.get(`/stage3/${familyId}`);
    setData(data);
  }
  useEffect(() => { load(); }, [familyId]);

  async function approve() {
    setError('');
    setApproving(true);
    try {
      await api.post(`/stage3/${familyId}/approve`);
      await reload();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  if (!data) return <div className="text-slate-400">Загрузка данных рефлексии…</div>;

  const responses = data.responses?.q_and_a || [];
  const delta = data.reflection_delta || {};
  const shifts = delta.shifts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Этап 3. Вечерняя рефлексия и Reflection Delta</h1>
        <p className="text-slate-500 text-sm">
          Заполняется родителями дома в тихой обстановке после очной встречи. Фиксирует осмысление правил и зафиксированные сдвиги позиций.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Вечерняя рефлексия принята и обработана. Открыт Контрактный контур (Этап 4).</Alert>}

      {/* Reflection Delta warning box */}
      {shifts.length > 0 ? (
        <div className="card p-5 border-amber-200 bg-amber-50/60 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={20} />
            <h2 className="font-bold text-amber-900 text-base">Reflection Delta: Зафиксированы изменения позиций после очной встречи</h2>
          </div>

          <div className="space-y-3">
            {shifts.map((s, idx) => (
              <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200 text-sm space-y-1">
                <div className="font-bold text-slate-800">{s.topic}</div>
                <div className="text-xs text-slate-500">На встрече (Этап 2): {s.stage2_promise}</div>
                <div className="text-xs font-semibold text-rose-700">В вечерней рефлексии (Этап 3): {s.stage3_reflection}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 font-medium text-sm">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <span>Позиции вечерней рефлексии полностью совпадают со словесными договоренностями на очной встрече.</span>
        </div>
      )}

      {/* Received Answers */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
          <Moon size={18} className="text-indigo-600" />
          Ответы родителей в вечерней рефлексии
        </h2>

        {responses.length === 0 ? (
          <div className="text-slate-400 text-sm italic">Ответы от семьи пока не поступали. Вы можете отправить родителям ссылку или заполнить данные вручную.</div>
        ) : (
          <div className="space-y-4">
            {responses.map((qa, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold uppercase text-slate-500">Вопрос #{idx + 1}</div>
                <div className="text-sm font-semibold text-slate-800">{qa.question}</div>
                <div className="text-sm text-indigo-950 font-medium mt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                  {qa.answer_text || qa.justification_text || `Выбран вариант №${qa.selected_option_id}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isCompleted && (
        <button onClick={approve} disabled={approving} className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm">
          {approving ? 'Обрабатываем рефлексию…' : 'Утвердить Этап 3 и перейти к переходу флагов в договор (Этап 4)'}
        </button>
      )}
    </div>
  );
}
