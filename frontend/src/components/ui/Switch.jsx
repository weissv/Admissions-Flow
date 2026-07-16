import clsx from 'clsx';

export default function Switch({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-slate-300'
        )}
      >
        <span
          className={clsx(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  );
}
