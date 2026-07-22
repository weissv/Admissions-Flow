import { useState, useRef } from 'react';
import { api, apiErrorMessage } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import { STAGE0_TAGS } from '../../constants/competencies.js';
import { Mic, Square, Loader2, Save, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const QUESTION_CATEGORIES = [
  { id: 'price', label: 'Стоимость / Условия' },
  { id: 'rules', label: 'Правила / Границы' },
  { id: 'schedule', label: 'Режим дня / Полный день' },
  { id: 'discipline', label: 'Дисциплина / Самостоятельность' },
  { id: 'teachers', label: 'Учителя / Авторитет' },
  { id: 'academic', label: 'Учебная программа / Результаты' },
  { id: 'other', label: 'Другое' },
];

const ROUTE_OPTIONS = [
  'Standard Route (Стандартный маршрут)',
  'Careful Diagnostics (Тщательная диагностика)',
  'Required Director Interview (Интервью с директором)',
  'Needs Second Parent Position (Позиция второго родителя)',
  'Pause / Clarification (Пауза / Уточнение)',
];

export default function Stage0Panel({ familyId, detail, reload }) {
  const stage0 = detail.family.stage0_data || {};
  const isCompleted = detail.family.stage_statuses['0'] === 'Completed';

  const [adminName, setAdminName] = useState(stage0.admin_name || 'Администратор');
  const [contactFormat, setContactFormat] = useState(stage0.contact_format || 'Phone');
  const [applicantIdentity, setApplicantIdentity] = useState(stage0.applicant_identity || 'Mother');

  const [triggerQuote, setTriggerQuote] = useState(stage0.trigger_quote || '');
  const [primaryMotive, setPrimaryMotive] = useState(stage0.primary_motive || '');
  const [alternativesConsidered, setAlternativesConsidered] = useState(stage0.alternatives_considered || '');

  const [questions, setQuestions] = useState(
    stage0.first_questions && stage0.first_questions.length === 3
      ? stage0.first_questions
      : [
          { order: 1, text: '', category: 'price' },
          { order: 2, text: '', category: 'rules' },
          { order: 3, text: '', category: 'academic' },
        ]
  );

  const [tags, setTags] = useState(stage0.call_tags || []);
  const [callLog, setCallLog] = useState(stage0.call_log || '');

  const [dominantPronoun, setDominantPronoun] = useState(stage0.dominant_pronoun || 'MyChild');
  const [prevSchoolTone, setPrevSchoolTone] = useState(stage0.prev_school_tone || 'Neutral');
  const [blameAttribution, setBlameAttribution] = useState(stage0.blame_attribution || 'School');
  const [familyResponsibility, setFamilyResponsibility] = useState(stage0.family_responsibility_recognition ?? 2);

  const [indicators, setIndicators] = useState(
    stage0.initial_indicators || {
      request_clarity: 2,
      educational_motivation: 2,
      family_resource: 2,
      communication_readiness: 2,
      readiness_for_rules: 2,
      initial_risk: 0,
    }
  );

  const [adminRoute, setAdminRoute] = useState(stage0.admin_route || 'Standard Route (Стандартный маршрут)');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  function toggleTag(tag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function handleQuestionChange(index, field, value) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  }

  function handleIndicatorChange(key, value) {
    setIndicators((prev) => ({ ...prev, [key]: Number(value) }));
  }

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/stage0/${familyId}`, {
        admin_name: adminName,
        contact_format: contactFormat,
        applicant_identity: applicantIdentity,
        trigger_quote: triggerQuote,
        primary_motive: primaryMotive,
        alternatives_considered: alternativesConsidered,
        first_questions: questions,
        call_tags: tags,
        call_log: callLog,
        dominant_pronoun: dominantPronoun,
        prev_school_tone: prevSchoolTone,
        blame_attribution: blameAttribution,
        family_responsibility_recognition: familyResponsibility,
        initial_indicators: indicators,
        admin_route: adminRoute,
      });
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
      setError(apiErrorMessage(err, 'Транскрибация недоступна. Вы можете ввести текст вручную.'));
    } finally {
      setTranscribing(false);
    }
  }

  async function handleComplete() {
    setError('');
    setSaving(true);
    try {
      await saveDraft();
      await api.post(`/stage0/${familyId}/complete`);
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
        <h1 className="text-2xl font-bold text-slate-900">Этап 0. Первичный контакт (Admin Checklist)</h1>
        <p className="text-slate-500 text-sm">
          Зафиксируйте первоначальные маркеры речи, дословные вопросы родителя и историю прошлого опыта по методике Mezon v3.4.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {isCompleted && <Alert type="success">Этап завершён. Открыт 1-й этап (Онлайн-знакомство).</Alert>}

      {/* Admin Metadata */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Метаданные контакта</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Имя администратора</label>
            <input
              type="text"
              className="input mt-1"
              value={adminName}
              disabled={isCompleted}
              onChange={(e) => setAdminName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Формат контакта</label>
            <select
              className="input mt-1"
              value={contactFormat}
              disabled={isCompleted}
              onChange={(e) => setContactFormat(e.target.value)}
            >
              <option value="Phone">Телефонный звонок</option>
              <option value="InPerson">Личный визит</option>
              <option value="Online">Онлайн-консультация</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Кто обратился</label>
            <select
              className="input mt-1"
              value={applicantIdentity}
              disabled={isCompleted}
              onChange={(e) => setApplicantIdentity(e.target.value)}
            >
              <option value="Mother">Мама</option>
              <option value="Father">Отец</option>
              <option value="Both">Оба родителя</option>
              <option value="Guardian">Опекун / Законный представитель</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Trigger & Motive */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Причина и триггер обращения</h2>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase">Дословный триггер-цитата родителя</label>
          <textarea
            className="input mt-1"
            rows={2}
            disabled={isCompleted}
            placeholder="«Мы ищем школу, где ребенка не будут ломать…» или «В старой школе слабая математика…»"
            value={triggerQuote}
            onChange={(e) => setTriggerQuote(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Первичный мотив</label>
            <input
              type="text"
              className="input mt-1"
              disabled={isCompleted}
              placeholder="Сильная академическая программа / Атмосфера / Дисциплина"
              value={primaryMotive}
              onChange={(e) => setPrimaryMotive(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Рассматриваемые альтернативы</label>
            <input
              type="text"
              className="input mt-1"
              disabled={isCompleted}
              placeholder="Другие частные школы, семейное обучение и т.д."
              value={alternativesConsidered}
              onChange={(e) => setAlternativesConsidered(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* First 3 Questions */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Первые 3 вопроса родителя (слово в слово в точной последовательности)</h2>
        {questions.map((q, idx) => (
          <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <span className="font-bold text-slate-500 w-8">#{idx + 1}</span>
            <input
              type="text"
              className="input flex-1"
              disabled={isCompleted}
              placeholder={`Дословный вопрос ${idx + 1}`}
              value={q.text || ''}
              onChange={(e) => handleQuestionChange(idx, 'text', e.target.value)}
            />
            <select
              className="input md:w-56"
              disabled={isCompleted}
              value={q.category || 'price'}
              onChange={(e) => handleQuestionChange(idx, 'category', e.target.value)}
            >
              {QUESTION_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Speech Markers & Previous School Story */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Речевые маркеры и история прошлой школы</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Доминирующее местоимение</label>
            <select
              className="input mt-1"
              disabled={isCompleted}
              value={dominantPronoun}
              onChange={(e) => setDominantPronoun(e.target.value)}
            >
              <option value="MyChild">«Мой ребенок...» (Фокус на индивидуальность)</option>
              <option value="We">«Мы с ним делаем...» (Слияние / Гиперопека)</option>
              <option value="SchoolMust">«Школа должна нам...» (Потребительская позиция)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Тон рассказа о прошлой школе</label>
            <select
              className="input mt-1"
              disabled={isCompleted}
              value={prevSchoolTone}
              onChange={(e) => setPrevSchoolTone(e.target.value)}
            >
              <option value="Positive">Благодарный / Позитивный</option>
              <option value="Neutral">Нейтральный / Конструктивный</option>
              <option value="Conflict">Конфликтный / Высокая обида</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase">Атрибуция ответственности</label>
            <select
              className="input mt-1"
              disabled={isCompleted}
              value={blameAttribution}
              onChange={(e) => setBlameAttribution(e.target.value)}
            >
              <option value="School">Вся вина на прошлой школе</option>
              <option value="Child">Вина на ребенке / лени</option>
              <option value="Family">Вина на семье</option>
              <option value="Shared">Разделенная ответственность</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase">
            Признание ответственности семьи за прошлый результат (0–3): {familyResponsibility}/3
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            className="w-full mt-2 accent-indigo-600"
            disabled={isCompleted}
            value={familyResponsibility}
            onChange={(e) => setFamilyResponsibility(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0 — Полное обвинение школы</span>
            <span>1 — Частично</span>
            <span>2 — Осознает свой вклад</span>
            <span>3 — Зрелое партнерство</span>
          </div>
        </div>
      </div>

      {/* Initial 6 Indicators */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Первичная экспертная оценка (0–3 балла)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'request_clarity', label: '1. Четкость и адекватность запроса' },
            { key: 'educational_motivation', label: '2. Образовательная (не потребительская) мотивация' },
            { key: 'family_resource', label: '3. Вовлеченность и ресурсность семьи' },
            { key: 'communication_readiness', label: '4. Готовность к конструктивному диалогу' },
            { key: 'readiness_for_rules', label: '5. Готовность придерживаться правил школы' },
            { key: 'initial_risk', label: '6. Уровень первичного риска (0 - низкий, 3 - высокий)' },
          ].map((ind) => (
            <div key={ind.key} className="space-y-1">
              <div className="flex justify-between text-sm font-medium text-slate-700">
                <span>{ind.label}</span>
                <span className="font-bold text-indigo-600">{indicators[ind.key] ?? 2} / 3</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                className="w-full accent-indigo-600"
                disabled={isCompleted}
                value={indicators[ind.key] ?? 2}
                onChange={(e) => handleIndicatorChange(ind.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Speech Log & Transcription */}
      <div className="card p-5 space-y-3 bg-white shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-base">Лог первого разговора и Whisper Стенограмма</h2>
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
          className="input min-h-[140px]"
          disabled={isCompleted}
          value={callLog}
          onChange={(e) => setCallLog(e.target.value)}
          placeholder="Краткие заметки разговора или автоматическая стенограмма…"
        />
      </div>

      {/* Routing Decision */}
      <div className="card p-5 space-y-4 bg-white shadow-sm border border-slate-200">
        <h2 className="font-semibold text-slate-800 text-base border-b pb-2">Решение по маршрутизации первичного контакта</h2>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase">Рекомендуемый администратором маршрут</label>
          <select
            className="input mt-1 font-semibold text-indigo-900"
            disabled={isCompleted}
            value={adminRoute}
            onChange={(e) => setAdminRoute(e.target.value)}
          >
            {ROUTE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      {!isCompleted && (
        <div className="flex gap-3 pt-2">
          <button onClick={saveDraft} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Save size={16} />
            Сохранить черновик
          </button>
          <button onClick={handleComplete} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />
            {saving ? 'Завершаем…' : 'Завершить этап 0 и открыть этап 1'}
          </button>
        </div>
      )}
    </div>
  );
}
