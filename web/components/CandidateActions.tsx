"use client";

import { useState } from "react";
import { usePool } from "@/lib/data";
import { Icon } from "./Icon";

export default function CandidateActions({
  candidateId, jobId, jobTitle,
}: { candidateId: string; jobId: string; jobTitle: string }) {
  const {
    isOverridden, isBlacklisted, getNote,
    overrideCandidate, removeOverride,
    blacklistCandidate, unblacklistCandidate,
    saveNote,
    logBq,
  } = usePool();

  const currentOverride = isOverridden(candidateId, jobId);
  const currentBlacklist = isBlacklisted(candidateId);
  const currentNote = getNote(candidateId);

  const [mode, setMode] = useState<null | "override" | "blacklist" | "note">(null);
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

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="shield" className="w-4 h-4 text-amber-700" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-amber-900">Recruiter actions</h3>
        <span className="text-[10px] text-amber-800/70 uppercase tracking-wider ml-auto">Human in the loop</span>
      </div>

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
