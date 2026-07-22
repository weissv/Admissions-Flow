import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Switch from '../../components/ui/Switch.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { FileDown, FileCheck, ShieldAlert, FileText } from 'lucide-react';

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
    a.download = `Protocol_Agreements_Family_${familyId}.pdf`;
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
        <h1 className="text-2xl font-bold text-slate-900">Этап 4. Контрактный контур и Протокол Договоренностей</h1>
        <p className="text-slate-500 text-sm">
          Перевод выявленных флагов RISK и CHECK в явные письменные приложения и обязательства сторон перед зачислением.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Протокол договоренностей и договор подписи. Открыта педагогическая проба (Этап 5).</Alert>}

      {/* Active Flags Registry */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
        <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <ShieldAlert className="text-indigo-600" size={18} />
          Выявленные флаги семьи для трансляции в договор
        </h2>
        <div className="flex flex-wrap gap-2">
          {(!detail.family.risk_flags || detail.family.risk_flags.length === 0) && (
            <span className="text-sm text-slate-400">Флаги риска не зафиксированы.</span>
          )}
          {(detail.family.risk_flags || []).map((f) => (
            <Badge key={f} color="purple">{f}</Badge>
          ))}
        </div>
      </div>

      {/* Contract clauses selection */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
          <FileText className="text-indigo-600" size={18} />
          Приложения и индивидуальные пункты Договора Мезон v3.4
        </h2>

        <div className="space-y-3 divide-y divide-slate-100">
          {clauses.map((c) => (
            <div key={c.id} className="pt-3 first:pt-0">
              <Switch
                checked={c.selected}
                onChange={() => !isCompleted && toggle(c.id)}
                label={c.clause_title}
                description={
                  c.auto_suggested
                    ? `[Автоматически предложено по флагу ${c.risk_flag}] ${c.clause_text}`
                    : c.clause_text
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Generate & Download PDF */}
      {!isCompleted && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={generate} disabled={saving} className="btn-secondary flex-1 py-3 justify-center">
            <FileDown size={18} />
            {saving ? 'Формируем PDF…' : 'Сформировать Протокол и Договор'}
          </button>
          {downloadUrl && (
            <button onClick={download} className="btn-outline flex-1 justify-center py-3">
              Скачать готовый PDF
            </button>
          )}
        </div>
      )}

      {/* Sign action */}
      {!isCompleted && (
        <button onClick={sign} disabled={saving} className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm">
          <FileCheck size={18} />
          {saving ? 'Подписываем…' : 'Подписать Протокол и Договор (Запустить Задание-тест)'}
        </button>
      )}
    </div>
  );
}
