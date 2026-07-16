import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Switch from '../../components/ui/Switch.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { FileDown, FileCheck } from 'lucide-react';

export default function Stage4Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['4'] === 'Completed';
  const [clauses, setClauses] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  async function load() {
    const { data } = await api.get(`/stage4/${familyId}/clauses`);
    setClauses(data);
  }
  useEffect(() => { load(); }, [familyId]);

  function toggle(id) {
    setClauses((cs) => cs.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  }

  async function saveSelection() {
    const selected_clause_ids = clauses.filter((c) => c.selected).map((c) => c.id);
    await api.post(`/stage4/${familyId}/clauses`, { selected_clause_ids });
  }

  async function generate() {
    setError('');
    setSaving(true);
    try {
      await saveSelection();
      const { data } = await api.post(`/stage4/${familyId}/generate`);
      setDownloadUrl(data.download_url);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    const res = await api.get(`/stage4/${familyId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Договор.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function sign() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage4/${familyId}/sign`);
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
        <h1 className="text-xl font-bold text-slate-900">Этап 4. Контрактный контур</h1>
        <p className="text-slate-500 text-sm">Автоматически подобранные приложения к договору на основе выявленных рисков.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Договор подписан. Запущено задание-тест.</Alert>}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-1">Активные риски семьи</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          {detail.family.risk_flags.length === 0 && <span className="text-sm text-slate-400">Риски не выявлены.</span>}
          {detail.family.risk_flags.map((f) => <Badge key={f} color="orange">{f}</Badge>)}
        </div>
      </div>

      <div className="card p-5 space-y-1 divide-y divide-slate-100">
        <h2 className="font-semibold text-slate-800 pb-2">Пункты договора</h2>
        {clauses.map((c) => (
          <div key={c.id} className="py-2">
            <Switch
              checked={c.selected}
              onChange={() => !isCompleted && toggle(c.id)}
              label={c.clause_title}
              description={c.auto_suggested ? 'Автоматически предложено на основе флага риска' : c.clause_text.slice(0, 90) + '…'}
            />
          </div>
        ))}
      </div>

      {!isCompleted && (
        <div className="flex gap-3">
          <button onClick={generate} disabled={saving} className="btn-secondary flex-1">
            <FileDown size={16} /> Сгенерировать Договор
          </button>
          {downloadUrl && (
            <button onClick={download} className="btn-outline flex-1 justify-center">
              Скачать PDF
            </button>
          )}
        </div>
      )}

      {!isCompleted && downloadUrl && (
        <button onClick={sign} disabled={saving} className="btn-primary w-full">
          <FileCheck size={16} /> Договор подписан. Запустить задание-тест
        </button>
      )}
    </div>
  );
}
