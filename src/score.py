"""Stage 6: fit_score. Competence only. No network signal, ever.

Every component below is a 0.0-1.0 value that describes the CANDIDATE and is
WEIGHT-INDEPENDENT. Weights apply in the final aggregation so the browser can
recombine components live as the tuner sliders move.
"""
from .config import scoring, taxonomy


def _skill_credit(required: str, cand_skills_lower: list[str]) -> float:
    """1.0 for exact/synonym match; family credit for broader match; 0 otherwise."""
    cfg = scoring()
    tax = taxonomy()
    syn = (tax.get("skill_synonyms") or {}).get(required, {
        "exact": [required.lower()],
        "family": [],
    })
    for alias in syn.get("exact", []):
        a = alias.lower()
        if any(a in s for s in cand_skills_lower):
            return float(cfg["skill_exact_credit"])
    for fam in syn.get("family", []):
        f = fam.lower()
        if any(f in s for s in cand_skills_lower):
            return float(cfg["skill_family_credit"])
    return 0.0


def _domain_component(candidate: dict) -> float:
    tax = taxonomy()
    cfg = scoring()
    lex = tax["domain_lexicon"]
    haystacks = [
        candidate.get("industry", "") or "",
        candidate.get("current_company", "") or "",
        *(candidate.get("past_companies") or []),
        *(candidate.get("top_skills") or []),
    ]
    hits = 0
    for kw in lex["keywords"]:
        if any(kw in (h or "").lower() for h in haystacks if h):
            hits += 1
    for comp in lex["known_companies"]:
        cl = comp.lower()
        if any(cl in (h or "").lower() for h in haystacks if h):
            hits += 1
    curve = cfg["connection_curve"]
    return float(curve[min(hits, len(curve) - 1)])


def _seniority_component(candidate: dict, job: dict) -> tuple[float, str]:
    cfg = scoring()
    cand_tier = float(candidate.get("seniority_tier") or 3.0)
    job_tier = float(cfg["job_seniority_tier"].get(job.get("seniority", "Senior"), 3.5))
    gap = cand_tier - job_tier
    if gap > cfg["above_band_tier_gap"]:
        return (max(cfg["band_floor"], 1.0 - cfg["above_band_penalty"]), "above_band")
    if gap < -cfg["below_band_tier_gap"]:
        return (max(cfg["band_floor"], 1.0 - cfg["below_band_penalty"]), "below_band")
    return (1.0, "in_band")


def _family_component(candidate: dict, job: dict) -> float:
    """Directional adjacency lookup — see scoring.yaml § role_family_adjacency."""
    cfg = scoring()
    tax = taxonomy()
    job_family = (tax.get("job_family_map") or {}).get(job["job_id"], "unknown")
    cand_family = candidate.get("role_family", "unknown")
    if cand_family == job_family:
        return 1.0
    adj = (cfg.get("role_family_adjacency") or {}).get(job_family, {})
    # New shape: dict-of-dicts, per-pair credit. Old shape (list + flat credit)
    # is not supported here — kept as a validation error rather than a silent
    # fallback so schema drift is loud.
    if isinstance(adj, dict):
        return float(adj.get(cand_family, 0.0))
    raise TypeError(
        "role_family_adjacency must be a dict-of-dicts (per-pair credit). "
        f"Got {type(adj).__name__} for job_family={job_family!r} — "
        "see scoring.yaml comment block."
    )


def _split_semi(value: str) -> list[str]:
    return [s.strip() for s in (value or "").split(";") if s.strip()]


def _parse_required_skills(raw: str) -> tuple[list[str], set[str]]:
    """Split required_skills, respecting the '*' suffix that marks a skill as
    critical. Returns (clean_names_in_order, set_of_critical_names).

    Example: 'Python;Computer Vision*;AWS' -> (['Python', 'Computer Vision', 'AWS'],
                                                 {'Computer Vision'})
    """
    tokens = _split_semi(raw)
    clean: list[str] = []
    critical: set[str] = set()
    for t in tokens:
        is_critical = t.endswith("*")
        name = t.rstrip("*").strip()
        clean.append(name)
        if is_critical:
            critical.add(name)
    return clean, critical


def score_fit(candidate: dict, job: dict) -> dict:
    cfg = scoring()
    req_skills, critical_skills = _parse_required_skills(job.get("required_skills", ""))
    nice_skills = _split_semi(job.get("nice_to_have", ""))
    cand_skills_lower = [s.lower() for s in (candidate.get("top_skills") or [])]

    # Required-skills coverage
    matched_req: list[str] = []
    matched_req_family: list[str] = []
    missing_req: list[str] = []
    total_credit = 0.0
    for req in req_skills:
        credit = _skill_credit(req, cand_skills_lower)
        total_credit += credit
        if credit >= cfg["skill_exact_credit"]:
            matched_req.append(req)
        elif credit > 0:
            matched_req_family.append(req)
        else:
            missing_req.append(req)
    required_component = (total_credit / len(req_skills)) if req_skills else 0.0

    # Critical-skills cap: any critical skill with ZERO credit (no exact and no
    # family alias) triggers the ceiling. A family match still counts as HAVING
    # the skill; only literal absence penalises.
    missing_critical = sorted(critical_skills & set(missing_req))
    if missing_critical:
        required_component = min(required_component,
                                 float(cfg.get("critical_missing_ceiling", 0.4)))

    # Nice-to-have coverage
    matched_nice: list[str] = []
    nice_credit = 0.0
    for n in nice_skills:
        c = _skill_credit(n, cand_skills_lower)
        nice_credit += c
        if c > 0:
            matched_nice.append(n)
    nice_component = (nice_credit / len(nice_skills)) if nice_skills else 0.0

    family_component = _family_component(candidate, job)
    seniority_component, seniority_flag = _seniority_component(candidate, job)
    domain_component = _domain_component(candidate)

    weights = cfg["fit_weights"]
    total_w = sum(weights.values())
    weighted = (
        required_component * weights["required_skills"]
        + family_component * weights["role_family"]
        + seniority_component * weights["seniority"]
        + domain_component * weights["domain"]
        + nice_component * weights["nice_to_have"]
    )
    score = round(weighted / total_w * 100, 1)

    # Confidence ceiling for low-data candidates
    if candidate.get("data_confidence") == "low":
        score = min(score, float(cfg["low_confidence_fit_ceiling"]))

    return {
        "components": {
            "required_skills": round(required_component, 4),
            "role_family": round(family_component, 4),
            "seniority": round(seniority_component, 4),
            "domain": round(domain_component, 4),
            "nice_to_have": round(nice_component, 4),
        },
        "score_default": score,
        "matched_required": matched_req,
        "matched_required_family": matched_req_family,
        "missing_required": missing_req,
        "matched_nice_to_have": matched_nice,
        "critical_skills": sorted(critical_skills),
        "missing_critical": missing_critical,
        "seniority_flag": seniority_flag,
        "excluded": None,
    }
