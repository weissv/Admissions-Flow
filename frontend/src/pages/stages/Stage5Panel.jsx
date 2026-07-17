import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { UploadCloud } from 'lucide-react';

export default function Stage5Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['5'] === 'Completed';
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState(null);
  const [selfReport, setSelfReport] = useState('');

  const [independence, setIndependence] = useState(0);
  const [honesty, setHonesty] = useState(0);
  const [quality, setQuality] = useState(0);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  async function load() {
    const { data } = await api.get(`/stage5/${familyId}`);
    setTask(data);
    if (data) {
      setSelfReport(data.parent_self_report || '');
      setIndependence(data.independence_score || 0);
      setHonesty(data.honesty_score || 0);
      setQuality(data.quality_score || 0);
      setReviewerName(data.reviewer_name || '');
      setReviewerNotes(data.reviewer_notes || '');
    }
  }
  useEffect(() => { load(); }, [familyId]);

  async function upload() {
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('parent_self_report', selfReport);
      await api.post(`/stage5/${familyId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function review() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage5/${familyId}/review`, {
        independence_score: independence,
        honesty_score: honesty,
        quality_score: quality,
        reviewer_name: reviewerName,
        reviewer_notes: reviewerNotes,
      });
      await reload();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Этап 5. Задание-тест</h1>
        <p className="text-slate-500 text-sm">Загрузка домашнего задания и проверка куратором.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Задание проверено. Семья зачислена на испытательный период.</Alert>}

      {!isCompleted && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Загрузка работы</h2>
          <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 cursor-pointer hover:bg-slate-50">
            <UploadCloud size={20} className="text-slate-400" />
            <span className="text-sm text-slate-500">{file ? file.name : task?.file_path || 'Выберите файл'}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <div>
            <label className="label">Самоотчёт родителя</label>
            <textarea className="input min-h-[100px]" value={selfReport} onChange={(e) => setSelfReport(e.target.value)} placeholder="Признался ли родитель в желании вмешаться? Как выполнялось задание?" />
          </div>
          <button onClick={upload} disabled={saving} className="btn-secondary w-full">Сохранить</button>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Проверка куратором</h2>
        <div>
          <div className="label">Самостоятельность <span className="text-slate-400 font-normal">(было ли очевидно, что сделали родители?)</span></div>
          <StarRating value={independence} onChange={isCompleted ? () => {} : setIndependence} tooltip="0 — явно сделали родители, 4 — полностью самостоятельно" />
        </div>
        <div>
          <div className="label">Честность отчёта <span className="text-slate-400 font-normal">(признал ли родитель желание помочь?)</span></div>
          <StarRating value={honesty} onChange={isCompleted ? () => {} : setHonesty} tooltip="0 — скрыл вмешательство, 4 — полностью честный отчёт" />
        </div>
        <div>
          <div className="label">Качество выполнения</div>
          <StarRating value={quality} onChange={isCompleted ? () => {} : setQuality} tooltip="0 — не выполнено, 4 — выполнено отлично" />
        </div>
        {!isCompleted && (
          <>
            <input className="input" placeholder="ФИО проверяющего" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
            <textarea className="input min-h-[80px]" placeholder="Заметки проверяющего" value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} />
            <button onClick={review} disabled={saving} className="btn-primary w-full">Проверить и зачислить на испытательный период</button>
          </>
        )}
      </div>
    </div>
  );
}
