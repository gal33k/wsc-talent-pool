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

export function computeWarmth(c: WarmthComponents, w: WarmthWeights): number {
  const total = w.mutual_connections + w.shared_employer + w.recency + w.notes_present;
  if (total <= 0) return 0;
  const weighted =
    c.mutual_connections * w.mutual_connections +
    c.shared_employer * w.shared_employer +
    c.recency * w.recency +
    c.notes_present * w.notes_present;
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
