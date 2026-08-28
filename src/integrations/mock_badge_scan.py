"""MOCK: conference badge-scan export.

Real counterpart:  Cvent / Swapcard / Brella event-attendee export
Real endpoint:     GET /events/{event_id}/attendees

Reads the shipped CSV as if it were a post-event export. Trims whitespace at
ingest (the messiness a real export contains). Optional simulate_missing_linkedin
blanks a fraction of URLs so the enrichment_status=none path can be exercised
on a dataset that ships fully joined.
"""
import csv
import random
from pathlib import Path

from . import call_log


def get_attendees(source: Path, simulate_missing_linkedin: float = 0.0,
                  seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    with source.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            row = {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            if simulate_missing_linkedin > 0 and rng.random() < simulate_missing_linkedin:
                row["linkedin_url"] = ""
            rows.append(row)
    call_log.log(
        system="badge_scan",
        method="GET",
        endpoint=f"/events/{source.stem}/attendees",
        result=f"{len(rows)} records",
    )
    return rows
