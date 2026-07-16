import { useState, useRef } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import { STAGE0_TAGS } from '../../constants/stages.js';
import { Mic, Square, Loader2, CheckCircle2, Copy } from 'lucide-react';
import clsx from 'clsx';

const TAG_COLORS = {
  'Высокая тревожность': 'border-amber-300 bg-amber-50 text-amber-700',
  'Потребительская позиция': 'border-red-300 bg-red-50 text-red-700',
  'Жалобы на прошлую школу': 'border-orange-300 bg-orange-50 text-orange-700',
  'Ориентация на развитие': 'border-emerald-300 bg-emerald-50 text-emerald-700',
};

export default function Stage0Panel({ familyId, detail, reload }) {
  const stage0 = detail.family.stage0_data || {};
  const isCompleted = detail.family.stage_statuses['0'] === 'Completed';

  const [tags, setTags] = useState(stage0.call_tags || []);
  const [callLog, setCallLog] = useState(stage0.call_log || '');
  const [questions, setQuestions] = useState(stage0.first_questions || ['', '', '']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  function toggleTag(tag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/stage0/${familyId}`, { call_tags: tags, call_log: callLog, first_questions: questions });
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = handleStop;
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Не удалось получить доступ к микрофону.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleStop() {
    setTranscribing(true);
    setError('');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'call.webm');
      const { data } = await api.post(`/stage0/${familyId}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCallLog((prev) => (prev ? `${prev}\n\n${data.transcript}` : data.transcript));
    } catch (err) {
      setError(apiErrorMessage(err, 'Транскрибация недоступна. Проверьте настройки Whisper API.'));
    } finally {
      setTranscribing(false);
    }
  }

  async function handleComplete() {
    setError('');
    if (questions.filter((q) => q.trim()).length < 3) {
      setError('Заполните все 3 первых вопроса родителей.');
      return;
    }
    setSaving(true);
    try {
      await saveDraft();
      const { data } = await api.post(`/stage0/${familyId}/complete`);
      setLinks(data.links);
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
        <h1 className="text-xl font-bold text-slate-900">Этап 0. Первичный контакт</h1>
        <p className="text-slate-500 text-sm">Зафиксируйте тон разговора и отправьте семье ссылку на Анкету 1.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Этап завершён. Анкета 1 отправлена родителям.</Alert>}

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Быстрые теги</h2>
        <div className="flex flex-wrap gap-2">
          {STAGE0_TAGS.map((tag) => (
            <button
              type="button"
              key={tag}
              disabled={isCompleted}
              onClick={() => toggleTag(tag)}
              className={clsx('pill', tags.includes(tag) ? TAG_COLORS[tag] : 'border-slate-200 bg-white text-slate-600')}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Лог разговора</h2>
          {!isCompleted && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={recording ? 'btn-danger !py-1.5 !px-3' : 'btn-outline !py-1.5 !px-3'}
            >
              {transcribing ? <Loader2 size={15} className="animate-spin" /> : recording ? <Square size={15} /> : <Mic size={15} />}
              {transcribing ? 'Распознаём…' : recording ? 'Остановить' : 'Диктовать'}
            </button>
          )}
        </div>
        <textarea
          className="input min-h-[160px]"
          disabled={isCompleted}
          value={callLog}
          onChange={(e) => setCallLog(e.target.value)}
          placeholder="Запись содержания разговора появится здесь после диктовки, либо введите вручную…"
        />
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Первые три вопроса родителей</h2>
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            className="input"
            disabled={isCompleted}
            placeholder={`Вопрос ${i + 1}`}
            value={questions[i] || ''}
            onChange={(e) => setQuestions((q) => q.map((v, idx) => (idx === i ? e.target.value : v)))}
          />
        ))}
      </div>

      {!isCompleted && (
        <div className="flex gap-3">
          <button onClick={saveDraft} disabled={saving} className="btn-secondary">Сохранить черновик</button>
          <button onClick={handleComplete} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Отправляем…' : 'Сгенерировать ссылку на Анкету 1'}
          </button>
        </div>
      )}

      {links && (
        <div className="card p-5 space-y-3 border-emerald-200">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <CheckCircle2 size={18} /> Ссылки на Анкету 1 сгенерированы
          </div>
          {links.map((l) => (
            <div key={l.token} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2">
              <div>
                <div className="text-xs uppercase text-slate-400">{l.respondent_type === 'mother' ? 'Мать' : 'Отец'}</div>
                <div className="text-sm text-slate-700 break-all">{l.url}</div>
              </div>
              <button className="btn-outline !py-1.5 !px-2.5" onClick={() => navigator.clipboard.writeText(l.url)}>
                <Copy size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
