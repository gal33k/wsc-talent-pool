"use client";

import type { Candidate, Job } from "@/lib/types";
import { usePool } from "@/lib/data";
import { computeFit, computeWarmth } from "@/lib/scoring";
import { ComponentBar } from "./ScoreBar";
import { Chip } from "./Chip";
import Avatar from "./Avatar";
import { Icon } from "./Icon";
import CandidateActions from "./CandidateActions";
import { useEffect, useState } from "react";

export default function CandidateDetail({
  candidate, job, onClose,
}: { candidate: Candidate; job: Job; onClose: () => void }) {
  const { fitWeights, warmthWeights } = usePool();
  const fit = candidate.jobs[job.job_id];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!fit) return null;
  const fitScore = computeFit(fit.components, fitWeights);
  const warmthScore = computeWarmth(candidate.warmth.components, warmthWeights);
  const maxFitWeight = Math.max(...Object.values(fitWeights)) || 40;
  const maxWarmthWeight = Math.max(...Object.values(warmthWeights)) || 40;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-modal z-50 flex justify-end fade-in"
      role="presentation"
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-name"
        className="bg-white w-full max-w-[680px] h-full overflow-y-auto overscroll-contain shadow-2xl fade-up"
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-white border-b border-border z-10 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Avatar name={candidate.name} size="xl" />
              <div className="min-w-0">
                <h2 id="dossier-name" className="text-lg font-semibold text-text leading-tight">
                  {candidate.name}
                </h2>
                <div className="text-sm text-dim mt-0.5">{candidate.title}</div>
                <div className="text-xs text-mute mt-1 flex items-center gap-2 flex-wrap">
                  <span>{candidate.company}</span>
                  {candidate.location && (<><span className="text-faint">·</span><span>{candidate.location}</span></>)}
                  {candidate.years_experience && (<><span className="text-faint">·</span><span>{candidate.years_experience} yrs</span></>)}
                </div>
                <div className="text-[11px] text-mute mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                    {candidate.role_family}
                  </span>
                  <span className="text-faint">·</span>
                  <span translate="no">{candidate.linkedin_url?.replace("linkedin.com/in/", "")}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-mute hover:text-text hover:bg-slate-100 w-8 h-8 rounded-md flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Icon name="close" className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Score header */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">Fit</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl font-bold text-indigo-900 tabular">{fitScore.toFixed(1)}</div>
                <div className="text-xs text-indigo-700/70">/ 100</div>
              </div>
              <div className="text-[11px] text-indigo-700/70 mt-0.5">competence for {job.title}</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Warmth</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl font-bold text-emerald-900 tabular">{warmthScore.toFixed(1)}</div>
                <div className="text-xs text-emerald-700/70">/ 100</div>
              </div>
              <div className="text-[11px] text-emerald-700/70 mt-0.5">reachability index</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-7">
          <CandidateActions candidateId={candidate.id} jobId={job.job_id} jobTitle={job.title} />

          <Section title="Fit breakdown" sub="5 components, weight-independent">
            <div className="rounded-lg border border-border bg-white p-4">
              <ComponentBar label="Required skills" value={fit.components.required_skills} weight={fitWeights.required_skills} weightMax={maxFitWeight} />
              <ComponentBar label="Role family"     value={fit.components.role_family}     weight={fitWeights.role_family}     weightMax={maxFitWeight} />
              <ComponentBar label="Seniority"       value={fit.components.seniority}       weight={fitWeights.seniority}       weightMax={maxFitWeight} />
              <ComponentBar label="Domain"          value={fit.components.domain}          weight={fitWeights.domain}          weightMax={maxFitWeight} />
              <ComponentBar label="Nice-to-have"    value={fit.components.nice_to_have}    weight={fitWeights.nice_to_have}    weightMax={maxFitWeight} />
            </div>
          </Section>

          <Section title="Warmth breakdown" sub="4 components">
            <div className="rounded-lg border border-border bg-white p-4">
              <ComponentBar label="Mutual connections" value={candidate.warmth.components.mutual_connections} weight={warmthWeights.mutual_connections} weightMax={maxWarmthWeight} />
              <ComponentBar label="Shared employer"    value={candidate.warmth.components.shared_employer}    weight={warmthWeights.shared_employer}    weightMax={maxWarmthWeight} />
              <ComponentBar label="Recency"            value={candidate.warmth.components.recency}            weight={warmthWeights.recency}            weightMax={maxWarmthWeight} />
              <ComponentBar label="Notes present"      value={candidate.warmth.components.notes_present}      weight={warmthWeights.notes_present}      weightMax={maxWarmthWeight} />
            </div>
          </Section>

          <Section title="Required skills">
            <div className="flex flex-wrap gap-1.5">
              {fit.matched_required.map(s => <Chip key={s} variant="success">✓ {s}</Chip>)}
              {fit.matched_required_family.map(s => <Chip key={s + "f"} variant="family">~ {s} (family)</Chip>)}
              {fit.missing_required.map(s => <Chip key={s + "x"} variant="outlined">✗ {s}</Chip>)}
            </div>
            {fit.matched_nice_to_have.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] text-mute mb-1.5">Nice-to-have matches</div>
                <div className="flex flex-wrap gap-1.5">
                  {fit.matched_nice_to_have.map(s => <Chip key={s} variant="info">{s}</Chip>)}
                </div>
              </div>
            )}
          </Section>

          {(candidate.warmth.shared_employers.length > 0 || candidate.warmth.mutuals.length > 0) && (
            <Section title="Warm paths">
              <div className="space-y-2">
                {candidate.warmth.shared_employers.map((s, i) => (
                  <div key={"s" + i} className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <Avatar name={s.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text font-medium">{s.name}</div>
                      <div className="text-xs text-mute">{s.title} · {s.department}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-emerald-800 font-medium">{s.employer}</div>
                      {s.overlap && <div className="text-[11px] text-emerald-700/80">{s.overlap}</div>}
                    </div>
                  </div>
                ))}
                {candidate.warmth.mutuals.map((m, i) => (
                  <div key={"m" + i} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <Avatar name={m.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text font-medium">{m.name}</div>
                      <div className="text-xs text-mute">{m.title} · {m.department}</div>
                    </div>
                    <div className="text-[11px] text-mute">1st degree</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Pool admission audit">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ["Role family", candidate.gate.signals.role_family],
                ["Skills evidence", candidate.gate.signals.skills_evidence],
                ["Proximity", candidate.gate.signals.proximity],
              ].map(([label, ok]) => (
                <div key={label as string} className={`rounded-lg border px-3 py-2.5 ${ok ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/50"}`}>
                  <div className="text-[11px] text-mute font-medium">{label as string}</div>
                  <div className={`text-sm font-semibold mt-0.5 flex items-center gap-1.5 ${ok ? "text-emerald-700" : "text-slate-400"}`}>
                    <Icon name={ok ? "check" : "close"} className="w-3.5 h-3.5" strokeWidth={2.5} />
                    {ok ? "Pass" : "Fail"}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-mute font-mono bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
              {candidate.gate.reason}
            </div>
          </Section>

          <Section title="Origin">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-text">{candidate.conference.name}</div>
                  <div className="text-xs text-mute mt-0.5">{candidate.conference.date} · {candidate.conference.domain}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-text tabular">{candidate.conference.days_since}</div>
                  <div className="text-[10px] text-mute uppercase tracking-wider">days ago</div>
                </div>
              </div>
              {candidate.notes && (
                <div className="mt-3 pl-3 border-l-2 border-indigo-200 text-sm text-dim italic">
                  &ldquo;{candidate.notes}&rdquo;
                </div>
              )}
            </div>
          </Section>

          <Section title="Recruiter brief" sub="rendered by mock_narrator — production: single Claude call">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4 text-sm text-text leading-relaxed">
              {fit.why_summary}
            </div>
          </Section>

          <Section title="Outreach draft" actions={
            <button
              onClick={() => {
                navigator.clipboard?.writeText(fit.outreach_draft);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Icon name="copy" className="w-3.5 h-3.5" strokeWidth={2} />
              {copied ? "Copied" : "Copy"}
            </button>
          }>
            <div className="rounded-lg border border-border bg-white p-4 text-sm text-text leading-relaxed whitespace-pre-wrap">
              {fit.outreach_draft}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, sub, actions, children }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {sub && <div className="text-[11px] text-mute mt-0.5">{sub}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
