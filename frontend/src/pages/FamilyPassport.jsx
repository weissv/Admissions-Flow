import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { api } from '../api/client.js';
import Badge from '../components/ui/Badge.jsx';
import { ArrowLeft, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, AlertCircle, Check } from 'lucide-react';
import clsx from 'clsx';
import { ROUTE_COLORS } from '../constants/stages.js';

const COLOR_MAP = { green: 'bg-emerald-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };
const BADGE_COLOR_MAP = { green: 'green', yellow: 'yellow', orange: 'orange', red: 'red' };

export default function FamilyPassport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get(`/passport/${id}`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="p-10 text-center text-slate-400">Загрузка Паспорта семьи 2.0…</div>;

  const { family, iop, compatibility, route, radar, risks, iop_breakdown } = data;
  const pct = Math.max(0, Math.min(100, (iop / 4) * 100));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-2xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to={`/families/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            <ArrowLeft size={16} /> К рабочей области семьи
          </Link>
          <div className="text-xs text-slate-500 font-mono">Mezon Parent Portrait & Methodology v3.4</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Passport Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Паспорт семьи 2.0: {family.child_name}</h1>
              <Badge color="purple">Класс: {family.child_class}</Badge>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Целевая возрастная группа: {family.target_grade || '1-2'} · Первичный выбор администратора: «{family.admin_route_recommendation}»
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-semibold uppercase">Назначенный маршрут</div>
              <Badge color={ROUTE_COLORS[route.code] || 'blue'} className="text-sm font-bold px-3 py-1 mt-0.5">
                {route.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Top Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Radar Chart */}
          <div className="card p-5 col-span-1 md:col-span-2 bg-white shadow-sm border border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900 text-base border-b pb-2">Радар 12 партнерских компетенций (0–4)</h2>
            <ResponsiveContainer width="100%" height={380}>
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} />
                <PolarRadiusAxis angle={30} domain={[0, 4]} tickCount={5} stroke="#94a3b8" />
                <Radar name="Оценка" dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* IOP Gauge & Stage Breakdown */}
          <div className="space-y-6">
            <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-slate-900 text-sm uppercase text-slate-500">Интегральный Индекс (ИОП)</h2>
              <div className="text-4xl font-extrabold text-indigo-950">{iop.toFixed(2)} <span className="text-slate-400 text-lg font-normal">/ 4.00</span></div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className={clsx('h-full rounded-full transition-all duration-500', COLOR_MAP[compatibility.color])} style={{ width: `${pct}%` }} />
              </div>
              <div className="pt-1">
                <Badge color={BADGE_COLOR_MAP[compatibility.color]}>{compatibility.label}</Badge>
              </div>
            </div>

            <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-slate-900 text-sm uppercase text-slate-500">Вклад этапов (Формула v3.4)</h2>
              <div className="space-y-2 text-xs">
                {iop_breakdown.map((b) => (
                  <div key={b.stage} className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-0">
                    <span className="text-slate-600 font-medium">Этап {b.stage} (вес {(b.weight * 100).toFixed(0)}%)</span>
                    <span className="font-mono text-slate-800">S={b.score.toFixed(2)} → <strong className="text-indigo-600">+{b.contribution.toFixed(2)}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Verification Audit Grid (Soft Status Badges) */}
        <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" size={18} />
            Доказательная полнота компетенций (Методический статус доказуемости)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {radar.map((c) => {
              const isVerified = c.proofCount >= 2;

              return (
                <div
                  key={c.key}
                  className={clsx(
                    'p-3.5 rounded-xl border text-xs space-y-1.5',
                    !isVerified
                      ? 'border-amber-200 bg-amber-50/50 text-slate-800'
                      : 'border-emerald-200 bg-emerald-50/50 text-slate-800'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{c.label}</span>
                    <span className="font-extrabold text-sm text-indigo-700">{c.score} / 4</span>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-500">Зафиксированных цитат/фактов: {c.proofCount}</span>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check size={12} /> Подтверждено фактами (≥2)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        <AlertCircle size={12} /> Рекомендуется добавить еще факты/цитаты
                      </span>
                    )}
                  </div>

                  {c.proofs && c.proofs.length > 0 && (
                    <div className="mt-1 space-y-1 text-slate-600 italic">
                      {c.proofs.map((p, i) => (
                        <div key={i} className="line-clamp-1">«{p}»</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* System Flag Taxonomy Registry */}
        <div className="card p-5 bg-white shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" size={18} />
            Реестр системных флагов семьи (System Flag Taxonomy)
          </h2>

          {risks.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Флаги риска не зафиксированы.</div>
          ) : (
            <div className="space-y-2">
              {risks.map((r) => (
                <div key={r.flag} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
                    onClick={() => setExpanded(expanded === r.flag ? null : r.flag)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge color={r.type === 'positive' ? 'green' : r.type === 'critical' || r.type === 'risk' ? 'red' : 'yellow'}>
                        {r.label}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">({r.flag})</span>
                    </div>
                    {expanded === r.flag ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {expanded === r.flag && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
                      {r.evidence.length === 0 ? (
                        <div className="text-slate-400">Нет зафиксированных фактов/цитат.</div>
                      ) : (
                        r.evidence.map((e, i) => (
                          <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="text-slate-500 font-semibold mb-0.5">
                              Этап {e.stage ?? '—'} · {e.source} ({new Date(e.created_at || Date.now()).toLocaleDateString('ru-RU')}):
                            </div>
                            <div className="text-slate-800 font-medium">«{e.quote}»</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
