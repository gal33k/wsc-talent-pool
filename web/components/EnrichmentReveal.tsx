"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type EnrichmentJob = {
  jobId: string;
  jobTitle: string;
  matchedCount: number;
  totalRequired: number;
  fitScore: number;
  tier: "call_this_week" | "direct_outreach" | "nurture" | "excluded";
};

export type EnrichmentPlayback = {
  candidateName: string;
  linkedinUrl: string;
  discoveredSkills: string[];
  roleFamily: string;
  gateSignals: { role_family: boolean; skills_evidence: boolean; proximity: boolean };
  gateDecision: "ADMIT" | "HOLD" | "REJECT";
  gateReason: string;
  jobs: EnrichmentJob[];
  channel: "conference" | "referral" | "cv";
  referrer?: { name: string; role: string };
};

const CONFERENCE_STEPS = [
  { id: "fetch",       label: "Fetch LinkedIn profile",              detail: "POST /clay/v1/enrichment/people" },
  { id: "employers",   label: "Extract past employers + tier flag",  detail: "6 roles read · check against notable-employer list" },
  { id: "posts",       label: "Scan recent posts (last 90 days)",    detail: "POST /clay/v1/enrichment/people (posts included) · topic classification" },
  { id: "featured",    label: "Pull publications, talks, repos",     detail: "Featured section + GitHub cross-reference" },
  { id: "gate",        label: "Run pool-admission gate",             detail: "3 signals · 2-of-3 admits" },
  { id: "connections", label: "Cross-check with WSC directory",      detail: "1st + 2nd degree · returns warm-intro paths" },
  { id: "score",       label: "Score against open positions",        detail: "Fit + warmth per role_id" },
] as const;

const REFERRAL_STEPS = [
  ...CONFERENCE_STEPS.slice(0, 6),
  { id: "score", label: "Score with vouched-by-employee lift", detail: "Fit + warmth + referral trust boost" },
] as const;

// Synthetic enrichment output — clearly labeled as an example. Illustrates the
// KIND of data enrichment returns; the actual scoring below uses real form input.
const EXAMPLE_ENRICHMENT = {
  employers: [
    { name: "DAZN",                years: "2023 – 2026", tier: "notable"  as const, note: "Video ML team, real-time broadcast inference" },
    { name: "Meta Reality Labs",   years: "2020 – 2023", tier: "notable"  as const, note: "Real-time avatars, computer-vision pipelines" },
    { name: "Stanford Vision Lab", years: "2018 – 2020", tier: "research" as const, note: "MS thesis: 3D pose estimation for athletes" },
  ],
  posts: [
    { title: "Why we moved real-time inference from TF Serving to ONNX Runtime",     daysAgo: 12, engagement: "218 reactions · 24 comments", match: ["Object Detection", "PyTorch"] },
    { title: "Notes from CVPR 2026 — dominance of vision-language models in sports", daysAgo: 34, engagement: "412 reactions · 51 comments", match: ["Computer Vision", "Sports Analytics"] },
    { title: "Building a 60fps pose estimator on edge hardware",                     daysAgo: 71, engagement: "97 reactions · 8 comments",   match: ["Real-time processing"] },
  ],
  publications: [
    { title: "Real-time multi-object tracking for sports broadcast", venue: "CVPR 2024",              type: "paper" as const },
    { title: "Video ML at DAZN — architecture keynote",              venue: "PyTorch Conference 2024", type: "talk"  as const },
    { title: "sports-video-utils (2.1k stars)",                      venue: "GitHub",                  type: "repo"  as const },
  ],
  connections: [
    { employee: "Maya Levi",   role: "Senior ML Engineer · AI/ML", relationship: "ex-colleague at Meta Reality Labs (2021–2022)", degree: 1 as const },
    { employee: "David Cohen", role: "VP Engineering",             relationship: "shared employer at DAZN (overlap 2024)",       degree: 2 as const },
  ],
};

const PUB_ICON: Record<"paper" | "talk" | "repo", React.ComponentProps<typeof Icon>["name"]> = {
  paper: "book",
  talk:  "message",
  repo:  "terminal",
};

export default function EnrichmentReveal({
  playback,
  onDone,
}: {
  playback: EnrichmentPlayback;
  onDone?: () => void;
}) {
  const STEPS = playback.channel === "referral" ? REFERRAL_STEPS : CONFERENCE_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep(s => s + 1), step === 0 ? 900 : 700);
    return () => clearTimeout(t);
  }, [step, STEPS.length]);

  const done = step >= STEPS.length;

  // Prepend referrer to WSC connections if this is a referral submission.
  const wscConnections = playback.channel === "referral" && playback.referrer
    ? [
        { employee: playback.referrer.name, role: playback.referrer.role, relationship: "referrer + vouched personally", degree: 1 as const },
        ...EXAMPLE_ENRICHMENT.connections.filter(c => c.employee !== playback.referrer!.name),
      ]
    : EXAMPLE_ENRICHMENT.connections;

  const topJob = [...playback.jobs].sort((a, b) => b.fitScore - a.fitScore)[0];

  return (
    <div className="card p-6 fade-up">
      <header className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-mute font-medium mb-0.5">
            Live enrichment · {playback.channel}
          </div>
          <div className="text-lg font-semibold text-text">{playback.candidateName}</div>
          <div className="text-xs text-mute font-mono truncate max-w-md">
            {playback.linkedinUrl ? (
              <a
                href={playback.linkedinUrl.startsWith("http") ? playback.linkedinUrl : `https://${playback.linkedinUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-700 hover:underline"
                title="Open on LinkedIn"
              >
                {playback.linkedinUrl}
              </a>
            ) : "(no LinkedIn URL — capping evidence signal at low confidence)"}
          </div>
          {playback.channel === "referral" && playback.referrer && (
            <div className="text-xs text-mute mt-1">
              Referred by <strong className="text-text">{playback.referrer.name}</strong> · {playback.referrer.role}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!done && (
            <div className="flex items-center gap-2 text-xs text-mute">
              <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              running…
            </div>
          )}
          {done && onDone && (
            <button onClick={onDone} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              + Add another
            </button>
          )}
        </div>
      </header>

      <ol className="space-y-2 mb-6">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <li key={s.id} className={`flex items-start gap-3 px-3 py-2 rounded-md border ${
              state === "done"   ? "border-emerald-100 bg-emerald-50/40"
            : state === "active" ? "border-indigo-200 bg-indigo-50/60"
            : "border-border bg-white"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                state === "done"   ? "bg-emerald-100 text-emerald-600"
              : state === "active" ? "bg-indigo-100 text-indigo-600"
              : "bg-slate-100 text-slate-400"
              }`}>
                {state === "done" ? (
                  <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
                ) : state === "active" ? (
                  <div className="w-2.5 h-2.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[10px] font-mono">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${state === "pending" ? "text-mute" : "text-text"}`}>{s.label}</div>
                <div className="text-[11px] text-mute font-mono truncate">{s.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Reveal cards — appear as each step completes. Employer/post/publication cards
          are ILLUSTRATIVE (marked "example enrichment output"). Skills, gate, and scoring
          come from the actual form input. */}

      {step >= 1 && (
        <Reveal label="Skills extracted" hint="from LinkedIn skills section + past-role bullets">
          <div className="flex flex-wrap gap-1.5">
            {playback.discoveredSkills.slice(0, 12).map(s => (
              <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                {s}
              </span>
            ))}
            {playback.discoveredSkills.length === 0 && (
              <span className="text-[11px] text-mute italic">No confirmed skills yet — profile needs more data.</span>
            )}
          </div>
          <div className="mt-2 text-xs text-mute">
            Role family: <span className="font-mono text-text">{playback.roleFamily}</span>
          </div>
        </Reveal>
      )}

      {step >= 2 && (
        <Reveal label="Past employers" hint="example enrichment output · in prod extracted from LinkedIn experience section">
          <ul className="divide-y divide-border-faint">
            {EXAMPLE_ENRICHMENT.employers.map((e, i) => (
              <li key={i} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text flex items-center gap-2">
                    {e.name}
                    {e.tier === "notable" && (
                      <span className="text-[10px] font-semibold bg-violet-100 text-violet-800 rounded px-1.5 py-0.5">notable-tier</span>
                    )}
                    {e.tier === "research" && (
                      <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 rounded px-1.5 py-0.5">research</span>
                    )}
                  </div>
                  <div className="text-xs text-mute">{e.note}</div>
                </div>
                <div className="text-[11px] font-mono text-mute whitespace-nowrap">{e.years}</div>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px] text-mute">
            → contributes to <span className="text-indigo-700 font-medium">caliber signal</span> + warm-employer overlap.
          </div>
        </Reveal>
      )}

      {step >= 3 && (
        <Reveal label="Recent posts" hint="example enrichment output · topic classification against JD keywords">
          <ul className="space-y-2">
            {EXAMPLE_ENRICHMENT.posts.map((p, i) => (
              <li key={i} className="border border-border-faint rounded-md px-3 py-2 bg-slate-50/40">
                <div className="text-sm text-text font-medium leading-snug mb-1">{p.title}</div>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="text-mute">{p.daysAgo}d ago</span>
                  <span className="text-mute">·</span>
                  <span className="text-mute">{p.engagement}</span>
                  {p.match.map(m => (
                    <span key={m} className="bg-emerald-100 text-emerald-800 font-semibold rounded px-1.5 py-0.5">
                      matches: {m}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px] text-mute">
            → topic-matches boost <span className="text-indigo-700 font-medium">evidence signal</span>: they don't just list the skill, they publish about it.
          </div>
        </Reveal>
      )}

      {step >= 4 && (
        <Reveal label="Publications, talks & repos" hint="example enrichment output · Featured section + GitHub API">
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {EXAMPLE_ENRICHMENT.publications.map((p, i) => (
              <li key={i} className="border border-border-faint rounded-md p-3 bg-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Icon name={PUB_ICON[p.type]} className="w-3.5 h-3.5" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-violet-700 font-semibold">{p.type}</span>
                </div>
                <div className="text-sm text-text font-medium leading-snug">{p.title}</div>
                <div className="text-[11px] text-mute mt-0.5">{p.venue}</div>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px] text-mute">
            → contributes to <span className="text-indigo-700 font-medium">caliber signal</span>: publication venue and OSS visibility are quality markers.
          </div>
        </Reveal>
      )}

      {step >= 5 && (
        <Reveal label="Gate decision" hint="3 signals · 2-of-3 admits — from real input">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {(["role_family", "skills_evidence", "proximity"] as const).map(k => {
              const ok = playback.gateSignals[k];
              return (
                <div key={k} className={`flex-1 min-w-[130px] rounded-md border px-3 py-2 ${ok ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/40"}`}>
                  <div className="text-[10px] uppercase tracking-wider text-mute font-medium">{k.replace("_", " ")}</div>
                  <div className={`text-sm font-semibold ${ok ? "text-emerald-700" : "text-slate-500"}`}>
                    {ok ? "PASS" : "—"}
                  </div>
                </div>
              );
            })}
            <div className={`px-3 py-2 rounded-md border font-semibold text-sm ${
              playback.gateDecision === "ADMIT"    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : playback.gateDecision === "HOLD"     ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {playback.gateDecision}
            </div>
          </div>
          <div className="text-xs text-mute font-mono">{playback.gateReason}</div>
        </Reveal>
      )}

      {step >= 6 && (
        <Reveal label="Warm-intro paths in WSC directory" hint="example enrichment output · cross-check LinkedIn connections against WSC employees">
          <ul className="space-y-2">
            {wscConnections.map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border border-emerald-100 bg-emerald-50/30 rounded-md px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{c.employee}</div>
                  <div className="text-xs text-mute">{c.role}</div>
                  <div className="text-xs text-emerald-800 mt-1">↳ {c.relationship}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold rounded px-2 py-0.5 whitespace-nowrap ${
                  c.degree === 1 ? "bg-emerald-600 text-white" : "bg-emerald-200 text-emerald-900"
                }`}>
                  {c.degree}° connection
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px] text-mute">
            → drives <span className="text-indigo-700 font-medium">warmth score</span> + names the person best placed to make the intro.
          </div>
        </Reveal>
      )}

      {step >= (playback.channel === "referral" ? 7 : 6) && (
        <Reveal label="Scored against open positions" hint="real per-role fit from the pipeline">
          <ul className="space-y-1.5">
            {playback.jobs.map(j => (
              <li key={j.jobId} className="flex items-center gap-3 text-sm border border-border-faint rounded-md px-3 py-2">
                <span className="font-mono text-[11px] text-mute w-16 shrink-0">{j.jobId}</span>
                <span className="flex-1 text-text truncate">{j.jobTitle}</span>
                <span className="text-[11px] text-mute whitespace-nowrap">{j.matchedCount}/{j.totalRequired} req</span>
                <span className={`text-sm font-mono font-semibold tabular w-12 text-right ${
                  j.fitScore >= 80 ? "text-emerald-700"
                : j.fitScore >= 60 ? "text-indigo-700"
                : "text-slate-500"
                }`}>{j.fitScore.toFixed(1)}</span>
                <span className={`text-[10px] uppercase tracking-wider rounded-full border px-2 py-0.5 whitespace-nowrap ${
                  j.tier === "call_this_week"  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : j.tier === "direct_outreach" ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : j.tier === "nurture"         ? "bg-slate-100 text-slate-700 border-slate-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>{j.tier.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
          {playback.channel === "referral" && playback.referrer && (
            <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
              <strong>+ Vouched-by-employee lift</strong> applied to warmth (referrer: {playback.referrer.name}).
              Adds ~15 warmth points on top of the network base.
            </div>
          )}
        </Reveal>
      )}

      {done && topJob && (
        <div className="mt-6 pt-4 border-t border-border-faint flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-text min-w-0">
            <span className="font-semibold">Enrichment complete.</span>{" "}
            <span className="text-mute">
              Top fit: <strong className="text-text">{topJob.jobId}</strong> at{" "}
              <strong className="text-text tabular font-mono">{topJob.fitScore.toFixed(1)}</strong>.
              Added to the pool.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/jobs/${topJob.jobId}/`}
              className="text-xs bg-indigo-600 text-white font-medium px-3 py-1.5 rounded-md hover:bg-indigo-700 inline-flex items-center gap-1.5"
            >
              View {topJob.jobId} shortlist
              <Icon name="arrow-right" className="w-3.5 h-3.5" strokeWidth={2.25} />
            </a>
            <a href="/pool/" className="text-xs text-mute hover:text-text font-medium">Open pool →</a>
          </div>
        </div>
      )}
    </div>
  );
}

function Reveal({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="fade-up mb-5">
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <div className="text-[10px] uppercase tracking-wider text-mute font-semibold">{label}</div>
        {hint && <div className="text-[10px] text-faint italic truncate">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
