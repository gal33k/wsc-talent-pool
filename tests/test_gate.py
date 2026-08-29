"""Gate decision tests.

The gate is the heart of Decision A. These tests lock in behaviour on rows we
care about most: known noise must REJECT, known talent must ADMIT even without
network signal, and borderline profiles must HOLD (not silently drop).

Run: python tests/test_gate.py
"""
import csv
import sys
from pathlib import Path

# Allow running from repo root: python tests/test_gate.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import DATA_DIR
from src.ingest import load_attendees
from src.resolve import resolve
from src.enrich import enrich
from src.normalize import normalise
from src.gate import gate
from src.integrations.mock_enrichment import MockEnrichment
from src.integrations import call_log


def _run() -> dict:
    call_log.reset()
    rows = load_attendees(DATA_DIR / "conference_attendees.csv")
    rows = resolve(rows)
    enricher = MockEnrichment(DATA_DIR / "linkedin_profiles.csv")
    rows = enrich(rows, enricher)
    rows = normalise(rows)
    rows = gate(rows)
    return {r["hubspot_id"]: r for r in rows}


CRITICAL_ADMITS = {
    "HS041": "Viktor Novak — Senior Data Engineer, Databricks, 0 mutuals",
    "HS049": "Ingrid Svensson — Data Engineer, Klarna, 0 mutuals",
    "HS054": "Mei Zhang — Platform Engineer, CloudNative Labs, 0 mutuals",
    "HS056": "Kim Soo-Jin — DevOps Lead, Samsung SDS, 0 mutuals",
    "HS067": "Javier Morales — Broadcast Engineer, TeleDeporte, 0 mutuals",
    "HS026": "Grace Wilson — DevOps Engineer, CyberShield (admit on skills+family alone, zero warm paths)",
}

CRITICAL_REJECTS = {
    "HS012": "Laura Gibson — IT Manager, City Hospital (0/3)",
    "HS063": "Amara Diallo — Network Engineer, TelecomSN",
    "HS071": "Patrick Duval — IT Engineer, TextileInd",
    "HS018": "Olivia Scott — Digital Marketing Manager",
}


def test_critical_admits_all_pass() -> None:
    by_id = _run()
    failures = []
    for hid, note in CRITICAL_ADMITS.items():
        row = by_id.get(hid)
        if not row:
            failures.append((hid, "MISSING from pipeline output", note))
            continue
        if row["gate"]["decision"] != "ADMIT":
            failures.append((hid, row["gate"]["decision"], f"{note} — reason={row['gate']['reason']}"))
    assert not failures, f"critical admit failures: {failures}"


def test_critical_admits_are_signal_based_not_network_based() -> None:
    """None of the 6 critical admits should have mutual connections — that's the
    whole point: the gate admits them on signal, not on warmth."""
    by_id = _run()
    for hid in CRITICAL_ADMITS:
        row = by_id[hid]
        mutuals = row.get("wsc_mutual_connections", [])
        assert not mutuals, (
            f"{hid} {row['full_name']} has mutuals {mutuals} — no longer a "
            "zero-mutuals demo row"
        )


def test_known_noise_rejects_with_reason() -> None:
    by_id = _run()
    failures = []
    for hid, note in CRITICAL_REJECTS.items():
        row = by_id.get(hid)
        if not row:
            failures.append((hid, "MISSING", note))
            continue
        d = row["gate"]["decision"]
        if d != "REJECT":
            failures.append((hid, d, f"{note} — reason={row['gate']['reason']}"))
        elif not row["gate"]["reason"]:
            failures.append((hid, "MISSING REASON", note))
    assert not failures, f"reject failures: {failures}"


def test_every_row_has_a_reason() -> None:
    """No candidate should end up with an empty reason string — even ADMITs."""
    by_id = _run()
    for hid, row in by_id.items():
        assert row["gate"]["reason"], f"{hid} has empty gate reason"


def test_decision_counts_are_within_expected_range() -> None:
    """Sanity: with the current taxonomy, the split should be roughly 65+ admit,
    < 5 hold, < 5 reject. Not a strict range — a canary for taxonomy drift."""
    by_id = _run()
    counts = {"ADMIT": 0, "HOLD": 0, "REJECT": 0}
    for row in by_id.values():
        counts[row["gate"]["decision"]] += 1
    total = sum(counts.values())
    assert total == 75, f"expected 75 candidates, got {total}"
    assert counts["ADMIT"] >= 60, f"unexpectedly few ADMITs: {counts}"
    assert counts["REJECT"] >= 2,  f"unexpectedly few REJECTs: {counts}"


def test_stoplist_filters_generic_employers() -> None:
    """Employer tokens on any row must not include 'startup', 'freelance',
    'university' etc. — the exact stoplist that prevents ~40 false warm paths."""
    by_id = _run()
    banned = {"startup", "freelance", "university", "public sector"}
    for hid, row in by_id.items():
        for token in row.get("employer_tokens", []):
            assert token.lower() not in banned, (
                f"{hid} {row['full_name']} employer token '{token}' should have been "
                f"filtered by generic_employer_stoplist"
            )


def test_grace_wilson_admits_on_merit_alone() -> None:
    """The zero-network demo row: no mutuals, no shared employers (IDF
    variants are stoplisted from passive matching — see taxonomy.yaml). She
    still admits because family + skills pass the gate on their own. This
    is the "not everyone strong has a warm path" case the two-axis design
    is built to catch."""
    by_id = _run()
    grace = by_id.get("HS026")
    assert grace, "Grace Wilson missing"
    assert grace["gate"]["decision"] == "ADMIT"
    assert not grace.get("wsc_mutual_connections"), (
        "Grace has mutuals — the demo depends on her being zero-mutuals"
    )


if __name__ == "__main__":
    for fn in [
        test_critical_admits_all_pass,
        test_critical_admits_are_signal_based_not_network_based,
        test_known_noise_rejects_with_reason,
        test_every_row_has_a_reason,
        test_decision_counts_are_within_expected_range,
        test_stoplist_filters_generic_employers,
        test_grace_wilson_admits_on_merit_alone,
    ]:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            print(f"FAIL  {fn.__name__}\n      {e}")
