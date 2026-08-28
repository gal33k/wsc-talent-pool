"""Stage 1: load and normalise attendee rows.

Thin wrapper over the badge-scan mock. Tags every row with source_channel so
the pipeline stays channel-tuned — same shared enrichment + gate + scoring core,
different source door — when the pool later accepts referrals and inbound
applications.
"""
from pathlib import Path

from .integrations import mock_badge_scan


def load_attendees(source: Path, simulate_missing_linkedin: float = 0.0) -> list[dict]:
    rows = mock_badge_scan.get_attendees(source, simulate_missing_linkedin)
    for r in rows:
        r["source_channel"] = "conference"
    return rows
