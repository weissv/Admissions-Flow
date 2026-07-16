import { Star } from 'lucide-react';
import clsx from 'clsx';

export default function StarRating({ value = 0, onChange, max = 4, tooltip }) {
  return (
    <div className="flex items-center gap-1" title={tooltip}>
      {Array.from({ length: max + 1 }, (_, i) => i).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star
            size={22}
            className={clsx(i <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-slate-500">{value} / {max}</span>
    </div>
  );
}
