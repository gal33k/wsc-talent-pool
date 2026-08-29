"use client";

import { useState, useMemo, useEffect } from "react";
import { usePool } from "@/lib/data";
import { Icon } from "@/components/Icon";
import type { Candidate } from "@/lib/types";

/* Taxonomy editor — Claude-assisted.
   Claude analyses the pool weekly and proposes taxonomy changes.
   The HR user approves, edits, or rejects each. Nothing writes to config
   without an approval. */

type Suggestion = {
  id: string;
  kind: "title_pattern" | "skill_synonym" | "employer_stopword" | "family_evidence";
  headline: string;
  rationale: string;
  impact: string;
  payload: {
    family?: string;
    pattern?: string;
    skill?: string;
    alias?: string;
    tier?: "exact" | "family";
    token?: string;
    keyword?: string;
  };
};

type Applied = {
  id: string;
  headline: string;
  kind: Suggestion["kind"];
  source: "claude" | "manual";
  payload: Suggestion["payload"];
  ts: string;
};

const CURRENT_STOPLIST = ["freelance", "startup", "university", "public sector", "hospital group", "idf"];

export default function TaxonomyEditor() {
  const { pool, loading, error, logBq } = usePool();
  const [applied, setApplied] = useState<Applied[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Suggestion | null>(null);
  const [lastAnalysed, setLastAnalysed] = useState<string>("");
  const [manualOpen, setManualOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Generate suggestions from the actual pool data. In production this is a
  // Claude call over the recent gate events + skills distribution + reject titles.
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!pool) return [];
    return generateSuggestions(pool.candidates).filter(s => !rejected.includes(s.id));
  }, [pool, rejected]);

  useEffect(() => {
    // Set a plausible timestamp — "5 minutes ago"
    const d = new Date(Date.now() - 5 * 60 * 1000);
    setLastAnalysed(d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }));
  }, []);

  const approve = (s: Suggestion, source: Applied["source"] = "claude") => {
    setApplied(prev => [{
      id: s.id + "-" + Date.now(),
      headline: s.headline,
      kind: s.kind,
      source,
      payload: s.payload,
      ts: new Date().toISOString(),
    }, ...prev]);
    logBq({
      op: "INSERT",
      table: "wsc.taxonomy.change_events",
      sql: `INSERT INTO wsc.taxonomy.change_events (kind, source, payload, actor, ts)\nVALUES ('${s.kind}', '${source}', ${JSON.stringify(JSON.stringify(s.payload))}, 'recruiter@wsc', CURRENT_TIMESTAMP())`,
      rows: 1,
    });
    setEditing(null);
    setEditDraft(null);
  };

  const reject = (id: string) => {
    setRejected(prev => [...prev, id]);
    setEditing(null);
    setEditDraft(null);
  };

  const startEdit = (s: Suggestion) => {
    setEditing(s.id);
    setEditDraft({ ...s });
  };

  const regenerate = () => {
    setRegenerating(true);
    setTimeout(() => {
      // Clear rejects so the "regenerated" pass surfaces them again — pretends
      // Claude re-analysed and stands by them.
      setRejected([]);
      setLastAnalysed(new Date().toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }));
      setRegenerating(false);
    }, 1200);
  };

  const undoApplied = (i: number) => {
    setApplied(prev => prev.filter((_, idx) => idx !== i));
  };

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-6 md:p-8">No data.</main>;

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-5 md:px-8 md:py-8">
      {/* Editorial header */}
      <header className="mb-8 pb-6 border-b border-border">
        <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-800 mb-3">
          Configuration · recruiter-editable
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-text tracking-tight display-tight leading-[1.05] mb-3">
          Taxonomy editor
        </h1>
        <p className="text-base text-dim max-w-2xl leading-snug">
          Claude reviews the pool every week and proposes rule updates — new title patterns for
          job titles it saw, skill synonyms it's confident about, generic-employer tokens creating
          false warm paths. You approve, edit, or reject each one. Nothing writes to
          <code className="text-[13px] mx-1">config/taxonomy.yaml</code>
          without your sign-off.
        </p>

        {/* Analysis meta row */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-mute">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Claude analysed {pool.candidates.length} candidates · last run{" "}
            <span className="font-mono text-dim">{lastAnalysed || "—"}</span>
          </div>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="ml-auto inline-flex items-center gap-1.5 text-xs bg-white border border-border rounded-md px-3 py-1.5 font-medium hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50"
          >
            {regenerating ? (
              <>
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                Re-analysing pool…
              </>
            ) : (
              <>
                <Icon name="sparkles" className="w-3.5 h-3.5" strokeWidth={2.25} />
                Regenerate suggestions
              </>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="min-w-0 space-y-8">
          {/* Suggestions panel */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                Suggested changes
              </h2>
              <span className="text-xs text-mute">{suggestions.length} pending your review</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="card p-10 text-center border-dashed">
                <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3">
                  <Icon name="check" className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="text-sm font-medium text-text">You're all caught up</div>
                <div className="text-xs text-mute mt-1">
                  {rejected.length > 0 ? "Rejected suggestions won't return until you Regenerate." : "Claude will re-scan the pool weekly. Manual edits available below."}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map(s => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    editing={editing === s.id}
                    editDraft={editing === s.id ? editDraft : null}
                    onEditChange={setEditDraft}
                    onApprove={() => approve(editing === s.id && editDraft ? editDraft : s, "claude")}
                    onReject={() => reject(s.id)}
                    onStartEdit={() => startEdit(s)}
                    onCancelEdit={() => { setEditing(null); setEditDraft(null); }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Manual entry — collapsible, secondary */}
          <section>
            <button
              onClick={() => setManualOpen(!manualOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-border bg-white hover:border-stone-300 group"
            >
              <div className="flex items-center gap-2.5">
                <Icon name="plus" className="w-4 h-4 text-mute group-hover:text-text" strokeWidth={2} />
                <span className="text-sm font-medium text-text">Add a rule manually</span>
                <span className="text-xs text-mute">— for edge cases Claude wouldn't spot</span>
              </div>
              <Icon name={manualOpen ? "chevron-down" : "chevron-right"} className="w-4 h-4 text-mute" strokeWidth={2} />
            </button>

            {manualOpen && (
              <ManualEntry
                onSubmit={(payload, kind, headline) => {
                  approve({
                    id: `manual-${Date.now()}`,
                    kind, headline,
                    rationale: "Added manually by recruiter.",
                    impact: "Applies on next pipeline run.",
                    payload,
                  }, "manual");
                  setManualOpen(false);
                }}
              />
            )}
          </section>

          {/* Current taxonomy summary — what's already in place */}
          <section>
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">
              Current taxonomy at a glance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryTile n={12} label="Role families" hint="ml_cv, backend, product, …" />
              <SummaryTile n={45} label="Skill synonyms" hint="PyTorch, AWS, Kafka, …" />
              <SummaryTile n={CURRENT_STOPLIST.length} label="Employer stopwords" hint="freelance, startup, IDF, …" />
              <SummaryTile n={68} label="Family evidence skills" hint="opencv → ml_cv, spark → data_eng, …" />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside>
          <div className="sticky top-4 space-y-3">
            <div className="card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-mute font-semibold">
                  Session changes
                </div>
                <span className="text-xs font-mono text-mute">{applied.length}</span>
              </div>
              {applied.length === 0 ? (
                <div className="text-xs text-mute italic">
                  Approve a suggestion or add one manually — it'll appear here.
                </div>
              ) : (
                <ul className="space-y-2">
                  {applied.map((a, i) => (
                    <li key={a.id} className="rounded-md border border-border-faint bg-white p-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`text-[9px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 ${
                          a.source === "claude" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"
                        }`}>
                          {a.source === "claude" ? "Claude" : "Manual"}
                        </span>
                        <button
                          onClick={() => undoApplied(i)}
                          className="text-mute hover:text-rose-600 flex-shrink-0"
                          aria-label="Undo"
                        >
                          <Icon name="close" className="w-3 h-3" strokeWidth={2} />
                        </button>
                      </div>
                      <div className="text-xs text-text leading-snug">{a.headline}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-4 bg-stone-50/60">
              <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">
                On save, we'd
              </div>
              <ol className="text-[11px] text-dim space-y-1.5 leading-relaxed">
                <li>1. Commit the patch to <code className="text-[10px]">config/taxonomy.yaml</code> in Git</li>
                <li>2. Kick off a re-gate on the pool</li>
                <li>3. Log to <code className="text-[10px]">wsc.taxonomy.change_events</code></li>
                <li>4. Email you a diff of who moved which direction</li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ------------ Suggestion card ------------ */

function SuggestionCard({
  suggestion, editing, editDraft,
  onEditChange, onApprove, onReject, onStartEdit, onCancelEdit,
}: {
  suggestion: Suggestion;
  editing: boolean;
  editDraft: Suggestion | null;
  onEditChange: (s: Suggestion | null) => void;
  onApprove: () => void;
  onReject: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const kindLabel = {
    title_pattern: "Title pattern",
    skill_synonym: "Skill synonym",
    employer_stopword: "Employer stopword",
    family_evidence: "Family evidence",
  }[suggestion.kind];

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
          <Icon name="sparkles" className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-50 rounded px-1.5 py-0.5">
              Claude · {kindLabel}
            </span>
          </div>

          {!editing ? (
            <>
              <div className="text-sm text-text font-medium leading-snug mb-2">
                {suggestion.headline}
              </div>
              <div className="text-xs text-mute mb-1 leading-relaxed">
                <strong className="text-dim">Why:</strong> {suggestion.rationale}
              </div>
              <div className="text-xs text-emerald-800 leading-relaxed mb-3">
                <strong>Impact:</strong> {suggestion.impact}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={onApprove}
                  className="text-xs bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md hover:bg-emerald-600 inline-flex items-center gap-1.5"
                >
                  <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Approve as-is
                </button>
                <button
                  onClick={onStartEdit}
                  className="text-xs bg-white border border-border text-text font-medium px-3 py-1.5 rounded-md hover:border-stone-400"
                >
                  Edit before approve
                </button>
                <button
                  onClick={onReject}
                  className="text-xs text-mute hover:text-rose-700 font-medium px-2 py-1.5"
                >
                  Reject
                </button>
              </div>
            </>
          ) : editDraft && (
            <EditForm
              draft={editDraft}
              onChange={onEditChange}
              onApprove={onApprove}
              onCancel={onCancelEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EditForm({
  draft, onChange, onApprove, onCancel,
}: {
  draft: Suggestion;
  onChange: (s: Suggestion) => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const patch = <K extends keyof Suggestion["payload"]>(key: K, value: Suggestion["payload"][K]) => {
    onChange({ ...draft, payload: { ...draft.payload, [key]: value } });
  };

  const fields = () => {
    switch (draft.kind) {
      case "title_pattern":
        return (
          <>
            <FieldLabel>Title pattern</FieldLabel>
            <input
              value={draft.payload.pattern ?? ""}
              onChange={e => patch("pattern", e.target.value.toLowerCase())}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
            <FieldLabel className="mt-3">Family</FieldLabel>
            <input
              value={draft.payload.family ?? ""}
              onChange={e => patch("family", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
          </>
        );
      case "skill_synonym":
        return (
          <>
            <FieldLabel>Required skill</FieldLabel>
            <input
              value={draft.payload.skill ?? ""}
              onChange={e => patch("skill", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
            />
            <FieldLabel className="mt-3">Alias</FieldLabel>
            <input
              value={draft.payload.alias ?? ""}
              onChange={e => patch("alias", e.target.value.toLowerCase())}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
            <FieldLabel className="mt-3">Tier</FieldLabel>
            <select
              value={draft.payload.tier ?? "family"}
              onChange={e => patch("tier", e.target.value as "exact" | "family")}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="exact">Exact (1.0 credit)</option>
              <option value="family">Family (0.6 credit)</option>
            </select>
          </>
        );
      case "employer_stopword":
        return (
          <>
            <FieldLabel>Stopword token</FieldLabel>
            <input
              value={draft.payload.token ?? ""}
              onChange={e => patch("token", e.target.value.toLowerCase())}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
          </>
        );
      case "family_evidence":
        return (
          <>
            <FieldLabel>Family</FieldLabel>
            <input
              value={draft.payload.family ?? ""}
              onChange={e => patch("family", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
            <FieldLabel className="mt-3">Evidence keyword</FieldLabel>
            <input
              value={draft.payload.keyword ?? ""}
              onChange={e => patch("keyword", e.target.value.toLowerCase())}
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-white"
            />
          </>
        );
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {fields()}
      <div className="flex gap-2 pt-3">
        <button
          onClick={onApprove}
          className="text-xs bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md hover:bg-emerald-600 inline-flex items-center gap-1.5"
        >
          <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
          Approve with edits
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-mute hover:text-text font-medium px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-[10px] uppercase tracking-wider text-mute font-semibold mb-1 ${className}`}>{children}</label>;
}

/* ------------ Manual entry (secondary, collapsible) ------------ */

function ManualEntry({ onSubmit }: {
  onSubmit: (payload: Suggestion["payload"], kind: Suggestion["kind"], headline: string) => void;
}) {
  const [kind, setKind] = useState<Suggestion["kind"]>("title_pattern");
  const [payload, setPayload] = useState<Suggestion["payload"]>({ family: "ml_cv", pattern: "" });

  return (
    <div className="card mt-2 p-4">
      <div className="flex gap-1 mb-4 border-b border-border-faint">
        {(["title_pattern", "skill_synonym", "employer_stopword", "family_evidence"] as const).map(k => (
          <button
            key={k}
            onClick={() => { setKind(k); setPayload({}); }}
            className={`px-3 py-1.5 text-xs font-medium -mb-px border-b-2 transition-colors ${
              kind === k ? "border-emerald-700 text-emerald-700" : "border-transparent text-mute hover:text-text"
            }`}
          >
            {k.replace("_", " ")}
          </button>
        ))}
      </div>

      <EditForm
        draft={{
          id: "manual",
          kind,
          headline: "",
          rationale: "",
          impact: "",
          payload,
        }}
        onChange={s => setPayload(s.payload)}
        onApprove={() => {
          const headline = describeManual(kind, payload);
          if (!headline) return;
          onSubmit(payload, kind, headline);
          setPayload({});
        }}
        onCancel={() => setPayload({})}
      />
    </div>
  );
}

function describeManual(kind: Suggestion["kind"], p: Suggestion["payload"]): string {
  switch (kind) {
    case "title_pattern":
      return p.pattern && p.family ? `Add "${p.pattern}" → ${p.family}` : "";
    case "skill_synonym":
      return p.skill && p.alias ? `Add "${p.alias}" as ${p.tier ?? "family"} alias of ${p.skill}` : "";
    case "employer_stopword":
      return p.token ? `Stopword: "${p.token}"` : "";
    case "family_evidence":
      return p.family && p.keyword ? `${p.family} += "${p.keyword}"` : "";
  }
}

function SummaryTile({ n, label, hint }: { n: number; label: string; hint: string }) {
  return (
    <div className="card p-3">
      <div className="text-2xl font-semibold text-text tabular font-mono">{n}</div>
      <div className="text-xs text-text font-medium mt-1">{label}</div>
      <div className="text-[10px] text-mute mt-1 truncate" title={hint}>{hint}</div>
    </div>
  );
}

/* ------------ Suggestion generation ------------
   In production this is a scheduled Claude call over the pool + gate events.
   Here we compute deterministic proposals from the current candidate data so
   the demo reflects real inputs. */

function generateSuggestions(candidates: Candidate[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // 1. Reject clustering — find rejects whose title contains a common word
  const rejectTitles = candidates.filter(c => c.gate.decision === "REJECT").map(c => c.title || "");
  const wordCounts: Record<string, number> = {};
  rejectTitles.forEach(t => {
    t.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length > 4 && !["senior", "junior", "manager", "engineer", "developer"].includes(w)) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    });
  });
  const clusteredWords = Object.entries(wordCounts).filter(([, n]) => n >= 2);
  clusteredWords.slice(0, 2).forEach(([word, count]) => {
    suggestions.push({
      id: `cluster-${word}`,
      kind: "title_pattern",
      headline: `Add "${word}" as a title pattern`,
      rationale: `Saw "${word}" in ${count} rejected candidate titles this week. If this is a role you'd hire for (or want to hold for review), map it to a family so it's not silently dropped.`,
      impact: `Would flip ${count} candidates from REJECT toward HOLD/ADMIT on next re-gate.`,
      payload: { family: "unknown", pattern: word },
    });
  });

  // 2. Skill hits in admits that aren't in known synonyms — new evidence
  const admitSkills: Record<string, number> = {};
  candidates.filter(c => c.gate.decision === "ADMIT").forEach(c => {
    (c.skills || []).forEach(s => {
      const sl = s.toLowerCase();
      if (sl.length > 3) admitSkills[sl] = (admitSkills[sl] || 0) + 1;
    });
  });
  const skillsWorthNoting = Object.entries(admitSkills).filter(([s, n]) =>
    n >= 3 && !["python", "aws", "java", "kafka", "docker", "kubernetes"].includes(s)
  );
  skillsWorthNoting.slice(0, 2).forEach(([skill, count]) => {
    suggestions.push({
      id: `evidence-${skill}`,
      kind: "family_evidence",
      headline: `Add "${skill}" as evidence for a role family`,
      rationale: `Seen in ${count} admitted candidates but not currently in any family's evidence list. Adding it strengthens the gate's skills check.`,
      impact: `Improves signal 2 confirmation without changing any existing scores.`,
      payload: { family: "ml_general", keyword: skill },
    });
  });

  // 3. Frequent generic-looking employer strings
  const employers: Record<string, number> = {};
  candidates.forEach(c => (c.past_companies || []).forEach(e => {
    const el = e.toLowerCase().trim();
    if (el.length < 15 && (el.includes("consulting") || el.includes("solutions") || el.includes("services"))) {
      employers[el] = (employers[el] || 0) + 1;
    }
  }));
  const candidateStopwords = Object.entries(employers).filter(([, n]) => n >= 2);
  candidateStopwords.slice(0, 1).forEach(([token, count]) => {
    suggestions.push({
      id: `stopword-${token}`,
      kind: "employer_stopword",
      headline: `Consider "${token}" as a stopword`,
      rationale: `Appears in ${count} candidate profiles but is generic — a person listing "${token}" doesn't mean they share a company with anyone specific.`,
      impact: `Would remove ~${count * 2} false warm-path signals across the pool.`,
      payload: { token },
    });
  });

  // 4. Static baseline suggestion so the demo always has at least one to review
  if (suggestions.length < 3) {
    suggestions.push({
      id: "static-pytorch-torch",
      kind: "skill_synonym",
      headline: `Add "torch" as an exact alias of PyTorch`,
      rationale: `Recent LinkedIn profiles frequently list "torch" or "torch 2.x" instead of "PyTorch". Currently we'd miss those in required-skills matching.`,
      impact: `Would raise required-skills scores on 4 candidates for JOB001 (Senior ML Engineer).`,
      payload: { skill: "PyTorch", alias: "torch", tier: "exact" },
    });
  }

  return suggestions;
}
