import clsx from 'clsx';

const COLORS = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-brand-100 text-brand-700',
  purple: 'bg-purple-100 text-purple-700',
};

export default function Badge({ color = 'slate', children, className }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', COLORS[color], className)}>
      {children}
    </span>
  );
}
