export function ScoreBar({
  label, value, tone = "accent",
}: { label: string; value: number; tone?: "accent" | "good" }) {
  const barColour = tone === "good" ? "bg-emerald-500" : "bg-indigo-500";
  return (
    <div className="flex-1">
      <div className="flex justify-between mb-1.5">
        <span className="text-[11px] text-mute font-medium">{label}</span>
        <span className="text-xs text-text font-semibold tabular">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`${barColour} h-full rounded-full transition-all duration-500 ease-out`}
             style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function ComponentBar({
  label, value, weight, weightMax = 40,
}: { label: string; value: number; weight: number; weightMax?: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-dim">{label} <span className="text-faint">· weight {weight}</span></span>
        <span className="font-mono font-semibold text-text tabular">{(value * weight).toFixed(1)}<span className="text-faint">/{weight}</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
        <div className="bg-slate-200 h-full absolute inset-y-0 left-0 rounded-full"
             style={{ width: `${(weight / weightMax) * 100}%` }} />
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full absolute inset-y-0 left-0 rounded-full transition-all"
             style={{ width: `${(value * weight / weightMax) * 100}%` }} />
      </div>
    </div>
  );
}
