"""Stage 7: warmth_score + best intro path.

Reachability only. No competence signal in this axis. Same-department peers
are preferred as intro paths (a peer is best placed to answer "will you
introduce us"), but the same-dept preference lives in intro-path selection —
the raw component score is count-based so the tuner behaves predictably.
"""
from __future__ import annotations

import re
from datetime import date

from .config import scoring, taxonomy
from .normalize import canonical_employer, is_generic_employer


_YEAR_RANGE = re.compile(r"\((\d{4})[-–](\d{4}|present)\)", re.IGNORECASE)


def _parse_year_range(text: str) -> tuple[int, int] | None:
    m = _YEAR_RANGE.search(text or "")
    if not m:
        return None
    start = int(m.group(1))
    end = date.today().year if m.group(2).lower() == "present" else int(m.group(2))
    return (start, end)


def _employer_from_work_history_entry(entry: str) -> str:
    """'Sky Sports Digital (2017-2020)' -> 'Sky Sports Digital'."""
    return _YEAR_RANGE.sub("", entry).strip()


def _employer_from_past_title_entry(entry: str) -> str:
    """'ML Engineer at Opta Sports (2019-2022)' -> 'Opta Sports'."""
    stripped = _YEAR_RANGE.sub("", entry).strip()
    if " at " in stripped:
        return stripped.split(" at ", 1)[1].strip()
    return stripped


def _parse_employee_employers(work_history: str) -> list[tuple[str, tuple[int, int] | None]]:
    """Return list of (canonical_employer, year_range_or_None)."""
    out: list[tuple[str, tuple[int, int] | None]] = []
    for entry in (work_history or "").split(";"):
        raw = _employer_from_work_history_entry(entry)
        if not raw or is_generic_employer(raw):
            continue
        canon = canonical_employer(raw)
        if is_generic_employer(canon):
            continue
        out.append((canon, _parse_year_range(entry)))
    return out


def _parse_candidate_employers(candidate: dict) -> list[tuple[str, tuple[int, int] | None]]:
    """From past_titles (year-tagged) + current_company (implicit ongoing)."""
    out: list[tuple[str, tuple[int, int] | None]] = []
    for entry in candidate.get("past_titles") or []:
        raw = _employer_from_past_title_entry(entry)
        if not raw or is_generic_employer(raw):
            continue
        canon = canonical_employer(raw)
        if is_generic_employer(canon):
            continue
        out.append((canon, _parse_year_range(entry)))
    cc = (candidate.get("current_company") or "").strip()
    if cc and not is_generic_employer(cc):
        out.append((canonical_employer(cc), None))
    return out


def _overlap_years(a: tuple[int, int] | None,
                   b: tuple[int, int] | None) -> str | None:
    if not a or not b:
        return None
    start = max(a[0], b[0])
    end = min(a[1], b[1])
    if end < start:
        return None
    return f"{start}-{end}" if end != start else str(start)


def _recency_component(candidate: dict, reference_date: date | None = None) -> float:
    cfg = scoring()
    conf_date = candidate.get("conference_date")
    if not conf_date:
        return 0.0
    try:
        parts = str(conf_date).split("-")
        y, m = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return 0.0
    today = reference_date or date.today()
    months = (today.year - y) * 12 + (today.month - m)
    return round(0.5 ** (max(0, months) / float(cfg["recency_half_life_months"])), 4)


def score_warmth(candidate: dict, employees: list[dict],
                 reference_date: date | None = None) -> dict:
    cfg = scoring()
    curve = cfg["connection_curve"]

    employees_by_id = {e["employee_id"]: e for e in employees}
    cand_employers = _parse_candidate_employers(candidate)
    cand_employer_map = {e: r for e, r in cand_employers}

    # Mutuals
    mutual_ids = candidate.get("wsc_mutual_connections") or []
    mutuals: list[dict] = []
    for eid in mutual_ids:
        emp = employees_by_id.get(eid)
        if not emp:
            continue
        mutuals.append({
            "employee_id": eid,
            "name": emp["full_name"],
            "title": emp["title"],
            "department": emp["department"],
        })

    # Shared employers (post-stoplist, alias-normalised on both sides)
    shared: list[dict] = []
    for emp in employees:
        emp_employers = _parse_employee_employers(emp.get("work_history") or "")
        for (canon, emp_range) in emp_employers:
            if canon not in cand_employer_map:
                continue
            overlap = _overlap_years(emp_range, cand_employer_map[canon])
            shared.append({
                "employer": canon,
                "employee_id": emp["employee_id"],
                "name": emp["full_name"],
                "title": emp["title"],
                "department": emp["department"],
                "overlap": overlap,
            })

    mutual_component = float(curve[min(len(mutuals), len(curve) - 1)])
    shared_component = float(curve[min(len(shared), len(curve) - 1)])
    recency = _recency_component(candidate, reference_date)
    notes_present = 1.0 if (candidate.get("notes") or "").strip() else 0.0

    weights = cfg["warmth_weights"]
    total_w = sum(weights.values())
    weighted = (
        mutual_component * weights["mutual_connections"]
        + shared_component * weights["shared_employer"]
        + recency * weights["recency"]
        + notes_present * weights["notes_present"]
    )
    score = round(weighted / total_w * 100, 1)

    return {
        "components": {
            "mutual_connections": round(mutual_component, 4),
            "shared_employer": round(shared_component, 4),
            "recency": round(recency, 4),
            "notes_present": round(notes_present, 4),
        },
        "score_default": score,
        "mutuals": mutuals,
        "shared_employers": shared,
    }


def best_intro_path(warmth: dict, job_department: str | None = None) -> str:
    """Rank: shared+same_dept > shared+cross > mutual+same_dept > mutual+cross."""

    def rank_shared(s: dict) -> int:
        return 0 if (job_department and s["department"] == job_department) else 1

    def rank_mutual(m: dict) -> int:
        return 2 if (job_department and m["department"] == job_department) else 3

    candidates: list[tuple[int, str]] = []
    for s in warmth.get("shared_employers", []):
        overlap = f" — overlapped at {s['employer']}" + (f" {s['overlap']}" if s.get("overlap") else "")
        candidates.append((rank_shared(s), f"{s['name']} ({s['title']}){overlap}"))
    for m in warmth.get("mutuals", []):
        candidates.append((rank_mutual(m), f"{m['name']} ({m['title']}) — 1st-degree connection"))
    if not candidates:
        return ""
    candidates.sort(key=lambda t: t[0])
    return candidates[0][1]
