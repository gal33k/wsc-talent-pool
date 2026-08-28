"""MOCK: Comeet ATS.

Real counterpart:  Comeet
Real endpoints:
  GET  /company/{uid}/positions           -> get_open_positions
  GET  /candidates?email={email}          -> get_candidate_status
  POST /positions/{pid}/candidates        -> push_sourced_candidate

The candidate-status stub CSV encodes the four states worth handling: active
in process (suppress), previously rejected for another role (show with flag),
hired (exclude), declined offer (show as intelligence).
"""
import csv
from pathlib import Path
from typing import Optional

from . import call_log


def get_open_positions(source: Path) -> list[dict]:
    positions: list[dict] = []
    with source.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            positions.append({k: (v.strip() if isinstance(v, str) else v)
                              for k, v in row.items()})
    call_log.log("comeet", "GET", "/company/wsc/positions",
                 f"{len(positions)} positions")
    return positions


def get_candidate_status(email: str, source: Optional[Path] = None) -> Optional[dict]:
    """None if the candidate isn't in ATS; else dict with status/role/date."""
    endpoint = f"/candidates?email={email}"
    if source is None or not source.exists():
        call_log.log("comeet", "GET", endpoint, "not found")
        return None
    with source.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("email", "").strip().lower() == email.strip().lower():
                data = {k: (v.strip() if isinstance(v, str) else v)
                        for k, v in row.items()}
                call_log.log(
                    "comeet", "GET", endpoint,
                    f"{data['status']} ({data.get('role','?')}, {data.get('date','?')})",
                )
                return data
    call_log.log("comeet", "GET", endpoint, "not found")
    return None


def push_sourced_candidate(position_id: str, contact_id: str, score: dict) -> None:
    call_log.log(
        "comeet", "POST", f"/positions/{position_id}/candidates",
        "201 created",
        payload={"contact_id": contact_id, "score": score},
    )
