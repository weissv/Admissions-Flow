export default function Slider({ label, leftLabel, rightLabel, value, onChange, min = 0, max = 4 }) {
  return (
    <div className="py-2">
      {label && <div className="text-sm font-medium text-slate-800 mb-2">{label}</div>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
