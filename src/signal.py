"""Stage 7: signal_score + best intro path.

The second axis of Decision B. Renamed from "warmth" because reachability alone
is too narrow. Signal = everything non-competence that predicts a candidate
would convert AND fit here:

  - Peer vouch (same-team WSC endorsement, weighted by role match × tenure)
  - Same-team overlap without vouch (shared employer/team, no endorsement)
  - Cross-team vouch (WSC endorsement from a different area)
  - Culture affinity (OSS in our stack, domain-topic engagement)
  - Prior WSC engagement (past events, follows, mentions)
  - Recency of contact
  - Recruiter notes present
  - LinkedIn mutuals (bare reachability — the weakest signal)

No competence signal enters this axis. Same-department preference lives in
intro-path selection only (see best_intro_path) so the score stays job-agnostic.
"""
from __future__ import annotations

import re
from datetime import date

from .config import scoring, taxonomy
from .normalize import canonical_employer, is_generic_employer


_YEAR_RANGE = re.compile(r"\((\d{4})[-–](\d{4}|present)\)", re.IGNORECASE)


def _parse_year_range(text: str) -> tuple[int, int] | None:
    m = _YEAR_RANGE.search(text or "")
    if not m:
        return None
    start = int(m.group(1))
    end = date.today().year if m.group(2).lower() == "present" else int(m.group(2))
    return (start, end)


def _employer_from_work_history_entry(entry: str) -> str:
    return _YEAR_RANGE.sub("", entry).strip()


def _employer_from_past_title_entry(entry: str) -> str:
    stripped = _YEAR_RANGE.sub("", entry).strip()
    if " at " in stripped:
        return stripped.split(" at ", 1)[1].strip()
    return stripped


def _parse_employee_employers(work_history: str) -> list[tuple[str, tuple[int, int] | None]]:
    out: list[tuple[str, tuple[int, int] | None]] = []
    for entry in (work_history or "").split(";"):
        raw = _employer_from_work_history_entry(entry)
        if not raw or is_generic_employer(raw):
            continue
        canon = canonical_employer(raw)
        if is_generic_employer(canon):
            continue
        out.append((canon, _parse_year_range(entry)))
    return out


def _parse_candidate_employers(candidate: dict) -> list[tuple[str, tuple[int, int] | None]]:
    out: list[tuple[str, tuple[int, int] | None]] = []
    for entry in candidate.get("past_titles") or []:
        raw = _employer_from_past_title_entry(entry)
        if not raw or is_generic_employer(raw):
            continue
        canon = canonical_employer(raw)
        if is_generic_employer(canon):
            continue
        out.append((canon, _parse_year_range(entry)))
    cc = (candidate.get("current_company") or "").strip()
    if cc and not is_generic_employer(cc):
        out.append((canonical_employer(cc), None))
    return out


def _overlap_years(a, b):
    if not a or not b:
        return None
    start = max(a[0], b[0])
    end = min(a[1], b[1])
    if end < start:
        return None
    return f"{start}-{end}" if end != start else str(start)


def _recency_component(candidate: dict, reference_date: date | None = None) -> float:
    cfg = scoring()
    conf_date = candidate.get("conference_date")
    if not conf_date:
        return 0.0
    try:
        parts = str(conf_date).split("-")
        y, m = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0.0
    today = reference_date or date.today()
    months = (today.year - y) * 12 + (today.month - m)
    return round(0.5 ** (max(0, months) / float(cfg["recency_half_life_months"])), 4)


def _months_since(hire_date_str: str, reference_date: date | None = None) -> int:
    """Return months between a YYYY-MM-DD hire date and today. 0 if unparseable."""
    if not hire_date_str:
        return 0
    try:
        y, m, d = map(int, hire_date_str.split("-"))
        today = reference_date or date.today()
        return max(0, (today.year - y) * 12 + (today.month - m))
    except (ValueError, IndexError):
        return 0


def _tenure_multiplier(months: int) -> float:
    """Walk the tenure bands descending, return the first match's multiplier."""
    cfg = scoring()
    bands = cfg.get("vouch_tenure", {}).get("senior_bands", [])
    for band in bands:
        if months >= band["min_months"]:
            return float(band["multiplier"])
    return 0.6  # fallback = < 6 months band


def _employee_role_family(employee: dict) -> str:
    """Infer role family for a WSC employee from their title. Kept simple —
    the same taxonomy patterns used for candidates apply."""
    title = (employee.get("title") or "").lower()
    if any(k in title for k in ("ml research", "ml engineer", "vision", "video ai")):
        return "ml_cv" if "vision" in title or "video" in title else "ml_general"
    if any(k in title for k in ("data engineer", "sports data analyst")):
        return "data_engineering"
    if "backend" in title:
        return "backend"
    if "frontend" in title:
        return "frontend"
    if "devops" in title or "sre" in title:
        return "platform_devops"
    if "product manager" in title or "head of product" in title:
        return "product"
    if "sales engineer" in title:
        return "sales_engineering"
    if "sports content" in title or "content" in title:
        return "content"
    if any(k in title for k in ("cto", "vp", "head of", "director")):
        return "leadership"
    return "other"


def _role_match_multiplier(employee: dict, job: dict) -> float:
    """The multiplier applied to a vouch, based on how well the vouching
    employee's role matches the target job's role family."""
    cfg = scoring()
    tax = taxonomy()
    matches = cfg.get("vouch_role_match", {})

    job_family = (tax.get("job_family_map") or {}).get(job["job_id"], "unknown")
    emp_family = _employee_role_family(employee)
    emp_dept = (employee.get("department") or "").lower()

    if emp_family == "leadership":
        return float(matches.get("leadership", 1.5))
    if emp_family == job_family:
        return float(matches.get("same_role_family", 3.0))

    # Same department — infer job's dept from role family (rough)
    job_dept_map = {
        "ml_cv": "ai/ml", "ml_general": "ai/ml",
        "backend": "engineering", "frontend": "engineering",
        "platform_devops": "engineering",
        "data_engineering": "data",
        "product": "product",
        "sales_engineering": "sales",
    }
    if job_dept_map.get(job_family) == emp_dept:
        return float(matches.get("same_department", 2.0))

    # Adjacent family — reuse role_family_adjacency map's presence as a signal
    adj_map = cfg.get("role_family_adjacency", {}).get(job_family, {})
    if isinstance(adj_map, dict) and emp_family in adj_map:
        return float(matches.get("adjacent_family", 1.3))

    return float(matches.get("cross_department", 1.0))


def _peer_vs_cross_split(shared: list[dict], job: dict) -> tuple[float, float]:
    """Split shared-employer overlaps into same-team and cross-team buckets.
    Returns (same_team_component, _). Cross-team overlaps get folded into the
    lower-weighted mutual/general bucket (they don't earn the same-team weight).
    """
    tax = taxonomy()
    job_family = (tax.get("job_family_map") or {}).get(job["job_id"], "unknown")

    same_team = 0
    for s in shared:
        # Look up the employee whose department maps to same team as job
        emp_family = _employee_role_family({"title": s.get("title", ""),
                                             "department": s.get("department", "")})
        if emp_family == job_family:
            same_team += 1
    return (same_team, len(shared) - same_team)


def _vouch_score(candidate: dict, employees: list[dict], job: dict,
                 reference_date: date | None = None) -> tuple[float, float, list[dict]]:
    """Compute peer_vouch and cross_team_vouch scores from active endorsements.

    Sources of an "active" endorsement (in priority):
      1. candidate.referred_by_employee_id — the candidate was submitted via
         /referrals with an attributed WSC employee (set at ingest for referral channel)
      2. candidate.recruiter_vouches — a list of {employee_id, note} added by
         a recruiter through the dossier (session state in this build)

    A shared LinkedIn mutual is NOT a vouch — it's a passive social-graph fact.

    Returns (peer_vouch_normalized_0_1, cross_team_vouch_normalized_0_1, evidence).
    """
    cfg = scoring()
    normalizer = float(cfg.get("vouch_normalizer", 3.75))
    tax = taxonomy()
    job_family = (tax.get("job_family_map") or {}).get(job["job_id"], "unknown")

    employees_by_id = {e["employee_id"]: e for e in employees}
    peer_total = 0.0
    cross_total = 0.0
    evidence: list[dict] = []

    active_vouch_ids: list[str] = []
    ref_id = candidate.get("referred_by_employee_id")
    if ref_id:
        active_vouch_ids.append(ref_id)
    for v in candidate.get("recruiter_vouches") or []:
        eid = v.get("employee_id") if isinstance(v, dict) else v
        if eid and eid not in active_vouch_ids:
            active_vouch_ids.append(eid)

    for eid in active_vouch_ids:
        emp = employees_by_id.get(eid)
        if not emp:
            continue
        role_mult = _role_match_multiplier(emp, job)
        tenure_mult = _tenure_multiplier(_months_since(emp.get("hire_date", ""), reference_date))
        composite = role_mult * tenure_mult
        normalized = min(1.0, composite / normalizer)

        emp_family = _employee_role_family(emp)
        # Peer bucket = same role family OR leadership; cross bucket = everything else
        is_peer = (emp_family == job_family) or (emp_family == "leadership")
        if is_peer:
            peer_total += normalized
        else:
            cross_total += normalized

        evidence.append({
            "employee_id": eid,
            "name": emp["full_name"],
            "title": emp["title"],
            "role_match_multiplier": role_mult,
            "tenure_multiplier": tenure_mult,
            "composite": round(composite, 3),
            "normalized": round(normalized, 3),
            "bucket": "peer" if is_peer else "cross_team",
        })

    return (min(1.0, peer_total), min(1.0, cross_total), evidence)


def _culture_affinity(candidate: dict) -> float:
    """Culture affinity — strict definition, no bias-prone signals.

    Sources (deterministic, from candidate data):
      - domain-topic hits in top_skills that overlap our stack keywords
      - past employers that appear in the sports/broadcast lexicon
      - conference attendance in sports-tech / video-tech conferences

    Not included: alma mater, geography, hobbies, personality inference.
    """
    tax = taxonomy()
    domain_kws = set((tax.get("domain_lexicon") or {}).get("keywords") or [])
    known_companies = set(kc.lower() for kc in
                          (tax.get("domain_lexicon") or {}).get("known_companies") or [])

    hits = 0
    for s in candidate.get("top_skills") or []:
        sl = s.lower()
        if any(kw in sl for kw in domain_kws):
            hits += 1
    for pc in candidate.get("past_companies") or []:
        if pc.lower() in known_companies:
            hits += 1
    # Conference itself counts as engagement with the space
    conf = (candidate.get("conference_name") or "").lower()
    if any(kw in conf for kw in domain_kws):
        hits += 1

    curve = scoring()["connection_curve"]
    return float(curve[min(hits, len(curve) - 1)])


def _prior_wsc_engagement(candidate: dict) -> float:
    """Deterministic proxy for "has this person engaged with WSC's world before?"

    In production this pulls from HubSpot engagement history (follows, post
    likes, past event attendance). We don't have that live in this build, so
    we use the strongest deterministic proxy available in the CSVs: the
    domain of the conference they attended. Someone who showed up at a
    Sports Technology & Analytics event is exponentially more likely to have
    engaged with WSC than someone at a generic DevOps meetup.

    The mapping is centralised here rather than in taxonomy.yaml because
    it's specific to Signal scoring, not classification. Values 0..1.
    """
    domain = (candidate.get("conference_domain") or "").strip().lower()
    # Ordered from most-aligned to least — first match wins.
    if "sports" in domain:
        return 1.0   # e.g. "Sports Technology & Analytics" — direct WSC world
    if "broadcast" in domain or "video" in domain:
        return 0.75  # core to WSC's product surface
    if "ai" in domain or "ml" in domain or "analytics" in domain:
        return 0.4   # general tech-adjacent, some overlap
    if "devops" in domain or "platform" in domain:
        return 0.15  # weak signal — generic engineering conference
    return 0.0


def score_signal(candidate: dict, employees: list[dict], job: dict | None = None,
                 reference_date: date | None = None) -> dict:
    """Compute the 8-component Signal score.

    `job` is required when computing peer_vouch and cross_team_vouch. When None
    (legacy code paths), those components fall back to 0 and only the
    reachability + culture + engagement components contribute.
    """
    cfg = scoring()
    curve = cfg["connection_curve"]

    employees_by_id = {e["employee_id"]: e for e in employees}
    cand_employers = _parse_candidate_employers(candidate)
    cand_employer_map = {e: r for e, r in cand_employers}

    # Mutuals (bare)
    mutual_ids = candidate.get("wsc_mutual_connections") or []
    mutuals: list[dict] = []
    for eid in mutual_ids:
        emp = employees_by_id.get(eid)
        if not emp:
            continue
        mutuals.append({
            "employee_id": eid, "name": emp["full_name"],
            "title": emp["title"], "department": emp["department"],
        })

    # Shared employers (post-stoplist + alias-unified on both sides)
    shared: list[dict] = []
    for emp in employees:
        for (canon, emp_range) in _parse_employee_employers(emp.get("work_history") or ""):
            if canon not in cand_employer_map:
                continue
            overlap = _overlap_years(emp_range, cand_employer_map[canon])
            shared.append({
                "employer": canon, "employee_id": emp["employee_id"],
                "name": emp["full_name"], "title": emp["title"],
                "department": emp["department"], "overlap": overlap,
            })

    # Same-team overlap component uses same-team subset of shared employers
    if job is not None:
        same_team_count, _ = _peer_vs_cross_split(shared, job)
    else:
        same_team_count = 0

    same_team_component = float(curve[min(same_team_count, len(curve) - 1)])

    # Active vouches (from referred_by_employee_id and recruiter_vouches)
    if job is not None:
        peer_vouch_score, cross_team_vouch_score, vouch_evidence = _vouch_score(
            candidate, employees, job, reference_date
        )
    else:
        peer_vouch_score, cross_team_vouch_score, vouch_evidence = 0.0, 0.0, []

    culture_affinity = _culture_affinity(candidate)
    prior_engagement = _prior_wsc_engagement(candidate)
    recency = _recency_component(candidate, reference_date)
    notes_present = 1.0 if (candidate.get("notes") or "").strip() else 0.0
    mutual_component = float(curve[min(len(mutuals), len(curve) - 1)])

    weights = cfg["signal_weights"]
    total_w = sum(weights.values())
    weighted = (
        peer_vouch_score        * weights["peer_vouch"]
        + same_team_component   * weights["same_team_overlap"]
        + cross_team_vouch_score * weights["cross_team_vouch"]
        + culture_affinity      * weights["culture_affinity"]
        + prior_engagement      * weights["prior_wsc_engagement"]
        + recency               * weights["recency"]
        + notes_present         * weights["notes_present"]
        + mutual_component      * weights["mutual_connections"]
    )
    score = round(weighted / total_w * 100, 1)

    return {
        "components": {
            "peer_vouch":            round(peer_vouch_score, 4),
            "same_team_overlap":     round(same_team_component, 4),
            "cross_team_vouch":      round(cross_team_vouch_score, 4),
            "culture_affinity":      round(culture_affinity, 4),
            "prior_wsc_engagement":  round(prior_engagement, 4),
            "recency":               round(recency, 4),
            "notes_present":         round(notes_present, 4),
            "mutual_connections":    round(mutual_component, 4),
        },
        "score_default": score,
        "mutuals": mutuals,
        "shared_employers": shared,
        "vouch_evidence": vouch_evidence,
    }


# Backwards-compatible alias so callers using score_warmth() still work during
# the transition. Prefer score_signal().
def score_warmth(candidate: dict, employees: list[dict],
                 reference_date: date | None = None) -> dict:
    return score_signal(candidate, employees, job=None, reference_date=reference_date)


def best_intro_path(warmth: dict, job_department: str | None = None) -> str:
    """Rank: shared+same_dept > shared+cross > mutual+same_dept > mutual+cross."""
    def rank_shared(s: dict) -> int:
        return 0 if (job_department and s["department"] == job_department) else 1

    def rank_mutual(m: dict) -> int:
        return 2 if (job_department and m["department"] == job_department) else 3

    candidates: list[tuple[int, str]] = []
    for s in warmth.get("shared_employers", []):
        overlap = f" — overlapped at {s['employer']}" + (f" {s['overlap']}" if s.get("overlap") else "")
        candidates.append((rank_shared(s), f"{s['name']} ({s['title']}){overlap}"))
    for m in warmth.get("mutuals", []):
        candidates.append((rank_mutual(m), f"{m['name']} ({m['title']}) — 1st-degree connection"))
    if not candidates:
        return ""
    candidates.sort(key=lambda t: t[0])
    return candidates[0][1]
