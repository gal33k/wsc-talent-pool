import type { Tier } from "@/lib/scoring";

const STYLES: Record<Exclude<Tier, null>, { label: string; hint: string; cls: string }> = {
  call_this_week: {
    label: "Warm intro", hint: "Strong fit + a WSC employee can introduce you",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  direct_outreach: {
    label: "Cold outreach", hint: "Strong fit, no warm path — reach out directly",
    cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  nurture: {
    label: "Nurture", hint: "Borderline fit — keep in pool, re-score next role",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export default function TierBadge({ tier, showHint = false, size = "md" }: {
  tier: Exclude<Tier, null>; showHint?: boolean; size?: "sm" | "md";
}) {
  const s = STYLES[tier];
  const sz = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <div className="inline-flex items-baseline gap-2.5">
      <span className={`inline-flex items-center rounded-full font-medium border ${s.cls} ${sz}`}>
        {s.label}
      </span>
      {showHint && <span className="text-xs text-mute">{s.hint}</span>}
    </div>
  );
}

export { STYLES as TIER_STYLES };
