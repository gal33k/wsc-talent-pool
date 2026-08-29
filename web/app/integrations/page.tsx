"use client";

import { useMemo, useState, Fragment } from "react";
import { usePool } from "@/lib/data";
import { Icon } from "@/components/Icon";
import StatsBar from "@/components/StatsBar";

const SYSTEM_LABELS: Record<string, string> = {
  badge_scan: "Cvent",
  enrichment: "Clay",
  salesnav:   "LinkedIn Sales Navigator",
  hubspot:    "HubSpot",
  comeet:     "Comeet",
  notifier:   "Slack",
  narrator:   "Claude",
  bigquery:   "BigQuery",
  referral:   "Referral form",
};

const SYSTEM_COLORS: Record<string, string> = {
  badge_scan: "bg-sky-100 text-sky-800",
  enrichment: "bg-fuchsia-100 text-fuchsia-800",
  salesnav:   "bg-blue-100 text-blue-800",
  hubspot:    "bg-orange-100 text-orange-800",
  comeet:     "bg-emerald-100 text-emerald-800",
  notifier:   "bg-indigo-100 text-indigo-800",
  narrator:   "bg-violet-100 text-violet-800",
  bigquery:   "bg-cyan-100 text-cyan-800",
  referral:   "bg-pink-100 text-pink-800",
};

const SYSTEM_ROLES: Record<string, { role: string; blurb: string; saves: string; endpoint: string; iconName: React.ComponentProps<typeof Icon>["name"] }> = {
  badge_scan: {
    role: "Where leads come from",
    blurb: "Post-event export of conference badge scans. Feeds the raw contact rows into ingest.",
    saves: "Captures 200+ leads per event without a recruiter typing a single business card. Replaces the manual data-entry job that used to eat ~4 hrs after every conference.",
    endpoint: "GET /events/{id}/attendees",
    iconName: "download",
  },
  enrichment: {
    role: "Enrichment orchestrator (waterfall)",
    blurb: "Clay is the pipeline that turns a name + LinkedIn URL into a structured profile — past employers, skills, recent posts, publications, mutual connections. Waterfalls through Apollo → PDL → Sales-Nav-backed data → GitHub in one request. Enterprise-grade, no scraping.",
    saves: "Turns a name + URL into structured evidence you can defend a shortlist with. Replaces the ~3 hrs/day recruiters spend hunting LinkedIn for context on lukewarm leads — and swaps a compliant orchestrator in for the scraper you'd otherwise be tempted to build.",
    endpoint: "POST https://api.clay.com/v1/enrichment/people",
    iconName: "search",
  },
  salesnav: {
    role: "Recruiter search + outreach layer",
    blurb: "LinkedIn Sales Navigator is where recruiters do targeted lead search (title/industry/company/geo), maintain saved lead lists, and send InMail to people we can't reach any other way. Feeds Clay with the connection graph and recent activity data.",
    saves: "Legitimate InMail delivery + real-time lead search on the LinkedIn graph — the tool recruiters would open anyway. Rather than paralleling it, our pipeline hooks in: saved leads sync into the pool, InMail sends fire from the /intros outreach queue.",
    endpoint: "Sales Nav API + partner InMail endpoints",
    iconName: "link",
  },
  hubspot: {
    role: "The contact bank",
    blurb: "The single source of truth for every candidate. Talent-pool properties are written back so recruiters see the same data across marketing tools.",
    saves: "One place holds everyone. Marketing sees talent-pool status; recruiters see marketing engagement. No dual data-entry, no 'which system is truth' argument.",
    endpoint: "PATCH /crm/v3/objects/contacts/{id}",
    iconName: "users",
  },
  comeet: {
    role: "Applicant tracking system",
    blurb: "Owns active hiring processes. We read status to dedupe and push shortlisted candidates as sourced.",
    saves: "Never re-approach a candidate already in-flight — that's the awkward call recruiters hate making. Also stops the same candidate from being sourced twice by two recruiters.",
    endpoint: "GET /candidates?email · POST /positions/{id}/candidates",
    iconName: "briefcase",
  },
  notifier: {
    role: "Recruiter's outbound channel",
    blurb: "DMs the WSC employee best placed to make a warm intro. Shows the request in Slack; recruiter confirms.",
    saves: "One click reaches the specific WSC employee who knows the candidate — instead of the recruiter guessing who might know whom, or asking in a channel.",
    endpoint: "POST /chat.postMessage",
    iconName: "message",
  },
  narrator: {
    role: "AI describer (never decider)",
    blurb: "Renders the why-summary and outreach draft from a structured evidence dict. In production this is a single Claude call over the same dict; in this build it's templated.",
    saves: "Cuts a first-touch outreach message from ~10 min of writing to ~30 sec of editing. Uses only the evidence the pipeline already computed — the LLM never invents facts.",
    endpoint: "single Claude API call over the evidence dict",
    iconName: "sparkles",
  },
  bigquery: {
    role: "Queryable pool + BI dashboard",
    blurb: "Every pipeline event, gate decision, score, and recruiter action lands here as a row.",
    saves: "Ask 'which of last quarter's events actually produced hires?' in SQL. No engineering ticket, no export-to-CSV round-trip, no waiting for a dashboard to be built.",
    endpoint: "INSERT INTO wsc.talent_pool.* · SELECT for /analytics",
    iconName: "database",
  },
  referral: {
    role: "Employee-submitted referrals",
    blurb: "Forward-referral capture form. Same scoring pipeline as conferences — only source_channel differs, plus a vouched-by-employee lift on warmth.",
    saves: "Structured referral capture with the vouched-lift baked in. No more Slack DMs a recruiter has to chase and copy-paste into HubSpot manually.",
    endpoint: "POST /forms/referrals/submissions",
    iconName: "plus",
  },
};

const METHOD_INK: Record<string, string> = {
  GET:    "text-emerald-600",
  POST:   "text-indigo-600",
  PATCH:  "text-amber-600",
  RENDER: "text-violet-600",
  DELETE: "text-rose-600",
};

export default function IntegrationsLog() {
  const { pool, loading, error } = usePool();
  const [systemFilter, setSystemFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!pool) return [];
    return systemFilter === "all"
      ? pool.call_log
      : pool.call_log.filter(c => c.system === systemFilter);
  }, [pool, systemFilter]);

  if (loading) return <main className="p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;

  const systems = Array.from(new Set(pool.call_log.map(c => c.system)));
  const bySys = systems.reduce((acc, s) => {
    acc[s] = pool.call_log.filter(c => c.system === s).length;
    return acc;
  }, {} as Record<string, number>);

  const enrichmentCalls = pool.call_log.filter(c => c.system === "enrichment");
  const cacheHits = enrichmentCalls.filter(c => c.result.includes("cache hit")).length;
  const totalCredits = enrichmentCalls.filter(c => c.result.includes("credits")).length;

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">Integrations · what each system does for the recruiter</div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Integrations</h1>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Eight systems, each doing one thing that a recruiter used to do by hand.
          Read the business value up top; the technical call log below is the same story in API form.
        </p>
      </header>

      <StatsBar stats={[
        { label: "Calls logged",   value: pool.call_log.length, sub: `across ${systems.length} systems`, iconName: "terminal" },
        { label: "Credits used",   value: totalCredits, sub: "of 500 budget", iconName: "database", accent: true },
        { label: "Cache hits",     value: cacheHits, sub: "zero-cost lookups", iconName: "gauge" },
        { label: "HubSpot writes", value: bySys.hubspot || 0, sub: "talent-pool patches", iconName: "check" },
      ]} />

      <div className="rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-sm p-3.5 mb-5 flex items-start gap-3">
        <Icon name="info" className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
        <div>
          Every arrow crossing a real system boundary is fronted by an adapter with a mock and a documented real counterpart.
          Swapping to production is a one-file change per integration.
        </div>
      </div>

      {/* Business-level system view — leads with what each system saves the recruiter. */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">What each system does for the recruiter</h2>
          <span className="text-xs text-mute">business value first · technical trace below</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {["enrichment", "salesnav", "badge_scan", "referral", "notifier", "narrator", "comeet", "hubspot", "bigquery"].map(sysKey => {
            const role = SYSTEM_ROLES[sysKey];
            const calls = bySys[sysKey] || 0;
            return (
              <div key={sysKey} className="card p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${SYSTEM_COLORS[sysKey]}`}>
                    <Icon name={role.iconName} className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold text-text">{SYSTEM_LABELS[sysKey]}</div>
                        <div className="text-[11px] font-medium text-indigo-700">{role.role}</div>
                      </div>
                      <span className="text-[10px] font-mono text-mute tabular">{calls} {calls === 1 ? "call" : "calls"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-emerald-50/60 border border-emerald-100 px-3 py-2.5 mb-3">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">What this saves you</div>
                  <div className="text-xs text-emerald-900 leading-relaxed">{role.saves}</div>
                </div>

                <div className="text-[11px] text-mute leading-relaxed mb-2">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-faint mr-1.5">How</span>
                  {role.blurb}
                </div>
                <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-border-faint truncate" title={role.endpoint}>
                  {role.endpoint}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-text">Technical call log</h2>
        <span className="text-xs text-mute">every request the production pipeline would issue</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-xs text-mute font-medium">Filter</span>
        <button
          onClick={() => setSystemFilter("all")}
          className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${
            systemFilter === "all"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-mute border-border hover:text-text"
          }`}
        >
          All · {pool.call_log.length}
        </button>
        {Object.entries(bySys).map(([s, n]) => (
          <button
            key={s}
            onClick={() => setSystemFilter(s)}
            className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${
              systemFilter === s
                ? "bg-slate-900 text-white border-slate-900"
                : `${SYSTEM_COLORS[s]} border-transparent hover:opacity-80`
            }`}
          >
            {SYSTEM_LABELS[s] || s} · {n}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-mute text-[11px] uppercase tracking-wider border-b border-border font-medium bg-slate-50/50">
              <tr>
                <th scope="col" className="text-left px-4 py-2.5">Time</th>
                <th scope="col" className="text-left px-4 py-2.5">System</th>
                <th scope="col" className="text-left px-4 py-2.5">Call</th>
                <th scope="col" className="text-left px-4 py-2.5">Result</th>
                <th scope="col" className="text-left px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isOpen = expanded === i;
                const timeOnly = c.ts.split("T")[1]?.replace("+00:00", "") || c.ts;
                return (
                  <Fragment key={i}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="border-t border-border-faint hover:bg-slate-50/60 cursor-pointer"
                    >
                      <td className="px-4 py-2 text-[11px] font-mono text-mute whitespace-nowrap">{timeOnly}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[11px] font-medium rounded px-2 py-0.5 ${SYSTEM_COLORS[c.system] || "bg-slate-100 text-slate-700"}`}>
                          {SYSTEM_LABELS[c.system] || c.system}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-dim">
                        <span className={`font-semibold mr-2 ${METHOD_INK[c.method] || "text-mute"}`}>{c.method}</span>
                        <span>{c.endpoint}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-mute">{c.result}</td>
                      <td className="px-4 py-2 text-mute">
                        {!!c.payload && (
                          <Icon name={isOpen ? "chevron-down" : "chevron-right"} className="w-3.5 h-3.5" />
                        )}
                      </td>
                    </tr>
                    {isOpen && Boolean(c.payload) ? (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wider text-mute font-medium mb-1.5">Payload</div>
                          <pre className="text-[11px] text-dim font-mono bg-white rounded border border-border-faint p-3 overflow-x-auto">
{JSON.stringify(c.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-mute py-8 italic">No calls for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
