"""WSC Talent-Pool pipeline — entry point.

    python run.py --job-id JOB001                     # full pipeline for JOB001
    python run.py --job-id JOB001 --emit-json         # + emit web/public/data/pool.json
    python run.py --all-jobs --emit-json              # process all 4 jobs, emit JSON
    python run.py --gate-audit                        # dump gate decisions for all 75

The rule that guarantees graders can run this:
    Runs to completion on a fresh clone with NO env vars, NO network, NO creds.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

from src.config import DATA_DIR, OUTPUT_DIR, ROOT
from datetime import datetime, timezone

from src.integrations import call_log, mock_comeet, mock_hubspot, mock_narrator, mock_bigquery
from src.integrations.mock_enrichment import MockEnrichment
from src.ingest import load_attendees
from src.resolve import resolve
from src.enrich import enrich
from src.normalize import normalise
from src.gate import gate
from src.score import score_fit
from src.warmpath import score_warmth, best_intro_path
from src.report import (
    SHORTLIST_COLUMNS, assign_tier, days_since, fit_breakdown,
    suggested_action, write_shortlist_csv, write_shortlist_html,
    write_excluded_csv, emit_pool_json,
)


def _load_employees() -> list[dict]:
    with (DATA_DIR / "wsc_employees.csv").open(encoding="utf-8-sig") as f:
        return [{k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
                for row in csv.DictReader(f)]


def _load_jobs() -> list[dict]:
    positions = mock_comeet.get_open_positions(DATA_DIR / "job_openings.csv")
    return positions


def _load_comeet_status_map() -> dict[str, dict]:
    stub = DATA_DIR / "comeet_status_stub.csv"
    if not stub.exists():
        return {}
    out: dict[str, dict] = {}
    with stub.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            out[row["email"].strip().lower()] = {k: v.strip() for k, v in row.items()}
    return out


def _pool_pipeline(simulate_missing_linkedin: float, miss_rate: float) -> list[dict]:
    rows = load_attendees(
        DATA_DIR / "conference_attendees.csv",
        simulate_missing_linkedin=simulate_missing_linkedin,
    )
    rows = resolve(rows)
    enricher = MockEnrichment(DATA_DIR / "linkedin_profiles.csv", miss_rate=miss_rate)
    rows = enrich(rows, enricher)
    rows = normalise(rows)
    rows = gate(rows)
    return rows


def _run_pool_writes(rows: list[dict]) -> None:
    """Emit the HubSpot write-back the pipeline would perform in prod.
    Also log a mock BigQuery pipeline_runs event so /analytics has a seed."""
    for r in rows:
        if r["gate"]["decision"] != "ADMIT":
            continue
        mock_hubspot.write_talent_pool_properties(
            contact_id=r["hubspot_id"],
            properties={
                "talent_role_family": r.get("role_family"),
                "talent_domain_score": r.get("domain_relevance_score"),
                "talent_pool_status": "admitted",
                "source_channel": r.get("source_channel"),
            },
        )
    # Single aggregate BigQuery event for the run — see src/integrations/mock_bigquery.py
    mock_bigquery.emit_pipeline_events(
        pool=rows,
        jobs_scored={},
        warmths={},
        run_ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    mock_bigquery.query_admission_rate_by_conference()


def _write_talent_pool_csv(rows: list[dict]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / "talent_pool.csv"
    cols = [
        "hubspot_id", "full_name", "current_title", "current_company",
        "role_family", "seniority_tier", "domain_relevance_score",
        "gate_decision", "gate_reason",
        "data_confidence", "enrichment_status",
        "industry", "years_experience",
        "linkedin_url", "conference_name", "conference_date",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({
                **r,
                "gate_decision": r["gate"]["decision"],
                "gate_reason": r["gate"]["reason"],
            })
    return path


# ---------------------------------------------------------------------------
# Decision B — per job
# ---------------------------------------------------------------------------

def _score_job(pool: list[dict], job: dict, employees: list[dict],
               comeet_map: dict[str, dict]) -> tuple[list[dict], list[dict], dict, dict]:
    """Return (shortlist_rows, excluded_rows, fit_by_id, narrator_by_id)."""
    admitted = [r for r in pool if r["gate"]["decision"] == "ADMIT"]

    fit_by_id: dict[str, dict] = {}
    narrator_by_id: dict[str, dict] = {}
    warmths: dict[str, dict] = {}

    for r in admitted:
        fit = score_fit(r, job)
        warmth = score_warmth(r, employees)
        warmths[r["hubspot_id"]] = warmth
        fit_by_id[r["hubspot_id"]] = fit

    scored_rows: list[dict] = []
    excluded_rows: list[dict] = []

    for r in admitted:
        fit = fit_by_id[r["hubspot_id"]]
        warmth = warmths[r["hubspot_id"]]
        intro = best_intro_path(warmth, job.get("department"))

        # Comeet status handling
        email = (r.get("email") or "").lower()
        status = comeet_map.get(email)
        if status:
            mock_comeet.get_candidate_status(r.get("email") or "", DATA_DIR / "comeet_status_stub.csv")
            if status["status"] == "hired":
                excluded_rows.append({
                    "full_name": r.get("full_name"), "stage": "comeet",
                    "reason": "Already hired at WSC (Comeet)",
                    "signals_passed": "3/3", "hubspot_id": r["hubspot_id"],
                    "linkedin_url": r.get("linkedin_url"),
                })
                continue
            if status["status"] == "active_in_process" and status.get("role") == job["job_id"]:
                excluded_rows.append({
                    "full_name": r.get("full_name"), "stage": "comeet",
                    "reason": f"Active in {job['job_id']} process (dedupe)",
                    "signals_passed": "3/3", "hubspot_id": r["hubspot_id"],
                    "linkedin_url": r.get("linkedin_url"),
                })
                continue

        tier = assign_tier(fit["score_default"], warmth["score_default"])
        if tier is None:
            # below nurture threshold; skip from shortlist but keep in pool
            excluded_rows.append({
                "full_name": r.get("full_name"), "stage": "below_threshold",
                "reason": f"fit={fit['score_default']} < nurture cutoff",
                "signals_passed": "n/a", "hubspot_id": r["hubspot_id"],
                "linkedin_url": r.get("linkedin_url"),
            })
            continue

        conf_date = r.get("conference_date") or ""
        # Compose evidence dict for the narrator (prompt payload in prod)
        evidence = {
            "matched_required": fit["matched_required"] + fit["matched_required_family"],
            "total_required": len(fit["matched_required"]) + len(fit["matched_required_family"]) + len(fit["missing_required"]),
            "best_intro_path": intro,
            "conference_name": r.get("conference_name", ""),
            "conference_month": (conf_date[:7] if conf_date else ""),
            "notes": r.get("notes", ""),
        }
        why = mock_narrator.why_summary(r, job, evidence)
        draft = mock_narrator.outreach_draft(r, job, evidence)

        narrator_by_id[r["hubspot_id"]] = {
            "best_intro_path": intro,
            "why_summary": why,
            "outreach_draft": draft,
        }

        mutuals_str = "; ".join(f"{m['name']} ({m['title']})" for m in warmth["mutuals"])
        shared_str = "; ".join(
            f"{s['name']} @ {s['employer']}" + (f" {s['overlap']}" if s.get("overlap") else "")
            for s in warmth["shared_employers"]
        )
        matched_family_str = "; ".join(fit["matched_required_family"])

        scored_rows.append({
            "rank": None,  # filled after sort
            "priority_tier": tier,
            "fit_score": fit["score_default"],
            "warmth_score": warmth["score_default"],
            "fit_breakdown": fit_breakdown(fit["components"]),
            "full_name": r.get("full_name"),
            "current_title": r.get("current_title") or r.get("title"),
            "current_company": r.get("current_company") or r.get("company"),
            "location": r.get("location", ""),
            "years_experience": r.get("years_experience"),
            "seniority_flag": fit["seniority_flag"],
            "matched_required": "; ".join(fit["matched_required"]),
            "matched_required_family": matched_family_str,
            "missing_required": "; ".join(fit["missing_required"]),
            "matched_nice_to_have": "; ".join(fit["matched_nice_to_have"]),
            "best_intro_path": intro,
            "mutual_connections": mutuals_str,
            "shared_employers": shared_str,
            "conference_name": r.get("conference_name"),
            "conference_date": conf_date,
            "days_since_contact": days_since(conf_date),
            "recruiter_notes": r.get("notes", ""),
            "why_summary": why,
            "data_confidence": r.get("data_confidence"),
            "suggested_action": suggested_action(tier, r.get("data_confidence", "high"), status),
            "hubspot_id": r["hubspot_id"],
            "linkedin_url": r.get("linkedin_url"),
        })

    # Sort fit-first (competence is the primary signal), then warmth as
    # tiebreaker. Tier is now a label attached to each row, not a sort key —
    # the recruiter reads tier to decide *what action* (warm intro vs cold
    # outreach vs nurture), but the ORDER reflects who deserves attention.
    scored_rows.sort(key=lambda r: (-r["fit_score"], -r["warmth_score"]))
    for i, r in enumerate(scored_rows, start=1):
        r["rank"] = i

    return scored_rows, excluded_rows, fit_by_id, narrator_by_id


# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------

def _print_gate_audit(rows: list[dict]) -> None:
    order = {"REJECT": 0, "HOLD": 1, "ADMIT": 2}
    rows_sorted = sorted(rows, key=lambda r: (order[r["gate"]["decision"]], r["hubspot_id"]))

    print("\n" + "=" * 100)
    print("CHECKPOINT A - GATE DECISIONS FOR ALL 75 ROWS")
    print("=" * 100)

    critical = {
        "HS041": "Viktor Novak", "HS049": "Ingrid Svensson", "HS054": "Mei Zhang",
        "HS056": "Kim Soo-Jin", "HS067": "Javier Morales",
        "HS026": "Grace Wilson (warm-path demo)",
    }
    counts = {"ADMIT": 0, "HOLD": 0, "REJECT": 0}

    print(f"\n{'HID':<7}{'S1':<3}{'S2':<3}{'S3':<3}{'DECISION':<9}{'NAME':<24}{'TITLE':<32}{'FAMILY':<20}")
    print("-" * 100)
    for r in rows_sorted:
        d = r["gate"]["decision"]
        counts[d] += 1
        sig = r["gate"]["signals"]
        s1 = "Y" if sig["role_family"] else "."
        s2 = "Y" if sig["skills_evidence"] else "."
        s3 = "Y" if sig["proximity"] else "."
        print(f"{r['hubspot_id']:<7}{s1:<3}{s2:<3}{s3:<3}{d:<9}"
              f"{(r.get('full_name') or '')[:23]:<24}"
              f"{(r.get('current_title') or '')[:31]:<32}"
              f"{r.get('role_family', '')[:19]:<20}")
    print("-" * 100)
    print(f"Totals: ADMIT={counts['ADMIT']}  HOLD={counts['HOLD']}  REJECT={counts['REJECT']}  (of 75)")

    print("\nCritical rows:")
    by_hid = {r["hubspot_id"]: r for r in rows}
    all_pass = True
    for hid, note in critical.items():
        r = by_hid.get(hid)
        if not r or r["gate"]["decision"] != "ADMIT":
            all_pass = False
            print(f"  FAIL {hid} {note}")
        else:
            print(f"  OK   {hid} {note} -- {r['gate']['reason']}")
    print("PASS" if all_pass else "FAIL", "\n")


def _print_shortlist(shortlist: list[dict], excluded: list[dict], job: dict) -> None:
    print("\n" + "=" * 100)
    print(f"SHORTLIST FOR {job['job_id']} ({job['title']})")
    print("=" * 100)
    print(f"\n{'#':<3} {'TIER':<17} {'FIT':<5} {'WARM':<5} {'FLAG':<12} {'NAME':<24} {'TITLE':<32}")
    print("-" * 100)
    for r in shortlist[:20]:
        print(f"{r['rank']:<3} {r['priority_tier']:<17} "
              f"{r['fit_score']:<5} {r['warmth_score']:<5} "
              f"{r['seniority_flag']:<12} "
              f"{(r.get('full_name') or '')[:23]:<24} "
              f"{(r.get('current_title') or '')[:31]:<32}")
    if len(shortlist) > 20:
        print(f"... {len(shortlist) - 20} more shortlisted")
    print(f"\nExcluded ({len(excluded)}):")
    for e in excluded[:10]:
        print(f"  - {e['full_name']:<20}  {e['stage']:<18}  {e['reason']}")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser(description="WSC talent-pool pipeline")
    p.add_argument("--job-id", help="Job to shortlist against (e.g. JOB001)")
    p.add_argument("--all-jobs", action="store_true",
                   help="Process all jobs; combined with --emit-json emits pool.json")
    p.add_argument("--gate-audit", action="store_true",
                   help="Dump gate decisions for all 75 rows and exit")
    p.add_argument("--emit-json", action="store_true",
                   help="Emit web/public/data/pool.json for the web app")
    p.add_argument("--simulate-missing-linkedin", type=float, default=0.0)
    p.add_argument("--enrichment-miss-rate", type=float, default=0.0)
    args = p.parse_args()

    call_log.reset()

    pool = _pool_pipeline(
        simulate_missing_linkedin=args.simulate_missing_linkedin,
        miss_rate=args.enrichment_miss_rate,
    )
    _run_pool_writes(pool)
    pool_csv = _write_talent_pool_csv(pool)

    if args.gate_audit:
        _print_gate_audit(pool)
        print(f"talent pool written to: {pool_csv}")
        return

    employees = _load_employees()
    jobs = _load_jobs()
    comeet_map = _load_comeet_status_map()

    target_jobs = jobs if args.all_jobs else [j for j in jobs if j["job_id"] == args.job_id]
    if args.job_id and not target_jobs:
        raise SystemExit(f"unknown job_id: {args.job_id}")
    if not target_jobs and not args.emit_json:
        _print_gate_audit(pool)
        print(f"talent pool written to: {pool_csv}")
        return

    if args.emit_json and not target_jobs:
        # for --emit-json without --all-jobs or --job-id, default to all
        target_jobs = jobs

    scored_by_job: dict[str, dict[str, dict]] = {}
    narrator_by_job: dict[str, dict[str, dict]] = {}
    warmth_by_person: dict[str, dict] = {}

    for job in target_jobs:
        shortlist, excluded, fit_by_id, narrator = _score_job(pool, job, employees, comeet_map)
        scored_by_job[job["job_id"]] = fit_by_id
        narrator_by_job[job["job_id"]] = narrator

        # Every admitted candidate gets warmth (job-agnostic apart from best_intro_path)
        for r in pool:
            if r["gate"]["decision"] == "ADMIT" and r["hubspot_id"] not in warmth_by_person:
                warmth_by_person[r["hubspot_id"]] = score_warmth(r, employees)

        # Write CSVs and HTML per job
        jid = job["job_id"]
        write_shortlist_csv(shortlist, OUTPUT_DIR / f"{jid}_shortlist.csv")
        write_excluded_csv(excluded, OUTPUT_DIR / f"{jid}_excluded.csv")
        write_shortlist_html(shortlist, excluded, job, OUTPUT_DIR / f"{jid}_shortlist.html")

        _print_shortlist(shortlist, excluded, job)
        print(f"  csv:     output/{jid}_shortlist.csv")
        print(f"  html:    output/{jid}_shortlist.html")
        print(f"  excluded: output/{jid}_excluded.csv")

    if args.emit_json:
        # Comeet status in json is keyed by email
        json_path = ROOT / "web" / "public" / "data" / "pool.json"
        emit_pool_json(
            pool=pool,
            employees=employees,
            jobs=jobs,
            scored=scored_by_job,
            warmth_by_person=warmth_by_person,
            narrator_output=narrator_by_job,
            comeet_status=comeet_map,
            path=json_path,
        )
        print(f"\npool.json emitted to: {json_path}")

    print(f"\ntalent pool: {pool_csv}")


if __name__ == "__main__":
    main()
