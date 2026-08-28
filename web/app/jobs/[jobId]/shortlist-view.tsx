"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePool } from "@/lib/data";
import { computeFit, computeWarmth, assignTier, TIER_ORDER } from "@/lib/scoring";
import CandidateCard from "@/components/CandidateCard";
import CandidateDetail from "@/components/CandidateDetail";
import WeightTuner from "@/components/WeightTuner";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";
import { exportRows } from "@/lib/csv-export";

export default function ShortlistView({ jobId }: { jobId: string }) {
  const {
    pool, loading, error, setSelectedJobId,
    fitWeights, warmthWeights, tiers, parityOk,
    isBlacklisted, isOverridden,
  } = usePool();
  const [detailId, setDetailId] = useState<string | null>(null);

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
        if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
        return b.warmthScore - a.warmthScore;
      });
  }, [pool, job, fitWeights, warmthWeights, tiers, isBlacklisted, isOverridden]);

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
            <span className="ml-2 text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-medium">
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
                  {s.replace(/\*$/, "")}{s.endsWith("*") && <span className="text-red-600 ml-0.5">*</span>}
                </span>
              ))}
            </div>
            {job.required_skills.some(s => s.endsWith("*")) && (
              <div className="text-[11px] text-mute mt-1.5">
                <span className="text-red-600">*</span> critical — missing caps required-skills score at 40%
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

      <StatsBar stats={[
        { label: "Talent pool",     value: admitted, sub: `${pool.candidates.length - admitted} filtered out`, iconName: "users" },
        { label: "Shortlisted",     value: ranked.length, sub: `for ${job.job_id}`, iconName: "list", accent: true },
        { label: "Call this week",  value: grouped.call_this_week.length, sub: "warm intro + strong fit", iconName: "trending-up" },
        { label: "Top connector",   value: topWarmthEmployee.name, sub: `${topWarmthEmployee.count} intro paths`, iconName: "link" },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-text">Ranked by fit</h2>
              <span className="text-xs text-mute">competence-first · tier is a label, not a sort key</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-[11px] text-mute">
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>{grouped.call_this_week.length} call</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>{grouped.direct_outreach.length} outreach</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>{grouped.nurture.length} nurture</span>
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
            {ranked.map(r => (
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
          {ranked.length === 0 && (
            <div className="card p-12 text-center border-dashed">
              <div className="text-sm font-medium text-text">No candidates meet the current thresholds</div>
              <div className="text-xs text-mute mt-1">Try dragging the Nurture threshold down in the tuner.</div>
            </div>
          )}
        </div>
        <div>
          <WeightTuner />
        </div>
      </div>

      {detail && job && <CandidateDetail candidate={detail} job={job} onClose={() => setDetailId(null)} />}
    </main>
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
