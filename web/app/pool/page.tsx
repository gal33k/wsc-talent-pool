"use client";

import { useMemo, useState } from "react";
import { usePool, type SessionJob } from "@/lib/data";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";
import CandidateDetail from "@/components/CandidateDetail";
import NewPositionModal, { matchPool, type PoolMatch } from "@/components/NewPositionModal";
import { exportRows } from "@/lib/csv-export";
import { computeFit } from "@/lib/scoring";

// Convert the mathematical gate reason string into plain English.
// Uses the structured signals + role_family + a friendly family name map.
const FAMILY_LABEL: Record<string, string> = {
  ml_cv:            "computer-vision ML",
  ml_general:       "general ML",
  data_engineering: "data engineering",
  backend:          "backend engineering",
  frontend:         "frontend engineering",
  platform_devops:  "platform / DevOps",
  video_broadcast:  "video / broadcast",
  sales_engineering: "sales engineering",
  product:          "product management",
  content:          "content / editorial",
  not_talent:       "not an engineering role we hire for",
  unknown:          "an unrecognised title",
  leadership:       "leadership",
};

function friendlyGateReason(c: { gate: { decision: string; signals: { role_family: boolean; skills_evidence: boolean; proximity: boolean }; reason: string }; role_family: string }): string {
  const s = c.gate.signals;
  const familyLabel = FAMILY_LABEL[c.role_family] ?? c.role_family;

  if (c.gate.decision === "ADMIT") {
    const passed = [
      s.role_family ? `their title fits ${familyLabel}` : null,
      s.skills_evidence ? "their skills back that up" : null,
      s.proximity ? "they work in an adjacent industry" : null,
    ].filter(Boolean);
    if (passed.length === 3) return `Admitted — ${passed.join(", ")}.`;
    const missed = [
      !s.role_family ? "title didn't clearly fit a role we hire" : null,
      !s.skills_evidence ? "skills didn't back up the role type" : null,
      !s.proximity ? "not from an adjacent industry" : null,
    ].filter(Boolean);
    return `Admitted (2 of 3) — ${passed.join(" and ")}. Missed: ${missed.join(" and ")}.`;
  }

  if (c.gate.decision === "HOLD") {
    const only = s.role_family ? `title fits ${familyLabel}`
              : s.skills_evidence ? "skills suggest a fit"
              : s.proximity ? "works in an adjacent industry"
              : "one weak signal";
    return `Borderline (1 of 3) — ${only}. Worth a manual look.`;
  }

  // REJECT
  return `Not a fit — ${familyLabel}, skills don't confirm a role we hire, no adjacent industry.`;
}

const DECISION_STYLES: Record<string, string> = {
  ADMIT:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  HOLD:   "bg-amber-50 text-amber-800 border-amber-200",
  REJECT: "bg-rose-50 text-rose-700 border-rose-200",
};

const SOURCE_STYLES: Record<string, string> = {
  conference: "bg-sky-100 text-sky-800 border-sky-200",
  referral:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  cv_upload:  "bg-amber-100 text-amber-800 border-amber-200",
  sourced:    "bg-violet-100 text-violet-800 border-violet-200",
};

export default function TalentPoolAudit() {
  const { pool, loading, error, sessionCandidates, sessionJobs, removeSessionJob, getGateOverride, fitWeights } = usePool();
  const [conf, setConf] = useState("all");
  const [decision, setDecision] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  // "Only match open roles" — when on, filters the table to admits whose
  // role_family is one we're currently hiring for. Scales to any number of
  // open roles (it's still one chip) and updates automatically when jobs
  // open or close because it re-reads pool.jobs on every render.
  const [hiringOnly, setHiringOnly] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // The most recently opened session job — drives the emerald "just opened"
  // banner at the top of the table. Cleared when the user dismisses.
  const [justOpened, setJustOpened] = useState<{ job: SessionJob; matches: PoolMatch[] } | null>(null);

  // Effective gate = recruiter override wins over pipeline decision.
  const effectiveGate = (c: { id: string; gate: { decision: string } }) =>
    getGateOverride(c.id)?.newDecision ?? c.gate.decision;

  // Best-fit open role — for each admitted candidate, find the job with the
  // highest fit score across the currently open positions. This is what makes
  // the pool feel connected to the jobs view: a hiring manager can see "who
  // do we have that fits X?" without opening every dossier.
  const bestFitFor = (c: import("@/lib/types").Candidate): { jobId: string; jobTitle: string; score: number } | null => {
    if (!pool || !c.jobs) return null;
    let best: { jobId: string; jobTitle: string; score: number } | null = null;
    for (const [jobId, fit] of Object.entries(c.jobs)) {
      const job = pool.jobs.find(j => j.job_id === jobId);
      if (!job) continue;
      const score = computeFit(fit.components, fitWeights);
      if (!best || score > best.score) best = { jobId, jobTitle: job.title, score };
    }
    return best;
  };

  // Actively-hiring flag — is this candidate's role_family the same family
  // as any currently-open role? Different from best-fit (which is fit-driven
  // and always returns something for admits). This asks the simpler question
  // a recruiter cares about on Monday morning: "am I hiring for this family
  // *right now*?"
  const activelyHiringFor = (c: import("@/lib/types").Candidate): { job_id: string; title: string } | null => {
    if (!pool) return null;
    const match = pool.jobs.find(j => j.role_family === c.role_family);
    return match ? { job_id: match.job_id, title: match.title } : null;
  };

  const rows = useMemo(() => {
    if (!pool) return [];
    const ql = q.trim().toLowerCase();
    // Combined open-role families: baked-in pipeline jobs + session-added jobs.
    // This is what makes "same tree, refreshed" work — session jobs slot in
    // alongside the real ones without any extra plumbing.
    const openFamilies = new Set<string>([
      ...pool.jobs.map(j => j.role_family),
      ...sessionJobs.map(j => j.role_family),
    ]);
    // Session captures (from /capture, /referrals) appear at the top so a
    // recruiter can see what they just added.
    const merged = [...sessionCandidates, ...pool.candidates];
    return merged
      .filter(c => source === "all" || (source === "conference"))
      .filter(c => conf === "all" || c.conference.name === conf)
      .filter(c => decision === "all" || effectiveGate(c) === decision)
      .filter(c => !hiringOnly || (effectiveGate(c) === "ADMIT" && openFamilies.has(c.role_family)))
      .filter(c => !ql || c.name.toLowerCase().includes(ql) || c.company.toLowerCase().includes(ql) || (c.title || "").toLowerCase().includes(ql));
  }, [pool, sessionCandidates, sessionJobs, conf, decision, source, hiringOnly, q, getGateOverride]);

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading pool…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-6 md:p-8">No data.</main>;

  const conferences = Array.from(new Set(pool.candidates.map(c => c.conference.name)));
  const counts = pool.candidates.reduce((acc, c) => {
    const d = effectiveGate(c);
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  // Admitted candidates whose role_family matches at least one currently-open
  // role — includes session-added positions so the number reacts live when
  // the recruiter opens a new role from the modal.
  const activelyHiringFamilies = new Set<string>([
    ...pool.jobs.map(j => j.role_family),
    ...sessionJobs.map(j => j.role_family),
  ]);
  const activelyHiringCount = pool.candidates.filter(
    c => effectiveGate(c) === "ADMIT" && activelyHiringFamilies.has(c.role_family)
  ).length;

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-medium text-mute mb-1">Decision A · pool admission audit</div>
          <h1 className="text-2xl font-semibold text-text tracking-tight">Talent pool</h1>
          <p className="text-sm text-mute mt-1 max-w-2xl">
            Every one of the {pool.candidates.length} contacts, with the three signals that decided admission and the reason string.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-emerald-800 transition-colors shadow-sm flex-shrink-0"
          title="Open a new role and see who in the pool matches — no pipeline re-run"
        >
          <Icon name="plus" className="w-4 h-4" strokeWidth={2.5} />
          Open a new position
        </button>
      </header>

      {justOpened && (
        <div className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3 fade-up">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <Icon name="check" className="w-4 h-4" strokeWidth={2.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">New role opened</span>
              <span className="text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 bg-emerald-700 text-white">session</span>
              <button
                onClick={() => { removeSessionJob(justOpened.job.job_id); setJustOpened(null); if (hiringOnly) setHiringOnly(false); }}
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
                  <button
                    key={m.candidate.id}
                    onClick={() => setDetailId(m.candidate.id)}
                    className="w-full flex items-center gap-3 text-sm hover:bg-white/60 rounded px-1.5 py-1 -mx-1.5 transition-colors text-left"
                  >
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
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => { setHiringOnly(true); setJustOpened(null); }}
                className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-md hover:bg-emerald-800 font-medium"
              >
                Show all matches in the table
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

      {!justOpened && sessionJobs.length > 0 && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900 flex-wrap">
          <Icon name="briefcase" className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" strokeWidth={2.25} />
          <span className="font-medium">Session roles open:</span>
          {sessionJobs.map(j => (
            <span key={j.job_id} className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-300 px-2 py-0.5 text-[11px]">
              {j.title}
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
            Counted in &ldquo;Only match open roles&rdquo; below · cleared on browser reset.
          </span>
        </div>
      )}

      <StatsBar stats={[
        { label: "Total contacts", value: pool.candidates.length, sub: "across 4 conferences",  iconName: "users" },
        { label: "Admitted",       value: counts.ADMIT || 0,      sub: "in the talent pool",     iconName: "check", accent: true },
        { label: "Hold",           value: counts.HOLD || 0,       sub: "for human review",       iconName: "alert" },
        { label: "Rejected",       value: counts.REJECT || 0,     sub: "with reason recorded",   iconName: "filter" },
      ]} />

      {/* Source-channel breakdown + honest note about the seed */}
      <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 flex items-start gap-3">
        <Icon name="info" className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
        <div className="text-sm text-indigo-900 flex-1">
          <div className="mb-2">
            <strong>Sources in this pool:</strong>{" "}
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-sky-100 text-sky-800 border-sky-200 mx-1">
              conference · {pool.candidates.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 mx-1 opacity-60">
              referral · 0
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200 mx-1 opacity-60">
              CV upload · 0
            </span>
          </div>
          <div className="text-xs text-indigo-900/80 leading-relaxed">
            The seed pool is <strong>100% conference</strong> because the brief provides
            <code className="text-[11px]"> conference_attendees.csv</code> (75 rows) and no other
            channel data. Referrals and CV inbound are <strong>working adapters</strong> — submit via{" "}
            <a href="/referrals/" className="underline hover:no-underline">/referrals</a> to score
            a new referral end-to-end; the pipeline treats it identically apart from the vouched
            lift. Multi-channel is architectural + working per-channel; only the seed is single-channel.
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex gap-3 items-center flex-wrap bg-slate-50/50">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              aria-label="Search talent pool"
              placeholder="Search name, title, company…"
              type="search"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus-visible:border-accent placeholder:text-faint"
            />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-mute font-medium mr-1">Source</span>
            {(["all", "conference", "referral", "cv_upload"] as const).map(s => {
              const isDisabled = s === "referral" || s === "cv_upload";
              return (
                <button
                  key={s}
                  onClick={() => !isDisabled && setSource(s)}
                  disabled={isDisabled}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                    source === s
                      ? "bg-slate-900 text-white border-slate-900"
                      : isDisabled
                        ? "bg-slate-50 text-faint border-border-faint cursor-not-allowed"
                        : "bg-white text-mute border-border hover:text-text"
                  }`}
                  title={isDisabled ? "No seeded rows for this channel — submit via the corresponding form" : undefined}
                >
                  {s === "all" ? "All" : s === "cv_upload" ? "CV" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 items-center">
            <label htmlFor="conf-filter" className="text-xs text-mute font-medium">Conference</label>
            <select id="conf-filter" value={conf} onChange={e => setConf(e.target.value)}
                    aria-label="Filter by conference"
                    className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-white cursor-pointer">
              <option value="all">All</option>
              {conferences.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-1 items-center">
            {["all", "ADMIT", "HOLD", "REJECT"].map(d => (
              <button
                key={d}
                onClick={() => setDecision(d)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                  decision === d
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-mute border-border hover:text-text"
                }`}
              >
                {d === "all" ? "All" : d}
              </button>
            ))}
          </div>
          <button
            onClick={() => setHiringOnly(v => !v)}
            title={`Toggle: show only admits whose role family matches one of the ${pool.jobs.length} currently-open roles`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
              hiringOnly
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-emerald-800 border-emerald-300 hover:border-emerald-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hiringOnly ? "bg-white" : "bg-emerald-600"}`} />
            Only match open roles
            <span className={`text-[10px] tabular ${hiringOnly ? "text-white/80" : "text-emerald-700/70"}`}>
              ({activelyHiringCount})
            </span>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-mute tabular">{rows.length} of {pool.candidates.length}</span>
            <button
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                exportRows(
                  `wsc-talent-pool-${today}.csv`,
                  rows,
                  [
                    { label: "Name",          get: c => c.name },
                    { label: "Title",         get: c => c.title },
                    { label: "Company",       get: c => c.company },
                    { label: "Conference",    get: c => c.conference?.name },
                    { label: "Role family",   get: c => c.role_family },
                    { label: "Actively hiring",     get: c => activelyHiringFor(c)?.job_id ?? "" },
                    { label: "Top-match role",      get: c => bestFitFor(c)?.jobTitle ?? "" },
                    { label: "Top-match fit",       get: c => { const b = bestFitFor(c); return b ? b.score.toFixed(1) : ""; } },
                    { label: "Signal · family",     get: c => c.gate.signals.role_family ? "yes" : "" },
                    { label: "Signal · skills",     get: c => c.gate.signals.skills_evidence ? "yes" : "" },
                    { label: "Signal · proximity",  get: c => c.gate.signals.proximity ? "yes" : "" },
                    { label: "Decision",      get: c => effectiveGate(c) },
                    { label: "Pipeline decision", get: c => c.gate.decision },
                    { label: "Reason",        get: c => getGateOverride(c.id)?.reason ?? c.gate.reason },
                    { label: "LinkedIn",      get: c => c.linkedin_url },
                  ]
                );
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-white hover:border-accent hover:text-accent transition-colors"
              title="Download the current filtered view as CSV"
            >
              <Icon name="download" className="w-3.5 h-3.5" strokeWidth={2.25} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-mute text-[11px] uppercase tracking-wider border-b border-border font-medium">
              <tr>
                <th scope="col" className="text-left px-4 py-2.5">Name</th>
                <th scope="col" className="text-left px-4 py-2.5">Title · Company</th>
                <th scope="col" className="text-left px-4 py-2.5">Source</th>
                <th scope="col" className="text-left px-4 py-2.5">Family</th>
                <th scope="col" className="text-left px-4 py-2.5" title="Highest-scoring open role for this candidate">Top match</th>
                <th scope="col" className="text-center px-2 py-2.5" title="Role family">Fam</th>
                <th scope="col" className="text-center px-2 py-2.5" title="Skills">Skl</th>
                <th scope="col" className="text-center px-2 py-2.5" title="Proximity">Prox</th>
                <th scope="col" className="text-left px-4 py-2.5">Decision</th>
                <th scope="col" className="text-left px-4 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetailId(c.id)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(c.id); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open dossier for ${c.name}`}
                  className="border-t border-border-faint hover:bg-emerald-50/40 cursor-pointer transition-colors focus:outline-none focus-visible:bg-emerald-50/60"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="sm" />
                      <span className="text-text font-medium">{c.name}</span>
                      {("sessionOnly" in c && (c as { sessionOnly?: boolean }).sessionOnly) && (
                        <span className="text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 bg-emerald-600 text-white">
                          new
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-dim">{c.title}</div>
                    <div className="text-xs text-mute">{c.company}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full border px-2 py-0.5 ${SOURCE_STYLES.conference}`}>
                      conference
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] text-mute bg-slate-100 rounded px-1.5 py-0.5">{c.role_family}</span>
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    {(() => {
                      const best = bestFitFor(c);
                      if (!best) {
                        return <span className="text-[11px] text-mute italic">not scored</span>;
                      }
                      const strong = best.score >= 70;
                      return (
                        <a
                          href={`/jobs/${best.jobId}/`}
                          className="group inline-flex items-center gap-1.5 text-[11px] hover:underline"
                          title={`Open ${best.jobTitle} shortlist`}
                        >
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 tabular font-semibold ${
                            strong ? "bg-emerald-100 text-emerald-800" : best.score >= 45 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {best.score.toFixed(0)}
                          </span>
                          <span className="text-dim truncate max-w-[140px]">{best.jobTitle}</span>
                        </a>
                      );
                    })()}
                  </td>
                  {[c.gate.signals.role_family, c.gate.signals.skills_evidence, c.gate.signals.proximity].map((ok, j) => (
                    <td key={j} className="px-2 py-2.5 text-center">
                      {ok ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="inline-flex w-5 h-5 items-center justify-center text-slate-300">·</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    {(() => {
                      const eff = effectiveGate(c);
                      const overridden = eff !== c.gate.decision;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${DECISION_STYLES[eff]}`}
                          title={overridden ? `Pipeline: ${c.gate.decision} → recruiter override: ${eff}` : undefined}
                        >
                          {eff}
                          {overridden && <span className="text-[9px] opacity-70">·override</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-dim max-w-md" title={c.gate.reason}>
                    {friendlyGateReason(c)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-sm text-mute py-8 italic">
                    No candidates match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && (() => {
        const c = pool.candidates.find(x => x.id === detailId);
        if (!c) return null;
        // Use JOB001 (or first job) as the default dossier context — Talent Pool
        // is a job-agnostic view, so we just show a defensible per-job dossier.
        const job = pool.jobs.find(j => j.job_id === "JOB001") ?? pool.jobs[0];
        return <CandidateDetail candidate={c} job={job} onClose={() => setDetailId(null)} />;
      })()}

      {modalOpen && (
        <NewPositionModal
          onClose={() => setModalOpen(false)}
          onOpened={(job, matches) => {
            setModalOpen(false);
            setJustOpened({ job, matches });
            // Scroll to top of the page so the banner is visible.
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </main>
  );
}
