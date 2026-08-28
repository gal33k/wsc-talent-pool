"""MOCK: LinkedIn profile enrichment.

Real counterpart:  Proxycurl / People Data Labs
Real endpoint:     GET /proxycurl/api/v2/linkedin?url={linkedin_url}

Simulates the three behaviours that shape production cost + edge cases:
  * a CACHE — repeated lookups are free after the first
  * a MISS RATE — configurable fraction returns None
  * a CREDIT COUNTER — every non-cached call decrements the budget

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
            call_log.log("enrichment", "GET", "/profile?url=(blank)", "400 invalid input")
            return None

        if key in self._cache:
            call_log.log("enrichment", "GET", f"/profile?url={key}",
                         "cache hit, 0 credits")
            return self._cache[key]

        # simulate a real vendor miss
        if self._rng.random() < self._miss_rate:
            self._cache[key] = None
            self._credits_used += 1
            call_log.log("enrichment", "GET", f"/profile?url={key}",
                         f"404 not found, credits {self._credits_used}/{self._credit_budget}")
            return None

        profile = self._profiles.get(key)
        self._cache[key] = profile
        self._credits_used += 1
        call_log.log("enrichment", "GET", f"/profile?url={key}",
                     f"{'200 ok' if profile else '404 not found'}, "
                     f"credits {self._credits_used}/{self._credit_budget}")
        return profile

    @property
    def credits_summary(self) -> dict:
        return {"used": self._credits_used, "budget": self._credit_budget}
