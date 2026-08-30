"use client";

import { usePool } from "@/lib/data";
import type { FitWeights, WarmthWeights, SignalWeights } from "@/lib/types";
import { Icon } from "./Icon";

const FIT_LABELS: Record<keyof FitWeights, [string, string]> = {
  required_skills: [
    "Required skills",
    "How much matching the job's must-have skills counts. Drag up if strict skill-matching matters most.",
  ],
  role_family: [
    "Role family",
    "How much having the exact job family matters (ML vs backend vs data). Adjacent families get half credit.",
  ],
  seniority: [
    "Seniority",
    "How strictly to match the job's seniority band. Above-band and below-band still show, just flagged.",
  ],
  domain: [
    "Domain",
    "How much sports/media/broadcast context counts. High = penalise candidates from unrelated industries.",
  ],
  nice_to_have: [
    "Nice-to-have",
    "Bonus weight for optional skills. Small by design — these are extras, not requirements.",
  ],
};

const WARMTH_LABELS: Record<keyof WarmthWeights, [string, string]> = {
  mutual_connections: ["Mutual connections", "3+ mutuals = full credit."],
  shared_employer:    ["Shared employer",    "Post-stoplist, alias-normalized."],
  recency:            ["Recency",            "12-month half-life decay."],
  notes_present:      ["Recruiter notes",    "A recorded booth conversation."],
};

// New 8-component Signal — replaces Warmth. Each slider has plain-English
// help text explaining what dragging it up/down does.
const SIGNAL_LABELS: Record<keyof SignalWeights, [string, string]> = {
  peer_vouch: [
    "Peer vouch",
    "Highest signal — an active endorsement from a same-team WSC employee (with tenure + role-match multipliers). Drag up if peer vouches should dominate.",
  ],
  same_team_overlap: [
    "Same-team overlap",
    "Shared employer with a same-team WSC person, WITHOUT an active vouch. They've been in the same room — real signal, no endorsement yet.",
  ],
  cross_team_vouch: [
    "Cross-team vouch",
    "An active endorsement from a WSC employee in a different area. Still valuable, but weaker judgment on role-fit than a peer vouch.",
  ],
  culture_affinity: [
    "Culture affinity",
    "Domain-topic engagement — OSS in our stack, publications on adjacent problems, past sports-tech conference attendance. Strict signals only, no bias-prone proxies.",
  ],
  prior_wsc_engagement: [
    "Prior WSC engagement",
    "Followed WSC, engaged with our posts, attended past WSC events. Passive interest — they know us.",
  ],
  recency: [
    "Recency",
    "Freshness of contact. Someone met 3 months ago outranks someone met 2 years ago; 12-month half-life.",
  ],
  notes_present: [
    "Recruiter notes",
    "A recorded booth conversation happened. Small but real signal.",
  ],
  mutual_connections: [
    "Mutual connections",
    "Bare LinkedIn mutuals with no team overlap and no vouch. Weakest signal — a passive social-graph fact.",
  ],
};

function Slider({
  label, tip, value, onChange, max = 60,
}: { label: string; tip: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="text-xs text-text font-medium">{label}</label>
        <span className="text-xs text-emerald-800 font-semibold tabular bg-emerald-50 px-1.5 py-0.5 rounded">
          {value}
        </span>
      </div>
      <input type="range" min={0} max={max} value={value}
             onChange={e => onChange(Number(e.target.value))}
             className="w-full" />
      {tip && <div className="text-[11px] text-mute mt-1">{tip}</div>}
    </div>
  );
}

function isSignalShape(w: WarmthWeights | SignalWeights): w is SignalWeights {
  return typeof (w as SignalWeights).peer_vouch === "number";
}

export default function WeightTuner() {
  const { fitWeights, warmthWeights, tiers, setFitWeights, setWarmthWeights, setTiers, resetWeights } = usePool();

  return (
    <aside className="card overflow-hidden sticky top-4 max-h-[calc(100vh-2rem)] flex flex-col">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Icon name="sliders" className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-semibold text-text">Weight tuner</div>
            <div className="text-[11px] text-mute">Drag any slider · list re-ranks live</div>
          </div>
        </div>
        <button
          onClick={resetWeights}
          className="text-xs text-emerald-700 hover:text-amber-900 font-medium"
        >
          Reset
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4">
        <Group label="Fit — competence (does this person match the job?)" dot="bg-emerald-600">
          {(Object.keys(FIT_LABELS) as Array<keyof FitWeights>).map(k => {
            const [label, tip] = FIT_LABELS[k];
            return (
              <Slider key={k} label={label} tip={tip}
                      value={fitWeights[k]}
                      onChange={v => setFitWeights({ ...fitWeights, [k]: v })} />
            );
          })}
        </Group>

        <Group label="Signal — reachability + endorsement + culture (how likely they convert)" dot="bg-emerald-500">
          {isSignalShape(warmthWeights) ? (
            (Object.keys(SIGNAL_LABELS) as Array<keyof SignalWeights>).map(k => {
              const [label, tip] = SIGNAL_LABELS[k];
              return (
                <Slider key={k} label={label} tip={tip}
                        value={(warmthWeights as SignalWeights)[k]}
                        onChange={v => setWarmthWeights({ ...warmthWeights, [k]: v } as SignalWeights)} />
              );
            })
          ) : (
            (Object.keys(WARMTH_LABELS) as Array<keyof WarmthWeights>).map(k => {
              const [label, tip] = WARMTH_LABELS[k];
              return (
                <Slider key={k} label={label} tip={tip}
                        value={(warmthWeights as WarmthWeights)[k]}
                        onChange={v => setWarmthWeights({ ...warmthWeights, [k]: v } as WarmthWeights)} />
              );
            })
          )}
        </Group>

        <Group label="Tier thresholds — decides who lands where" dot="bg-emerald-600">
          <Slider label="Warm intro — min fit"
                  tip="Fit score needed to earn the 'Warm intro' tier. Higher = fewer candidates get the top-priority label."
                  value={tiers.call_this_week.min_fit} max={100}
                  onChange={v => setTiers({ ...tiers, call_this_week: { ...tiers.call_this_week, min_fit: v } })} />
          <Slider label="Warm intro — min signal"
                  tip="Signal is also required for the 'Warm intro' tier (needs BOTH fit and signal). Higher = only recommend intros where the intro path is solid."
                  value={tiers.call_this_week.min_warmth} max={100}
                  onChange={v => setTiers({ ...tiers, call_this_week: { ...tiers.call_this_week, min_warmth: v } })} />
          <Slider label="Cold outreach — min fit"
                  tip="Fit score needed for cold-outreach recommendations (no warm path, but fit is strong)."
                  value={tiers.direct_outreach.min_fit} max={100}
                  onChange={v => setTiers({ ...tiers, direct_outreach: { min_fit: v } })} />
          <Slider label="Nurture — min fit"
                  tip="Minimum fit to show at all. Below this line: not shortlisted, hidden from the ranked view."
                  value={tiers.nurture.min_fit} max={100}
                  onChange={v => setTiers({ ...tiers, nurture: { min_fit: v } })} />
        </Group>
      </div>

      <div className="border-t border-border px-4 py-2.5 bg-slate-50/50 text-[11px] text-mute">
        <div className="flex items-start gap-1.5">
          <Icon name="info" className="w-3 h-3 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <span>Sub-scores are computed in Python. The browser only does the weighted sum.</span>
        </div>
      </div>
    </aside>
  );
}

function Group({ label, dot, children }: { label: string; dot: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-semibold text-mute mb-3 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      {children}
    </div>
  );
}
