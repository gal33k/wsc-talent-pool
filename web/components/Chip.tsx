export function Chip({
  children, variant = "solid", size = "md",
}: { children: React.ReactNode; variant?: "solid" | "outlined" | "family" | "flag" | "info" | "success"; size?: "sm" | "md"; }) {
  const cls = {
    solid:    "bg-indigo-50 text-indigo-700 border border-indigo-100",
    outlined: "border border-dashed border-slate-300 text-slate-500",
    family:   "bg-amber-50 text-amber-800 border border-amber-100",
    flag:     "bg-rose-50 text-rose-700 border border-rose-100",
    info:     "bg-sky-50 text-sky-700 border border-sky-100",
    success:  "bg-emerald-50 text-emerald-700 border border-emerald-100",
  }[variant];
  const sz = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";
  return <span className={`inline-flex items-center rounded-md font-medium ${cls} ${sz}`}>{children}</span>;
}
