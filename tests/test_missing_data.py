"""Missing-data path tests.

The shipped 75 rows join cleanly; production won't. These tests exercise the
edge cases the pipeline was designed to survive:

- LinkedIn URL missing on the badge scan
- LinkedIn URL present but no matching profile
- Empty top_skills list
- Blank title
- Same person at two conferences
- Enricher configured with a miss rate

Uses data/test_edge_cases.csv as the fixture.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import DATA_DIR, scoring
from src.ingest import load_attendees
from src.resolve import resolve
from src.enrich import enrich
from src.normalize import normalise
from src.gate import gate
from src.score import score_fit
from src.integrations.mock_enrichment import MockEnrichment
from src.integrations import call_log


FIXTURE = DATA_DIR / "test_edge_cases.csv"


def _run_edge_pipeline() -> list[dict]:
    """Run the pool pipeline over the edge-case fixture (not the main CSV)."""
    call_log.reset()
    rows = load_attendees(FIXTURE)
    rows = resolve(rows)
    enricher = MockEnrichment(DATA_DIR / "linkedin_profiles.csv")
    rows = enrich(rows, enricher)
    rows = normalise(rows)
    rows = gate(rows)
    return rows


def _run_main_with_miss_rate(rate: float, seed: int = 7) -> list[dict]:
    """Run the main pipeline but tell the enricher to fake a miss rate."""
    call_log.reset()
    rows = load_attendees(DATA_DIR / "conference_attendees.csv")
    rows = resolve(rows)
    enricher = MockEnrichment(DATA_DIR / "linkedin_profiles.csv",
                              miss_rate=rate, seed=seed)
    rows = enrich(rows, enricher)
    rows = normalise(rows)
    rows = gate(rows)
    return rows


# ── The fixture ────────────────────────────────────────────────────────────

def test_fixture_exists() -> None:
    assert FIXTURE.exists(), f"expected fixture at {FIXTURE}"


def test_missing_linkedin_url_becomes_enrichment_none() -> None:
    """HSTEST01 has no linkedin_url — must land as enrichment_status=none."""
    rows = _run_edge_pipeline()
    by_id = {r["hubspot_id"]: r for r in rows}
    row = by_id["HSTEST01"]
    assert row["enrichment_status"] == "none"
    assert row.get("top_skills") == []


def test_missing_profile_row_becomes_enrichment_none() -> None:
    """HSTEST02 has a URL but no matching LinkedIn profile row."""
    rows = _run_edge_pipeline()
    by_id = {r["hubspot_id"]: r for r in rows}
    row = by_id["HSTEST02"]
    assert row["enrichment_status"] == "none"


def test_missing_data_yields_low_confidence() -> None:
    rows = _run_edge_pipeline()
    by_id = {r["hubspot_id"]: r for r in rows}
    for hid in ("HSTEST01", "HSTEST02"):
        assert by_id[hid]["data_confidence"] == "low", (
            f"{hid} confidence={by_id[hid]['data_confidence']}"
        )


def test_low_confidence_caps_fit_score() -> None:
    """Even if a low-confidence row scored high on paper, the ceiling caps it."""
    cfg = scoring()
    ceiling = cfg["low_confidence_fit_ceiling"]
    rows = _run_edge_pipeline()
    by_id = {r["hubspot_id"]: r for r in rows}
    row = by_id["HSTEST01"]
    # Score against JOB001 — no valid fit expected but must not crash and must respect ceiling
    fit = score_fit(row, {
        "job_id": "JOB001", "title": "Senior ML Engineer",
        "department": "AI/ML", "seniority": "Senior",
        "required_skills": "Python;PyTorch;Computer Vision;Object Detection;AWS",
        "nice_to_have": "Docker",
    })
    assert fit["score_default"] <= ceiling


def test_blank_title_does_not_crash_pipeline() -> None:
    """HSTEST03 has an empty title — normalisation must not raise."""
    rows = _run_edge_pipeline()
    by_id = {r["hubspot_id"]: r for r in rows}
    row = by_id["HSTEST03"]
    assert "role_family" in row  # produced without crashing


def test_duplicate_across_conferences_collapses_to_one_person() -> None:
    """HSTEST04 + HSTEST05 share the same linkedin_url — must resolve to one
    person with two conferences attended."""
    rows = _run_edge_pipeline()
    matching = [r for r in rows if "linkedin.com/in/dup-person" in (r.get("linkedin_url") or "")]
    assert len(matching) == 1, f"expected 1 resolved person, got {len(matching)}"
    assert len(matching[0]["conferences_attended"]) == 2
    assert len(matching[0]["merged_from"]) == 2


# ── Miss-rate simulation on the main dataset ───────────────────────────────

def test_miss_rate_simulator_produces_none_enrichments() -> None:
    """With miss_rate=0.5 on the main 75, roughly half should land as
    enrichment_status=none. Wide tolerance so it isn't flaky."""
    rows = _run_main_with_miss_rate(0.5, seed=13)
    n_none = sum(1 for r in rows if r["enrichment_status"] == "none")
    assert 15 <= n_none <= 60, (
        f"expected roughly half of 75 to miss at rate=0.5, got {n_none}"
    )


def test_zero_miss_rate_matches_baseline() -> None:
    """Sanity: miss_rate=0 means the main dataset joins cleanly (all 75)."""
    rows = _run_main_with_miss_rate(0.0)
    n_none = sum(1 for r in rows if r["enrichment_status"] == "none")
    assert n_none == 0


if __name__ == "__main__":
    tests = [n for n in dir() if n.startswith("test_")]
    passed = failed = 0
    for name in tests:
        fn = globals()[name]
        try:
            fn()
            print(f"PASS  {name}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {name}\n      {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
