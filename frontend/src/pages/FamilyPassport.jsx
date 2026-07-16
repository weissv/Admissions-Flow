import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { api } from '../api/client.js';
import Badge from '../components/ui/Badge.jsx';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { ROUTE_COLORS } from '../constants/stages.js';

const COLOR_MAP = { green: 'bg-emerald-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };
const BADGE_COLOR_MAP = { green: 'green', yellow: 'yellow', orange: 'orange', red: 'red' };
const SEVERITY_BADGE = { critical: 'red', moderate: 'yellow', positive: 'green' };

export default function FamilyPassport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get(`/passport/${id}`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="p-10 text-center text-slate-400">Загрузка…</div>;

  const { family, iop, compatibility, route, radar, risks, iop_breakdown } = data;
  const pct = Math.max(0, Math.min(100, (iop / 4) * 100));

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link to={`/families/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> К карточке семьи
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Паспорт семьи: {family.child_name}</h1>
          <p className="text-slate-500 text-sm">Целевой класс {family.child_class} · Этап {family.current_stage}</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="card p-5 col-span-2">
            <h2 className="font-semibold text-slate-800 mb-4">Радар компетенций</h2>
            <ResponsiveContainer width="100%" height={420}>
              <RadarChart data={radar} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 4]} tickCount={5} />
                <Radar name="Оценка" dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Шкала совместимости (ИОП)</h2>
              <div className="text-3xl font-bold text-slate-900 mb-2">{iop.toFixed(2)}</div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden mb-2">
                <div className={clsx('h-full rounded-full', COLOR_MAP[compatibility.color])} style={{ width: `${pct}%` }} />
              </div>
              <Badge color={BADGE_COLOR_MAP[compatibility.color]}>{compatibility.label}</Badge>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Рекомендованный маршрут</h2>
              <Badge color={ROUTE_COLORS[route.code]} className="text-base px-4 py-2">
                {route.label}
              </Badge>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Вклад этапов в ИОП</h2>
              <div className="space-y-2 text-sm">
                {iop_breakdown.map((b) => (
                  <div key={b.stage} className="flex items-center justify-between">
                    <span className="text-slate-500">Этап {b.stage} (вес {(b.weight * 100).toFixed(0)}%)</span>
                    <span className="font-mono text-slate-700">S={b.score.toFixed(2)} → +{b.contribution.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Активные риски</h2>
          {risks.length === 0 && <div className="text-sm text-slate-400">Риски не выявлены.</div>}
          <div className="space-y-2">
            {risks.map((r) => (
              <div key={r.flag} className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                  onClick={() => setExpanded(expanded === r.flag ? null : r.flag)}
                >
                  <div className="flex items-center gap-3">
                    <Badge color={SEVERITY_BADGE[r.severity]}>{r.label}</Badge>
                  </div>
                  {expanded === r.flag ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded === r.flag && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-2">
                    {r.evidence.length === 0 && <div className="text-sm text-slate-400">Нет зафиксированных цитат.</div>}
                    {r.evidence.map((e, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-slate-400">Этап {e.stage ?? '—'} · {e.source}:</span>{' '}
                        <span className="text-slate-700">«{e.quote}»</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
