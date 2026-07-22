import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { UploadCloud, CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';

export default function Stage5Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['5'] === 'Completed';
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState(null);
  const [childProduct, setChildProduct] = useState('');
  const [whoPresent, setWhoPresent] = useState('Только ребенок');
  const [exactHelp, setExactHelp] = useState('');
  const [interventionMoments, setInterventionMoments] = useState('');
  const [honestyStatement, setHonestyStatement] = useState('');

  const [independence, setIndependence] = useState(3);
  const [honesty, setHonesty] = useState(3);
  const [quality, setQuality] = useState(3);
  const [reviewerName, setReviewerName] = useState('Куратор');
  const [reviewerNotes, setReviewerNotes] = useState('');

  async function load() {
    const { data } = await api.get(`/stage5/${familyId}`);
    setTask(data);
    if (data) {
      setChildProduct(data.child_product_description || '');
      const sr = data.family_self_report || {};
      setWhoPresent(sr.who_present || 'Только ребенок');
      setExactHelp(sr.exact_help_provided || '');
      setInterventionMoments(sr.intervention_moments || '');
      setHonestyStatement(sr.honesty_statement || data.parent_self_report || '');

      setIndependence(data.independence_score ?? 3);
      setHonesty(data.honesty_score ?? 3);
      setQuality(data.quality_score ?? 3);
      setReviewerName(data.reviewer_name || 'Куратор');
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
      formData.append('child_product_description', childProduct);
      formData.append('parent_self_report', honestyStatement);
      formData.append('who_present', whoPresent);
      formData.append('exact_help_provided', exactHelp);
      formData.append('intervention_moments', interventionMoments);
      formData.append('honesty_statement', honestyStatement);

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
        proof_quotes: [
          `Самостоятельность в пробе: ${independence}/4`,
          `Честность самоотчета: ${honesty}/4`,
          reviewerNotes || 'Оценка практической пробы дома',
        ],
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
        <h1 className="text-2xl font-bold text-slate-900">Этап 5. Задание-тест и Семейный Самоотчет</h1>
        <p className="text-slate-500 text-sm">
          Практическая педагогическая проба дома. Оценка не только продукта ребенка, но и динамики поддержки самостоятельности со стороны семьи.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Проба проверена. Семья зачислена на Испытательный срок (Этап 6).</Alert>}

      {/* Family Self-Report Upload */}
      {!isCompleted && (
        <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b pb-2">1. Загрузка результата и Семейный Самоотчет</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Описание сделанной работы ребенком</label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Рисунок, инженерная модель, проект…"
                value={childProduct}
                onChange={(e) => setChildProduct(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Кто находился рядом во время работы</label>
              <select className="input mt-1" value={whoPresent} onChange={(e) => setWhoPresent(e.target.value)}>
                <option value="Только ребенок">Только ребенок (полностью один)</option>
                <option value="Мама наблюдала">Мама наблюдала в комнате</option>
                <option value="Папа помогал координировать">Отец помогал сориентироваться</option>
                <option value="Вся семья помогала">Вся семья принимала участие</option>
              </select>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 cursor-pointer hover:bg-slate-50">
            <UploadCloud size={24} className="text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">{file ? file.name : task?.file_path || 'Нажмите, чтобы выгрузить фото/файл работы'}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Какая конкретно помощь была оказана ребенку?</label>
              <input
                type="text"
                className="input mt-1"
                placeholder="Помогли отрезать материал, подали схему, не вмешивались в идею…"
                value={exactHelp}
                onChange={(e) => setExactHelp(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">В какие моменты родителям хотелось вмешаться и исправить ошибку?</label>
              <textarea
                className="input mt-1 min-h-[70px]"
                placeholder="Признание родителей: когда ребенок тушевался или делал неровно…"
                value={interventionMoments}
                onChange={(e) => setInterventionMoments(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Итоговое заявление о честности участия</label>
              <textarea
                className="input mt-1 min-h-[70px]"
                placeholder="Честное резюме от родителей…"
                value={honestyStatement}
                onChange={(e) => setHonestyStatement(e.target.value)}
              />
            </div>
          </div>

          <button onClick={upload} disabled={saving} className="btn-secondary w-full py-2.5">
            Сохранить самоотчет семьи
          </button>
        </div>
      )}

      {/* Reviewer Evaluation Panel */}
      <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600" size={18} />
          2. Оценка куратора (шкала 0–4)
        </h2>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="font-semibold text-slate-800 text-sm">Поддержка субъектности ребенка (agency_support)</div>
              <div className="text-xs text-slate-500">Виден ли самостоятельный вклад ребенка без прямого выполнения за него?</div>
            </div>
            <StarRating value={independence} onChange={isCompleted ? () => {} : setIndependence} tooltip="0 — сделали родители, 4 — полностью самостоятельно" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="font-semibold text-slate-800 text-sm">Взрослая саморефлексия и честность отчета (self_reflection)</div>
              <div className="text-xs text-slate-500">Признал ли родитель моменты, когда ему хотелось подменить задачу ребенка?</div>
            </div>
            <StarRating value={honesty} onChange={isCompleted ? () => {} : setHonesty} tooltip="0 — скрыл вмешательство, 4 — честный отчет" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="font-semibold text-slate-800 text-sm">Организованность выполнения (organization)</div>
              <div className="text-xs text-slate-500">Качество планирования и завершенность работы</div>
            </div>
            <StarRating value={quality} onChange={isCompleted ? () => {} : setQuality} tooltip="0 — сорвано, 4 — отличный результат" />
          </div>
        </div>

        {!isCompleted && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">ФИО проверяющего эксперта</label>
              <input className="input mt-1" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase">Экспертное заключение куратора</label>
              <textarea
                className="input min-h-[90px] mt-1"
                placeholder="Заметки куратора по доказуемости самостоятельности ребенка…"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
              />
            </div>

            <button onClick={review} disabled={saving} className="btn-primary w-full py-3.5 text-base font-semibold shadow-sm flex items-center justify-center gap-2">
              <FileCheck size={18} />
              {saving ? 'Проверяем…' : 'Утвердить пробу и зачислить на Испытательный срок (Этап 6)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
