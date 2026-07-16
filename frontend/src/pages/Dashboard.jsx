import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Progress from '../components/ui/Progress.jsx';
import { STAGE_LABELS, ROUTE_LABELS, ROUTE_COLORS } from '../constants/stages.js';
import { GraduationCap, Plus, LogOut, Search, ShieldAlert } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [families, setFamilies] = useState([]);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (routeFilter) params.route_status = routeFilter;
    const { data } = await api.get('/families', { params });
    setFamilies(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFilter]);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <GraduationCap className="text-white" size={18} />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">Конвейер Приема</div>
              <div className="text-xs text-slate-500 leading-tight">Admissions Flow</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.full_name}</span>
            <button onClick={logout} className="btn-outline !px-3">
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-slate-900">Семьи в процессе приёма</h1>
          <Link to="/families/new" className="btn-primary">
            <Plus size={18} /> Новая семья
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по имени ребёнка…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <select className="input max-w-[220px]" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
            <option value="">Все маршруты</option>
            {Object.entries(ROUTE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={load} className="btn-outline">Обновить</button>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Ребёнок</th>
                <th className="text-left px-4 py-3">Класс</th>
                <th className="text-left px-4 py-3">Текущий этап</th>
                <th className="text-left px-4 py-3">ИОП</th>
                <th className="text-left px-4 py-3">Маршрут</th>
                <th className="text-left px-4 py-3">Риски</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!loading && families.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Пока нет семей. Добавьте первую заявку.</td></tr>
              )}
              {families.map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{f.child_name}</td>
                  <td className="px-4 py-3 text-slate-500">{f.child_class}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 text-xs mb-1">Этап {f.current_stage}. {STAGE_LABELS[f.current_stage]}</div>
                    <Progress value={f.current_stage} max={6} />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{Number(f.iop_score).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge color={ROUTE_COLORS[f.route_status]}>{ROUTE_LABELS[f.route_status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {f.risk_flags?.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                        <ShieldAlert size={14} /> {f.risk_flags.length}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link to={`/families/${f.id}`} className="text-brand-600 hover:underline text-sm font-medium mr-3">Открыть</Link>
                    <Link to={`/families/${f.id}/passport`} className="text-slate-500 hover:underline text-sm">Паспорт</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
