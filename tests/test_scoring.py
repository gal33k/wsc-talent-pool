"""Scoring maths tests.

Locks in the component-level behaviour so tuner drift is caught before it
reaches the browser. Focus on the specific decisions in scoring.yaml:

- diminishing-returns curve on connections
- seniority band fit above / below / inside
- required-skills exact vs family partial credit
- role-family adjacency
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import scoring, taxonomy
from src.score import score_fit, _skill_credit, _seniority_component, _family_component


def _job(**overrides) -> dict:
    base = {
        "job_id": "JOB001",
        "title": "Senior ML Engineer",
        "department": "AI/ML",
        "seniority": "Senior",
        "key_domains": "",
        "required_skills": "Python;PyTorch;Computer Vision;Object Detection;AWS",
        "nice_to_have": "Sports Analytics;Real-time processing;Docker",
    }
    base.update(overrides)
    return base


def _cand(**overrides) -> dict:
    base = {
        "full_name": "Test Candidate",
        "role_family": "ml_cv",
        "seniority_tier": 4.0,
        "top_skills": ["Python", "PyTorch", "Computer Vision", "Object Detection", "AWS"],
        "industry": "Sports Technology",
        "current_company": "Second Spectrum",
        "past_companies": [],
        "years_experience": 6,
        "data_confidence": "high",
    }
    base.update(overrides)
    return base


# ── Connection curve ────────────────────────────────────────────────────────

def test_connection_curve_matches_config() -> None:
    curve = scoring()["connection_curve"]
    assert curve == [0.0, 0.5, 0.8, 1.0], f"unexpected curve: {curve}"


def test_domain_component_uses_diminishing_returns_curve() -> None:
    # 0 hits: nothing sports/media adjacent → curve[0] = 0.0
    empty = _cand(industry="", current_company="Nowhere", past_companies=[], top_skills=["Java"])
    fit = score_fit(empty, _job())
    assert fit["components"]["domain"] == 0.0, fit["components"]["domain"]

    # 1 hit: industry "Streaming" matches only the 'streaming' keyword → curve[1] = 0.5
    one_hit = _cand(industry="Streaming", current_company="Nowhere",
                    past_companies=[], top_skills=["Java"])
    fit = score_fit(one_hit, _job())
    assert fit["components"]["domain"] == 0.5, fit["components"]["domain"]

    # 2 hits: industry "Hockey Streaming" matches 'hockey' + 'streaming' → curve[2] = 0.8
    two_hits = _cand(industry="Hockey Streaming", current_company="Nowhere",
                     past_companies=[], top_skills=["Java"])
    fit = score_fit(two_hits, _job())
    assert fit["components"]["domain"] == 0.8, fit["components"]["domain"]

    # 3+ hits: 'Sports Streaming' hits sports + sport + streaming → curve[3+] = 1.0
    many = _cand(industry="Sports Streaming", current_company="Nowhere",
                 past_companies=[], top_skills=["Java"])
    fit = score_fit(many, _job())
    assert fit["components"]["domain"] == 1.0, fit["components"]["domain"]


# ── Skill credit — exact vs family ─────────────────────────────────────────

def test_pytorch_exact_matches_full_credit() -> None:
    cfg = scoring()
    credit = _skill_credit("PyTorch", ["pytorch"])
    assert credit == cfg["skill_exact_credit"] == 1.0


def test_tensorflow_matches_pytorch_via_family_partial() -> None:
    cfg = scoring()
    # tensorflow is in PyTorch's family list, not exact
    credit = _skill_credit("PyTorch", ["tensorflow"])
    assert credit == cfg["skill_family_credit"] == 0.6


def test_unrelated_skill_no_credit() -> None:
    assert _skill_credit("PyTorch", ["excel", "sql"]) == 0.0


def test_required_skills_component_averages_over_all_required() -> None:
    # 3 exact + 2 missing = (1+1+1+0+0)/5 = 0.6
    cand = _cand(top_skills=["Python", "PyTorch", "AWS"])
    fit = score_fit(cand, _job())
    assert abs(fit["components"]["required_skills"] - 0.6) < 0.001


# ── Seniority band ─────────────────────────────────────────────────────────

def test_in_band_seniority_gets_full_credit_and_flag() -> None:
    cfg = scoring()
    # tier 4 (Senior) vs job tier 4 (Senior) → in_band
    comp, flag = _seniority_component(_cand(seniority_tier=4.0), _job())
    assert comp == 1.0
    assert flag == "in_band"


def test_above_band_penalises_and_flags() -> None:
    cfg = scoring()
    # tier 5 (Principal) vs Senior (4) gap=1 > above_band_tier_gap → above_band
    comp, flag = _seniority_component(_cand(seniority_tier=5.0), _job())
    assert flag == "above_band"
    expected = max(cfg["band_floor"], 1.0 - cfg["above_band_penalty"])
    assert abs(comp - expected) < 0.001

    # Head-of / Director → tier 6, even further above
    comp, flag = _seniority_component(_cand(seniority_tier=6.0), _job())
    assert flag == "above_band"


def test_below_band_penalises_and_flags() -> None:
    cfg = scoring()
    # tier 2 (Junior) vs Senior (4) gap=-2 < -below_band_tier_gap → below_band
    comp, flag = _seniority_component(_cand(seniority_tier=2.0), _job())
    assert flag == "below_band"
    expected = max(cfg["band_floor"], 1.0 - cfg["below_band_penalty"])
    assert abs(comp - expected) < 0.001


# ── Role family adjacency ──────────────────────────────────────────────────

def test_exact_family_full_credit() -> None:
    assert _family_component(_cand(role_family="ml_cv"), _job()) == 1.0


def test_adjacent_family_partial_credit() -> None:
    """ml_general is a NEAR adjacency for ml_cv jobs — should get the higher rate."""
    cfg = scoring()
    expected = cfg["role_family_adjacency"]["ml_cv"]["ml_general"]
    assert _family_component(_cand(role_family="ml_general"), _job()) == expected
    assert expected >= 0.5, "ml_general should be at least 0.5 — it's a near neighbour of ml_cv"


def test_data_engineering_is_far_adjacent_to_ml_cv() -> None:
    """The specific collision from docs/01 — Scarlett Green (Data Eng) must
    NOT score the same as ML engineers on JOB001 (ml_cv)."""
    cfg = scoring()
    ml_general_credit = cfg["role_family_adjacency"]["ml_cv"]["ml_general"]
    data_eng_credit   = cfg["role_family_adjacency"]["ml_cv"].get("data_engineering", 0.0)
    assert data_eng_credit < ml_general_credit - 0.2, (
        f"data_engineering ({data_eng_credit}) should be materially lower than "
        f"ml_general ({ml_general_credit}) for an ml_cv job. If they're close, "
        f"an ML engineer and a Data engineer score identically on family."
    )
    assert _family_component(_cand(role_family="data_engineering"), _job()) == data_eng_credit


def test_critical_skill_missing_caps_component() -> None:
    """Missing a critical skill caps the required_skills component at the
    ceiling, regardless of how many other skills are matched.

    Uses a job spec that marks CV + OD critical via the '*' suffix — the same
    convention as job_openings.csv for JOB001.
    """
    from src.score import score_fit
    cfg = scoring()
    ceiling = cfg["critical_missing_ceiling"]

    critical_job = _job(required_skills="Python;PyTorch;Computer Vision*;Object Detection*;AWS")
    sara_like = _cand(
        top_skills=["Python", "PyTorch", "AWS", "Recommendation Systems"],
        role_family="ml_general",
    )
    fit = score_fit(sara_like, critical_job)
    assert fit["components"]["required_skills"] <= ceiling, (
        f"missing critical (CV + OD) should cap component at {ceiling}, "
        f"got {fit['components']['required_skills']}"
    )
    assert fit["missing_critical"] == ["Computer Vision", "Object Detection"]


def test_critical_skill_family_match_still_counts_as_present() -> None:
    """A family match (e.g. TensorFlow for PyTorch) counts as HAVING the skill —
    only literal zero triggers the cap."""
    from src.score import score_fit
    critical_job = _job(required_skills="Python;PyTorch;Computer Vision*;Object Detection*;AWS")
    priya_like = _cand(
        top_skills=["Python", "PyTorch", "Computer Vision", "YOLO", "AWS"],
        role_family="ml_cv",
    )
    fit = score_fit(priya_like, critical_job)
    assert not fit["missing_critical"]
    assert fit["components"]["required_skills"] == 1.0


def test_no_critical_marker_no_cap() -> None:
    """A job without any starred skills should never trigger the critical cap
    even when many skills are missing — the marker is opt-in."""
    from src.score import score_fit
    no_critical_job = _job(required_skills="Python;PyTorch;Computer Vision;Object Detection;AWS")
    sara_like = _cand(
        top_skills=["Python", "PyTorch", "AWS", "Recommendation Systems"],
        role_family="ml_general",
    )
    fit = score_fit(sara_like, no_critical_job)
    # 3 exact out of 5 = 0.6, no cap
    assert abs(fit["components"]["required_skills"] - 0.6) < 0.001
    assert fit["missing_critical"] == []


def test_unrelated_family_zero_credit() -> None:
    assert _family_component(_cand(role_family="product"), _job()) == 0.0


def test_not_talent_family_zero_credit() -> None:
    assert _family_component(_cand(role_family="not_talent"), _job()) == 0.0


# ── Confidence ceiling ─────────────────────────────────────────────────────

def test_low_confidence_caps_fit_score() -> None:
    cfg = scoring()
    ceiling = cfg["low_confidence_fit_ceiling"]
    # A candidate who would otherwise score very high, but with low confidence,
    # must be capped.
    perfect = _cand(data_confidence="low")
    fit = score_fit(perfect, _job())
    assert fit["score_default"] <= ceiling, (
        f"low-confidence candidate scored {fit['score_default']} > ceiling {ceiling}"
    )


# ── Aggregate score sanity ─────────────────────────────────────────────────

def test_perfect_candidate_scores_near_top() -> None:
    """A candidate with all exact skills + right family + in-band + strong
    domain + full nice-to-have should score ≥90."""
    perfect = _cand(
        top_skills=["Python", "PyTorch", "Computer Vision", "Object Detection", "AWS",
                    "Docker", "Real-time processing", "Sports Analytics"],
        industry="Sports Technology",
        current_company="Second Spectrum",
        past_companies=["Mobileye"],
    )
    fit = score_fit(perfect, _job())
    assert fit["score_default"] >= 90, fit["score_default"]


def test_bad_fit_candidate_scores_low() -> None:
    bad = _cand(
        role_family="not_talent",
        top_skills=["Excel", "SQL", "PowerPoint"],
        industry="Insurance",
        current_company="InsureCo",
        past_companies=[],
        seniority_tier=3.0,
    )
    fit = score_fit(bad, _job())
    assert fit["score_default"] <= 30, fit["score_default"]


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
