"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Pool, FitWeights, WarmthWeights, SignalWeights, Tiers } from "./types";
import { computeFit, computeWarmth } from "./scoring";

// Signal weights (new 8-component) — the second-axis defaults live here so the
// context has a valid shape before pool.json loads. Overwritten with server
// defaults on load.
const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  peer_vouch: 35,
  same_team_overlap: 18,
  cross_team_vouch: 12,
  culture_affinity: 12,
  prior_wsc_engagement: 8,
  recency: 7,
  notes_present: 5,
  mutual_connections: 3,
};

export type OverrideEntry = {
  candidateId: string;
  jobId: string;
  reason: string;
  addedAt: string;
};

export type BlacklistEntry = {
  candidateId: string;
  reason: string;
  addedAt: string;
};

export type NoteEntry = {
  candidateId: string;
  text: string;
  updatedAt: string;
};

export type BqActivity = {
  ts: string;
  op: "INSERT" | "SELECT" | "UPDATE" | "DELETE";
  table: string;
  sql: string;
  rows?: number;
};

export type IntroStatus = "queued" | "sent" | "accepted" | "declined";

export type IntroRequest = {
  id: string;
  candidateId: string;
  candidateName: string;
  employeeId: string;
  employeeName: string;
  jobId: string;
  jobTitle: string;
  path: string;
  status: IntroStatus;
  requestedAt: string;
  updatedAt: string;
};

type Ctx = {
  pool: Pool | null;
  loading: boolean;
  error: string | null;
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;
  fitWeights: FitWeights;
  warmthWeights: WarmthWeights | SignalWeights;
  tiers: Tiers;
  setFitWeights: (w: FitWeights) => void;
  setWarmthWeights: (w: WarmthWeights | SignalWeights) => void;
  setTiers: (t: Tiers) => void;
  resetWeights: () => void;
  parityOk: boolean;

  // Human-in-the-loop
  overrides: OverrideEntry[];
  blacklist: BlacklistEntry[];
  notes: NoteEntry[];
  isOverridden: (candidateId: string, jobId: string) => OverrideEntry | undefined;
  isBlacklisted: (candidateId: string) => BlacklistEntry | undefined;
  getNote: (candidateId: string) => NoteEntry | undefined;
  overrideCandidate: (candidateId: string, jobId: string, reason: string) => void;
  removeOverride: (candidateId: string, jobId: string) => void;
  blacklistCandidate: (candidateId: string, reason: string) => void;
  unblacklistCandidate: (candidateId: string) => void;
  saveNote: (candidateId: string, text: string) => void;

  // BigQuery mock activity (session-only)
  bqActivity: BqActivity[];
  logBq: (entry: Omit<BqActivity, "ts">) => void;

  // Outreach queue — intro requests the recruiter has fired
  introRequests: IntroRequest[];
  getIntroRequest: (candidateId: string, jobId: string) => IntroRequest | undefined;
  requestIntro: (args: {
    candidateId: string; candidateName: string;
    employeeId: string;  employeeName: string;
    jobId: string;       jobTitle: string;
    path: string;
  }) => void;
  updateIntroStatus: (id: string, status: IntroStatus) => void;
  cancelIntroRequest: (id: string) => void;
};

const PoolContext = createContext<Ctx | null>(null);

export function PoolProvider({ children }: { children: ReactNode }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("JOB001");
  const [fitWeights, setFitWeights] = useState<FitWeights>({
    required_skills: 35, role_family: 25, seniority: 15, domain: 15, nice_to_have: 10,
  });
  // The `warmthWeights` state name is kept for backward-compat with call sites,
  // but its VALUE is now the 8-component Signal weights (see DEFAULT_SIGNAL_WEIGHTS).
  // computeWarmth() dispatches to computeSignal based on shape.
  const [warmthWeights, setWarmthWeights] = useState<WarmthWeights | SignalWeights>(
    DEFAULT_SIGNAL_WEIGHTS
  );
  const [tiers, setTiers] = useState<Tiers>({
    call_this_week: { min_fit: 70, min_warmth: 50 },
    direct_outreach: { min_fit: 70 },
    nurture: { min_fit: 45 },
  });
  const [parityOk, setParityOk] = useState(true);

  // Session-only human-in-the-loop state.
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [bqActivity, setBqActivity] = useState<BqActivity[]>([]);
  const [introRequests, setIntroRequests] = useState<IntroRequest[]>([]);

  useEffect(() => {
    fetch("/data/pool.json")
      .then(r => {
        if (!r.ok) throw new Error("failed to load pool.json");
        return r.json();
      })
      .then((data: Pool) => {
        setPool(data);
        setFitWeights(data.defaults.fit_weights);
        // Prefer the new 8-component signal_weights emitted by the pipeline;
        // fall back to legacy warmth_weights for older pool.json files.
        setWarmthWeights(data.defaults.signal_weights ?? data.defaults.warmth_weights);
        setTiers(data.defaults.tiers);

        let ok = true;
        for (const c of data.candidates) {
          for (const [jid, fit] of Object.entries(c.jobs)) {
            const recomputed = computeFit(fit.components, data.defaults.fit_weights);
            if (Math.abs(recomputed - fit.score_default) > 0.11) {
              console.warn(
                `[parity] candidate=${c.id} job=${jid} python=${fit.score_default} js=${recomputed}`
              );
              ok = false;
            }
          }
          const wr = computeWarmth(c.warmth.components, data.defaults.warmth_weights);
          if (Math.abs(wr - c.warmth.score_default) > 0.11) {
            console.warn(
              `[parity] warmth candidate=${c.id} python=${c.warmth.score_default} js=${wr}`
            );
            ok = false;
          }
        }
        setParityOk(ok);
        setLoading(false);

        // Simulate the mocked BigQuery seed load — the initial pool ingestion event.
        setBqActivity([{
          ts: new Date().toISOString(),
          op: "INSERT",
          table: "wsc.talent_pool.contacts",
          sql: `INSERT INTO wsc.talent_pool.contacts (hubspot_id, source_channel, role_family, gate_decision, fit_score, warmth_score, ingested_at)\nSELECT * FROM UNNEST(<${data.candidates.length}> rows) -- pool.json seed`,
          rows: data.candidates.length,
        }]);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  const resetWeights = () => {
    if (!pool) return;
    setFitWeights(pool.defaults.fit_weights);
    setWarmthWeights(pool.defaults.signal_weights ?? pool.defaults.warmth_weights);
    setTiers(pool.defaults.tiers);
  };

  // Human-in-the-loop
  const isOverridden = useCallback(
    (candidateId: string, jobId: string) =>
      overrides.find(o => o.candidateId === candidateId && o.jobId === jobId),
    [overrides]
  );
  const isBlacklisted = useCallback(
    (candidateId: string) => blacklist.find(b => b.candidateId === candidateId),
    [blacklist]
  );
  const getNote = useCallback(
    (candidateId: string) => notes.find(n => n.candidateId === candidateId),
    [notes]
  );

  const logBq = useCallback((entry: Omit<BqActivity, "ts">) => {
    setBqActivity(prev => [{ ts: new Date().toISOString(), ...entry }, ...prev]);
  }, []);

  const overrideCandidate = useCallback((candidateId: string, jobId: string, reason: string) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.candidateId === candidateId && o.jobId === jobId);
      const entry = { candidateId, jobId, reason, addedAt: new Date().toISOString() };
      return existing
        ? prev.map(o => (o === existing ? entry : o))
        : [...prev, entry];
    });
    logBq({
      op: "INSERT",
      table: "wsc.hitl.overrides",
      sql: `INSERT INTO wsc.hitl.overrides (contact_id, job_id, reason, actor, ts)\nVALUES ('${candidateId}', '${jobId}', ${JSON.stringify(reason)}, 'recruiter@wsc', CURRENT_TIMESTAMP())`,
      rows: 1,
    });
  }, [logBq]);

  const removeOverride = useCallback((candidateId: string, jobId: string) => {
    setOverrides(prev => prev.filter(o => !(o.candidateId === candidateId && o.jobId === jobId)));
    logBq({
      op: "DELETE",
      table: "wsc.hitl.overrides",
      sql: `DELETE FROM wsc.hitl.overrides WHERE contact_id = '${candidateId}' AND job_id = '${jobId}'`,
      rows: 1,
    });
  }, [logBq]);

  const blacklistCandidate = useCallback((candidateId: string, reason: string) => {
    setBlacklist(prev => {
      const existing = prev.find(b => b.candidateId === candidateId);
      const entry = { candidateId, reason, addedAt: new Date().toISOString() };
      return existing
        ? prev.map(b => (b === existing ? entry : b))
        : [...prev, entry];
    });
    logBq({
      op: "INSERT",
      table: "wsc.hitl.blacklist",
      sql: `INSERT INTO wsc.hitl.blacklist (contact_id, reason, actor, ts)\nVALUES ('${candidateId}', ${JSON.stringify(reason)}, 'recruiter@wsc', CURRENT_TIMESTAMP())`,
      rows: 1,
    });
  }, [logBq]);

  const unblacklistCandidate = useCallback((candidateId: string) => {
    setBlacklist(prev => prev.filter(b => b.candidateId !== candidateId));
    logBq({
      op: "DELETE",
      table: "wsc.hitl.blacklist",
      sql: `DELETE FROM wsc.hitl.blacklist WHERE contact_id = '${candidateId}'`,
      rows: 1,
    });
  }, [logBq]);

  const getIntroRequest = useCallback(
    (candidateId: string, jobId: string) =>
      introRequests.find(r => r.candidateId === candidateId && r.jobId === jobId),
    [introRequests]
  );

  const requestIntro = useCallback((args: {
    candidateId: string; candidateName: string;
    employeeId: string;  employeeName: string;
    jobId: string;       jobTitle: string;
    path: string;
  }) => {
    const now = new Date().toISOString();
    const id = `intro-${Date.now().toString(36)}`;
    setIntroRequests(prev => {
      // idempotent per (candidate, job) — one open request at a time
      const existing = prev.find(r => r.candidateId === args.candidateId && r.jobId === args.jobId);
      if (existing) return prev;
      return [{
        id, ...args,
        status: "queued" as IntroStatus,
        requestedAt: now,
        updatedAt: now,
      }, ...prev];
    });
    // In production this is a mock_notifier.send() → Slack DM to the employee
    // plus a BigQuery insert into wsc.outreach.intro_requests.
    logBq({
      op: "INSERT",
      table: "wsc.outreach.intro_requests",
      sql: `INSERT INTO wsc.outreach.intro_requests (id, contact_id, employee_id, job_id, status, requested_by, requested_at)\nVALUES ('${id}', '${args.candidateId}', '${args.employeeId}', '${args.jobId}', 'queued', 'recruiter@wsc', CURRENT_TIMESTAMP())`,
      rows: 1,
    });
  }, [logBq]);

  const updateIntroStatus = useCallback((id: string, status: IntroStatus) => {
    setIntroRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r)
    );
    logBq({
      op: "UPDATE",
      table: "wsc.outreach.intro_requests",
      sql: `UPDATE wsc.outreach.intro_requests SET status = '${status}', updated_at = CURRENT_TIMESTAMP() WHERE id = '${id}'`,
      rows: 1,
    });
  }, [logBq]);

  const cancelIntroRequest = useCallback((id: string) => {
    setIntroRequests(prev => prev.filter(r => r.id !== id));
    logBq({
      op: "DELETE",
      table: "wsc.outreach.intro_requests",
      sql: `DELETE FROM wsc.outreach.intro_requests WHERE id = '${id}'`,
      rows: 1,
    });
  }, [logBq]);

  const saveNote = useCallback((candidateId: string, text: string) => {
    setNotes(prev => {
      const existing = prev.find(n => n.candidateId === candidateId);
      const entry = { candidateId, text, updatedAt: new Date().toISOString() };
      return existing
        ? prev.map(n => (n === existing ? entry : n))
        : [...prev, entry];
    });
    logBq({
      op: "UPDATE",
      table: "wsc.hitl.recruiter_notes",
      sql: `MERGE INTO wsc.hitl.recruiter_notes t USING (SELECT '${candidateId}' AS contact_id) s ON t.contact_id = s.contact_id\nWHEN MATCHED THEN UPDATE SET text = ${JSON.stringify(text.slice(0, 60))}, updated_at = CURRENT_TIMESTAMP()\nWHEN NOT MATCHED THEN INSERT VALUES (s.contact_id, ${JSON.stringify(text.slice(0, 60))}, CURRENT_TIMESTAMP())`,
      rows: 1,
    });
  }, [logBq]);

  return (
    <PoolContext.Provider value={{
      pool, loading, error, selectedJobId, setSelectedJobId,
      fitWeights, warmthWeights, tiers,
      setFitWeights, setWarmthWeights, setTiers,
      resetWeights, parityOk,
      overrides, blacklist, notes,
      isOverridden, isBlacklisted, getNote,
      overrideCandidate, removeOverride, blacklistCandidate, unblacklistCandidate, saveNote,
      bqActivity, logBq,
      introRequests, getIntroRequest, requestIntro, updateIntroStatus, cancelIntroRequest,
    }}>
      {children}
    </PoolContext.Provider>
  );
}

export function usePool(): Ctx {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error("usePool must be used inside PoolProvider");
  return ctx;
}
