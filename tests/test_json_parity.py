"""Parity test: recomputing scores from components + default weights must
reproduce Python's score_default to 1 decimal place.

This is the invariant that makes the browser-side tuner safe. If it fails,
the Python and JS aggregations have drifted and the tuner will silently
mislead.

Regenerate pool.json first:
    python run.py --all-jobs --emit-json
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL_JSON = ROOT / "web" / "public" / "data" / "pool.json"


def _weighted(components: dict, weights: dict) -> float:
    total = sum(weights.values())
    if total <= 0:
        return 0.0
    weighted = sum(components[k] * weights[k] for k in weights)
    return round(weighted / total * 100, 1)


def test_fit_parity_all_candidates_all_jobs() -> None:
    doc = json.loads(POOL_JSON.read_text(encoding="utf-8"))
    fw = doc["defaults"]["fit_weights"]
    mismatches = []
    for c in doc["candidates"]:
        for jid, fit in c["jobs"].items():
            recomputed = _weighted(fit["components"], fw)
            if abs(recomputed - fit["score_default"]) > 0.11:
                mismatches.append((c["id"], jid, recomputed, fit["score_default"]))
    assert not mismatches, f"fit parity failed for {len(mismatches)} cases: {mismatches[:5]}"


def test_signal_parity_all_candidates() -> None:
    """Signal (formerly Warmth) — 8 components. Browser recompute must match
    Python's score_default to 1dp."""
    doc = json.loads(POOL_JSON.read_text(encoding="utf-8"))
    # Prefer new signal_weights; fall back to legacy warmth_weights if the
    # emitter is old.
    weights = doc["defaults"].get("signal_weights") or doc["defaults"]["warmth_weights"]
    mismatches = []
    for c in doc["candidates"]:
        components = c["warmth"]["components"]
        # Guard: if the pool.json shape and the weights shape drifted, the
        # test should fail loudly rather than silently miss a component.
        missing_keys = set(weights.keys()) - set(components.keys())
        assert not missing_keys, (
            f"pool.json component shape doesn't match signal_weights — "
            f"missing keys: {missing_keys}. Regenerate pool.json."
        )
        recomputed = _weighted(components, weights)
        if abs(recomputed - c["warmth"]["score_default"]) > 0.11:
            mismatches.append((c["id"], recomputed, c["warmth"]["score_default"]))
    assert not mismatches, f"signal parity failed: {mismatches[:5]}"


# Legacy alias — some CI configs still call the old name.
def test_warmth_parity_all_candidates() -> None:
    test_signal_parity_all_candidates()


def test_critical_admits() -> None:
    """Viktor / Ingrid / Mei / Kim / Javier / Grace must all be ADMIT."""
    doc = json.loads(POOL_JSON.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in doc["candidates"]}
    must_admit = ["HS041", "HS049", "HS054", "HS056", "HS067", "HS026"]
    for hid in must_admit:
        assert hid in by_id, f"{hid} missing from pool"
        assert by_id[hid]["gate"]["decision"] == "ADMIT", (
            f"{hid} {by_id[hid]['name']} gate={by_id[hid]['gate']['decision']} "
            f"reason={by_id[hid]['gate']['reason']}"
        )


def test_jin_park_above_band_not_first() -> None:
    """Jin Park must be flagged above_band for JOB001, not ranked #1."""
    doc = json.loads(POOL_JSON.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in doc["candidates"]}
    jin = by_id.get("HS046")
    assert jin, "Jin Park (HS046) missing"
    fit = jin["jobs"].get("JOB001")
    assert fit and fit["seniority_flag"] == "above_band", (
        f"expected above_band, got {fit and fit['seniority_flag']}"
    )


if __name__ == "__main__":
    for fn in [test_fit_parity_all_candidates_all_jobs, test_signal_parity_all_candidates,
               test_critical_admits, test_jin_park_above_band_not_first]:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            print(f"FAIL  {fn.__name__}: {e}")
