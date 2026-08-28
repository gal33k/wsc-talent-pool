"""Structured log for every mock API call.

Surfaced in the UI's Integrations screen (docs/09) — a live table of the
requests the production integrations would issue.
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Optional


@dataclass
class Call:
    ts: str
    system: str
    method: str
    endpoint: str
    result: str
    payload: Optional[dict] = None


_calls: list[Call] = []


def log(system: str, method: str, endpoint: str, result: str,
        payload: Optional[dict] = None) -> None:
    _calls.append(Call(
        ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        system=system, method=method, endpoint=endpoint,
        result=result, payload=payload,
    ))


def entries() -> list[dict]:
    return [asdict(c) for c in _calls]


def reset() -> None:
    _calls.clear()


def dump(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"calls": entries()}, indent=2), encoding="utf-8")
