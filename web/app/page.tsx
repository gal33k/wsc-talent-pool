"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePool } from "@/lib/data";
import { computeFit, computeWarmth, assignTier, TIER_ORDER } from "@/lib/scoring";
import { Icon } from "@/components/Icon";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import ScoreBadge from "@/components/ScoreBadge";

export default function JobsIndex() {
  const {
    pool, loading, error,
    fitWeights, warmthWeights, tiers,
    isBlacklisted, isOverridden, blacklist, overrides,
  } = usePool();

  const jobSummaries = useMemo(() => {
    if (!pool) return [];
    return pool.jobs.map(job => {
      const scored = pool.candidates
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
          return { candidate: c, fitScore, warmthScore, tier };
        })
        .filter(r => r.tier !== null)
        .sort((a, b) => (b.fitScore - a.fitScore) || (b.warmthScore - a.warmthScore));

      const top3 = scored.slice(0, 3);
      const counts = scored.reduce(
        (acc, r) => {
          if (r.tier === "call_this_week") acc.call++;
          else if (r.tier === "direct_outreach") acc.direct++;
          else if (r.tier === "nurture") acc.nurture++;
          return acc;
        },
        { call: 0, direct: 0, nurture: 0 }
      );

      return { job, top3, counts, total: scored.length };
    });
  }, [pool, fitWeights, warmthWeights, tiers, isBlacklisted, isOverridden]);

  if (loading) return <main className="p-8 text-mute text-sm">Loading pipeline…</main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;

  const admitted = pool.candidates.filter(c => c.gate.decision === "ADMIT").length;
  const totalShortlisted = jobSummaries.reduce((s, j) => s + j.total, 0);
  const totalCall = jobSummaries.reduce((s, j) => s + j.counts.call, 0);

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-8">
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-red-950 text-stone-100 p-8 md:p-10 overflow-hidden relative shadow-lg">
        {/* Warm ambient glow — top-right amber wash simulating studio light */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 pointer-events-none blur-3xl" style={{
          background: "radial-gradient(circle, rgba(217,119,6,0.6) 0%, transparent 70%)",
        }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
          backgroundSize: "50px 50px, 70px 70px",
        }} />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-red-400/90 mb-3">
              WSC Talent Intelligence · Take-home 2026
            </div>
            <h1 className="text-3xl md:text-[42px] font-semibold display-tight leading-[1.05] mb-3 text-white">
              Turn your best channels into <span className="font-serif italic text-red-300">the shortlist</span> for every open role.
            </h1>
            <p className="text-sm md:text-[15px] text-stone-300 leading-relaxed max-w-2xl mb-5">
              One pipeline, three channels — conferences, employee referrals, and inbound CVs.
              For each role you open, we rank the pool on <em className="text-white not-italic font-medium">fit</em> and{" "}
              <em className="text-white not-italic font-medium">warmth</em> — and name the WSC
              employee best placed to make the intro.
            </p>
            <Link
              href="/jobs/JOB001/"
              className="inline-flex items-center gap-2 bg-red-600 text-white hover:bg-red-500 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-md transition-colors"
            >
              <Icon name="play" className="w-4 h-4" strokeWidth={2.5} />
              Open the demo shortlist — JOB001 · Senior ML Engineer
              <Icon name="arrow-right" className="w-4 h-4" strokeWidth={2.5} />
            </Link>
          </div>
          <div className="flex items-center gap-5 md:gap-8 flex-shrink-0 stagger">
            <HeroMetric n={pool.candidates.length}     label="in the pool" />
            <HeroMetric n={pool.jobs.length}           label="open roles" accent />
            <HeroMetric n={totalCall}                  label="call this week" />
          </div>
        </div>
      </section>

      <StatsBar stats={[
        { label: "Open roles",       value: pool.jobs.length,       sub: "hiring right now", iconName: "briefcase" },
        { label: "In the pool",      value: admitted,               sub: `${pool.candidates.length - admitted} filtered out`, iconName: "users" },
        { label: "Total shortlist",  value: totalShortlisted,       sub: "across all roles", iconName: "list", accent: true },
        { label: "Call this week",   value: totalCall,              sub: "warm intro + strong fit", iconName: "trending-up" },
      ]} />

      {(blacklist.length > 0 || overrides.length > 0) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <Icon name="alert" className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <span className="font-medium">Human-in-the-loop overrides active:</span>{" "}
            {blacklist.length > 0 && <span>{blacklist.length} blacklisted</span>}
            {blacklist.length > 0 && overrides.length > 0 && " · "}
            {overrides.length > 0 && <span>{overrides.length} per-role overrides</span>}
            . These candidates are hidden from shortlists below.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {jobSummaries.map(({ job, top3, counts, total }) => {
          const isDemo = job.job_id === "JOB001";
          return (
          <Link
            key={job.job_id}
            href={`/jobs/${job.job_id}/`}
            className={`card card-interactive p-6 group relative ${
              isDemo
                ? "border-2 border-red-500 bg-gradient-to-br from-red-50/40 to-white ring-1 ring-red-100 hover:border-red-600"
                : ""
            }`}
          >
            {isDemo && (
              <span className="absolute -top-2 left-5 inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wider rounded-sm px-2.5 py-0.5 shadow-sm">
                <Icon name="sparkles" className="w-3 h-3" strokeWidth={2.75} />
                Required demo
              </span>
            )}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-mono ${isDemo ? "text-red-700 font-semibold" : "text-mute"}`}>{job.job_id}</span>
                  <span className="text-[11px] text-mute">·</span>
                  <span className="text-[11px] text-mute">{job.department}</span>
                  <span className="text-[11px] text-mute">·</span>
                  <span className="text-[11px] text-mute">{job.seniority}</span>
                </div>
                <h3 className={`text-lg font-semibold transition-colors ${isDemo ? "text-stone-900 group-hover:text-red-800" : "text-text group-hover:text-red-700"}`}>
                  {job.title}
                </h3>
              </div>
              <span className="text-[10px] text-mute uppercase tracking-wider flex-shrink-0 flex items-center gap-1 group-hover:text-accent">
                Open <Icon name="arrow-right" className="w-3 h-3" />
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {job.required_skills.slice(0, 5).map(s => (
                <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                  {s.replace(/\*$/, "")}
                </span>
              ))}
              {job.required_skills.length > 5 && (
                <span className="text-[11px] text-mute">+{job.required_skills.length - 5}</span>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border-faint">
              <TierPill label="Call" count={counts.call} colour="bg-emerald-600" />
              <TierPill label="Outreach" count={counts.direct} colour="bg-red-600" />
              <TierPill label="Nurture" count={counts.nurture} colour="bg-stone-400" />
              <div className="ml-auto text-right">
                <div className="text-lg font-semibold text-text tabular">{total}</div>
                <div className="text-[10px] text-mute uppercase tracking-wider">shortlisted</div>
              </div>
            </div>

            <div className="text-[10px] text-mute uppercase tracking-wider mb-2">Top matches</div>
            {top3.length === 0 ? (
              <div className="text-sm text-mute italic">No matches at current thresholds</div>
            ) : (
              <ul className="space-y-1.5">
                {top3.map((r, i) => (
                  <li key={r.candidate.id} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-mute w-4 tabular">{i + 1}</span>
                    <Avatar name={r.candidate.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text truncate font-medium">{r.candidate.name}</div>
                      <div className="text-[11px] text-mute truncate">{r.candidate.title}</div>
                    </div>
                    <ScoreBadge value={r.fitScore} label="fit" size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Link>
        );
        })}
      </div>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <ShortcutCard
          title="Capture a lead"
          description="Just met someone at a conference? Add them to the pool."
          href="/capture/"
          icon="plus"
        />
        <ShortcutCard
          title="Employee referral"
          description="Refer someone you'd vouch for and let the model score them."
          href="/referrals/"
          icon="message"
        />
        <ShortcutCard
          title="Introductions"
          description="See which WSC employee can warm-intro each candidate."
          href="/intros/"
          icon="link"
        />
      </section>
    </main>
  );
}

function HeroMetric({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-3xl md:text-4xl font-semibold tabular font-mono leading-none ${
        accent ? "text-red-400" : "text-white"
      }`}>
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-1.5 font-medium">
        {label}
      </div>
    </div>
  );
}

function TierPill({ label, count, colour }: { label: string; count: number; colour: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${colour}`} />
      <div>
        <div className="text-sm font-semibold text-text tabular leading-none">{count}</div>
        <div className="text-[10px] text-mute uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function ShortcutCard({
  title, description, href, icon,
}: {
  title: string; description: string; href: string; icon: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <Link href={href} className="card card-interactive p-4 group flex items-start gap-3">
      <div className="w-9 h-9 rounded-md bg-amber-50 text-red-700 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100">
        <Icon name={icon} className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text group-hover:text-red-700 transition-colors">{title}</div>
        <div className="text-xs text-mute mt-0.5">{description}</div>
      </div>
    </Link>
  );
}
