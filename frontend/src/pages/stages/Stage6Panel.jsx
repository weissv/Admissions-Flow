import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import clsx from 'clsx';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';

const CHECKS = [
  { key: 'punctuality_issue', label: 'Ребёнок опаздывал?' },
  { key: 'off_channel_communication', label: 'Родители писали в неустановленное время/каналы?' },
  { key: 'aggressive_complaints', label: 'Были жалобы на нагрузку в агрессивном ключе?' },
];

export default function Stage6Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['6'] === 'Completed';
  const [logs, setLogs] = useState([]);
  const [ewsAlert, setEwsAlert] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState({ punctuality_issue: false, off_channel_communication: false, aggressive_complaints: false });
  const [notes, setNotes] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  async function load() {
    const { data } = await api.get(`/stage6/${familyId}`);
    setLogs(data.logs);
    setEwsAlert(data.ews_alert);
  }
  useEffect(() => { load(); }, [familyId]);

  const nextWeek = (logs[logs.length - 1]?.week_number || 0) + 1;

  async function addLog() {
    setError('');
    if (!createdBy.trim()) {
      setError('Укажите имя куратора.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/stage6/${familyId}/log`, {
        week_number: nextWeek,
        checklist_answers: checklist,
        notes,
        created_by: createdBy,
      });
      setChecklist({ punctuality_issue: false, off_channel_communication: false, aggressive_complaints: false });
      setNotes('');
      await load();
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    setSaving(true);
    setError('');
    try {
      await api.post(`/stage6/${familyId}/complete`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Этап 6. Мониторинг испытательного срока</h1>
        <p className="text-slate-500 text-sm">Еженедельный чек-лист куратора (30 секунд на заполнение).</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Испытательный срок завершён.</Alert>}
      {ewsAlert && (
        <Alert type="error">
          <span className="font-semibold flex items-center gap-2"><AlertOctagon size={16} /> ТРЕВОГА: Назначить кризисную встречу.</span> Две недели подряд зафиксированы негативные отметки.
        </Alert>
      )}

      <div className="grid grid-cols-4 gap-3">
        {logs.map((log) => (
          <div key={log.week_number} className={clsx('card p-4', log.is_negative_week && 'border-red-300 bg-red-50')}>
            <div className="text-xs uppercase text-slate-400 mb-1">Неделя {log.week_number}</div>
            {log.is_negative_week ? (
              <div className="text-red-600 text-sm font-medium flex items-center gap-1"><AlertOctagon size={14} /> Есть риски</div>
            ) : (
              <div className="text-emerald-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={14} /> Норма</div>
            )}
          </div>
        ))}
      </div>

      {!isCompleted && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Чек-лист за неделю {nextWeek}</h2>
          {CHECKS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm py-1.5">
              <input
                type="checkbox"
                checked={checklist[c.key]}
                onChange={(e) => setChecklist((s) => ({ ...s, [c.key]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
          <textarea className="input min-h-[70px]" placeholder="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <input className="input" placeholder="ФИО куратора" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
          <button onClick={addLog} disabled={saving} className="btn-secondary w-full">Сохранить неделю {nextWeek}</button>
        </div>
      )}

      {!isCompleted && logs.length > 0 && (
        <button onClick={complete} disabled={saving} className="btn-primary w-full">Завершить испытательный срок</button>
      )}
    </div>
  );
}
