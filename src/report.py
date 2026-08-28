"""Stage 8: deliver. CSV + HTML + pool.json emitters, all off one code path.

pool.json is the app's data contract (docs/08). Sub-score components are
0-1 and weight-independent so the browser reproduces score_default with the
default weights and can re-rank live under new weights.
"""
from __future__ import annotations

import csv
import hashlib
import html
import json
from datetime import date, datetime, timezone
from pathlib import Path

from .config import scoring, taxonomy


TIER_ORDER = ["call_this_week", "direct_outreach", "nurture"]
TIER_LABELS = {
    "call_this_week": "Call this week",
    "direct_outreach": "Direct outreach",
    "nurture": "Nurture",
}


def assign_tier(fit: float, warmth: float) -> str | None:
    cfg = scoring()["tiers"]
    if fit >= cfg["call_this_week"]["min_fit"] and warmth >= cfg["call_this_week"]["min_warmth"]:
        return "call_this_week"
    if fit >= cfg["direct_outreach"]["min_fit"]:
        return "direct_outreach"
    if fit >= cfg["nurture"]["min_fit"]:
        return "nurture"
    return None


def suggested_action(tier: str | None, data_confidence: str, comeet_status: dict | None) -> str:
    if comeet_status and comeet_status.get("status") == "active_in_process":
        return "in_ats_process"
    if data_confidence == "low":
        return "needs_enrichment"
    if tier == "call_this_week":
        return "request_intro"
    if tier == "direct_outreach":
        return "direct_outreach"
    if tier == "nurture":
        return "nurture"
    return "not_shortlisted"


def fit_breakdown(components: dict) -> str:
    """'skills:31/35, family:25/25, seniority:15/15, domain:15/15, nice:3/10'."""
    weights = scoring()["fit_weights"]
    return ", ".join([
        f"skills:{round(components['required_skills'] * weights['required_skills'])}/{weights['required_skills']}",
        f"family:{round(components['role_family'] * weights['role_family'])}/{weights['role_family']}",
        f"seniority:{round(components['seniority'] * weights['seniority'])}/{weights['seniority']}",
        f"domain:{round(components['domain'] * weights['domain'])}/{weights['domain']}",
        f"nice:{round(components['nice_to_have'] * weights['nice_to_have'])}/{weights['nice_to_have']}",
    ])


def days_since(conf_date: str, ref: date | None = None) -> int:
    ref = ref or date.today()
    try:
        y, m, d = map(int, conf_date.split("-"))
        return (ref - date(y, m, d)).days
    except (ValueError, AttributeError):
        return -1


# ----------------------------------------------------------------------------
# CSV — the graded deliverable
# ----------------------------------------------------------------------------

SHORTLIST_COLUMNS = [
    "rank", "priority_tier", "fit_score", "warmth_score", "fit_breakdown",
    "full_name", "current_title", "current_company", "location", "years_experience",
    "seniority_flag", "matched_required", "missing_required", "matched_nice_to_have",
    "best_intro_path", "mutual_connections", "shared_employers",
    "conference_name", "conference_date", "days_since_contact",
    "recruiter_notes", "why_summary", "data_confidence", "suggested_action",
    "hubspot_id", "linkedin_url",
]


def write_shortlist_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=SHORTLIST_COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def write_excluded_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cols = ["full_name", "stage", "reason", "signals_passed",
            "hubspot_id", "linkedin_url"]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


# ----------------------------------------------------------------------------
# HTML — the recruiter view (single self-contained file, no build step)
# ----------------------------------------------------------------------------

_HTML_STYLE = """
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#111;margin:0;background:#f7f8fa}
header{padding:24px 32px;background:#111;color:#fff}
header h1{margin:0 0 4px 0;font-size:20px}
header .meta{color:#9aa;font-size:12px}
.banner{background:#fef3c7;border-bottom:1px solid #f59e0b;color:#78350f;padding:8px 32px;font-size:12px}
main{padding:24px 32px;max-width:1200px;margin:0 auto}
h2{font-size:15px;margin:32px 0 12px 0;color:#374151;letter-spacing:.02em;text-transform:uppercase}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px}
.card-head{display:flex;justify-content:space-between;gap:16px;align-items:baseline}
.name{font-weight:600;font-size:16px}
.role{color:#6b7280;font-size:13px}
.scores{display:flex;gap:24px;margin:12px 0}
.score{flex:1}
.score-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
.score-num{font-weight:600;font-size:15px}
.bar{height:6px;background:#e5e7eb;border-radius:3px;margin-top:4px;overflow:hidden}
.bar > div{height:100%;background:#2563eb}
.warmth-bar > div{background:#10b981}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
.chip{background:#eef2ff;color:#3730a3;font-size:11px;padding:2px 8px;border-radius:10px}
.chip.missing{background:transparent;border:1px dashed #d1d5db;color:#6b7280}
.chip.warn{background:#fef3c7;color:#78350f}
.intro{background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;margin:8px 0;font-size:13px}
.note{font-style:italic;color:#4b5563;font-size:12px;margin-top:6px}
.flag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#991b1b;margin-left:8px}
.flag.info{background:#dbeafe;color:#1e40af}
.excluded-section{margin-top:32px;padding-top:24px;border-top:2px dashed #e5e7eb}
.excluded-row{color:#6b7280;font-size:12px;padding:4px 0;border-bottom:1px dotted #e5e7eb}
.footer{color:#6b7280;font-size:11px;text-align:center;margin:32px 0 16px 0}
"""


def _card_html(row: dict) -> str:
    fit = row["fit_score"]
    warmth = row["warmth_score"]
    matched = row.get("matched_required", "").split("; ") if row.get("matched_required") else []
    missing = row.get("missing_required", "").split("; ") if row.get("missing_required") else []
    matched_family = row.get("matched_required_family", "").split("; ") if row.get("matched_required_family") else []
    flags = []
    if row.get("seniority_flag") == "above_band":
        flags.append('<span class="flag">above band</span>')
    if row.get("data_confidence") == "low":
        flags.append('<span class="flag">low confidence</span>')
    if row.get("suggested_action") == "in_ats_process":
        flags.append('<span class="flag info">already in ATS</span>')

    chips = "".join(f'<span class="chip">{html.escape(s)}</span>' for s in matched if s)
    chips += "".join(f'<span class="chip warn">{html.escape(s)} (family match)</span>' for s in matched_family if s)
    chips += "".join(f'<span class="chip missing">{html.escape(s)}</span>' for s in missing if s)

    intro = row.get("best_intro_path") or ""
    intro_html = f'<div class="intro"><strong>Intro path:</strong> {html.escape(intro)}</div>' if intro else ""

    note = row.get("recruiter_notes") or ""
    note_html = f'<div class="note">Note: {html.escape(note)}</div>' if note else ""

    why = row.get("why_summary") or ""

    return f"""
<div class="card">
  <div class="card-head">
    <div>
      <div class="name">#{row['rank']} {html.escape(row['full_name'])}{"".join(flags)}</div>
      <div class="role">{html.escape(row['current_title'])} @ {html.escape(row['current_company'])} · {html.escape(row.get('location') or '')} · {row.get('years_experience') or '?'}y</div>
    </div>
  </div>
  <div class="scores">
    <div class="score">
      <div class="score-label">Fit <span class="score-num">{fit}</span></div>
      <div class="bar"><div style="width:{fit}%"></div></div>
    </div>
    <div class="score">
      <div class="score-label">Warmth <span class="score-num">{warmth}</span></div>
      <div class="bar warmth-bar"><div style="width:{warmth}%"></div></div>
    </div>
  </div>
  <div class="chips">{chips}</div>
  {intro_html}
  {note_html}
  <div class="note">{html.escape(why)}</div>
</div>
"""


def write_shortlist_html(rows: list[dict], excluded: list[dict], job: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")

    by_tier: dict[str, list[dict]] = {t: [] for t in TIER_ORDER}
    for r in rows:
        if r["priority_tier"] in by_tier:
            by_tier[r["priority_tier"]].append(r)

    sections = []
    for tier in TIER_ORDER:
        items = by_tier[tier]
        if not items:
            continue
        sections.append(f"<h2>{TIER_LABELS[tier]} ({len(items)})</h2>")
        sections.append("".join(_card_html(r) for r in items))

    excl_html = ""
    if excluded:
        excl_rows = "".join(
            f'<div class="excluded-row"><strong>{html.escape(e["full_name"])}</strong> — '
            f'{html.escape(e["stage"])}: {html.escape(e["reason"])}</div>'
            for e in excluded
        )
        excl_html = f'<div class="excluded-section"><h2>Excluded ({len(excluded)})</h2>{excl_rows}</div>'

    document = f"""<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shortlist — {html.escape(job['title'])}</title>
<style>{_HTML_STYLE}</style>
</head>
<body>
<div class="banner">Synthetic data — recruitment exercise. No real candidate data.</div>
<header>
  <h1>{html.escape(job['title'])} — shortlist</h1>
  <div class="meta">{html.escape(job.get('department',''))} · {html.escape(job.get('seniority',''))} · generated {generated} · {len(rows)} shortlisted, {len(excluded)} excluded</div>
</header>
<main>
{"".join(sections)}
{excl_html}
<div class="footer">WSC Sports talent-pool pipeline · take-home exercise</div>
</main>
</body></html>
"""
    path.write_text(document, encoding="utf-8")


# ----------------------------------------------------------------------------
# pool.json — the web app's data contract
# ----------------------------------------------------------------------------


def _config_hash() -> str:
    from .config import CONFIG_DIR
    h = hashlib.sha1()
    h.update((CONFIG_DIR / "scoring.yaml").read_bytes())
    h.update((CONFIG_DIR / "taxonomy.yaml").read_bytes())
    return h.hexdigest()[:8]


def emit_pool_json(pool: list[dict], employees: list[dict], jobs: list[dict],
                   scored: dict[str, dict[str, dict]],
                   warmth_by_person: dict[str, dict],
                   narrator_output: dict[str, dict[str, dict]],
                   comeet_status: dict[str, dict],
                   path: Path) -> None:
    """
    pool               = list of gated candidate rows (post-normalise, post-gate)
    employees          = WSC employees
    jobs               = job openings
    scored[job_id][person_id] = fit dict from src/score.py
    warmth_by_person[person_id] = warmth dict from src/warmpath.py
    narrator_output[job_id][person_id] = {why_summary, outreach_draft, best_intro_path}
    comeet_status[email] = comeet stub row (or absent)
    """
    cfg = scoring()

    candidates_out = []
    for r in pool:
        cid = r["hubspot_id"]
        conf_date = r.get("conference_date") or ""
        candidate_entry = {
            "id": cid,
            "person_id": r.get("person_id"),
            "name": r.get("full_name"),
            "email": r.get("email"),
            "title": r.get("current_title") or r.get("title"),
            "company": r.get("current_company") or r.get("company"),
            "location": r.get("location", ""),
            "years_experience": r.get("years_experience"),
            "linkedin_url": r.get("linkedin_url"),
            "industry": r.get("industry", ""),
            "skills": r.get("top_skills", []),
            "past_titles": r.get("past_titles", []),
            "past_companies": r.get("past_companies", []),
            "conference": {
                "name": r.get("conference_name"),
                "domain": r.get("conference_domain"),
                "date": conf_date,
                "days_since": days_since(conf_date),
            },
            "notes": r.get("notes", ""),
            "role_family": r.get("role_family"),
            "seniority_tier": r.get("seniority_tier"),
            "data_confidence": r.get("data_confidence"),
            "enrichment_status": r.get("enrichment_status"),
            "domain_relevance_score": r.get("domain_relevance_score"),
            "gate": r.get("gate"),
            "comeet_status": comeet_status.get((r.get("email") or "").lower()),
            "warmth": warmth_by_person.get(cid, {
                "components": {"mutual_connections": 0, "shared_employer": 0, "recency": 0, "notes_present": 0},
                "score_default": 0,
                "mutuals": [],
                "shared_employers": [],
            }),
            "jobs": {},
        }
        for job in jobs:
            jid = job["job_id"]
            fit = scored.get(jid, {}).get(cid)
            if not fit:
                continue
            narrator = narrator_output.get(jid, {}).get(cid, {})
            candidate_entry["jobs"][jid] = {
                **fit,
                "best_intro_path": narrator.get("best_intro_path", ""),
                "why_summary": narrator.get("why_summary", ""),
                "outreach_draft": narrator.get("outreach_draft", ""),
            }
        candidates_out.append(candidate_entry)

    from .integrations import call_log

    document = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config_version": f"scoring.yaml@{_config_hash()}",
        "defaults": {
            "fit_weights": cfg["fit_weights"],
            "warmth_weights": cfg["warmth_weights"],
            "tiers": cfg["tiers"],
        },
        "jobs": [
            {
                "job_id": j["job_id"],
                "title": j["title"],
                "department": j["department"],
                "seniority": j["seniority"],
                "key_domains": [s.strip() for s in (j.get("key_domains") or "").split(";") if s.strip()],
                "required_skills": [s.strip() for s in (j.get("required_skills") or "").split(";") if s.strip()],
                "nice_to_have": [s.strip() for s in (j.get("nice_to_have") or "").split(";") if s.strip()],
            }
            for j in jobs
        ],
        "employees": [
            {
                "employee_id": e["employee_id"],
                "full_name": e["full_name"],
                "title": e["title"],
                "department": e["department"],
                "linkedin_id": e.get("linkedin_id"),
            }
            for e in employees
        ],
        "candidates": candidates_out,
        "call_log": call_log.entries(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=2, default=str), encoding="utf-8")
