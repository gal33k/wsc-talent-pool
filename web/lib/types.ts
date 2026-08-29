// Types mirroring the JSON contract emitted by src/report.py.
// Keep in sync with docs/08-web-app.md.

export type FitWeights = {
  required_skills: number;
  role_family: number;
  seniority: number;
  domain: number;
  nice_to_have: number;
};

export type WarmthWeights = {
  mutual_connections: number;
  shared_employer: number;
  recency: number;
  notes_present: number;
};

// New 8-component Signal — replaces Warmth as the second scoring axis.
export type SignalWeights = {
  peer_vouch: number;
  same_team_overlap: number;
  cross_team_vouch: number;
  culture_affinity: number;
  prior_wsc_engagement: number;
  recency: number;
  notes_present: number;
  mutual_connections: number;
};

export type Tiers = {
  call_this_week: { min_fit: number; min_warmth: number };
  direct_outreach: { min_fit: number };
  nurture: { min_fit: number };
};

export type Defaults = {
  fit_weights: FitWeights;
  warmth_weights: WarmthWeights;
  signal_weights?: SignalWeights;
  tiers: Tiers;
};

export type Job = {
  job_id: string;
  title: string;
  department: string;
  seniority: string;
  role_family: string;   // from taxonomy.yaml::job_family_map — used for the "actively hiring" flag on the pool page
  key_domains: string[];
  required_skills: string[];
  nice_to_have: string[];
};

export type Employee = {
  employee_id: string;
  full_name: string;
  title: string;
  department: string;
  linkedin_id?: string;
};

export type GateSignals = {
  role_family: boolean;
  skills_evidence: boolean;
  proximity: boolean;
};

export type Gate = {
  decision: "ADMIT" | "HOLD" | "REJECT";
  signals: GateSignals;
  reason: string;
};

export type Mutual = {
  employee_id: string;
  name: string;
  title: string;
  department: string;
};

export type SharedEmployer = {
  employer: string;
  employee_id: string;
  name: string;
  title: string;
  department: string;
  overlap: string | null;
};

export type WarmthComponents = {
  mutual_connections: number;
  shared_employer: number;
  recency: number;
  notes_present: number;
};

export type SignalComponents = {
  peer_vouch: number;
  same_team_overlap: number;
  cross_team_vouch: number;
  culture_affinity: number;
  prior_wsc_engagement: number;
  recency: number;
  notes_present: number;
  mutual_connections: number;
};

export type Warmth = {
  components: WarmthComponents;
  score_default: number;
  mutuals: Mutual[];
  shared_employers: SharedEmployer[];
};

export type FitComponents = {
  required_skills: number;
  role_family: number;
  seniority: number;
  domain: number;
  nice_to_have: number;
};

export type FitForJob = {
  components: FitComponents;
  score_default: number;
  matched_required: string[];
  matched_required_family: string[];
  missing_required: string[];
  matched_nice_to_have: string[];
  critical_skills?: string[];
  missing_critical?: string[];
  seniority_flag: "in_band" | "above_band" | "below_band";
  excluded: { stage: string; reason: string } | null;
  best_intro_path: string;
  why_summary: string;
  outreach_draft: string;
};

export type ComeetStatus = {
  status: "active_in_process" | "previously_rejected" | "hired" | "declined_offer";
  role?: string;
  date?: string;
  notes?: string;
};

export type Candidate = {
  id: string;
  person_id: string;
  name: string;
  email: string;
  title: string;
  company: string;
  location: string;
  years_experience: number | null;
  linkedin_url: string;
  industry: string;
  skills: string[];
  past_titles: string[];
  past_companies: string[];
  conference: {
    name: string;
    domain: string;
    date: string;
    days_since: number;
  };
  notes: string;
  role_family: string;
  seniority_tier: number;
  data_confidence: "high" | "medium" | "low";
  enrichment_status: "full" | "partial" | "none";
  domain_relevance_score: number;
  gate: Gate;
  comeet_status: ComeetStatus | null;
  warmth: Warmth;
  jobs: Record<string, FitForJob>;
};

export type CallLogEntry = {
  ts: string;
  system: string;
  method: string;
  endpoint: string;
  result: string;
  payload: unknown;
};

export type Pool = {
  generated_at: string;
  config_version: string;
  defaults: Defaults;
  jobs: Job[];
  employees: Employee[];
  candidates: Candidate[];
  call_log: CallLogEntry[];
};
