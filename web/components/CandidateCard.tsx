"use client";

import type { Candidate, Job, FitForJob } from "@/lib/types";
import type { Tier } from "@/lib/scoring";
import { ScoreBar } from "./ScoreBar";
import { Chip } from "./Chip";
import Avatar from "./Avatar";
import { Icon } from "./Icon";
import { TIER_STYLES } from "./TierBadge";
import { usePool } from "@/lib/data";

export default function CandidateCard({
  candidate, job, fit, warmthScore, rank, tier, onOpen,
}: {
  candidate: Candidate;
  job: Job;
  fit: FitForJob;
  warmthScore: number;
  rank: number;
  tier?: Exclude<Tier, null>;
  onOpen: () => void;
}) {
  const { getIntroRequest, requestIntro } = usePool();
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  // Pick the best intro path: prefer shared-employer overlap (verifiable), fall back
  // to a first-degree mutual. Both carry an employee_id we can DM.
  const introSource =
    candidate.warmth.shared_employers?.[0] ??
    candidate.warmth.mutuals?.[0] ??
    null;
  const introSourceKind = candidate.warmth.shared_employers?.[0] ? "employer" : "mutual";
  const existingIntro = introSource ? getIntroRequest(candidate.id, job.job_id) : undefined;
  const flags: React.ReactNode[] = [];
  const missingCritical = fit.missing_critical || [];
  if (missingCritical.length > 0) {
    flags.push(
      <Chip key="mc" variant="flag">
        missing critical: {missingCritical.join(", ")}
      </Chip>
    );
  }
  if (fit.seniority_flag === "above_band") flags.push(<Chip key="ab" variant="flag">above band</Chip>);
  if (fit.seniority_flag === "below_band") flags.push(<Chip key="bb" variant="flag">below band</Chip>);
  if (candidate.data_confidence === "low") flags.push(<Chip key="lc" variant="flag">low confidence</Chip>);
  if (candidate.comeet_status?.status === "previously_rejected")
    flags.push(
      <span
        key="pr"
        title={`Rejected for ${candidate.comeet_status.role} in Comeet — a different role. A rejection for another role isn't a rejection for this one; shown here so you know the history.`}
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 cursor-help"
      >
        prev. rejected · {candidate.comeet_status.role}
      </span>
    );
  if (candidate.comeet_status?.status === "declined_offer")
    flags.push(
      <span
        key="do"
        title="Declined our previous offer. Warm intelligence — not disqualifying, but factor into outreach language."
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 cursor-help"
      >
        declined offer
      </span>
    );

  return (
    <article
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Open dossier for ${candidate.name}`}
      className="card card-interactive p-5 fade-up group"
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <Avatar name={candidate.name} size="lg" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
            {rank}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text truncate">{candidate.name}</h3>
              <div className="text-sm text-dim truncate mt-0.5">
                {candidate.title} <span className="text-faint">·</span> {candidate.company}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {tierStyle && (
                <span className={`inline-flex items-center rounded-full font-medium border text-[10px] px-2 py-0.5 ${tierStyle.cls}`}>
                  {tierStyle.label}
                </span>
              )}
              <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 whitespace-nowrap">
                View dossier <Icon name="arrow-right" className="w-3 h-3" strokeWidth={2.5} />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs text-mute mt-1.5">
            {candidate.location && <span>{candidate.location}</span>}
            {candidate.years_experience && (
              <>
                {candidate.location && <span className="text-faint">·</span>}
                <span>{candidate.years_experience} yrs</span>
              </>
            )}
            <span className="text-faint">·</span>
            <span title="Source channel" className="inline-flex items-center gap-1 text-[10px] rounded bg-slate-100 px-1.5 py-0.5 uppercase tracking-wider font-medium text-slate-600">
              Conference
            </span>
            <span className="truncate">{candidate.conference.name}</span>
          </div>

          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">{flags}</div>
          )}

          <div className="flex gap-6 mt-4">
            <ScoreBar label="Fit" value={fit.score_default} tone="accent" />
            <ScoreBar label="Signal" value={warmthScore} tone="good" />
          </div>

          {/* Score visualization — 5 mini component bars showing raw score
              contribution to the final fit. Height = raw component × weight. */}
          <FitBreakdownMiniBars components={fit.components} total={fit.score_default} />

          <div className="flex flex-wrap gap-1.5 mt-3">
            {fit.matched_required.map(s => <Chip key={"m" + s} variant="success">{s}</Chip>)}
            {fit.matched_required_family.map(s => <Chip key={"f" + s} variant="family">{s} · family</Chip>)}
            {fit.missing_required.map(s => (
              <Chip key={"x" + s} variant={missingCritical.includes(s) ? "flag" : "outlined"}>
                {missingCritical.includes(s) ? "✗ " : ""}{s}
              </Chip>
            ))}
          </div>

          {introSource ? (
            <div className="mt-3 flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-1 flex-shrink-0">Intro</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-emerald-900 font-medium">
                  {introSource.name}
                  <span className="text-emerald-800/70 font-normal ml-1.5">
                    · {"employer" in introSource ? `worked at ${introSource.employer}` : "first-degree connection"}
                    {introSourceKind === "employer" && (introSource as { overlap?: string }).overlap ? ` (${(introSource as { overlap?: string }).overlap})` : ""}
                  </span>
                </div>
                {fit.best_intro_path && fit.best_intro_path !== introSource.name && (
                  <div className="text-[11px] text-emerald-800/70 mt-0.5 truncate">{fit.best_intro_path}</div>
                )}
              </div>
              {existingIntro ? (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1 flex-shrink-0 flex items-center gap-1 ${
                    existingIntro.status === "accepted" ? "bg-emerald-600 text-white"
                  : existingIntro.status === "declined" ? "bg-rose-100 text-rose-700"
                  : existingIntro.status === "sent"     ? "bg-indigo-100 text-indigo-700"
                  : "bg-amber-100 text-amber-800"
                  }`}
                  title={`Requested ${new Date(existingIntro.requestedAt).toLocaleString()}`}
                >
                  <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                  {existingIntro.status}
                </span>
              ) : (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    requestIntro({
                      candidateId:   candidate.id,
                      candidateName: candidate.name,
                      employeeId:    introSource.employee_id,
                      employeeName:  introSource.name,
                      jobId:         job.job_id,
                      jobTitle:      job.title,
                      path: introSourceKind === "employer"
                        ? `worked at ${(introSource as { employer: string; overlap?: string }).employer}${(introSource as { overlap?: string }).overlap ? " · " + (introSource as { overlap?: string }).overlap : ""}`
                        : "first-degree connection",
                    });
                  }}
                  className="text-xs bg-emerald-600 text-white font-medium px-3 py-1.5 rounded-md hover:bg-emerald-700 flex-shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm"
                  title={`Fire a Slack DM to ${introSource.name} asking to introduce ${candidate.name.split(" ")[0]} for ${job.job_id}`}
                >
                  <Icon name="message" className="w-3.5 h-3.5" strokeWidth={2.25} />
                  Ask {introSource.name.split(" ")[0]} to intro
                </button>
              )}
            </div>
          ) : fit.best_intro_path && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-mute mt-0.5 flex-shrink-0">Intro</span>
              <div className="text-sm text-dim flex-1 min-w-0">{fit.best_intro_path}</div>
            </div>
          )}

          {candidate.notes && (
            <div className="mt-2 text-xs text-mute italic pl-3 border-l-2 border-slate-200">
              &ldquo;{candidate.notes}&rdquo;
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* Fit breakdown — one horizontal bar of 100 units, divided into 5 segments
   by weight. Each segment is FILLED to `raw × weight` and left EMPTY for the
   shortfall. Missing points show as a stone-colored gap at the end. Reads
   like a progress bar built out of the 5 components — a recruiter can
   immediately see "family carrying, nice-to-have dragging." */
function FitBreakdownMiniBars({
  components, total,
}: {
  components: FitForJob["components"];
  total: number;
}) {
  const parts: Array<{ key: string; label: string; short: string; raw: number; weight: number; fill: string; empty: string }> = [
    { key: "required_skills", label: "Required skills",  short: "Skills",   raw: components.required_skills, weight: 35, fill: "bg-emerald-600", empty: "bg-emerald-100" },
    { key: "role_family",     label: "Role family",       short: "Family",   raw: components.role_family,     weight: 25, fill: "bg-emerald-700", empty: "bg-emerald-100" },
    { key: "seniority",       label: "Seniority band",    short: "Senior",   raw: components.seniority,       weight: 15, fill: "bg-teal-600",    empty: "bg-teal-100" },
    { key: "domain",          label: "Sports/media domain", short: "Domain", raw: components.domain,          weight: 15, fill: "bg-teal-700",    empty: "bg-teal-100" },
    { key: "nice_to_have",    label: "Nice-to-have",      short: "Nice",     raw: components.nice_to_have,    weight: 10, fill: "bg-cyan-600",    empty: "bg-cyan-100" },
  ];

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-mute font-semibold">
          Fit breakdown · what's carrying, what's dragging
        </span>
        <span className="text-[10px] text-mute">
          <span className="text-text font-mono font-semibold tabular">{total.toFixed(1)}</span> of 100
        </span>
      </div>

      {/* The 100-unit bar: 5 weighted segments with fill = raw × weight */}
      <div className="flex items-stretch h-2 rounded-sm overflow-hidden gap-px" role="img" aria-label={`Fit score ${total.toFixed(1)} across 5 components`}>
        {parts.map(p => (
          <div
            key={p.key}
            className="relative overflow-hidden"
            style={{ flexGrow: p.weight }}
            title={`${p.label} · weight ${p.weight} · raw ${(p.raw * 100).toFixed(0)}% · contributes ${(p.raw * p.weight).toFixed(1)}`}
          >
            <div className={`absolute inset-0 ${p.empty}`} />
            <div
              className={`absolute inset-y-0 left-0 ${p.fill}`}
              style={{ width: `${Math.min(100, p.raw * 100)}%` }}
            />
          </div>
        ))}
      </div>

      {/* Per-component readout — bigger numbers, weakest highlighted amber */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {parts.map(p => {
          const contribution = p.raw * p.weight;
          const isWeakest = p.raw < 0.5;
          return (
            <div
              key={p.key}
              className={`text-center rounded px-1 py-0.5 ${isWeakest ? "bg-amber-50" : ""}`}
              title={p.label}
            >
              <div className="text-[10px] text-mute uppercase tracking-wider leading-none">
                {p.short}
              </div>
              <div className={`text-[11px] font-mono font-semibold tabular mt-1 ${isWeakest ? "text-amber-800" : "text-text"}`}>
                {contribution.toFixed(0)}<span className="text-mute font-normal">/{p.weight}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
