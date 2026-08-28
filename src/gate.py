"""Stage 5: Decision A — pool admission.

Three independent signals, 2-of-3 admits. Every decision carries a reason
string so a recruiter can audit *why* someone was kept out.

  Signal 1 - role_family_ok:      title-derived family is not not_talent/unknown
  Signal 2 - skills_evidence_ok:  candidate's skills confirm that family
  Signal 3 - proximity_ok:        sports/media lexicon hit on industry, employers, or skills

Conference attendance is opportunity, never fit. The conference_domain sets an
expectation; the person's own profile decides.
"""
from .config import scoring, taxonomy


def _text_hit(needle: str, haystacks: list[str]) -> bool:
    n = needle.lower()
    return any(n in (h or "").lower() for h in haystacks if h)


def _skills_evidence_hit(family: str, skills: list[str]) -> tuple[bool, str | None]:
    """One or more of the family's evidence tokens appears in the skills list."""
    if family in ("unknown", "not_talent"):
        return (False, None)
    evidence = (taxonomy()["family_evidence"] or {}).get(family, [])
    lowered = [s.lower() for s in skills]
    for e in evidence:
        el = e.lower()
        if any(el in s for s in lowered):
            return (True, e)
    return (False, None)


def _proximity_hit(row: dict) -> tuple[bool, str | None]:
    lex = taxonomy()["domain_lexicon"]
    haystacks = [
        row.get("industry", ""),
        row.get("current_company", ""),
        *row.get("past_companies", []),
        *row.get("top_skills", []),
    ]
    for kw in lex["keywords"]:
        if _text_hit(kw, haystacks):
            return (True, kw)
    for comp in lex["known_companies"]:
        for h in haystacks:
            if h and comp.lower() in h.lower():
                return (True, comp)
    return (False, None)


def _confidence(row: dict) -> str:
    if row.get("enrichment_status") == "none":
        return "low"
    if not row.get("top_skills") or not row.get("industry"):
        return "medium"
    return "high"


def gate(rows: list[dict]) -> list[dict]:
    cfg = scoring()
    admit_min = cfg["gate"]["admit_min_signals"]
    hold_min = cfg["gate"]["hold_min_signals"]

    for r in rows:
        family = r.get("role_family", "unknown")
        skills = r.get("top_skills", [])

        s1 = family not in ("not_talent", "unknown")
        s2, s2_hit = _skills_evidence_hit(family, skills)
        s3, s3_hit = _proximity_hit(r)

        count = int(s1) + int(s2) + int(s3)
        if count >= admit_min:
            decision = "ADMIT"
        elif count >= hold_min:
            decision = "HOLD"
        else:
            decision = "REJECT"

        parts = [f"family={family}"]
        parts.append("skills=" + (f"y ({s2_hit})" if s2 else "n"))
        parts.append("proximity=" + (f"y ({s3_hit})" if s3 else "n"))
        reason = f"{count}/3 signals: " + "; ".join(parts)

        r["gate"] = {
            "decision": decision,
            "signals": {
                "role_family": s1,
                "skills_evidence": s2,
                "proximity": s3,
            },
            "reason": reason,
        }
        r["domain_relevance_score"] = round(100 * count / 3, 1)
        r["data_confidence"] = _confidence(r)
    return rows
