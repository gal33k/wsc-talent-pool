"use client";

import { useState } from "react";
import { usePool } from "@/lib/data";
import { Icon } from "./Icon";

export default function CandidateActions({
  candidateId, jobId, jobTitle, gateDecision,
}: { candidateId: string; jobId: string; jobTitle: string; gateDecision?: "ADMIT" | "HOLD" | "REJECT" }) {
  const {
    isOverridden, isBlacklisted, getNote,
    overrideCandidate, removeOverride,
    blacklistCandidate, unblacklistCandidate,
    saveNote,
    getGateOverride, overrideGate, removeGateOverride,
    logBq,
  } = usePool();

  const currentOverride = isOverridden(candidateId, jobId);
  const currentBlacklist = isBlacklisted(candidateId);
  const currentNote = getNote(candidateId);
  const currentGateOverride = getGateOverride(candidateId);
  const effectiveGate = currentGateOverride?.newDecision ?? gateDecision;

  const [mode, setMode] = useState<null | "override" | "blacklist" | "note" | "gate-admit" | "gate-reject">(null);
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState(currentNote?.text ?? "");
  const [pushedHubspot, setPushedHubspot] = useState(false);
  const [pushedComeet,  setPushedComeet]  = useState(false);

  const promoteToHubSpot = () => {
    setPushedHubspot(true);
    logBq({
      op: "UPDATE",
      table: "wsc.talent_pool.contacts",
      sql: `PATCH /crm/v3/objects/contacts/${candidateId}\n  properties: {\n    talent_pool_status: 'active_lead',\n    top_role_id: '${jobId}',\n    top_role_title: ${JSON.stringify(jobTitle)},\n    promoted_at: CURRENT_TIMESTAMP()\n  }`,
      rows: 1,
    });
  };

  const promoteToComeet = () => {
    setPushedComeet(true);
    logBq({
      op: "INSERT",
      table: "wsc.outreach.comeet_pushes",
      sql: `POST /positions/${jobId}/candidates\n  { contact_id: '${candidateId}', source: 'sourced', pushed_by: 'recruiter@wsc' }`,
      rows: 1,
    });
  };

  const openMode = (m: NonNullable<typeof mode>) => {
    setReason("");
    setMode(m);
  };

  const submitOverride = () => {
    if (!reason.trim()) return;
    overrideCandidate(candidateId, jobId, reason.trim());
    setMode(null);
  };
  const submitBlacklist = () => {
    if (!reason.trim()) return;
    blacklistCandidate(candidateId, reason.trim());
    setMode(null);
  };
  const submitNote = () => {
    saveNote(candidateId, noteText.trim());
    setMode(null);
  };
  const submitGateAdmit = () => {
    if (!reason.trim()) return;
    overrideGate(candidateId, "ADMIT", reason.trim());
    setMode(null);
  };
  const submitGateReject = () => {
    if (!reason.trim()) return;
    overrideGate(candidateId, "REJECT", reason.trim());
    setMode(null);
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="shield" className="w-4 h-4 text-amber-700" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-amber-900">Recruiter actions</h3>
        <span className="text-[10px] text-amber-800/70 uppercase tracking-wider ml-auto">Human in the loop</span>
      </div>

      {currentGateOverride && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 mb-3 text-xs ${
          currentGateOverride.newDecision === "ADMIT"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-slate-50 border-slate-200"
        }`}>
          <Icon
            name={currentGateOverride.newDecision === "ADMIT" ? "check" : "close"}
            className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${currentGateOverride.newDecision === "ADMIT" ? "text-emerald-700" : "text-slate-600"}`}
            strokeWidth={2.5}
          />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${currentGateOverride.newDecision === "ADMIT" ? "text-emerald-900" : "text-slate-900"}`}>
              Recruiter override: gate {gateDecision ?? "?"} → <span className="font-semibold">{currentGateOverride.newDecision}</span>
            </div>
            <div className="text-mute mt-0.5 italic">&ldquo;{currentGateOverride.reason}&rdquo;</div>
          </div>
          <button
            onClick={() => removeGateOverride(candidateId)}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {(currentOverride || currentBlacklist || currentNote) && (
        <div className="space-y-1.5 mb-3 text-xs">
          {currentOverride && (
            <div className="flex items-start gap-2 rounded-md bg-white border border-amber-200 px-3 py-2">
              <Icon name="alert" className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-amber-900">Marked &ldquo;not a fit&rdquo; for {jobId}</div>
                <div className="text-mute mt-0.5 italic">&ldquo;{currentOverride.reason}&rdquo;</div>
              </div>
              <button
                onClick={() => removeOverride(candidateId, jobId)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
              >
                Undo
              </button>
            </div>
          )}
          {currentBlacklist && (
            <div className="flex items-start gap-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
              <Icon name="close" className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-rose-900">Blacklisted — excluded from all scoring</div>
                <div className="text-mute mt-0.5 italic">&ldquo;{currentBlacklist.reason}&rdquo;</div>
              </div>
              <button
                onClick={() => unblacklistCandidate(candidateId)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
              >
                Undo
              </button>
            </div>
          )}
          {currentNote && (
            <div className="flex items-start gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
              <Icon name="message" className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text">Note</div>
                <div className="text-mute mt-0.5 whitespace-pre-wrap">{currentNote.text}</div>
              </div>
              <button
                onClick={() => { setNoteText(currentNote.text); openMode("note"); }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {mode === null && (
        <div className="space-y-3">
          {/* Gate decision override — only visible if the pipeline landed HOLD or REJECT.
              For ADMIT candidates the gate isn't in play, so we hide this section. */}
          {(effectiveGate === "HOLD" || effectiveGate === "REJECT") && !currentGateOverride && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-indigo-800 font-semibold mb-1">
                Gate decision — currently <span className="font-bold">{effectiveGate}</span>
              </div>
              <div className="text-[11px] text-indigo-900/80 mb-2">
                {effectiveGate === "HOLD"
                  ? "The pipeline is on the fence. You're the tiebreaker — admit them to the pool, or confirm the reject."
                  : "The pipeline rejected this profile. If you disagree, admit them to the pool anyway."}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => openMode("gate-admit")}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 font-medium flex items-center gap-1.5"
                >
                  <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Admit to pool
                </button>
                {effectiveGate === "HOLD" && (
                  <button
                    onClick={() => openMode("gate-reject")}
                    className="text-xs px-3 py-1.5 rounded-md border border-border bg-white hover:border-slate-400 text-slate-800 font-medium flex items-center gap-1.5"
                  >
                    <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Confirm reject
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Positive path — push the candidate forward */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold mb-1.5">Advance in the pipeline</div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={promoteToHubSpot}
                disabled={pushedHubspot}
                className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 border transition-colors ${
                  pushedHubspot
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default"
                    : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                }`}
                title="Write talent-pool properties on the HubSpot contact + queue a sourced-lead task"
              >
                <Icon name={pushedHubspot ? "check" : "arrow-right"} className="w-3.5 h-3.5" strokeWidth={2.5} />
                {pushedHubspot ? "Pushed to HubSpot" : "Push to HubSpot as pool lead"}
              </button>
              <button
                onClick={promoteToComeet}
                disabled={pushedComeet}
                className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 border transition-colors ${
                  pushedComeet
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default"
                    : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500"
                }`}
                title={`POST this candidate to Comeet as a sourced candidate for ${jobId}`}
              >
                <Icon name={pushedComeet ? "check" : "briefcase"} className="w-3.5 h-3.5" strokeWidth={2.5} />
                {pushedComeet ? `Pushed to Comeet · ${jobId}` : `Push to Comeet as sourced (${jobId})`}
              </button>
            </div>
            <div className="text-[10px] text-emerald-800/70 mt-1.5 italic">
              HubSpot push flags the contact as an active pool lead. Comeet push creates a
              &ldquo;sourced&rdquo; candidate row for this specific role — starts the ATS workflow.
            </div>
          </div>

          {/* Negative path — filter / blacklist / annotate */}
          <div className="pt-3 border-t border-amber-200/70">
            <div className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold mb-1.5">Recruiter overrides</div>
            <div className="flex gap-2 flex-wrap">
              {!currentOverride && (
                <button
                  onClick={() => openMode("override")}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-white hover:border-amber-400 text-amber-900 font-medium flex items-center gap-1.5"
                >
                  <Icon name="filter" className="w-3.5 h-3.5" strokeWidth={2} />
                  Not a fit for {jobId}
                </button>
              )}
              {!currentBlacklist && (
                <button
                  onClick={() => openMode("blacklist")}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-white hover:border-rose-400 text-rose-900 font-medium flex items-center gap-1.5"
                >
                  <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Blacklist globally
                </button>
              )}
              {!currentNote && (
                <button
                  onClick={() => { setNoteText(""); openMode("note"); }}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-white hover:border-emerald-500 text-emerald-900 font-medium flex items-center gap-1.5"
                >
                  <Icon name="message" className="w-3.5 h-3.5" strokeWidth={2} />
                  Add note
                </button>
              )}
            </div>
            <div className="text-[10px] text-amber-800/70 mt-1.5 italic">
              Overrides win over the model — the recruiter is the final call. Every action logs a mock BigQuery insert.
            </div>
          </div>
        </div>
      )}

      {mode === "gate-admit" && (
        <div className="rounded-md border border-emerald-300 bg-white p-3">
          <div className="text-xs font-semibold text-emerald-900 mb-1.5 flex items-center gap-1.5">
            <Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} />
            Admit {candidateName(candidateId)} to the pool
          </div>
          <div className="text-[11px] text-mute mb-2">
            Overrides the gate ({gateDecision ?? "HOLD"} → ADMIT). They&rsquo;ll be scored against every
            open role and become eligible for shortlists. Undo any time.
          </div>
          <label htmlFor="ga-reason" className="block text-xs font-medium text-text mb-1.5">
            Why admit? <span className="text-red-600">*</span>
          </label>
          <textarea
            id="ga-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            placeholder="e.g. Talked at the booth — strong ML background, gate missed the domain match."
          />
          <div className="flex gap-2 mt-3">
            <button onClick={submitGateAdmit} disabled={!reason.trim()}
                    className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-md hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium">
              Confirm admit
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-mute hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {mode === "gate-reject" && (
        <div className="rounded-md border border-slate-300 bg-white p-3">
          <div className="text-xs font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
            <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2.5} />
            Confirm reject for {candidateName(candidateId)}
          </div>
          <div className="text-[11px] text-mute mb-2">
            Locks in a REJECT on this HOLD. They stay in the audit view but won&rsquo;t surface in any
            shortlist. Undo any time. Blacklist (below) is stronger — use this if the gate was right.
          </div>
          <label htmlFor="gr-reason" className="block text-xs font-medium text-text mb-1.5">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="gr-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            placeholder="e.g. Adjacent industry, no ML signal on the profile. Gate was right."
          />
          <div className="flex gap-2 mt-3">
            <button onClick={submitGateReject} disabled={!reason.trim()}
                    className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium">
              Confirm reject
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-mute hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {mode === "override" && (
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <label htmlFor="ov-reason" className="block text-xs font-medium text-text mb-1.5">
            Why isn&rsquo;t {candidateName(candidateId)} a fit for <span className="font-semibold">{jobTitle}</span>?
          </label>
          <textarea
            id="ov-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            placeholder="e.g. Excellent CV background but seniority is above the band we're hiring for right now."
          />
          <div className="text-[11px] text-mute mt-1.5">
            They&rsquo;ll stay in the pool and remain scored for other roles. Undo any time.
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={submitOverride} disabled={!reason.trim()}
                    className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium">
              Confirm — hide from this role
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-mute hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {mode === "blacklist" && (
        <div className="rounded-md border border-rose-300 bg-white p-3">
          <div className="text-xs font-semibold text-rose-900 mb-1.5 flex items-center gap-1.5">
            <Icon name="alert" className="w-3.5 h-3.5" strokeWidth={2.25} />
            Blacklist is permanent (until you undo it)
          </div>
          <div className="text-[11px] text-mute mb-2">
            Removes {candidateName(candidateId)} from every open role and every future ranking. The
            profile stays in the pool for audit but never surfaces in a shortlist.
          </div>
          <label htmlFor="bl-reason" className="block text-xs font-medium text-text mb-1.5">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="bl-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} autoFocus
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            placeholder="e.g. Previous conduct issue reported. Do not re-approach."
          />
          <div className="flex gap-2 mt-3">
            <button onClick={submitBlacklist} disabled={!reason.trim()}
                    className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium">
              Confirm blacklist
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-mute hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {mode === "note" && (
        <div className="rounded-md border border-indigo-200 bg-white p-3">
          <label htmlFor="nt-text" className="block text-xs font-medium text-text mb-1.5">
            Recruiter note
          </label>
          <textarea
            id="nt-text" value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} autoFocus
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
            placeholder="e.g. Interested but not until Q2 — reach out again in March."
          />
          <div className="text-[11px] text-mute mt-1.5">
            Notes are visible across all roles this candidate appears in.
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={submitNote}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 font-medium">
              Save note
            </button>
            <button onClick={() => setMode(null)} className="text-xs text-mute hover:text-text">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

// Display a placeholder because we only pass the id in — CandidateActions doesn't
// need the full candidate object, and this keeps the component light.
function candidateName(id: string): string { return `this candidate (${id})`; }
