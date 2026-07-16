import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Lock, Check, Loader2 } from 'lucide-react';
import { STAGE_LABELS } from '../constants/stages.js';

export default function StageStepper({ familyId, stageStatuses = {} }) {
  const location = useLocation();

  return (
    <div className="card p-3 flex flex-col gap-1">
      {Array.from({ length: 7 }, (_, i) => i).map((stage) => {
        const status = stageStatuses[String(stage)] || 'Not_Started';
        const locked = status === 'Not_Started';
        const active = location.pathname.endsWith(`/stage/${stage}`);

        const content = (
          <div
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              active && 'bg-brand-50 text-brand-800 font-semibold',
              !active && !locked && 'hover:bg-slate-50 text-slate-700',
              locked && 'text-slate-400 cursor-not-allowed'
            )}
          >
            <span
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                status === 'Completed' && 'bg-emerald-500 text-white',
                status === 'In_Progress' && 'bg-brand-600 text-white',
                status === 'Not_Started' && 'bg-slate-200 text-slate-500',
                status === 'Failed' && 'bg-red-500 text-white'
              )}
            >
              {status === 'Completed' ? <Check size={15} /> : status === 'In_Progress' ? <Loader2 size={14} className="animate-spin" /> : stage}
            </span>
            <span className="flex-1">
              Этап {stage}. {STAGE_LABELS[stage]}
            </span>
            {locked && <Lock size={14} />}
          </div>
        );

        return locked ? (
          <div key={stage}>{content}</div>
        ) : (
          <Link key={stage} to={`/families/${familyId}/stage/${stage}`}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
