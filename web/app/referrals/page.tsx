"use client";

import { useState } from "react";
import { usePool } from "@/lib/data";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/Chip";
import EnrichmentReveal, { type EnrichmentPlayback } from "@/components/EnrichmentReveal";

type Submission = {
  id: string;
  ts: string;
  referrer: string;
  candidate: string;
  linkedinUrl: string;
  jobId: string;
  relationship: string;
};

export default function Referrals() {
  const { pool, loading, error, logBq } = usePool();
  const [referrer, setReferrer] = useState("");
  const [candidate, setCandidate] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [jobId, setJobId] = useState("JOB001");
  const [relationship, setRelationship] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [playback, setPlayback] = useState<EnrichmentPlayback | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-6 md:p-8">No data.</main>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!referrer) { setValidationError("Pick which WSC employee is referring."); return; }
    if (!candidate.trim()) { setValidationError("Enter the candidate's full name."); return; }
    if (!relationship.trim()) { setValidationError("Describe how you know them — it's what makes the referral useful."); return; }

    const referringEmployee = pool.employees.find(e => e.employee_id === referrer)!;
    const targetJob = pool.jobs.find(j => j.job_id === jobId)!;

    const sub: Submission = {
      id: `ref-${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      referrer,
      candidate: candidate.trim(),
      linkedinUrl: linkedinUrl.trim(),
      jobId,
      relationship: relationship.trim(),
    };
    setSubmissions([sub, ...submissions]);

    // Derive an enrichment playback from the referral. Because the referrer names
    // the role, we know target role and target family — that biases the scoring
    // toward that job, and the family/skills are inferred from it.
    const roleFamily = familyFromJob(targetJob.job_id);
    const skills = plausibleSkillsFor(roleFamily);

    // With a referral, we assume the referrer's knowledge is enough to admit —
    // set skills + family + proximity signals accordingly.
    const gateSignals = { role_family: true, skills_evidence: skills.length >= 3, proximity: true };
    const gateDecision: "ADMIT" | "HOLD" | "REJECT" = "ADMIT";
    const gateReason = `3/3 signals · referral admit path (vouched by ${referringEmployee.full_name})`;

    const jobs = pool.jobs.map(j => {
      const requiredCount = j.required_skills.length;
      const matched = j.required_skills.filter(rs => {
        const clean = rs.replace(/\*$/, "").toLowerCase();
        return skills.some(s => s.toLowerCase().includes(clean) || clean.includes(s.toLowerCase()));
      }).length;
      const familyMatch = j.job_id === jobId ? 1.0 : 0.35;
      // Add a vouched bonus that lifts the specific target role
      const vouchedBoost = j.job_id === jobId ? 12 : 0;
      const fitScore = Math.min(100,
        (matched / Math.max(1, requiredCount)) * 35 +
        familyMatch * 25 +
        15 + // seniority band assumed in
        15 + // proximity via referrer
        5    // nice-to-have baseline
        + vouchedBoost
      );
      const tier: "call_this_week" | "direct_outreach" | "nurture" | "excluded" =
        fitScore >= 70 ? "call_this_week"
      : fitScore >= 55 ? "direct_outreach"
      : fitScore >= 40 ? "nurture"
      : "excluded";
      return {
        jobId: j.job_id,
        jobTitle: j.title,
        matchedCount: matched,
        totalRequired: requiredCount,
        fitScore: Math.round(fitScore * 10) / 10,
        tier,
      };
    });

    const pb: EnrichmentPlayback = {
      candidateName: candidate.trim(),
      linkedinUrl: linkedinUrl.trim(),
      discoveredSkills: skills,
      roleFamily,
      gateSignals,
      gateDecision,
      gateReason,
      jobs,
      channel: "referral",
      referrer: {
        name: referringEmployee.full_name,
        role: `${referringEmployee.title} · ${referringEmployee.department}`,
      },
    };
    setPlayback(pb);

    logBq({
      op: "INSERT",
      table: "wsc.talent_pool.contacts",
      sql: `INSERT INTO wsc.talent_pool.contacts (source_channel, full_name, referred_by_employee_id, role_family, gate_decision, top_fit_job, top_fit_score)\nVALUES ('referral', '${candidate.trim()}', '${referrer}', '${roleFamily}', 'ADMIT', '${jobs.sort((a, b) => b.fitScore - a.fitScore)[0].jobId}', ${jobs[0].fitScore})`,
      rows: 1,
    });
  };

  const resetForm = () => {
    setPlayback(null);
    setCandidate("");
    setLinkedinUrl("");
    setRelationship("");
    setValidationError(null);
  };

  const referringEmployee = pool.employees.find(e => e.employee_id === referrer);
  const targetJob = pool.jobs.find(j => j.job_id === jobId);

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-medium text-mute mb-1">Referral capture · employee → candidate</div>
          <h1 className="text-2xl font-semibold text-text tracking-tight">Refer a candidate</h1>
          <p className="text-sm text-mute mt-1 max-w-2xl">
            A WSC employee vouches for someone. We enrich their LinkedIn (past employers, posts,
            publications, mutual connections) and score them across every open role — the referrer's
            vouch lifts the signal score for the target job.
          </p>
        </div>
      </header>

      <StatsBar stats={[
        { label: "Submissions this session", value: submissions.length, sub: "client-side mock", iconName: "message" },
        { label: "WSC employees who can refer", value: pool.employees.length, sub: "loaded from the roster",  iconName: "users" },
        { label: "Open positions",             value: pool.jobs.length,       sub: "target for each referral", iconName: "briefcase" },
        { label: "Channel share (forecast)",   value: "~35%",                 sub: "referrals convert highest",  iconName: "trending-up", accent: true },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="min-w-0">
          {!playback ? (
            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div>
                <label htmlFor="ref-employee" className="block text-sm font-medium text-text mb-1.5">
                  Referring employee <span className="text-red-600">*</span>
                </label>
                <select
                  id="ref-employee"
                  value={referrer}
                  onChange={e => setReferrer(e.target.value)}
                  aria-label="Referring employee"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                >
                  <option value="">— pick an employee —</option>
                  {pool.employees.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.full_name} · {e.title} · {e.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ref-name" className="block text-sm font-medium text-text mb-1.5">
                    Candidate name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="ref-name"
                    type="text"
                    value={candidate}
                    onChange={e => setCandidate(e.target.value)}
                    placeholder="e.g. Nadia Cohen"
                    autoComplete="name"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="ref-linkedin" className="block text-sm font-medium text-text mb-1.5">
                    LinkedIn URL <span className="text-mute text-xs font-normal">— optional</span>
                  </label>
                  <input
                    id="ref-linkedin"
                    type="url"
                    value={linkedinUrl}
                    onChange={e => setLinkedinUrl(e.target.value)}
                    placeholder="linkedin.com/in/…"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono focus:outline-none focus-visible:border-accent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ref-job" className="block text-sm font-medium text-text mb-1.5">
                  Target role <span className="text-red-600">*</span>
                </label>
                <select
                  id="ref-job"
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                  aria-label="Target role"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                >
                  {pool.jobs.map(j => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.job_id} · {j.title} · {j.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ref-relationship" className="block text-sm font-medium text-text mb-1.5">
                  How do you know them? <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="ref-relationship"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                  placeholder="Worked together at X 2019–21 on the video-analytics team. Strong on real-time systems, would be a fit for the ML platform work."
                  rows={4}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                />
                <div className="text-xs text-mute mt-1.5">
                  The relationship note is the referral's signal — it's what makes the outreach feel personal and honest.
                </div>
              </div>

              {validationError && (
                <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
                  <Icon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  {validationError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-xs text-mute">
                  {referringEmployee && targetJob ? (
                    <>Referring for <strong className="text-text">{targetJob.title}</strong> as <strong className="text-text">{referringEmployee.full_name}</strong></>
                  ) : (
                    <>Pick an employee and role to see a summary</>
                  )}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm"
                >
                  <Icon name="sparkles" className="w-4 h-4" strokeWidth={2} />
                  Enrich &amp; score
                </button>
              </div>
            </form>
          ) : (
            <EnrichmentReveal playback={playback} onDone={resetForm} />
          )}
        </div>

        <aside>
          <div className="card p-5 sticky top-4">
            <div className="text-xs uppercase tracking-wider text-mute font-medium mb-3">This session</div>
            {submissions.length === 0 ? (
              <div className="text-sm text-mute italic">No referrals submitted yet.</div>
            ) : (
              <ul className="divide-y divide-border-faint">
                {submissions.slice(0, 8).map(s => {
                  const emp = pool.employees.find(e => e.employee_id === s.referrer);
                  return (
                    <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <Avatar name={s.candidate} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text font-medium truncate">{s.candidate}</div>
                          <div className="text-xs text-mute truncate">
                            via {emp?.full_name.split(" ")[0] ?? "?"} · for {s.jobId}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <Chip variant="info" size="sm">source: referral</Chip>
                            <span className="text-[10px] text-faint font-mono">{s.ts.split("T")[1]?.slice(0, 5)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5 pt-4 border-t border-border text-xs text-mute space-y-1.5 leading-relaxed">
              <div className="font-medium text-dim">Why referrals score higher</div>
              <div>· Vouched-by-employee lifts the signal score by ~15 points on the target role.</div>
              <div>· Referrer becomes a first-degree warm-intro path automatically.</div>
              <div>· Enrichment still runs — we don't skip the LinkedIn pull just because someone vouched.</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ------- Lightweight helpers so the referral demo scores something plausible ------- */

function familyFromJob(jobId: string): string {
  return {
    JOB001: "ml_cv",
    JOB002: "backend",
    JOB003: "product",
    JOB004: "data_engineering",
  }[jobId] ?? "unknown";
}

function plausibleSkillsFor(family: string): string[] {
  return {
    ml_cv:           ["Python", "PyTorch", "Computer Vision", "Object Detection", "AWS", "Deep Learning"],
    backend:         ["Python", "Go", "Kafka", "AWS", "Microservices", "REST APIs", "PostgreSQL"],
    product:         ["Product Management", "Sports Analytics", "SQL", "Stakeholder Management"],
    data_engineering:["Python", "Spark", "dbt", "SQL", "AWS", "Airflow"],
  }[family] ?? ["Python", "AWS"];
}
