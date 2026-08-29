"use client";

import { useMemo, useState } from "react";
import { usePool } from "@/lib/data";
import { computeFit, computeWarmth, assignTier } from "@/lib/scoring";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";
import Avatar from "@/components/Avatar";

export default function Analytics() {
  const {
    pool, loading, error,
    fitWeights, warmthWeights, tiers,
    isBlacklisted, isOverridden,
    overrides, blacklist, notes,
    bqActivity,
  } = usePool();
  const [tab, setTab] = useState<"overview" | "conversion" | "quality" | "activity">("overview");

  const derived = useMemo(() => {
    if (!pool) return null;
    const admitted = pool.candidates.filter(c => c.gate.decision === "ADMIT").length;
    const hold = pool.candidates.filter(c => c.gate.decision === "HOLD").length;
    const rejected = pool.candidates.filter(c => c.gate.decision === "REJECT").length;

    // Admission rate by conference
    const byConf: Record<string, { total: number; admitted: number; rejected: number }> = {};
    pool.candidates.forEach(c => {
      const n = c.conference.name;
      byConf[n] ||= { total: 0, admitted: 0, rejected: 0 };
      byConf[n].total++;
      if (c.gate.decision === "ADMIT") byConf[n].admitted++;
      if (c.gate.decision === "REJECT") byConf[n].rejected++;
    });

    // Shortlist volume per job
    const jobs = pool.jobs.map(job => {
      const scored = pool.candidates
        .filter(c => c.jobs[job.job_id])
        .filter(c => !isBlacklisted(c.id))
        .filter(c => !isOverridden(c.id, job.job_id))
        .map(c => {
          const fit = c.jobs[job.job_id]!;
          const fitScore = computeFit(fit.components, fitWeights);
          const warmthScore = computeWarmth(c.warmth.components, warmthWeights);
          const tier = assignTier(fitScore, warmthScore, tiers);
          return { fitScore, warmthScore, tier };
        }).filter(r => r.tier !== null);
      return {
        job_id: job.job_id, title: job.title,
        total: scored.length,
        call: scored.filter(r => r.tier === "call_this_week").length,
        direct: scored.filter(r => r.tier === "direct_outreach").length,
        nurture: scored.filter(r => r.tier === "nurture").length,
        avgFit: scored.length ? scored.reduce((s, r) => s + r.fitScore, 0) / scored.length : 0,
      };
    });

    // Top connectors
    const connectorCounts: Record<string, { name: string; title: string; department: string; count: number; sharedEmployers: Set<string> }> = {};
    pool.candidates.forEach(c => {
      c.warmth.shared_employers.forEach(s => {
        connectorCounts[s.employee_id] ||= { name: s.name, title: s.title, department: s.department, count: 0, sharedEmployers: new Set() };
        connectorCounts[s.employee_id].count++;
        connectorCounts[s.employee_id].sharedEmployers.add(s.employer);
      });
      c.warmth.mutuals.forEach(m => {
        connectorCounts[m.employee_id] ||= { name: m.name, title: m.title, department: m.department, count: 0, sharedEmployers: new Set() };
        connectorCounts[m.employee_id].count++;
      });
    });
    const topConnectors = Object.values(connectorCounts).sort((a, b) => b.count - a.count).slice(0, 6);

    // Enrichment stats
    const enrichmentCalls = pool.call_log.filter(c => c.system === "enrichment");
    const cacheHits = enrichmentCalls.filter(c => c.result.includes("cache hit")).length;
    const creditsUsed = enrichmentCalls.filter(c => c.result.includes("credits")).length;

    // Family distribution
    const familyDist: Record<string, number> = {};
    pool.candidates.forEach(c => {
      familyDist[c.role_family] = (familyDist[c.role_family] || 0) + 1;
    });
    const families = Object.entries(familyDist).sort((a, b) => b[1] - a[1]);

    return {
      admitted, hold, rejected,
      byConf, jobs, topConnectors, cacheHits, creditsUsed,
      families,
      overrideRate: pool.candidates.length ? (overrides.length + blacklist.length) / pool.candidates.length : 0,
    };
  }, [pool, fitWeights, warmthWeights, tiers, isBlacklisted, isOverridden, overrides, blacklist]);

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading pipeline…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool || !derived) return <main className="p-6 md:p-8">No data.</main>;

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">BI dashboard · queried via mock BigQuery</div>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-text tracking-tight">Analytics</h1>
          <span className="text-xs text-mute font-mono">wsc.talent_pool.*</span>
        </div>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Pipeline KPIs and per-candidate analytical view. Every event in the pipeline (ingest,
          gate, score, HITL override) writes to the mocked BigQuery. Dashboard queries are shown as
          SQL on the Activity tab so you can see what production would run.
        </p>
      </header>

      <StatsBar stats={[
        { label: "Contacts scored",   value: pool.candidates.length,   sub: "total across conferences", iconName: "users" },
        { label: "Admitted to pool",  value: derived.admitted,          sub: `${(100 * derived.admitted / pool.candidates.length).toFixed(0)}% admission rate`, iconName: "check", accent: true },
        { label: "Enrichment credits", value: `${derived.creditsUsed}/500`, sub: `${derived.cacheHits} cache hits saved`, iconName: "database" },
        { label: "Overrides active",  value: overrides.length + blacklist.length, sub: `${notes.length} notes recorded`, iconName: "shield" },
      ]} />

      <nav className="flex gap-1 mb-5 border-b border-border">
        {[
          ["overview", "Overview"],
          ["conversion", "Pipeline conversion"],
          ["quality", "Match quality"],
          ["activity", "BigQuery activity"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as never)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-indigo-500 text-indigo-700"
                : "border-transparent text-mute hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Admission funnel">
            <FunnelBar label="Total contacts scored" value={pool.candidates.length} max={pool.candidates.length} colour="bg-slate-400" />
            <FunnelBar label="Admitted to pool"     value={derived.admitted}          max={pool.candidates.length} colour="bg-emerald-500" />
            <FunnelBar label="Held for review"      value={derived.hold}              max={pool.candidates.length} colour="bg-amber-500" />
            <FunnelBar label="Rejected with reason" value={derived.rejected}          max={pool.candidates.length} colour="bg-rose-500" />
          </Panel>

          <Panel title="Admission rate by conference">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-mute font-medium">
                <tr><th className="text-left py-1.5">Conference</th><th className="text-right">Admitted</th><th className="text-right">Total</th><th className="text-right">Rate</th></tr>
              </thead>
              <tbody>
                {Object.entries(derived.byConf).map(([name, s]) => (
                  <tr key={name} className="border-t border-border-faint">
                    <td className="py-2 text-text truncate max-w-[220px]">{name}</td>
                    <td className="py-2 text-right font-medium text-emerald-700 tabular">{s.admitted}</td>
                    <td className="py-2 text-right text-mute tabular">{s.total}</td>
                    <td className="py-2 text-right font-mono text-indigo-700">{Math.round(100 * s.admitted / s.total)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Role-family distribution in the pool">
            <div className="space-y-1.5">
              {derived.families.map(([fam, n]) => (
                <div key={fam} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-text w-40 truncate">{fam}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${fam === "not_talent" ? "bg-rose-400" : "bg-indigo-500"} rounded-full`}
                         style={{ width: `${(n / pool.candidates.length) * 100}%` }} />
                  </div>
                  <span className="text-mute tabular text-[11px] w-8 text-right">{n}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Top connectors — warm-intro leaderboard">
            <ul className="space-y-2">
              {derived.topConnectors.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-[11px] text-mute w-5 tabular">{i + 1}</span>
                  <Avatar name={c.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-text font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-mute truncate">{c.title} · {c.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-indigo-700 tabular">{c.count}</div>
                    <div className="text-[10px] text-mute uppercase tracking-wider">paths</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {tab === "conversion" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Shortlist size per role">
            <div className="space-y-2">
              {derived.jobs.map(j => (
                <div key={j.job_id} className="rounded-md border border-border-faint p-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="font-mono text-[11px] text-mute">{j.job_id}</span>
                      <span className="text-sm font-medium text-text ml-2">{j.title}</span>
                    </div>
                    <span className="text-lg font-semibold text-text tabular">{j.total}</span>
                  </div>
                  <div className="flex h-2 rounded overflow-hidden bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(j.call / Math.max(1, j.total)) * 100}%` }} title={`${j.call} call`} />
                    <div className="bg-indigo-500" style={{ width: `${(j.direct / Math.max(1, j.total)) * 100}%` }} title={`${j.direct} outreach`} />
                    <div className="bg-slate-400" style={{ width: `${(j.nurture / Math.max(1, j.total)) * 100}%` }} title={`${j.nurture} nurture`} />
                  </div>
                  <div className="flex gap-3 text-[11px] text-mute mt-1.5">
                    <span><span className="text-emerald-600">●</span> {j.call} call</span>
                    <span><span className="text-indigo-600">●</span> {j.direct} outreach</span>
                    <span><span className="text-slate-500">●</span> {j.nurture} nurture</span>
                    <span className="ml-auto">avg fit <span className="font-mono text-text">{j.avgFit.toFixed(1)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Enrichment cost efficiency">
            <div className="rounded-lg bg-slate-50 border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-mute font-medium mb-2">Clay credits</div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-semibold text-text tabular">{derived.creditsUsed}</span>
                <span className="text-sm text-mute">/ 500 budget</span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden border border-border-faint">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(derived.creditsUsed / 500) * 100}%` }} />
              </div>
              <div className="text-[11px] text-mute mt-2">
                {derived.cacheHits} additional lookups served from cache — that&rsquo;s ~{Math.round((derived.cacheHits / Math.max(1, derived.creditsUsed + derived.cacheHits)) * 100)}% waste avoided.
              </div>
            </div>
            <div className="mt-4 text-xs text-mute leading-relaxed">
              At scale, enrichment credit is the real cost line. Running the admission gate <em>before</em>
              enrichment (see /methodology) keeps the credit spend proportional to admissions rather than
              badge scans.
            </div>
          </Panel>
        </div>
      )}

      {tab === "quality" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Human-in-the-loop overrides">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <SmallStat label="Per-role overrides" value={overrides.length} />
              <SmallStat label="Blacklisted" value={blacklist.length} accent="rose" />
              <SmallStat label="Notes recorded" value={notes.length} accent="indigo" />
            </div>
            {overrides.length === 0 && blacklist.length === 0 && notes.length === 0 ? (
              <div className="text-xs text-mute italic">No recruiter actions this session yet.</div>
            ) : (
              <div className="text-[11px] text-mute">
                Every override is a labelled example the warmth/relevance model can learn from — see
                the &ldquo;Feedback loop&rdquo; item on /methodology.
              </div>
            )}
          </Panel>

          <Panel title="Signal axis breakdown across the pool">
            {(() => {
              const buckets = { zero: 0, one: 0, twoPlus: 0 };
              pool.candidates.forEach(c => {
                const n = c.warmth.mutuals.length + c.warmth.shared_employers.length;
                if (n === 0) buckets.zero++;
                else if (n === 1) buckets.one++;
                else buckets.twoPlus++;
              });
              const total = pool.candidates.length;
              return (
                <div className="space-y-2">
                  <BarRow label="0 warm paths"   value={buckets.zero}    total={total} colour="bg-slate-400" />
                  <BarRow label="1 warm path"    value={buckets.one}     total={total} colour="bg-indigo-500" />
                  <BarRow label="2+ warm paths"  value={buckets.twoPlus} total={total} colour="bg-emerald-500" />
                  <div className="text-[11px] text-mute mt-3">
                    Candidates with 0 warm paths (the &ldquo;zero-mutuals&rdquo; group) are the ones a
                    network-first model would miss. Our fit_score keeps them visible.
                  </div>
                </div>
              );
            })()}
          </Panel>
        </div>
      )}

      {tab === "activity" && (
        <Panel title={`BigQuery activity — ${bqActivity.length} events`}>
          <div className="text-xs text-mute mb-3">
            Every pipeline event writes to a mocked BigQuery dataset. Below is the exact SQL that
            would execute against <code>wsc.talent_pool.*</code>.
          </div>
          <ul className="space-y-2">
            {bqActivity.slice(0, 40).map((e, i) => (
              <li key={i} className="rounded-md border border-border-faint bg-slate-50 p-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-mono font-semibold ${
                      e.op === "INSERT" ? "text-emerald-700"
                    : e.op === "DELETE" ? "text-rose-700"
                    : e.op === "UPDATE" ? "text-amber-700"
                    : "text-indigo-700"
                    }`}>{e.op}</span>
                    <span className="text-xs font-mono text-text">{e.table}</span>
                    {e.rows !== undefined && <span className="text-[11px] text-mute">· {e.rows} row{e.rows === 1 ? "" : "s"}</span>}
                  </div>
                  <span className="text-[10px] text-faint font-mono">{e.ts.split("T")[1]?.slice(0, 8)}</span>
                </div>
                <pre className="text-[11px] font-mono text-dim overflow-x-auto whitespace-pre-wrap">{e.sql}</pre>
              </li>
            ))}
          </ul>
          {bqActivity.length === 0 && (
            <div className="text-xs text-mute italic">No activity this session yet — capture a lead or make an override to populate.</div>
          )}
        </Panel>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold text-text mb-4">{title}</h3>
      {children}
    </section>
  );
}

function FunnelBar({ label, value, max, colour }: { label: string; value: number; max: number; colour: string }) {
  const pct = (value / Math.max(1, max)) * 100;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-dim">{label}</span>
        <span className="font-mono font-medium text-text tabular">{value} <span className="text-mute">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`${colour} h-full rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BarRow({ label, value, total, colour }: { label: string; value: number; total: number; colour: string }) {
  const pct = (value / Math.max(1, total)) * 100;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-text w-32">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`${colour} h-full rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-mute tabular w-16 text-right">{value} <span className="text-faint">({pct.toFixed(0)}%)</span></span>
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: number; accent?: "rose" | "indigo" }) {
  const cls = accent === "rose"    ? "text-rose-700"
           : accent === "indigo"  ? "text-indigo-700"
           : "text-text";
  return (
    <div className="rounded-md border border-border-faint bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-mute font-medium mb-1">{label}</div>
      <div className={`text-2xl font-semibold tabular ${cls}`}>{value}</div>
    </div>
  );
}
