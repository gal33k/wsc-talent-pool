"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePool } from "@/lib/data";
import { computeFit, computeWarmth, assignTier, TIER_ORDER } from "@/lib/scoring";
import CandidateCard from "@/components/CandidateCard";
import CandidateDetail from "@/components/CandidateDetail";
import WeightTuner from "@/components/WeightTuner";
import Avatar from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { exportRows } from "@/lib/csv-export";

type SortKey = "fit" | "warmth" | "recency";
type TierFilter = "all" | "call_this_week" | "direct_outreach" | "nurture";

export default function ShortlistView({ jobId }: { jobId: string }) {
  const {
    pool, loading, error, setSelectedJobId,
    fitWeights, warmthWeights, tiers, parityOk,
    isBlacklisted, isOverridden,
  } = usePool();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("fit");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  // Keep the shared selectedJobId in sync so /intros/, /referrals/ pick this job by default.
  useEffect(() => { setSelectedJobId(jobId); }, [jobId, setSelectedJobId]);

  const job = pool?.jobs.find(j => j.job_id === jobId);

  const ranked = useMemo(() => {
    if (!pool || !job) return [];
    return pool.candidates
      .filter(c => c.jobs[job.job_id])
      .filter(c => !isBlacklisted(c.id))
      .filter(c => !isOverridden(c.id, job.job_id))
      .filter(c => !(c.comeet_status?.status === "active_in_process" && c.comeet_status.role === job.job_id))
      .filter(c => c.comeet_status?.status !== "hired")
      .map(c => {
        const fit = c.jobs[job.job_id]!;
        const fitScore = computeFit(fit.components, fitWeights);
        const warmthScore = computeWarmth(c.warmth.components, warmthWeights);
        const tier = assignTier(fitScore, warmthScore, tiers);
        return { candidate: c, fit, fitScore, warmthScore, tier };
      })
      .filter(r => r.tier !== null)
      .sort((a, b) => {
        if (sortBy === "warmth") {
          if (b.warmthScore !== a.warmthScore) return b.warmthScore - a.warmthScore;
          return b.fitScore - a.fitScore;
        }
        if (sortBy === "recency") {
          const ad = a.candidate.conference?.days_since ?? 9999;
          const bd = b.candidate.conference?.days_since ?? 9999;
          if (ad !== bd) return ad - bd;
          return b.fitScore - a.fitScore;
        }
        // default: fit
        if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
        return b.warmthScore - a.warmthScore;
      });
  }, [pool, job, fitWeights, warmthWeights, tiers, isBlacklisted, isOverridden, sortBy]);

  const rankedFiltered = useMemo(
    () => tierFilter === "all" ? ranked : ranked.filter(r => r.tier === tierFilter),
    [ranked, tierFilter]
  );

  const grouped = useMemo(() => {
    const g: Record<string, typeof ranked> = { call_this_week: [], direct_outreach: [], nurture: [] };
    ranked.forEach(r => { if (r.tier) g[r.tier].push(r); });
    return g;
  }, [ranked]);

  const detail = detailId ? pool?.candidates.find(c => c.id === detailId) : null;

  if (loading) return <main className="p-8"><Skeleton /></main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;
  if (!job) {
    return (
      <main className="p-8">
        <div className="card p-8 max-w-md">
          <div className="text-sm font-semibold text-text mb-1">Unknown role: <code>{jobId}</code></div>
          <div className="text-xs text-mute mb-4">Return to the jobs index to pick a valid role.</div>
          <Link href="/" className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-indigo-700">
            <Icon name="arrow-right" className="w-3.5 h-3.5 rotate-180" strokeWidth={2} />
            All jobs
          </Link>
        </div>
      </main>
    );
  }

  const admitted = pool.candidates.filter(c => c.gate.decision === "ADMIT").length;
  const topWarmthEmployee = (() => {
    const counts: Record<string, { name: string; count: number }> = {};
    pool.candidates.forEach(c => c.warmth.shared_employers.forEach(s => {
      counts[s.employee_id] = { name: s.name, count: (counts[s.employee_id]?.count || 0) + 1 };
    }));
    const top = Object.values(counts).sort((a, b) => b.count - a.count)[0];
    return top ? { name: top.name.split(" ")[0], count: top.count } : { name: "—", count: 0 };
  })();

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-8">
      <header className="mb-6">
        <nav className="text-xs mb-2 flex items-center gap-2 text-mute" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-text transition-colors">All jobs</Link>
          <span className="text-faint">/</span>
          <span className="font-mono">{job.job_id}</span>
          {!parityOk && (
            <span className="ml-2 text-[11px] text-emerald-600 bg-emerald-50 border border-red-200 px-2 py-0.5 rounded-md font-medium">
              parity mismatch
            </span>
          )}
        </nav>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-text tracking-tight">{job.title}</h1>
            <div className="text-sm text-mute mt-1">
              {job.department} · {job.seniority} · {ranked.length} shortlisted from a pool of {admitted}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {job.required_skills.map(s => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                  {s.replace(/\*$/, "")}{s.endsWith("*") && <span className="text-emerald-600 ml-0.5">*</span>}
                </span>
              ))}
            </div>
            {job.required_skills.some(s => s.endsWith("*")) && (
              <div className="text-[11px] text-mute mt-1.5">
                <span className="text-emerald-600">*</span> critical — missing caps required-skills score at 40%
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {pool.jobs.filter(j => j.job_id !== jobId).map(j => (
                <Link
                  key={j.job_id}
                  href={`/jobs/${j.job_id}/`}
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-mute font-mono transition-colors"
                >
                  {j.job_id}
                </Link>
              ))}
            </div>
            <div className="text-[10px] text-faint uppercase tracking-wider">Switch role</div>
          </div>
        </div>
      </header>

      {/* Clickable KPI row — each card filters or navigates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <Link href="/pool/" className="card card-interactive p-4 group" title="Open the full talent pool audit">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-mute font-medium">Talent pool</div>
            <Icon name="users" className="w-3.5 h-3.5 text-stone-400" strokeWidth={2} />
          </div>
          <div className="text-2xl font-semibold tabular text-text">{admitted}</div>
          <div className="text-[11px] text-mute mt-1">{pool.candidates.length - admitted} filtered out · open →</div>
        </Link>

        <button
          onClick={() => setTierFilter("all")}
          className={`card card-interactive p-4 text-left transition-colors ${
            tierFilter === "all" ? "ring-2 ring-emerald-600 border-emerald-600" : ""
          }`}
          title="Show every shortlisted candidate"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-mute font-medium">Shortlisted</div>
            <Icon name="list" className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
          </div>
          <div className="text-2xl font-semibold tabular text-emerald-700">{ranked.length}</div>
          <div className="text-[11px] text-mute mt-1">click to reset filter</div>
        </button>

        <button
          onClick={() => setTierFilter(tierFilter === "call_this_week" ? "all" : "call_this_week")}
          className={`card card-interactive p-4 text-left transition-colors ${
            tierFilter === "call_this_week" ? "ring-2 ring-emerald-500 border-emerald-500" : ""
          }`}
          title="Filter list to only 'Call this week' candidates"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-mute font-medium">Call this week</div>
            <Icon name="trending-up" className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
          </div>
          <div className="text-2xl font-semibold tabular text-emerald-700">{grouped.call_this_week.length}</div>
          <div className="text-[11px] text-mute mt-1">warm intro + strong fit · click to filter</div>
        </button>

        <Link href="/intros/" className="card card-interactive p-4 group" title="Open the outreach queue">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-mute font-medium">Top connector</div>
            <Icon name="link" className="w-3.5 h-3.5 text-stone-400" strokeWidth={2} />
          </div>
          <div className="text-lg font-semibold text-text">{topWarmthEmployee.name}</div>
          <div className="text-[11px] text-mute mt-1">{topWarmthEmployee.count} intro paths · outreach →</div>
        </Link>
      </div>

      {/* Tier explainer — makes "call vs outreach vs nurture" concrete */}
      <div className="mb-5 rounded-lg border border-border bg-white p-4">
        <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-2.5">What these tiers mean</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <TierExplainer
            dot="bg-emerald-500"
            label="Call this week"
            rule={`Fit ≥ ${tiers.call_this_week.min_fit}  AND  Warmth ≥ ${tiers.call_this_week.min_warmth}`}
            hint="Strong fit AND you have a warm intro path. Phone call territory — highest response rate."
          />
          <TierExplainer
            dot="bg-amber-500"
            label="Direct outreach"
            rule={`Fit ≥ ${tiers.direct_outreach.min_fit}  (network is cold)`}
            hint="Same strong fit, but nobody at WSC knows them yet. Cold email with an evidence-based hook."
          />
          <TierExplainer
            dot="bg-stone-400"
            label="Nurture"
            rule={`Fit ≥ ${tiers.nurture.min_fit}  (below strong-fit line)`}
            hint="Not this week's priority — worth keeping warm for future roles or as talent stays in-market."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-text">Ranked list</h2>
              <div className="flex items-center gap-1.5 text-xs">
                <label htmlFor="sort-by" className="text-mute">Sort by</label>
                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="text-xs font-medium border border-border rounded-md px-2 py-1 bg-white cursor-pointer hover:border-accent"
                  aria-label="Sort candidates by"
                >
                  <option value="fit">Fit (competence)</option>
                  <option value="warmth">Warmth (reachability)</option>
                  <option value="recency">Recency (most recent contact)</option>
                </select>
              </div>
              <span className="text-[11px] text-mute">
                {rankedFiltered.length} of {ranked.length}
                {tierFilter !== "all" && <> · filtered by tier</>}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-wider text-mute font-semibold mr-1">Filter</span>
                {(["all", "call_this_week", "direct_outreach", "nurture"] as const).map(t => {
                  const label = t === "all" ? "All" : t === "call_this_week" ? "Call" : t === "direct_outreach" ? "Outreach" : "Nurture";
                  const count = t === "all" ? ranked.length : grouped[t]?.length ?? 0;
                  const active = tierFilter === t;
                  const dot = t === "call_this_week" ? "bg-emerald-500" : t === "direct_outreach" ? "bg-emerald-600" : t === "nurture" ? "bg-stone-400" : "";
                  return (
                    <button
                      key={t}
                      onClick={() => setTierFilter(t)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                        active
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-mute border-border hover:text-text hover:border-stone-300"
                      }`}
                      title={t === "all" ? "Show every tier" : `Show only ${label} candidates`}
                    >
                      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                      {label} · {count}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  exportRows(
                    `wsc-shortlist-${jobId}-${today}.csv`,
                    ranked.map((r, i) => ({ ...r, rank: i + 1 })),
                    [
                      { label: "Rank",          get: r => r.rank },
                      { label: "Name",          get: r => r.candidate.name },
                      { label: "Title",         get: r => r.candidate.title },
                      { label: "Company",       get: r => r.candidate.company },
                      { label: "Role family",   get: r => r.candidate.role_family },
                      { label: "Fit score",     get: r => r.fitScore.toFixed(1) },
                      { label: "Warmth score",  get: r => r.warmthScore.toFixed(1) },
                      { label: "Tier",          get: r => (r.tier ?? "").replace(/_/g, " ") },
                      { label: "Source channel", get: () => "conference" },
                      { label: "Best intro",    get: r => r.candidate.warmth.shared_employers?.[0]?.name ?? "" },
                      { label: "Mutual conns",  get: r => r.candidate.warmth.mutuals?.length ?? 0 },
                      { label: "LinkedIn",      get: r => r.candidate.linkedin_url },
                      { label: "Note",          get: r => r.candidate.notes ?? "" },
                    ]
                  );
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-white hover:border-accent hover:text-accent transition-colors"
                title={`Download this ${ranked.length}-row shortlist as CSV`}
              >
                <Icon name="download" className="w-3.5 h-3.5" strokeWidth={2.25} />
                Export CSV
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {rankedFiltered.map(r => (
              <CandidateCard
                key={r.candidate.id}
                candidate={r.candidate}
                job={job}
                fit={{ ...r.fit, score_default: r.fitScore }}
                warmthScore={r.warmthScore}
                rank={ranked.indexOf(r) + 1}
                tier={r.tier as Exclude<typeof r.tier, null>}
                onOpen={() => setDetailId(r.candidate.id)}
              />
            ))}
          </div>
          {rankedFiltered.length === 0 && (
            <div className="card p-12 text-center border-dashed">
              <div className="text-sm font-medium text-text">
                {ranked.length === 0
                  ? "No candidates meet the current thresholds"
                  : `No candidates in the "${tierFilter.replace(/_/g, " ")}" tier`}
              </div>
              <div className="text-xs text-mute mt-1">
                {ranked.length === 0
                  ? "Try dragging the Nurture threshold down in the tuner."
                  : <>Try <button onClick={() => setTierFilter("all")} className="underline text-emerald-700">clearing the filter</button> or a different tier.</>}
              </div>
            </div>
          )}

          {/* Reconsider REJECTS — surface anyone gated out whose skills still
              match the required list of THIS role. Reject was job-agnostic;
              a new role can bring back someone we previously dropped. */}
          {(() => {
            const requiredSkillsLower = job.required_skills.map(s => s.replace(/\*$/, "").toLowerCase());
            const reconsider = pool.candidates
              .filter(c => c.gate.decision === "REJECT")
              .map(c => {
                const cs = (c.skills || []).map(s => s.toLowerCase());
                const matches = requiredSkillsLower.filter(rs =>
                  cs.some(s => s.includes(rs) || rs.includes(s))
                );
                return { candidate: c, matches };
              })
              .filter(r => r.matches.length >= 2)
              .sort((a, b) => b.matches.length - a.matches.length)
              .slice(0, 6);

            if (reconsider.length === 0) return null;
            return (
              <section className="mt-8 card p-5 border-amber-200 bg-amber-50/40">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                    <Icon name="alert" className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-text">
                      {reconsider.length} previously-rejected {reconsider.length === 1 ? "candidate" : "candidates"} might fit this role
                    </h3>
                    <p className="text-xs text-mute mt-0.5 leading-relaxed">
                      The pool gate is job-agnostic — these people were rejected as &ldquo;not talent
                      in a domain we hire&rdquo; overall. But their skills match ≥2 of{" "}
                      <strong className="text-text">{job.title}</strong>'s required list.
                      Worth a second look. Click through to their dossier and re-admit if the recruiter agrees.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 mt-4">
                  {reconsider.map(r => (
                    <li
                      key={r.candidate.id}
                      onClick={() => setDetailId(r.candidate.id)}
                      className="flex items-center gap-3 rounded-md bg-white border border-border px-3 py-2.5 cursor-pointer hover:border-amber-400 transition-colors"
                    >
                      <Avatar name={r.candidate.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{r.candidate.name}</div>
                        <div className="text-xs text-mute truncate">{r.candidate.title} · {r.candidate.company}</div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                        {r.matches.slice(0, 4).map(m => (
                          <span key={m} className="text-[10px] font-medium bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5">
                            ✓ {m}
                          </span>
                        ))}
                        {r.matches.length > 4 && (
                          <span className="text-[10px] text-mute">+{r.matches.length - 4}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-mute mt-3 italic">
                  Note: these were passed on by the gate for reasons like &ldquo;wrong role family
                  overall&rdquo; or &ldquo;no adjacent industry.&rdquo; The skills overlap here is
                  the recruiter's cue to check if the gate was too strict for THIS role.
                </div>
              </section>
            );
          })()}
        </div>
        <div>
          <WeightTuner />
        </div>
      </div>

      {detail && job && <CandidateDetail candidate={detail} job={job} onClose={() => setDetailId(null)} />}
    </main>
  );
}

function TierExplainer({
  dot, label, rule, hint,
}: { dot: string; label: string; rule: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 mt-1.5`} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-sm font-semibold text-text">{label}</div>
          <code className="text-[10px] font-mono text-mute bg-stone-50 border border-border-faint px-1.5 py-0.5 rounded whitespace-nowrap">{rule}</code>
        </div>
        <div className="text-xs text-mute mt-1 leading-relaxed">{hint}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-3xl">
      <div className="h-8 w-64 bg-slate-200 rounded-md animate-pulse mb-3" />
      <div className="h-4 w-96 bg-slate-100 rounded animate-pulse mb-6" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5 mb-3">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
