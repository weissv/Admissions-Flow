import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { ArrowLeft, IdCard } from 'lucide-react';
import StageStepper from '../components/StageStepper.jsx';
import Badge from '../components/ui/Badge.jsx';
import { ROUTE_LABELS, ROUTE_COLORS } from '../constants/stages.js';

import Stage0Panel from './stages/Stage0Panel.jsx';
import Stage1Panel from './stages/Stage1Panel.jsx';
import Stage2Panel from './stages/Stage2Panel.jsx';
import Stage3Panel from './stages/Stage3Panel.jsx';
import Stage4Panel from './stages/Stage4Panel.jsx';
import Stage5Panel from './stages/Stage5Panel.jsx';
import Stage6Panel from './stages/Stage6Panel.jsx';

const PANELS = {
  0: Stage0Panel, 1: Stage1Panel, 2: Stage2Panel, 3: Stage3Panel,
  4: Stage4Panel, 5: Stage5Panel, 6: Stage6Panel,
};

export default function FamilyWorkspace() {
  const { id, stage } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await api.get(`/families/${id}`);
    setDetail(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-10 text-center text-slate-400">Загрузка…</div>;
  if (!detail) return null;

  if (stage === undefined) {
    return <Navigate to={`/families/${id}/stage/${detail.family.current_stage}`} replace />;
  }

  const stageNum = Number(stage);
  const status = detail.family.stage_statuses[String(stageNum)] || 'Not_Started';
  if (status === 'Not_Started') {
    return <Navigate to={`/families/${id}/stage/${detail.family.current_stage}`} replace />;
  }

  const Panel = PANELS[stageNum];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> К списку семей
          </Link>
          <div className="flex items-center gap-3">
            <Badge color={ROUTE_COLORS[detail.family.route_status]}>{ROUTE_LABELS[detail.family.route_status]}</Badge>
            <span className="text-sm font-mono text-slate-600">ИОП: {Number(detail.family.iop_score).toFixed(2)}</span>
            <Link to={`/families/${id}/passport`} className="btn-outline !py-2">
              <IdCard size={16} /> Паспорт семьи
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-4">
          <div className="card p-4">
            <div className="font-bold text-slate-900">{detail.family.child_name}</div>
            <div className="text-sm text-slate-500">Целевой класс: {detail.family.child_class}</div>
          </div>
          <StageStepper familyId={id} stageStatuses={detail.family.stage_statuses} />
        </aside>

        <section>
          {Panel ? <Panel familyId={id} detail={detail} reload={load} /> : <div>Этап не найден</div>}
        </section>
      </main>
    </div>
  );
}
