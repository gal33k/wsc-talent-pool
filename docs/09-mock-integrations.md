# 09 — Mock integrations

**No API keys. No live calls. No LLM at runtime.** Every external system is a mock adapter that
implements the same interface as the real thing, returns realistic data, and **logs the call it
would have made**.

This is a deliberate design choice, not a shortcut, and it should be stated as one in the README:

> Every integration point is implemented as an adapter with a mock and a documented real
> counterpart. Swapping to production is a one-file change per integration, with no change to the
> pipeline or the UI. The mock logs the exact API call it would have made, so the integration
> surface is visible and reviewable without a single credential.

That sentence answers the brief's "what tools/integrations would you use in a real production
version" better than a paragraph of vendor names, because it is demonstrable.

## The adapter pattern

```
src/integrations/
  base.py              Protocol definitions — the interface each adapter implements
  mock_badge_scan.py   conference export ingestion
  mock_enrichment.py   "LinkedIn" profile enrichment
  mock_hubspot.py      contact read + talent-pool property write-back
  mock_comeet.py       ATS status lookup + job fetch + candidate write-back
  mock_notifier.py     Slack / email — the intro request
  mock_narrator.py     the "LLM" layer: why_summary + outreach draft
  call_log.py          every mock call appends here; exported to the UI
```

Each adapter:
- has a docstring naming the **real** counterpart and the **actual endpoint** it maps to
- returns data shaped exactly like the real API response
- appends a structured entry to the call log: method, endpoint, payload, what it would return

## What each mock does

### `mock_badge_scan.py`
Reads `data/conference_attendees.csv` as if it were a post-event export.
Real counterpart: **Cvent / Swapcard / Brella** export endpoint or webhook file-drop.
Simulate the messiness worth handling: trailing whitespace, inconsistent capitalisation, and an
optional `--simulate-missing-linkedin 0.15` flag that blanks a fraction of LinkedIn URLs so the
missing-profile path is exercisable on demand.

### `mock_enrichment.py`
Looks up `data/linkedin_profiles.csv` by LinkedIn URL.
Real counterpart: **Clay (enrichment orchestrator)** — `GET /proxycurl/v2/linkedin?url=…`
Behaviours to simulate, because they are what production actually does:
- a **cache** — second lookup for the same URL is a cache hit and is logged as such
- a **miss rate** — return `None` for a configurable fraction, so `enrichment_status` and the
  confidence ceiling are genuinely exercised
- a **credit counter** — log "credits used: 47 / budget 500". This makes the cost argument in the
  design doc concrete: *enrich only pool admissions, not every badge scan.*

### `mock_hubspot.py`
Read: contacts. Write: the talent-pool properties back onto the contact.
Real counterpart: **HubSpot CRM v3** — `PATCH /crm/v3/objects/contacts/{id}`
Every write logs the call it would make:
```
PATCH /crm/v3/objects/contacts/HS002
  { "properties": { "talent_role_family": "ml_cv",
                    "talent_domain_score": 92,
                    "talent_pool_status": "admitted",
                    "source_channel": "conference",
                    "last_enriched": "2025-…" } }
```

### `mock_comeet.py`
- `get_open_positions()` → reads `data/job_openings.csv`. Real: `GET /company/{uid}/positions`
- `get_candidate_status(email)` → reads `data/comeet_status_stub.csv`. Returns `active_in_process`,
  `previously_rejected` (with role + date), `hired`, `declined_offer`, or `None`
- `push_sourced_candidate(...)` → logs the POST that would attach the candidate and the score
  evidence to the position

Build the stub CSV with a few deliberate rows so the dedupe logic is visible in the UI: one active
candidate (must be **suppressed**), one previously rejected for a *different* role (must **show with
a flag**), one hired (**excluded**).

### `mock_notifier.py`
The reverse-referral action. `request_intro(employee, candidate, job)` logs the Slack DM or email
that would be sent, and returns a fake message id. The UI shows it in a toast and appends it to the
log.

### `mock_narrator.py` — the "AI" layer, mocked
Generates `why_summary` and `outreach_draft` **deterministically from templates**, using only fields
the deterministic layer already computed. No API, no key, no network, no variability.

```python
def why_summary(candidate, job, evidence) -> str:
    """MOCK. Production: a single Claude call with this same structured evidence
    as input. The evidence assembled here is exactly what the real prompt receives —
    swapping to a live call means replacing the template render, nothing else."""
```

Example rendered output:

> Priya Anand matches all 5 required skills for Senior ML Engineer and has 7 years in computer
> vision at video-technology companies. Maya Levi (Senior ML Engineer) overlapped with her at
> Mobileye in 2019–21 and can make the introduction. Met at SportsTech Innovation Summit,
> Nov 2024 — noted as "spoke about real-time tracking project".

**Critically, build the prompt-shaped evidence dict even though nothing consumes it.** Log it. Then
in the meeting you can point at the log and say: *"that dict is the prompt payload; a live model
call takes it and returns prose. I kept it templated so the demo is deterministic and costs
nothing."* That is a stronger answer than having wired a key, and it is honest.

## The integrations screen

Surface `call_log.py`'s output in the UI as a chronological table:

| Time | System | Call | Payload | Result |
|---|---|---|---|---|
| 10:04:02 | badge_scan | `GET /events/1042/attendees` | — | 75 records |
| 10:04:03 | enrichment | `GET /profile?url=…priya-anand` | — | 200, credits 1/500 |
| 10:04:03 | enrichment | `GET /profile?url=…priya-anand` | — | **cache hit**, 0 credits |
| 10:04:07 | comeet | `GET /candidates?email=…` | — | `previously_rejected` (JOB003, 2024-02) |
| 10:04:09 | hubspot | `PATCH /crm/v3/objects/contacts/HS002` | `{talent_pool_status: admitted}` | 204 |
| 10:06:31 | notifier | `POST /chat.postMessage` | intro request → Maya Levi | queued |

With a banner above it: **"Mock adapters — no live calls are made. Each row shows the request the
production integration would issue."**

Two reasons this earns its place:
1. It converts the design doc's integration section into something you can *point at* in the meeting.
2. It shows the enrichment cache and credit budget working, which is the concrete version of the
   scale argument.

## The rule that keeps this safe

> `python run.py --job-id JOB001` must run to completion on a fresh clone with **no environment
> variables, no network, and no credentials.** Any future live adapter is opt-in behind a flag and
> falls back to the mock when the credential is absent.

Put that line in the README. It is also the sentence that guarantees whoever grades this can
actually run it.
