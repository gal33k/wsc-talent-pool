// Modern HR-tool initials avatar. Round, colored subtly by name hash.
const PALETTE = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function colourFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name, size = "md",
}: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeCls = {
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-xs",
    lg: "w-12 h-12 text-sm",
    xl: "w-16 h-16 text-base",
  }[size];
  return (
    <div className={`${sizeCls} ${colourFor(name)} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}
