# 04 — Output specification

The brief asks us to "define the output" and says it must be usable by a recruiter **without
additional processing**. Test for every column: *does this answer a question the recruiter would
otherwise have to go and look up?*

## `output/JOB001_shortlist.csv`

| Column | Why it's there |
|---|---|
| `rank` | Where to start. |
| `priority_tier` | What kind of move this is: call_this_week / direct_outreach / nurture. |
| `fit_score` | Competence, 0–100. |
| `warmth_score` | Signal score, 0–100 (endorsements + reachability). *Column name kept as `warmth_score` for pipeline API stability; user-facing surfaces call it Signal.* |
| `fit_breakdown` | The five sub-scores, e.g. `skills:31/35, family:25/25, seniority:15/15, domain:15/15, nice:3/10`. **This is the "not a black box" column.** |
| `full_name` | |
| `current_title` | |
| `current_company` | |
| `location` | Matters if the role is Tel Aviv-based or hybrid. |
| `years_experience` | |
| `seniority_flag` | `in_band` / `above_band` / `below_band` — surfaced, not buried. |
| `matched_required` | The interview agenda, pre-written. |
| `missing_required` | e.g. "no evidence of object detection". |
| `matched_nice_to_have` | The differentiator between two similar candidates. |
| `best_intro_path` | **The most actionable field in the file.** A named person and a reason: `Maya Levi (Sr ML Engineer) — overlapped at Mobileye 2019–21`. |
| `mutual_connections` | Employee **names and titles**, never opaque IDs like `WSC002`. |
| `shared_employers` | Post-stoplist only. |
| `conference_name` | |
| `conference_date` | |
| `days_since_contact` | The opening line of the message. |
| `recruiter_notes` | Human context from the badge scan — "spoke about real-time tracking project". |
| `why_summary` | One sentence a recruiter can paste into Slack. |
| `data_confidence` | `high` / `medium` / `low`. Incomplete records should be visible, not silently averaged away. |
| `suggested_action` | request_intro / direct_outreach / nurture / needs_enrichment. Closes the loop from score to behaviour. |
| `hubspot_id` | Write-back key. Without it the output is a dead end. |
| `linkedin_url` | Write-back key. |

## Second output — excluded rows

`output/JOB001_excluded.csv` with `full_name`, `stage` (gate / hard requirement), `reason`,
`signals_passed`. Keeps the filter auditable and answers the first question a recruiter will ask:
*"who did it throw away, and why?"*

## Third output — the bonus recruiter view

`output/JOB001_shortlist.html` — a single self-contained HTML file written by the same code path
that writes the CSV. No build step, no dependencies, opens by double-clicking.

Contents:
- header: job title, date generated, counts (pool size, shortlisted, excluded)
- candidate cards grouped by `priority_tier`
- per card: name, title @ company, fit and signal as small bars, matched/missing skills as chips,
  the intro path called out prominently, the recruiter note, and a copy-ready outreach line
- a collapsed "excluded, with reasons" section at the bottom

Half a day at most, and it is the one deliverable the brief openly calls "impressive".

## Also write back to the pool

`output/talent_pool.csv` — the post-gate pool with `role_family`, `domain_relevance`,
`gate_decision`, `gate_reason`, `enrichment_status`, `data_confidence`. This is the artefact that
represents "what HubSpot would now contain", and it makes Decision A visible as a deliverable in its
own right rather than an invisible internal step.
