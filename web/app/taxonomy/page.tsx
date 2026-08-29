"use client";

import { useState, useMemo } from "react";
import { usePool } from "@/lib/data";
import { Icon } from "@/components/Icon";

type TaxonomyEdit =
  | { kind: "title_pattern"; family: string; pattern: string; addedAt: string }
  | { kind: "skill_synonym"; skill: string; alias: string; tier: "exact" | "family"; addedAt: string }
  | { kind: "employer_stopword"; token: string; addedAt: string }
  | { kind: "family_evidence"; family: string; keyword: string; addedAt: string };

const ROLE_FAMILIES = [
  "ml_cv", "ml_general", "data_engineering", "data_analytics",
  "backend", "frontend", "platform_devops", "video_broadcast",
  "sales_engineering", "product", "content", "not_talent",
];

export default function TaxonomyEditor() {
  const { pool, loading, error, logBq } = usePool();
  const [edits, setEdits] = useState<TaxonomyEdit[]>([]);
  const [tab, setTab] = useState<"patterns" | "synonyms" | "stoplist" | "evidence">("patterns");

  // Form state
  const [pf, setPf] = useState<{ family: string; pattern: string }>({ family: "ml_cv", pattern: "" });
  const [sy, setSy] = useState<{ skill: string; alias: string; tier: "exact" | "family" }>({ skill: "", alias: "", tier: "exact" });
  const [st, setSt] = useState<{ token: string }>({ token: "" });
  const [ev, setEv] = useState<{ family: string; keyword: string }>({ family: "ml_cv", keyword: "" });

  const addEdit = (edit: TaxonomyEdit) => {
    setEdits(prev => [edit, ...prev]);
    logBq({
      op: "INSERT",
      table: "wsc.taxonomy.change_events",
      sql: taxonomySql(edit),
      rows: 1,
    });
  };

  const removeEdit = (i: number) => {
    setEdits(prev => prev.filter((_, idx) => idx !== i));
  };

  // Preview: for a new title_pattern, count how many currently-REJECTED
  // candidates would now match the new pattern (would flip to family).
  const rejectFlipPreview = useMemo(() => {
    if (!pool || !pf.pattern.trim()) return 0;
    const p = pf.pattern.trim().toLowerCase();
    return pool.candidates.filter(c =>
      c.gate.decision === "REJECT" &&
      (c.title || "").toLowerCase().includes(p)
    ).length;
  }, [pool, pf.pattern]);

  if (loading) return <main className="p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;

  return (
    <main className="max-w-[1200px] mx-auto px-8 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">Configuration · recruiter-editable rules</div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Taxonomy editor</h1>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Every classification rule the pipeline uses lives in one YAML file. Add a title pattern to
          teach the system a new role family, add a skill synonym, or exclude a generic employer
          token — without touching code. Changes here are session-only in this demo; a production
          save writes to <code className="text-[12px]">config/taxonomy.yaml</code> and queues a
          re-gate on the pool.
        </p>
      </header>

      <div role="tablist" className="flex items-baseline gap-1 border-b border-border mb-6 overflow-x-auto">
        {[
          ["patterns", "Title patterns", "add title → role family"],
          ["synonyms", "Skill synonyms", "TensorFlow ↔ PyTorch"],
          ["stoplist", "Employer stoplist", "filter freelance / startup / etc."],
          ["evidence", "Family evidence", "skills that confirm a family"],
        ].map(([id, label, hint]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors whitespace-nowrap ${
              tab === id
                ? "border-emerald-700 text-emerald-700"
                : "border-transparent text-mute hover:text-text"
            }`}
          >
            {label}
            <span className="hidden sm:inline text-xs text-faint font-normal ml-2">· {hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          {tab === "patterns" && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Add a title pattern to a role family</h2>
              <p className="text-xs text-mute mb-4">
                First-match-wins on the candidate's title (lowercased substring). Example:{" "}
                <em>&ldquo;video ai engineer&rdquo;</em> → <code>ml_cv</code> so it beats the
                generic <em>&ldquo;video engineer&rdquo;</em> pattern in <code>video_broadcast</code>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-3">
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Family</label>
                  <select
                    value={pf.family}
                    onChange={e => setPf({ ...pf, family: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    {ROLE_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Title pattern (substring, lowercased)</label>
                  <input
                    type="text"
                    value={pf.pattern}
                    onChange={e => setPf({ ...pf, pattern: e.target.value })}
                    placeholder="e.g. computer vision engineer"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    disabled={!pf.pattern.trim()}
                    onClick={() => {
                      addEdit({
                        kind: "title_pattern",
                        family: pf.family,
                        pattern: pf.pattern.trim().toLowerCase(),
                        addedAt: new Date().toISOString(),
                      });
                      setPf({ ...pf, pattern: "" });
                    }}
                    className="text-xs bg-emerald-700 text-white font-medium px-4 py-2 rounded-md hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Add pattern
                  </button>
                </div>
              </div>
              {pf.pattern.trim() && rejectFlipPreview > 0 && (
                <div className="mt-3 text-xs rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                  <strong>{rejectFlipPreview}</strong> currently-rejected candidate{rejectFlipPreview !== 1 && "s"} would match this pattern.
                  Adding it would flip them from REJECT toward the <code>{pf.family}</code> family on next re-gate.
                </div>
              )}
            </section>
          )}

          {tab === "synonyms" && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Add a skill synonym</h2>
              <p className="text-xs text-mute mb-4">
                Exact alias earns full credit (1.0); family alias earns partial (0.6). Example:{" "}
                <code>PyTorch</code> exact aliases include <code>pytorch</code>, family aliases
                include <code>tensorflow</code>, <code>keras</code>, <code>deep learning</code>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-3">
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Required skill</label>
                  <input
                    type="text"
                    value={sy.skill}
                    onChange={e => setSy({ ...sy, skill: e.target.value })}
                    placeholder="e.g. PyTorch"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Alias to add</label>
                  <input
                    type="text"
                    value={sy.alias}
                    onChange={e => setSy({ ...sy, alias: e.target.value })}
                    placeholder="e.g. torch"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Tier</label>
                  <select
                    value={sy.tier}
                    onChange={e => setSy({ ...sy, tier: e.target.value as "exact" | "family" })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="exact">Exact (1.0)</option>
                    <option value="family">Family (0.6)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    disabled={!sy.skill.trim() || !sy.alias.trim()}
                    onClick={() => {
                      addEdit({
                        kind: "skill_synonym",
                        skill: sy.skill.trim(),
                        alias: sy.alias.trim().toLowerCase(),
                        tier: sy.tier,
                        addedAt: new Date().toISOString(),
                      });
                      setSy({ ...sy, skill: "", alias: "" });
                    }}
                    className="text-xs bg-emerald-700 text-white font-medium px-4 py-2 rounded-md hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Add synonym
                  </button>
                </div>
              </div>
            </section>
          )}

          {tab === "stoplist" && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Add a generic-employer stopword</h2>
              <p className="text-xs text-mute mb-4">
                Filters out generic employer strings that create false warm-path signals — e.g. every
                startup employee &ldquo;sharing&rdquo; an employer with every other startup employee.
                Current stoplist includes: <code>freelance</code>, <code>startup</code>,{" "}
                <code>university</code>, <code>public sector</code>, <code>hospital group</code>,{" "}
                <code>IDF</code> (bare).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <input
                  type="text"
                  value={st.token}
                  onChange={e => setSt({ token: e.target.value })}
                  placeholder="e.g. consulting"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono"
                />
                <button
                  disabled={!st.token.trim()}
                  onClick={() => {
                    addEdit({
                      kind: "employer_stopword",
                      token: st.token.trim().toLowerCase(),
                      addedAt: new Date().toISOString(),
                    });
                    setSt({ token: "" });
                  }}
                  className="text-xs bg-emerald-700 text-white font-medium px-4 py-2 rounded-md hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add to stoplist
                </button>
              </div>
            </section>
          )}

          {tab === "evidence" && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Add a family-evidence skill</h2>
              <p className="text-xs text-mute mb-4">
                Skills that confirm a candidate genuinely belongs to a claimed family. Gate signal 2
                requires at least one hit. Adding <em>&ldquo;triton inference&rdquo;</em> to{" "}
                <code>ml_cv</code> means anyone with that skill in their profile passes the
                skills-evidence check for that family.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-3">
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Family</label>
                  <select
                    value={ev.family}
                    onChange={e => setEv({ ...ev, family: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    {ROLE_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-mute font-medium mb-1">Evidence skill (substring, lowercased)</label>
                  <input
                    type="text"
                    value={ev.keyword}
                    onChange={e => setEv({ ...ev, keyword: e.target.value })}
                    placeholder="e.g. onnx runtime"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    disabled={!ev.keyword.trim()}
                    onClick={() => {
                      addEdit({
                        kind: "family_evidence",
                        family: ev.family,
                        keyword: ev.keyword.trim().toLowerCase(),
                        addedAt: new Date().toISOString(),
                      });
                      setEv({ ...ev, keyword: "" });
                    }}
                    className="text-xs bg-emerald-700 text-white font-medium px-4 py-2 rounded-md hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Add evidence
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Live YAML preview of session edits */}
          {edits.length > 0 && (
            <section className="mt-6 card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-stone-50/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text">YAML patch preview</div>
                  <div className="text-[11px] text-mute mt-0.5">The change-set that would be committed to <code>config/taxonomy.yaml</code> on save.</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(edits.map(yamlSnippet).join("\n"))}
                  className="text-xs border border-border rounded-md px-2.5 py-1 bg-white hover:border-emerald-500 hover:text-emerald-700 flex items-center gap-1.5"
                  title="Copy the YAML patch"
                >
                  <Icon name="copy" className="w-3.5 h-3.5" strokeWidth={2} />
                  Copy YAML
                </button>
              </div>
              <pre className="p-4 text-[11px] font-mono text-slate-800 bg-white leading-relaxed overflow-x-auto">
{edits.map(yamlSnippet).join("\n")}
              </pre>
            </section>
          )}
        </div>

        <aside>
          <div className="card p-4 sticky top-4">
            <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-3">
              Session edits · {edits.length}
            </div>
            {edits.length === 0 ? (
              <div className="text-xs text-mute italic">No changes yet.</div>
            ) : (
              <ul className="space-y-2">
                {edits.map((e, i) => (
                  <li key={i} className="rounded-md border border-border-faint bg-white p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold">
                          {editLabel(e)}
                        </div>
                        <div className="text-text mt-0.5 break-words">{editDescription(e)}</div>
                      </div>
                      <button
                        onClick={() => removeEdit(i)}
                        className="text-mute hover:text-rose-600 flex-shrink-0"
                        aria-label="Remove change"
                      >
                        <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 pt-3 border-t border-border-faint text-[10px] text-mute leading-relaxed">
              <strong className="text-dim">In production</strong> this saves to <code>config/taxonomy.yaml</code> in Git and triggers a re-gate on the pool. Log lands in <code>wsc.taxonomy.change_events</code>.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* --- helpers --- */

function editLabel(e: TaxonomyEdit): string {
  switch (e.kind) {
    case "title_pattern":    return "Title pattern";
    case "skill_synonym":    return `Skill synonym · ${e.tier}`;
    case "employer_stopword": return "Employer stopword";
    case "family_evidence":  return "Family evidence";
  }
}

function editDescription(e: TaxonomyEdit): string {
  switch (e.kind) {
    case "title_pattern":     return `"${e.pattern}" → ${e.family}`;
    case "skill_synonym":     return `"${e.alias}" → ${e.skill}`;
    case "employer_stopword": return `stop: "${e.token}"`;
    case "family_evidence":   return `${e.family} += "${e.keyword}"`;
  }
}

function yamlSnippet(e: TaxonomyEdit): string {
  switch (e.kind) {
    case "title_pattern":
      return `# role_families → ${e.family}\n  - family: ${e.family}\n    title_patterns:\n      - "${e.pattern}"`;
    case "skill_synonym":
      return `# skill_synonyms.${e.skill}.${e.tier}\n  ${e.skill}:\n    ${e.tier}:\n      - "${e.alias}"`;
    case "employer_stopword":
      return `# generic_employer_stoplist\n  - "${e.token}"`;
    case "family_evidence":
      return `# family_evidence.${e.family}\n  ${e.family}:\n    - "${e.keyword}"`;
  }
}

function taxonomySql(e: TaxonomyEdit): string {
  const payload = JSON.stringify(e);
  return `INSERT INTO wsc.taxonomy.change_events (kind, payload, actor, ts)\nVALUES ('${e.kind}', ${payload.replace(/'/g, "''")}, 'recruiter@wsc', CURRENT_TIMESTAMP())`;
}
