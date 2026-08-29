"""MOCK: profile enrichment.

Real counterpart:  Clay (enrichment orchestrator — waterfalls through Apollo,
                    People Data Labs, LinkedIn Sales Nav data, GitHub API, etc.)
Real endpoint:     POST https://api.clay.com/v1/enrichment/people
                     body: { "linkedin_url": "..." } or { "email": "..." }
                     returns: full profile (title, past employers, skills, activity)

Why Clay instead of a scraper:
  - Clay is the enterprise tool sales / recruiting teams actually buy for this
    workflow. It's a compliant orchestrator, not a scraping API.
  - "Waterfall" model: try Apollo first (cheap), fall back to PDL, fall back to
    a live enrichment. Optimises cost per enriched contact.
  - Composable — pull LinkedIn profile + GitHub activity + company data from
    the same request. That matches what the pipeline needs downstream (skills,
    employers, evidence signals) in a single call.
  - Sales-Navigator-backed data is the source of truth for connection graph
    and recent activity, without the terms-of-service risk of raw scraping.

The recruiter-facing search + outreach layer is LinkedIn Sales Navigator
(see mock_notifier for InMail delivery); Clay is the data pipeline.

Simulates the three behaviours that shape production cost + edge cases:
  * a CACHE — repeated lookups are free after the first
  * a MISS RATE — configurable fraction returns None (Clay does return null when
      no provider in the waterfall has coverage)
  * a CREDIT COUNTER — every non-cached call decrements the budget (Clay bills
      per enriched record; miss-with-provider-tried still charges)

Those three make the design-doc scale argument concrete:
  "enrich only pool ADMISSIONS, not every badge scan"
"""
import csv
import random
from pathlib import Path
from typing import Optional

from . import call_log


class MockEnrichment:
    def __init__(self, profiles_csv: Path, miss_rate: float = 0.0,
                 credit_budget: int = 500, seed: int = 42):
        self._profiles: dict[str, dict] = {}
        with profiles_csv.open(encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                key = row["linkedin_url"].strip().lower()
                self._profiles[key] = {k: (v.strip() if isinstance(v, str) else v)
                                       for k, v in row.items()}
        self._cache: dict[str, Optional[dict]] = {}
        self._miss_rate = miss_rate
        self._credit_budget = credit_budget
        self._credits_used = 0
        self._rng = random.Random(seed)

    def get_profile(self, linkedin_url: str) -> Optional[dict]:
        key = (linkedin_url or "").strip().lower()
        if not key:
            call_log.log("enrichment", "POST", "/clay/v1/enrichment/people (blank)", "400 invalid input")
            return None

        if key in self._cache:
            call_log.log("enrichment", "GET", f"/clay/v1/enrichment/people?linkedin={key}",
                         "cache hit, 0 credits")
            return self._cache[key]

        # simulate a real vendor miss
        if self._rng.random() < self._miss_rate:
            self._cache[key] = None
            self._credits_used += 1
            call_log.log("enrichment", "GET", f"/clay/v1/enrichment/people?linkedin={key}",
                         f"404 not found, credits {self._credits_used}/{self._credit_budget}")
            return None

        profile = self._profiles.get(key)
        self._cache[key] = profile
        self._credits_used += 1
        call_log.log("enrichment", "GET", f"/clay/v1/enrichment/people?linkedin={key}",
                     f"{'200 ok' if profile else '404 not found'}, "
                     f"credits {self._credits_used}/{self._credit_budget}")
        return profile

    @property
    def credits_summary(self) -> dict:
        return {"used": self._credits_used, "budget": self._credit_budget}
