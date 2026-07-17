import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';

export default function Stage2Panel({ familyId, detail, reload }) {
  const isCompleted = detail.family.stage_statuses['2'] === 'Completed';
  const [testResults, setTestResults] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [employeeName, setEmployeeName] = useState('');
  const [testName, setTestName] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [result04, setResult04] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    const { data } = await api.get(`/stage2/${familyId}`);
    setTestResults(data.test_results || []);
  }
  useEffect(() => { load(); }, [familyId]);

  async function saveTestResult() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage2/${familyId}/test-result`, {
        employee_name: employeeName,
        test_name: testName,
        score,
        max_score: maxScore,
        result_0_4: result04,
        notes,
      });
      setScore('');
      setMaxScore('');
      setResult04('');
      setNotes('');
      await load();
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function completeStage() {
    setError('');
    setSaving(true);
    try {
      await api.post(`/stage2/${familyId}/complete`);
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
        <h1 className="text-xl font-bold text-slate-900">Этап 2. Результаты теста</h1>
        <p className="text-slate-500 text-sm">Сотрудник вручную вводит фактические результаты теста. Ссылки и автоматические анкеты не создаются.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Результаты теста внесены. Этап завершён.</Alert>}

      {!isCompleted && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Ввод результатов теста</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Название теста</label>
              <input className="input" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Например: входной тест" />
            </div>
            <div>
              <label className="label">Сотрудник</label>
              <input className="input" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="ФИО" />
            </div>
            <div>
              <label className="label">Набрано баллов</label>
              <input className="input" type="number" min="0" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Например: 18" />
            </div>
            <div>
              <label className="label">Максимум баллов</label>
              <input className="input" type="number" min="0" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="Например: 25" />
            </div>
          </div>
          <div>
            <label className="label">Результат теста по шкале 0–4</label>
            <input className="input" type="number" min="0" max="4" step="0.01" value={result04} onChange={(e) => setResult04(e.target.value)} placeholder="Например: 3.25" />
          </div>
          <div>
            <label className="label">Комментарий к результату</label>
            <textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button onClick={saveTestResult} disabled={saving} className="btn-secondary w-full">
            {saving ? 'Сохраняем…' : 'Сохранить результаты теста'}
          </button>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Сохранённые результаты</h2>
          {testResults.map((result) => {
            const details = result.competency_scores?._test_details || {};
            return (
              <div key={result.id} className="rounded-xl bg-slate-50 p-4 text-sm">
                <div className="font-medium text-slate-800">{details.test_name || 'Тест'} · {result.competency_scores?.stage2_test_result ?? '—'} / 4</div>
                <div className="text-slate-500 mt-1">Баллы: {details.score ?? '—'} / {details.max_score ?? '—'}</div>
                <div className="text-slate-500">Внёс: {result.evaluator_name}</div>
                {result.raw_notes && <div className="text-slate-600 mt-2">{result.raw_notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {!isCompleted && (
        <button onClick={completeStage} disabled={saving} className="btn-primary w-full">
          Завершить этап
        </button>
      )}
    </div>
  );
}
