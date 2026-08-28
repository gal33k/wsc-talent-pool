"""MOCK: the "AI" layer.

Real counterpart:  a single Claude call with the same structured evidence dict
                   as input. Logging the evidence dict makes the swap surface
                   visible in the UI.

Deterministic templated renders — no API, no key, no variability. In the
meeting: point at the logged evidence dict and say "that is the prompt
payload; a live model takes it and returns prose".
"""
from . import call_log


def why_summary(candidate: dict, job: dict, evidence: dict) -> str:
    """One-sentence summary a recruiter can paste into Slack."""
    call_log.log(
        system="narrator", method="RENDER", endpoint="why_summary",
        result="template rendered",
        payload={"evidence": evidence},
    )
    matched = evidence.get("matched_required", [])
    total_req = evidence.get("total_required", len(matched))
    intro = evidence.get("best_intro_path")
    conf = evidence.get("conference_name", "the conference")
    conf_month = evidence.get("conference_month", "recently")
    note = candidate.get("notes") or evidence.get("notes")

    name = candidate.get("full_name", "Candidate")
    role = (candidate.get("current_title") or "their field").lower()
    company = candidate.get("current_company", "a relevant employer")
    years = candidate.get("years_experience")

    text = f"{name} matches {len(matched)}/{total_req} required skills for {job['title']}"
    if years:
        text += f" and has {years} years in {role} at {company}"
    text += "."
    if intro:
        text += f" {intro} can make the introduction."
    text += f" Met at {conf}, {conf_month}"
    if note:
        text += f' - noted as "{note}"'
    text += "."
    return text


def outreach_draft(candidate: dict, job: dict, evidence: dict) -> str:
    """Cold-outreach opener a recruiter can copy."""
    call_log.log(
        system="narrator", method="RENDER", endpoint="outreach_draft",
        result="template rendered",
        payload={"evidence": evidence},
    )
    first = (candidate.get("full_name") or "there").split()[0]
    matched = evidence.get("matched_required", [])
    match_ref = ", ".join(matched[:2]) if matched else "your background"
    company = candidate.get("current_company", "your current role")

    return (
        f"Hi {first} - we're hiring a {job['title']} at WSC Sports. "
        f"Your work on {match_ref} at {company} looks like a strong fit. "
        f"Would you be open to a short call this week?"
    )
