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
            <ScoreBar label="Warmth" value={warmthScore} tone="good" />
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

/* Compact fit visualization — 5 mini component bars stacked horizontally.
   Each bar's fill height = raw score (0-1); the width is proportional to the
   component's weight so you can eyeball "who's carrying this score." */
function FitBreakdownMiniBars({
  components, total,
}: {
  components: FitForJob["components"];
  total: number;
}) {
  const parts: Array<{ key: string; label: string; short: string; raw: number; weight: number; color: string }> = [
    { key: "required_skills", label: "Required skills · weight 35",  short: "skills",  raw: components.required_skills, weight: 35, color: "bg-emerald-500" },
    { key: "role_family",     label: "Role family match · weight 25", short: "family",  raw: components.role_family,     weight: 25, color: "bg-emerald-600" },
    { key: "seniority",       label: "Seniority band · weight 15",    short: "senior",  raw: components.seniority,       weight: 15, color: "bg-teal-500" },
    { key: "domain",          label: "Sports/media domain · weight 15", short: "domain",  raw: components.domain,        weight: 15, color: "bg-teal-600" },
    { key: "nice_to_have",    label: "Nice-to-have · weight 10",      short: "nice",    raw: components.nice_to_have,    weight: 10, color: "bg-cyan-500" },
  ];
  const maxRaw = 1.0;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-mute font-semibold">Fit breakdown</span>
        <span className="text-[10px] text-mute">
          weighted total <span className="text-text font-mono font-semibold tabular">{total.toFixed(1)}</span>
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-12" role="img" aria-label={`Fit score ${total.toFixed(1)} across 5 components`}>
        {parts.map(p => {
          const heightPct = (p.raw / maxRaw) * 100;
          const contribution = p.raw * p.weight;
          return (
            <div
              key={p.key}
              className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group cursor-help"
              title={`${p.label}\nraw: ${(p.raw * 100).toFixed(0)}%\ncontribution: ${contribution.toFixed(1)} of ${p.weight}`}
              style={{ flexGrow: p.weight }}
            >
              <div className="w-full h-full relative bg-stone-100 rounded-sm overflow-hidden">
                <div
                  className={`absolute bottom-0 left-0 right-0 ${p.color} rounded-sm transition-all group-hover:brightness-110`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                />
              </div>
              <div className="mt-1 text-[9px] text-mute leading-none uppercase tracking-wider">
                {p.short}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
