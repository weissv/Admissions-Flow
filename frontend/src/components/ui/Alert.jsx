import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const STYLES = {
  error: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
};

const ICONS = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

export default function Alert({ type = 'info', children, className }) {
  const Icon = ICONS[type];
  return (
    <div className={clsx('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm', STYLES[type], className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
