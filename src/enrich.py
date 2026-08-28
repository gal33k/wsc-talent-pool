"""Stage 3: LinkedIn left-join via the enrichment adapter.

Missing profile is a STATE, not an error. enrichment_status is one of:
  * full     -> profile joined cleanly
  * none     -> URL missing or no matching profile row (confidence ceiling applies)

The shipped dataset joins cleanly for all 75 rows; the missing path is
exercisable via --simulate-missing-linkedin on the badge-scan mock.
"""
from .integrations.mock_enrichment import MockEnrichment


def _split(value: str) -> list[str]:
    if not value:
        return []
    return [s.strip() for s in value.split(";") if s.strip()]


def enrich(rows: list[dict], enricher: MockEnrichment) -> list[dict]:
    for r in rows:
        profile = enricher.get_profile(r.get("linkedin_url") or "")

        if profile:
            r["enrichment_status"] = "full"
            r["current_company"] = profile.get("current_company") or r.get("company")
            r["current_title"] = profile.get("current_title") or r.get("title")
            r["location"] = profile.get("location", "")
            try:
                r["years_experience"] = int(profile.get("years_experience") or 0) or None
            except (TypeError, ValueError):
                r["years_experience"] = None
            r["top_skills"] = _split(profile.get("top_skills", ""))
            r["industry"] = profile.get("industry", "")
            r["past_companies"] = _split(profile.get("past_companies", ""))
            r["past_titles"] = _split(profile.get("past_titles", ""))
            r["wsc_mutual_connections"] = _split(profile.get("wsc_mutual_connections", ""))
        else:
            r["enrichment_status"] = "none"
            r["current_company"] = r.get("company")
            r["current_title"] = r.get("title")
            r["location"] = ""
            r["years_experience"] = None
            r["top_skills"] = []
            r["industry"] = ""
            r["past_companies"] = []
            r["past_titles"] = []
            r["wsc_mutual_connections"] = []
    return rows
