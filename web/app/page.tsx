"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePool, type SessionJob } from "@/lib/data";
import { computeFit, computeWarmth, assignTier, TIER_ORDER } from "@/lib/scoring";
import { Icon } from "@/components/Icon";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import ScoreBadge from "@/components/ScoreBadge";
import NewPositionModal, { type PoolMatch } from "@/components/NewPositionModal";

export default function JobsIndex() {
  const {
    pool, loading, error,
    fitWeights, warmthWeights, tiers,
    isBlacklisted, isOverridden, blacklist, overrides,
    sessionJobs, removeSessionJob,
  } = usePool();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [justOpened, setJustOpened] = useState<{ job: SessionJob; matches: PoolMatch[] } | null>(null);

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

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading pipeline…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-6 md:p-8">No data.</main>;

  const admitted = pool.candidates.filter(c => c.gate.decision === "ADMIT").length;
  const totalShortlisted = jobSummaries.reduce((s, j) => s + j.total, 0);
  const totalCall = jobSummaries.reduce((s, j) => s + j.counts.call, 0);

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-emerald-950 text-stone-100 p-8 md:p-10 overflow-hidden relative shadow-lg">
        {/* Warm ambient glow — top-right amber wash simulating studio light */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 pointer-events-none blur-3xl" style={{
          background: "radial-gradient(circle, rgba(21,128,61,0.5) 0%, transparent 70%)",
        }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
          backgroundSize: "50px 50px, 70px 70px",
        }} />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-300/90 mb-3">
              WSC Talent Intelligence · Take-home 2026
            </div>
            <h1 className="text-3xl md:text-[42px] font-semibold display-tight leading-[1.05] mb-3 text-white">
              Turn your best channels into <span className="font-serif italic text-emerald-300">the shortlist</span> for every open role.
            </h1>
            <p className="text-sm md:text-[15px] text-stone-300 leading-relaxed max-w-2xl mb-5">
              One pipeline, three channels — conferences, employee referrals, and inbound CVs.
              For each role you open, we rank the pool on <em className="text-white not-italic font-medium">fit</em> and{" "}
              <em className="text-white not-italic font-medium">signal</em> — and name the WSC
              employee best placed to make the intro.
            </p>
            <Link
              href="/jobs/JOB001/"
              className="inline-flex items-center gap-2 bg-emerald-700 text-white hover:bg-emerald-600 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-md transition-colors"
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
          <Icon name="alert" className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <span className="font-medium">Human-in-the-loop overrides active:</span>{" "}
            {blacklist.length > 0 && <span>{blacklist.length} blacklisted</span>}
            {blacklist.length > 0 && overrides.length > 0 && " · "}
            {overrides.length > 0 && <span>{overrides.length} per-role overrides</span>}
            . These candidates are hidden from shortlists below.
          </div>
        </div>
      )}

      {justOpened && (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3 fade-up">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <Icon name="check" className="w-4 h-4" strokeWidth={2.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">New role opened</span>
              <span className="text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 bg-emerald-700 text-white">session</span>
              <button
                onClick={() => { removeSessionJob(justOpened.job.job_id); setJustOpened(null); }}
                className="ml-auto text-[11px] text-emerald-800/70 hover:text-emerald-900 underline"
              >
                Undo
              </button>
            </div>
            <div className="text-base font-semibold text-emerald-950 mt-1">
              {justOpened.job.title}
              <span className="text-xs font-normal text-emerald-800/70 ml-2">
                · {justOpened.job.role_family} · {justOpened.job.required_skills.length} required skills
              </span>
            </div>
            {(() => {
              const strong = justOpened.matches.filter(m => m.score >= 0.8).length;
              const partial = justOpened.matches.filter(m => m.score >= 0.5 && m.score < 0.8).length;
              const weak = justOpened.matches.filter(m => m.score > 0 && m.score < 0.5).length;
              return (
                <div className="text-sm text-emerald-900 mt-1.5">
                  <span className="tabular font-semibold">{strong}</span> people match all required skills ·{" "}
                  <span className="tabular font-semibold">{partial}</span> match most ·{" "}
                  <span className="tabular font-semibold">{weak}</span> partial.
                </div>
              );
            })()}
            {justOpened.matches.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-emerald-200 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold mb-1">Top 5 in your pool</div>
                {justOpened.matches.slice(0, 5).map(m => (
                  <div key={m.candidate.id} className="w-full flex items-center gap-3 text-sm py-1">
                    <span className={`w-10 text-right tabular font-semibold text-xs ${
                      m.score >= 0.8 ? "text-emerald-800" : m.score >= 0.5 ? "text-amber-700" : "text-slate-600"
                    }`}>
                      {Math.round(m.score * 100)}%
                    </span>
                    <span className="text-emerald-950 font-medium min-w-0 truncate flex-1">{m.candidate.name}</span>
                    <span className="text-[11px] text-emerald-800/70 truncate max-w-[180px]">{m.candidate.title}</span>
                    {m.familyMatch && <span className="text-[10px] font-semibold text-emerald-700 flex-shrink-0">family ✓</span>}
                    <span className="text-[11px] text-emerald-800/70 tabular flex-shrink-0 w-16 text-right">
                      {m.matchedRequired.length}/{justOpened.job.required_skills.length} skills
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => router.push("/pool/")}
                className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-md hover:bg-emerald-800 font-medium inline-flex items-center gap-1"
              >
                See all matches in the pool <Icon name="arrow-right" className="w-3 h-3" strokeWidth={2.25} />
              </button>
              <button
                onClick={() => setJustOpened(null)}
                className="text-xs text-emerald-800/70 hover:text-emerald-900"
              >
                Dismiss
              </button>
              <span className="text-[11px] text-emerald-800/70 italic ml-auto">
                Full fit scores for this role will appear on the next pipeline run.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Open positions</h2>
          <p className="text-xs text-mute mt-0.5">
            {pool.jobs.length} pipeline roles
            {sessionJobs.length > 0 && <> · <span className="text-emerald-700 font-medium">{sessionJobs.length} session role{sessionJobs.length === 1 ? "" : "s"}</span></>}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-emerald-800 transition-colors shadow-sm"
          title="Open a new role and see who in the pool matches — no pipeline re-run"
        >
          <Icon name="plus" className="w-4 h-4" strokeWidth={2.5} />
          Open a new position
        </button>
      </div>

      {sessionJobs.length > 0 && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900 flex-wrap">
          <Icon name="briefcase" className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" strokeWidth={2.25} />
          <span className="font-medium">Session-added:</span>
          {sessionJobs.map(j => (
            <span key={j.job_id} className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-300 px-2 py-0.5 text-[11px]">
              {j.title}
              <span className="text-emerald-800/60">· {j.role_family}</span>
              <button
                onClick={() => removeSessionJob(j.job_id)}
                className="w-3.5 h-3.5 rounded-full hover:bg-emerald-100 flex items-center justify-center text-emerald-700"
                aria-label={`Remove ${j.title}`}
              >
                <Icon name="close" className="w-2 h-2" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <span className="text-emerald-800/60 italic ml-auto text-[11px]">
            Browser-only until the pipeline re-runs
          </span>
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
                ? "border-2 border-emerald-600 bg-gradient-to-br from-emerald-50/40 to-white ring-1 ring-emerald-100 hover:border-emerald-700"
                : ""
            }`}
          >
            {isDemo && (
              <span className="absolute -top-2 left-5 inline-flex items-center gap-1 bg-emerald-700 text-white text-[10px] font-semibold uppercase tracking-wider rounded-sm px-2.5 py-0.5 shadow-sm">
                <Icon name="sparkles" className="w-3 h-3" strokeWidth={2.75} />
                Required demo
              </span>
            )}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-mono ${isDemo ? "text-emerald-700 font-semibold" : "text-mute"}`}>{job.job_id}</span>
                  <span className="text-[11px] text-mute">·</span>
                  <span className="text-[11px] text-mute">{job.department}</span>
                  <span className="text-[11px] text-mute">·</span>
                  <span className="text-[11px] text-mute">{job.seniority}</span>
                </div>
                <h3 className={`text-lg font-semibold transition-colors ${isDemo ? "text-stone-900 group-hover:text-emerald-800" : "text-text group-hover:text-emerald-700"}`}>
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
              <TierPill label="Outreach" count={counts.direct} colour="bg-emerald-700" />
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

      {modalOpen && (
        <NewPositionModal
          onClose={() => setModalOpen(false)}
          onOpened={(job, matches) => {
            setModalOpen(false);
            setJustOpened({ job, matches });
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </main>
  );
}

function HeroMetric({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-3xl md:text-4xl font-semibold tabular font-mono leading-none ${
        accent ? "text-emerald-300" : "text-white"
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
      <div className="w-9 h-9 rounded-md bg-amber-50 text-emerald-700 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100">
        <Icon name={icon} className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text group-hover:text-emerald-700 transition-colors">{title}</div>
        <div className="text-xs text-mute mt-0.5">{description}</div>
      </div>
    </Link>
  );
}
