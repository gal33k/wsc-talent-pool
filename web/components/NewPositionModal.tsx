"use client";

/*
 * NewPositionModal — recruiter opens a new role from /pool.
 *
 * Form fields: title, role family (dropdown of families seen in the pool),
 * required skills (chip input with autocomplete from every skill string
 * that appears on any pool candidate). Submit creates a SessionJob
 * (localStorage-persisted, marked sessionOnly) — no pipeline re-run.
 *
 * After submit the parent shows a matches banner + top-matches panel by
 * calling matchPool() below, which does a case-insensitive exact match of
 * required_skills against candidate.skills plus a family-match bonus.
 * That mirrors what the Python pipeline's role_family + required_skills
 * fit components do at ingest — same rules, just applied live against
 * candidates we already scored, so the recruiter can act on a new role
 * without waiting for a full re-score.
 */

import { useMemo, useState, useEffect } from "react";
import { usePool, type SessionJob } from "@/lib/data";
import type { Candidate } from "@/lib/types";
import { Icon } from "./Icon";

export type PoolMatch = {
  candidate: Candidate;
  matchedRequired: string[];
  missingRequired: string[];
  familyMatch: boolean;
  score: number;   // 0..1 — matchedRequired / totalRequired, +bonus if family matches
};

// Ranking used by both the modal's "top matches" preview and the banner
// on /pool after submit. Kept in this file so both call sites use the same
// logic.
export function matchPool(
  candidates: Candidate[],
  requiredSkills: string[],
  roleFamily: string
): PoolMatch[] {
  const reqLower = requiredSkills.map(s => s.trim().toLowerCase()).filter(Boolean);
  return candidates
    .filter(c => c.gate.decision === "ADMIT")
    .map(c => {
      const skillsLower = new Set(c.skills.map(s => s.toLowerCase()));
      const matchedRequired = reqLower.filter(r => skillsLower.has(r));
      const missingRequired = reqLower.filter(r => !skillsLower.has(r));
      const familyMatch = c.role_family === roleFamily;
      // Skill fraction (0..1), + 0.15 bonus if role_family matches.
      // Capped at 1.0 so a family-match with all skills still scores 1.
      const skillFrac = reqLower.length === 0 ? (familyMatch ? 0.5 : 0) : matchedRequired.length / reqLower.length;
      const score = Math.min(1, skillFrac + (familyMatch ? 0.15 : 0));
      return {
        candidate: c,
        matchedRequired: requiredSkills.filter(r => skillsLower.has(r.toLowerCase())),
        missingRequired: requiredSkills.filter(r => !skillsLower.has(r.toLowerCase())),
        familyMatch,
        score,
      };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

const FAMILY_HINT: Record<string, string> = {
  ml_cv:             "ML — Computer Vision",
  ml_general:        "ML — General",
  data_engineering:  "Data engineering",
  data_analytics:    "Data / Analytics",
  backend:           "Backend engineering",
  frontend:          "Frontend engineering",
  platform_devops:   "Platform / DevOps",
  video_broadcast:   "Video / Broadcast",
  sales_engineering: "Sales engineering",
  product:           "Product management",
  content:           "Content / Editorial",
  leadership:        "Leadership",
  not_talent:        "(not a hiring family)",
};

export default function NewPositionModal({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (job: SessionJob, matches: PoolMatch[]) => void;
}) {
  const { pool, addSessionJob } = usePool();
  const [title, setTitle] = useState("AI Solutions Manager");
  const [family, setFamily] = useState("product");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([
    "Product Management", "Machine Learning", "Python", "Solution Design",
  ]);

  // Available families = families that appear on at least one candidate,
  // minus the non-hiring "not_talent" and "unknown" buckets.
  const availableFamilies = useMemo(() => {
    if (!pool) return [];
    const seen = new Set<string>();
    for (const c of pool.candidates) seen.add(c.role_family);
    return [...seen]
      .filter(f => f !== "not_talent" && f !== "unknown")
      .sort();
  }, [pool]);

  // Skill autocomplete pool — filtered to candidates whose role_family
  // matches the selected family, so pulling up "product" shows Product-
  // Management / User-Research rather than the whole-pool dominators
  // (Python / PyTorch etc). Falls back to the full pool if the selected
  // family has too few candidates to populate a useful list.
  const skillCatalog = useMemo(() => {
    if (!pool) return [] as { name: string; count: number }[];
    const inFamily = pool.candidates.filter(c => c.role_family === family);
    const source = inFamily.length >= 3 ? inFamily : pool.candidates;
    const counts = new Map<string, number>();
    for (const c of source) {
      for (const s of c.skills) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [pool, family]);
  const skillCatalogSource = useMemo(() => {
    if (!pool) return null;
    const inFamily = pool.candidates.filter(c => c.role_family === family);
    return inFamily.length >= 3
      ? { label: `${inFamily.length} ${family} people in the pool`, scope: "family" as const }
      : { label: `whole pool — only ${inFamily.length} ${family} people to draw from`, scope: "pool" as const };
  }, [pool, family]);

  const suggestions = useMemo(() => {
    const q = skillInput.trim().toLowerCase();
    if (!q) {
      return skillCatalog
        .filter(s => !skills.some(sk => sk.toLowerCase() === s.name.toLowerCase()))
        .slice(0, 6);
    }
    return skillCatalog
      .filter(s => s.name.toLowerCase().includes(q))
      .filter(s => !skills.some(sk => sk.toLowerCase() === s.name.toLowerCase()))
      .slice(0, 6);
  }, [skillInput, skillCatalog, skills]);

  const addSkill = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (skills.some(s => s.toLowerCase() === n.toLowerCase())) return;
    setSkills([...skills, n]);
    setSkillInput("");
  };
  const removeSkill = (name: string) => setSkills(skills.filter(s => s !== name));

  // Live preview of matches based on the current form state. Recomputes on
  // every keystroke — cheap for 75 candidates.
  const preview = useMemo(() => {
    if (!pool) return [];
    return matchPool(pool.candidates, skills, family).slice(0, 6);
  }, [pool, skills, family]);

  // Escape closes the modal.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = () => {
    if (!title.trim() || !family) return;
    const job = addSessionJob({
      title: title.trim(),
      role_family: family,
      required_skills: skills,
      nice_to_have: [],
    });
    // Compute matches against the FULL pool (not the preview slice) so the
    // banner and the "match open roles" filter see the same data.
    const matches = pool ? matchPool(pool.candidates, skills, family) : [];
    onOpened(job, matches);
  };

  const submitDisabled = !title.trim() || !family || skills.length === 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-modal z-50 flex items-center justify-center p-4 fade-in"
      role="presentation"
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-pos-title"
        className="bg-white w-full max-w-[720px] max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl fade-up"
      >
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              Recruiter · new position
            </div>
            <h2 id="new-pos-title" className="text-lg font-semibold text-text leading-tight">
              Open a new role and see who&rsquo;s ready today
            </h2>
            <p className="text-xs text-mute mt-1 max-w-md">
              We&rsquo;ll match the required skills against everyone in your pool. No pipeline
              re-run — same tree, refreshed against the new role.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-mute hover:text-text hover:bg-slate-100 w-8 h-8 rounded-md flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Icon name="close" className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="np-title" className="block text-xs font-medium text-text mb-1.5">
              Position title <span className="text-red-600">*</span>
            </label>
            <input
              id="np-title" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
              placeholder="e.g. AI Solutions Manager"
              autoFocus
            />
          </div>

          {/* Role family */}
          <div>
            <label htmlFor="np-family" className="block text-xs font-medium text-text mb-1.5">
              Closest role family <span className="text-red-600">*</span>
            </label>
            <select
              id="np-family" value={family} onChange={e => setFamily(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            >
              {availableFamilies.map(f => (
                <option key={f} value={f}>{FAMILY_HINT[f] ?? f} — {f}</option>
              ))}
            </select>
            <div className="text-[11px] text-mute mt-1">
              Which family in the pool is this role closest to? Matching family adds a bonus to the
              score below. Configured in <code className="font-mono text-[11px]">taxonomy.yaml</code>.
            </div>
          </div>

          {/* Required skills */}
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              Required skills <span className="text-red-600">*</span>{" "}
              <span className="text-mute font-normal">— what does the HM want to see?</span>
            </label>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-xs">
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="w-4 h-4 rounded-full hover:bg-emerald-200 flex items-center justify-center text-emerald-700"
                      aria-label={`Remove ${s}`}
                    >
                      <Icon name="close" className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && skillInput.trim()) {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                placeholder="Type a skill and press Enter (or pick from suggestions below)"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-1">
                  {skillInput.trim()
                    ? "Matches from your pool"
                    : `Common skills among ${skillCatalogSource?.label ?? "your pool"}`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => addSkill(s.name)}
                      className="inline-flex items-center gap-1 rounded-full bg-white border border-border hover:border-emerald-400 hover:bg-emerald-50 px-2 py-0.5 text-[11px] text-dim hover:text-emerald-800 transition-colors"
                    >
                      + {s.name}
                      <span className="text-[9px] text-mute">·{s.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold mb-2">
              Live preview · top matches from your pool
            </div>
            {preview.length === 0 ? (
              <div className="text-sm text-mute italic">
                No admits match this shape yet — try adding a skill or picking a different family.
              </div>
            ) : (
              <div className="space-y-1.5">
                {preview.map(m => (
                  <div key={m.candidate.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-12 text-right tabular font-semibold ${
                      m.score >= 0.8 ? "text-emerald-800" : m.score >= 0.5 ? "text-amber-700" : "text-slate-500"
                    }`}>
                      {Math.round(m.score * 100)}%
                    </span>
                    <span className="text-text font-medium min-w-0 truncate flex-1">{m.candidate.name}</span>
                    <span className="text-xs text-mute truncate max-w-[180px]">{m.candidate.title}</span>
                    {m.familyMatch && (
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold flex-shrink-0">family ✓</span>
                    )}
                    <span className="text-[11px] text-mute tabular flex-shrink-0 w-16 text-right">
                      {m.matchedRequired.length}/{skills.length} skills
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-border px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-mute">
            Session-only — persists in your browser, never touches <code className="font-mono text-[11px]">pool.json</code>.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-mute hover:text-text px-3 py-1.5 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitDisabled}
              className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
              Open position &amp; refresh pool
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
