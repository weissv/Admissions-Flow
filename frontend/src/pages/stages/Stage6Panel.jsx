import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import clsx from 'clsx';
import { AlertOctagon, CheckCircle2, Calendar, UserCheck } from 'lucide-react';

const CHECKS = [
  { key: 'punctuality_issue', label: '1. Нарушения пунктуальности / опоздания' },
  { key: 'off_channel_communication', label: '2. Обращения в неустановленное время / в нерабочие каналы' },
  { key: 'aggressive_complaints', label: '3. Агрессивная/конфликтная коммуникация со стороны родителей' },
  { key: 'sr_intervention', label: '4. Подмена задач самостоятельности (гиперопека)' },
  { key: 'agreement_violation', label: '5. Отступление от подписанного Протокола Договоренностей' },
];

export default function Stage6Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['6'] === 'Completed';
  const [logs, setLogs] = useState([]);
  const [checkpoint, setCheckpoint] = useState(null);
  const [ewsAlert, setEwsAlert] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState({
    punctuality_issue: false,
    off_channel_communication: false,
    aggressive_complaints: false,
    sr_intervention: false,
    agreement_violation: false,
  });
  const [notes, setNotes] = useState('');
  const [createdBy, setCreatedBy] = useState('Куратор');

  const [checkpointNotes, setCheckpointNotes] = useState('');
  const [finalRoute, setFinalRoute] = useState('Standard');

  async function load() {
    const { data } = await api.get(`/stage6/${familyId}`);
    setLogs(data.logs || []);
    setEwsAlert(data.ews_alert || false);
    if (data.checkpoint) {
      setCheckpoint(data.checkpoint);
      setCheckpointNotes(data.checkpoint.summary_notes || '');
      setFinalRoute(data.checkpoint.final_route_assignment || 'Standard');
    }
  }
  useEffect(() => { load(); }, [familyId]);

  const nextWeek = (logs[logs.length - 1]?.week_number || 0) + 1;

  async function addLog() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage6/${familyId}/log`, {
        week_number: nextWeek,
        checklist_answers: checklist,
        notes,
        created_by: createdBy,
      });
      setChecklist({
        punctuality_issue: false,
        off_channel_communication: false,
        aggressive_complaints: false,
        sr_intervention: false,
        agreement_violation: false,
      });
      setNotes('');
      await load();
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveCheckpoint() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage6/${familyId}/checkpoint`, {
        checkpoint_week: Math.max(3, logs.length),
        summary_notes: checkpointNotes,
        final_route_assignment: finalRoute,
        curator_name: createdBy,
      });
      await load();
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
      await saveCheckpoint();
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
        <h1 className="text-2xl font-bold text-slate-900">Этап 6. Мониторинг испытательного срока (Probation Period Tracker)</h1>
        <p className="text-slate-500 text-sm">
          Рабочее пространство классного руководителя и куратора на 1–3 месяца. Еженедельная матрица наблюдений + контрольная точка 3–4 недели.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Испытательный срок успешно завершен. Окончательный маршрут сопровождения утвержден.</Alert>}
      {ewsAlert && (
        <Alert type="error">
          <span className="font-bold flex items-center gap-2 text-rose-800">
            <AlertOctagon size={18} /> ТРЕВОГА (Early Warning System): Зафиксированы негативные отметки 2 недели подряд!
          </span>
          Требуется созыв внеочередного педагогического консилиума и встреча с родителями.
        </Alert>
      )}

      {/* Weekly Matrix Grid */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
        <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          Матрица еженедельных срезов ({logs.length} недель зафиксировано)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {logs.map((log) => (
            <div
              key={log.week_number}
              className={clsx(
                'p-4 rounded-xl border text-sm space-y-1',
                log.is_negative_week ? 'border-rose-300 bg-rose-50/80 text-rose-950' : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
              )}
            >
              <div className="text-xs uppercase font-bold text-slate-500">Неделя #{log.week_number}</div>
              {log.is_negative_week ? (
                <div className="text-rose-700 font-bold text-sm flex items-center gap-1">
                  <AlertOctagon size={16} /> Нарушения
                </div>
              ) : (
                <div className="text-emerald-700 font-bold text-sm flex items-center gap-1">
                  <CheckCircle2 size={16} /> Без нарушений
                </div>
              )}
              {log.notes && <div className="text-xs text-slate-600 italic mt-1 line-clamp-2">«{log.notes}»</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Add New Week Log */}
      {!isCompleted && (
        <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b pb-2">Еженедельный срез за Неделю #{nextWeek}</h2>

          <div className="space-y-2">
            {CHECKS.map((c) => (
              <label key={c.key} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  checked={checklist[c.key]}
                  onChange={(e) => setChecklist((s) => ({ ...s, [c.key]: e.target.checked }))}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>

          <textarea
            className="input min-h-[80px]"
            placeholder="Заметки куратора / классного руководителя за неделю…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input text-sm"
              placeholder="ФИО куратора"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
            />
            <button onClick={addLog} disabled={saving} className="btn-secondary py-2.5">
              Сохранить срез за неделю #{nextWeek}
            </button>
          </div>
        </div>
      )}

      {/* 3-4 Week Checkpoint Review */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
          <UserCheck size={18} className="text-indigo-600" />
          Контрольная точка 3–4 недели и финализация маршрута
        </h2>

        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase">Окончательный маршрут сопровождения</label>
          <select
            className="input mt-1 font-semibold text-indigo-900"
            disabled={isCompleted}
            value={finalRoute}
            onChange={(e) => setFinalRoute(e.target.value)}
          >
            <option value="Standard">Standard (Стандартное зачисление без ограничений)</option>
            <option value="Preventive">Preventive (Условное зачисление с ежемесячным срезом)</option>
            <option value="Intense">Intense (Усиленная педагогическая поддержка)</option>
            <option value="Crisis">Crisis (Кризисный статус / Рекомендация смены модели)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase">Итоговое заключение консилиума</label>
          <textarea
            className="input min-h-[90px] mt-1"
            disabled={isCompleted}
            placeholder="Итоги испытательного срока, рекомендации классному руководителю и психологу…"
            value={checkpointNotes}
            onChange={(e) => setCheckpointNotes(e.target.value)}
          />
        </div>
      </div>

      {!isCompleted && (
        <button onClick={complete} disabled={saving} className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm">
          Завершить испытательный срок и зафиксировать Семейный Паспорт 2.0
        </button>
      )}
    </div>
  );
}
