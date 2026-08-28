"""Stage 2: identity resolution + dedupe.

Priority: linkedin_url > email > (full_name lowered, company lowered). A person
who appears at two conferences collapses to one row; the most recent contact
wins for the header fields, and both conferences are recorded so recency can
use the latest and warmth can list all touchpoints.
"""


def _key_for(row: dict) -> str:
    linkedin = (row.get("linkedin_url") or "").strip().lower()
    if linkedin:
        return f"li:{linkedin}"
    email = (row.get("email") or "").strip().lower()
    if email:
        return f"em:{email}"
    return f"nc:{(row.get('full_name') or '').strip().lower()}|{(row.get('company') or '').strip().lower()}"


def resolve(rows: list[dict]) -> list[dict]:
    by_key: dict[str, list[dict]] = {}
    for r in rows:
        by_key.setdefault(_key_for(r), []).append(r)

    resolved: list[dict] = []
    for key, group in by_key.items():
        group_sorted = sorted(group, key=lambda x: x.get("conference_date", ""), reverse=True)
        primary = dict(group_sorted[0])
        primary["person_id"] = key
        primary["merged_from"] = [g["hubspot_id"] for g in group_sorted]
        primary["conferences_attended"] = [
            {
                "name": g.get("conference_name"),
                "domain": g.get("conference_domain"),
                "date": g.get("conference_date"),
            }
            for g in group_sorted
        ]
        resolved.append(primary)
    return resolved
