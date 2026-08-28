export default function ScoreBadge({
  value, label, size = "md",
}: { value: number; label?: string; size?: "sm" | "md" | "lg" }) {
  const tone =
    value >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : value >= 60 ? "bg-indigo-50 text-indigo-700 border-indigo-200"
    : value >= 40 ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-slate-100 text-slate-600 border-slate-200";

  const sz = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  }[size];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium border ${tone} ${sz}`}>
      {label && <span className="opacity-75 text-[10px] uppercase tracking-wider">{label}</span>}
      <span className="font-semibold tabular">{value.toFixed(1)}</span>
    </span>
  );
}
