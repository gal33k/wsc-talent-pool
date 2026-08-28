"""Adapter protocols.

Each mock adapter in this package implements one of these interfaces. Swapping
to a live vendor implementation is a one-file change — the pipeline (src/) and
the UI (web/) never see the difference.
"""
from pathlib import Path
from typing import Protocol


class BadgeScanAdapter(Protocol):
    def get_attendees(self, source: Path, simulate_missing_linkedin: float = 0.0) -> list[dict]: ...


class EnrichmentAdapter(Protocol):
    def get_profile(self, linkedin_url: str) -> dict | None: ...


class HubspotAdapter(Protocol):
    def write_talent_pool_properties(self, contact_id: str, properties: dict) -> None: ...


class ComeetAdapter(Protocol):
    def get_open_positions(self, source: Path) -> list[dict]: ...
    def get_candidate_status(self, email: str, source: Path | None = None) -> dict | None: ...
    def push_sourced_candidate(self, position_id: str, contact_id: str, score: dict) -> None: ...


class NotifierAdapter(Protocol):
    def request_intro(self, employee_name: str, candidate_name: str, job_title: str) -> str: ...


class NarratorAdapter(Protocol):
    def why_summary(self, candidate: dict, job: dict, evidence: dict) -> str: ...
    def outreach_draft(self, candidate: dict, job: dict, evidence: dict) -> str: ...
