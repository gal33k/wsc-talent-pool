"""MOCK: employee-submitted referral capture.

Real counterpart:  a form embedded in Slack (or a HubSpot form) that WSC
                   employees use to submit a candidate they'd vouch for.
Real endpoints:
  POST /forms/referrals/submissions          - receive the payload
  POST /crm/v3/objects/contacts              - create the HubSpot contact
  GET  /clay/v1/enrichment/people?url=       - enrich the profile
  POST /positions/{pid}/candidates           - push to Comeet if fit >= threshold

Referrals are the highest-converting channel by a wide margin (see
docs/06-production-design.md § "Multi-channel"). Capturing the RELATIONSHIP
(how the referrer knows them, where and when they worked together) is the
signal that makes a referral more than a name — that context is what makes
the outreach feel personal.

The forward-referral flow reuses the whole scoring pipeline unchanged:
    submission -> mock_enrichment -> normalise -> gate -> score
The only thing that changes is source_channel = "referral" and a
referred_by_employee_id field on the contact record. Everything else — the
gate, the taxonomy, fit + warmth scoring, the intro-path logic — behaves
identically to a conference-channel contact.
"""
from datetime import datetime, timezone
from typing import Optional

from . import call_log


def submit_referral(
    referring_employee_id: str,
    referring_employee_name: str,
    candidate_name: str,
    candidate_linkedin_url: Optional[str],
    target_job_id: str,
    relationship_note: str,
) -> dict:
    """Log the referral submission the way production would receive it.

    Returns a mock submission id and echoes back the payload the pipeline
    would send downstream. The client can present this to the recruiter as
    'queued for enrichment' without any live network call.
    """
    payload = {
        "source_channel": "referral",
        "referring_employee_id": referring_employee_id,
        "referring_employee_name": referring_employee_name,
        "candidate": {
            "full_name": candidate_name,
            "linkedin_url": candidate_linkedin_url or None,
        },
        "target_job_id": target_job_id,
        "relationship_note": relationship_note,
        "submitted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    call_log.log(
        system="referral",
        method="POST",
        endpoint="/forms/referrals/submissions",
        result="201 accepted (mock) — queued for enrichment",
        payload=payload,
    )
    # Simulate the downstream chain the pipeline would trigger.
    call_log.log(
        system="hubspot",
        method="POST",
        endpoint="/crm/v3/objects/contacts",
        result="201 created (mock) — source_channel=referral",
        payload={
            "properties": {
                "full_name": candidate_name,
                "source_channel": "referral",
                "referred_by": referring_employee_name,
                "talent_pool_status": "pending_enrichment",
                "relationship_note": relationship_note,
            }
        },
    )
    if candidate_linkedin_url:
        call_log.log(
            system="enrichment",
            method="GET",
            endpoint=f"/profile?url={candidate_linkedin_url}",
            result="queued (mock) — will fill profile on next batch",
        )

    return {
        "submission_id": f"ref-{abs(hash((referring_employee_id, candidate_name))) % 10**8}",
        "status": "queued_for_enrichment",
        "next_steps": [
            "mock_enrichment fills the LinkedIn profile",
            "normalise + gate assign role_family and admission decision",
            "score against target_job_id with the same fit + warmth model",
            "if tier >= direct_outreach, push to Comeet as a sourced candidate",
        ],
        "payload": payload,
    }
