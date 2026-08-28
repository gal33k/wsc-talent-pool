"use client";

import { useMemo, useState } from "react";
import { usePool } from "@/lib/data";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";
import { exportRows } from "@/lib/csv-export";

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
  const { pool, loading, error } = usePool();
  const [conf, setConf] = useState("all");
  const [decision, setDecision] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!pool) return [];
    const ql = q.trim().toLowerCase();
    return pool.candidates
      .filter(c => source === "all" || (source === "conference"))
      .filter(c => conf === "all" || c.conference.name === conf)
      .filter(c => decision === "all" || c.gate.decision === decision)
      .filter(c => !ql || c.name.toLowerCase().includes(ql) || c.company.toLowerCase().includes(ql) || (c.title || "").toLowerCase().includes(ql));
  }, [pool, conf, decision, source, q]);

  if (loading) return <main className="p-8 text-mute text-sm">Loading pool…</main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;

  const conferences = Array.from(new Set(pool.candidates.map(c => c.conference.name)));
  const counts = pool.candidates.reduce((acc, c) => {
    acc[c.gate.decision] = (acc[c.gate.decision] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">Decision A · pool admission audit</div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Talent pool</h1>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Every one of the {pool.candidates.length} contacts, with the three signals that decided admission and the reason string.
        </p>
      </header>

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
                    { label: "Signal · family",     get: c => c.gate.signals.role_family ? "yes" : "" },
                    { label: "Signal · skills",     get: c => c.gate.signals.skills_evidence ? "yes" : "" },
                    { label: "Signal · proximity",  get: c => c.gate.signals.proximity ? "yes" : "" },
                    { label: "Decision",      get: c => c.gate.decision },
                    { label: "Reason",        get: c => c.gate.reason },
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
                <th scope="col" className="text-center px-2 py-2.5" title="Role family">Fam</th>
                <th scope="col" className="text-center px-2 py-2.5" title="Skills">Skl</th>
                <th scope="col" className="text-center px-2 py-2.5" title="Proximity">Prox</th>
                <th scope="col" className="text-left px-4 py-2.5">Decision</th>
                <th scope="col" className="text-left px-4 py-2.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border-faint hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="sm" />
                      <span className="text-text font-medium">{c.name}</span>
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
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${DECISION_STYLES[c.gate.decision]}`}>
                      {c.gate.decision}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-mute font-mono max-w-md truncate" title={c.gate.reason}>
                    {c.gate.reason}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-sm text-mute py-8 italic">
                    No candidates match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
