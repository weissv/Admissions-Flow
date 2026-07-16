import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { CheckCircle2, XCircle, AlertTriangle, Copy } from 'lucide-react';

export default function Stage1Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['1'] === 'Completed';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);

  const links = detail.access_links.filter((l) => l.stage_number === 1);

  async function load() {
    const { data } = await api.get(`/stage1/${familyId}`);
    setData(data);
  }
  useEffect(() => { load(); }, [familyId]);

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
        <h1 className="text-xl font-bold text-slate-900">Этап 1. Онлайн-знакомство</h1>
        <p className="text-slate-500 text-sm">SJT-анкета и демографический опрос для матери и отца.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Анкета 1 утверждена. Семья приглашена на очную встречу.</Alert>}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Статус получения ответов</h2>
        <div className="grid grid-cols-2 gap-4">
          {['mother', 'father'].map((r) => (
            <div key={r} className="flex items-center gap-2">
              {data.received[r] ? <CheckCircle2 className="text-emerald-500" size={18} /> : <XCircle className="text-slate-300" size={18} />}
              <span className="text-sm">{r === 'mother' ? 'Мать' : 'Отец'}: {data.received[r] ? 'ответ получен' : 'ожидаем ответ'}</span>
            </div>
          ))}
        </div>
        {links.length > 0 && (
          <div className="mt-4 space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2">
                <div className="text-xs text-slate-500">{l.respondent_type === 'mother' ? 'Мать' : 'Отец'} · {l.is_used ? 'использована' : 'ожидает'}</div>
                <button className="btn-outline !py-1 !px-2" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/public/questionnaire/${l.token}`)}>
                  <Copy size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <h2 className="font-semibold text-slate-800 mb-3">Ответы по вопросам</h2>
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
          {approving ? 'Утверждаем…' : 'Утвердить Анкету 1 и пригласить на встречу'}
        </button>
      )}
    </div>
  );
}
