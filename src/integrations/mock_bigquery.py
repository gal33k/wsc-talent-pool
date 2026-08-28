"""MOCK: BigQuery persistence layer.

Real counterpart:  Google Cloud BigQuery
Real endpoints:
  POST /bigquery/v2/projects/{project}/jobs               execute a query
  POST /bigquery/v2/projects/{project}/datasets/{ds}/tables/{tbl}/insertAll   streaming insert

This is the queryable database behind the pool. The BI dashboard on /analytics
reads from these tables via SELECT; the pipeline writes to them on every
significant event.

Tables (mock schema):
  wsc.talent_pool.contacts       one row per person, mutable
  wsc.talent_pool.gate_events    one row per gate decision, immutable
  wsc.talent_pool.score_events   one row per (contact x job x scoring_run), immutable
  wsc.hitl.overrides             per-role recruiter overrides
  wsc.hitl.blacklist             globally excluded contacts
  wsc.hitl.recruiter_notes       free-text notes per contact
  wsc.telemetry.enrichment_calls Proxycurl call log with credit accounting

Every INSERT/SELECT is logged via call_log so the /integrations page shows the
production SQL surface. Swapping to real BigQuery is a one-file change —
replace the log() call with a client.query() call.
"""
from typing import Optional

from . import call_log


def insert_contact(hubspot_id: str, source_channel: str, role_family: str,
                   gate_decision: str, fit_scores: dict, warmth_score: float,
                   ingested_at: str) -> None:
    """Write a fresh pool ingestion event."""
    sql = (
        "INSERT INTO `wsc.talent_pool.contacts`\n"
        "  (hubspot_id, source_channel, role_family, gate_decision, "
        "fit_scores, warmth_score, ingested_at)\n"
        f"VALUES ('{hubspot_id}', '{source_channel}', '{role_family}', "
        f"'{gate_decision}', @fit_scores, {warmth_score:.1f}, '{ingested_at}')"
    )
    call_log.log(
        system="bigquery",
        method="INSERT",
        endpoint="wsc.talent_pool.contacts",
        result="1 row · streaming insert (mock)",
        payload={"sql": sql, "params": {"fit_scores": fit_scores}},
    )


def insert_gate_event(hubspot_id: str, decision: str, reason: str,
                      signals_role_family: bool, signals_skills_evidence: bool,
                      signals_proximity: bool, ts: str) -> None:
    sql = (
        "INSERT INTO `wsc.talent_pool.gate_events`\n"
        "  (hubspot_id, decision, reason, signals, ts)\n"
        f"VALUES ('{hubspot_id}', '{decision}', {reason!r},\n"
        f"  STRUCT({str(signals_role_family).lower()} AS role_family,\n"
        f"         {str(signals_skills_evidence).lower()} AS skills_evidence,\n"
        f"         {str(signals_proximity).lower()} AS proximity),\n"
        f"  '{ts}')"
    )
    call_log.log(
        system="bigquery",
        method="INSERT",
        endpoint="wsc.talent_pool.gate_events",
        result="1 row",
        payload={"sql": sql},
    )


def insert_score_event(hubspot_id: str, job_id: str, fit_score: float,
                       warmth_score: float, tier: Optional[str], ts: str) -> None:
    sql = (
        "INSERT INTO `wsc.talent_pool.score_events`\n"
        "  (hubspot_id, job_id, fit_score, warmth_score, tier, scored_at)\n"
        f"VALUES ('{hubspot_id}', '{job_id}', {fit_score:.1f}, "
        f"{warmth_score:.1f}, {tier!r}, '{ts}')"
    )
    call_log.log(
        system="bigquery",
        method="INSERT",
        endpoint="wsc.talent_pool.score_events",
        result="1 row",
        payload={"sql": sql},
    )


def query_admission_rate_by_conference() -> str:
    """The SQL the /analytics dashboard runs to compute admission-rate-by-conference.
    In the mock we only log it; the browser computes the values from pool.json."""
    sql = (
        "SELECT c.conference_name,\n"
        "       COUNT(*) AS total,\n"
        "       COUNTIF(c.gate_decision = 'ADMIT') AS admitted,\n"
        "       COUNTIF(c.gate_decision = 'ADMIT') / COUNT(*) AS admission_rate\n"
        "FROM `wsc.talent_pool.contacts` c\n"
        "GROUP BY c.conference_name\n"
        "ORDER BY admission_rate DESC"
    )
    call_log.log(
        system="bigquery",
        method="SELECT",
        endpoint="wsc.talent_pool.contacts",
        result="dashboard query · admission rate by conference",
        payload={"sql": sql},
    )
    return sql


def emit_pipeline_events(pool: list[dict], jobs_scored: dict, warmths: dict,
                         run_ts: str) -> None:
    """Called once per pipeline run to backfill the mocked BigQuery tables.
    Compresses to a single logged event so the call_log stays readable while
    still surfacing the surface area."""
    admitted = sum(1 for r in pool if r["gate"]["decision"] == "ADMIT")
    call_log.log(
        system="bigquery",
        method="INSERT",
        endpoint="wsc.talent_pool.pipeline_runs",
        result=f"1 row · {len(pool)} contacts · {admitted} admitted",
        payload={
            "sql": (
                "INSERT INTO `wsc.talent_pool.pipeline_runs`\n"
                "  (run_ts, contacts_scored, admitted, held, rejected, jobs_scored)\n"
                f"VALUES ('{run_ts}', {len(pool)}, {admitted},\n"
                f"  {sum(1 for r in pool if r['gate']['decision'] == 'HOLD')},\n"
                f"  {sum(1 for r in pool if r['gate']['decision'] == 'REJECT')},\n"
                f"  {len(jobs_scored)})"
            ),
        },
    )
