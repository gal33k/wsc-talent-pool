// Weighted-sum recombination ONLY. Never a scoring rule.
//
// The Python pipeline computes weight-independent 0-1 components per candidate.
// This module aggregates them under whatever weights the user has set in the
// tuner. With default weights, the result MUST equal Python's score_default
// to 1 decimal place — asserted on mount in useAssertParity.

import type {
  FitComponents,
  FitWeights,
  WarmthComponents,
  WarmthWeights,
  SignalComponents,
  SignalWeights,
  Tiers,
} from "./types";

export function computeFit(c: FitComponents, w: FitWeights): number {
  const total = w.required_skills + w.role_family + w.seniority + w.domain + w.nice_to_have;
  if (total <= 0) return 0;
  const weighted =
    c.required_skills * w.required_skills +
    c.role_family * w.role_family +
    c.seniority * w.seniority +
    c.domain * w.domain +
    c.nice_to_have * w.nice_to_have;
  return Math.round((weighted / total) * 1000) / 10;
}

// New: signal (renamed from warmth) — 8 components covering endorsements,
// team overlap, culture affinity, engagement, and passive reachability.
export function computeSignal(c: SignalComponents, w: SignalWeights): number {
  const total =
    w.peer_vouch + w.same_team_overlap + w.cross_team_vouch + w.culture_affinity +
    w.prior_wsc_engagement + w.recency + w.notes_present + w.mutual_connections;
  if (total <= 0) return 0;
  const weighted =
    c.peer_vouch            * w.peer_vouch +
    c.same_team_overlap     * w.same_team_overlap +
    c.cross_team_vouch      * w.cross_team_vouch +
    c.culture_affinity      * w.culture_affinity +
    c.prior_wsc_engagement  * w.prior_wsc_engagement +
    c.recency               * w.recency +
    c.notes_present         * w.notes_present +
    c.mutual_connections    * w.mutual_connections;
  return Math.round((weighted / total) * 1000) / 10;
}

// Backwards-compatible alias. Callers passing WarmthWeights + WarmthComponents
// still work — internally we dispatch to computeSignal.
export function computeWarmth(c: WarmthComponents | SignalComponents, w: WarmthWeights | SignalWeights): number {
  // Detect signal (8-component) vs warmth (4-component) shape.
  if ("peer_vouch" in c && "peer_vouch" in w) {
    return computeSignal(c as SignalComponents, w as SignalWeights);
  }
  // Legacy warmth path
  const wc = c as WarmthComponents;
  const ww = w as WarmthWeights;
  const total = ww.mutual_connections + ww.shared_employer + ww.recency + ww.notes_present;
  if (total <= 0) return 0;
  const weighted =
    wc.mutual_connections * ww.mutual_connections +
    wc.shared_employer * ww.shared_employer +
    wc.recency * ww.recency +
    wc.notes_present * ww.notes_present;
  return Math.round((weighted / total) * 1000) / 10;
}

export type Tier = "call_this_week" | "direct_outreach" | "nurture" | null;

export function assignTier(fit: number, warmth: number, tiers: Tiers): Tier {
  if (fit >= tiers.call_this_week.min_fit && warmth >= tiers.call_this_week.min_warmth) {
    return "call_this_week";
  }
  if (fit >= tiers.direct_outreach.min_fit) return "direct_outreach";
  if (fit >= tiers.nurture.min_fit) return "nurture";
  return null;
}

export const TIER_LABEL: Record<Exclude<Tier, null>, string> = {
  call_this_week: "Call this week",
  direct_outreach: "Direct outreach",
  nurture: "Nurture",
};

export const TIER_ORDER: Array<Exclude<Tier, null>> = [
  "call_this_week",
  "direct_outreach",
  "nurture",
];
