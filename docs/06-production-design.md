# 06 — Production design (the design-doc deliverable)

The brief requires an explanation of what replaces each CSV in a real deployment, and what the
system looks like at scale. Be **specific about vendors and mechanisms** — this is where generic
answers become indistinguishable from each other.

## What replaces each mock

| Mock file | Real system | Mechanism |
|---|---|---|
| `conference_attendees.csv` | Badge-scan vendors — Cvent, Swapcard, Brella, Eventbrite | Post-event export or API pull into HubSpot as contacts, tagged with the event and its domain. Business cards via OCR; booth conversations via a mobile capture form so notes are structured at the source. |
| *(the pool itself)* | **HubSpot** | A custom object, or a contact-property namespace: `talent_role_family`, `talent_domain_score`, `talent_pool_status`, `last_enriched`, `source_channel`. Lists and workflows come free. The team already lives here — that is why the brief names it. |
| `linkedin_profiles.csv` | A compliant enrichment vendor | Proxycurl, People Data Labs, Clearbit or similar, keyed on LinkedIn URL or work email, with a credit budget and a persistent cache. |
| `wsc_employees.csv` | HRIS — HiBob, BambooHR, Workday | Nightly roster sync. Mutual connections require each employee to opt into a network-sharing integration; where that isn't available, **shared-employer overlap from HRIS work history is the fallback** — which is exactly why that column matters. |
| `job_openings.csv` | **Comeet** | Pull open positions via API; webhook on job-published to auto-trigger a shortlist; write shortlisted candidates back as sourced candidates with the score and evidence attached. |

## Say this about LinkedIn explicitly

> Scraping LinkedIn directly violates their terms of service, and Sales Navigator has no bulk export
> API — it is a research surface for recruiters, not a data source for a pipeline. Production
> enrichment goes through a compliant vendor with a DPA in place.

Knowing that boundary is a maturity signal, and it pre-empts the obvious follow-up question in the
debrief. Sales Navigator still has a role: as the **manual research tool** a recruiter uses on a
shortlisted candidate, not as an automated feed.

## Orchestration

- **Event-driven ingest**: webhook / file-drop watcher on the badge-scan export → queue → pipeline.
- **Scheduled enrichment refresh**: nightly worker walking pool members past their staleness TTL.
- **On-demand matching**: API endpoint or Comeet webhook → shortlist → notification to the recruiter.
- Idempotent upserts keyed on resolved identity, so re-running an import is safe.
- Retries with dead-lettering; a failed enrichment must not lose the contact.

## At scale — hundreds of conferences, thousands of contacts

The shape doesn't change much. Three things do:

1. **Storage moves** from CSV-in-memory to a warehouse table with incremental transforms. The
   enrichment cache becomes the expensive asset and must be treated as one.
2. **Matching becomes two-phase**: an embedding index prefilters a few hundred plausible candidates
   per role, then the transparent scorer ranks those. Explainability is preserved where it matters;
   compute is spent only where it doesn't.
3. **Cost control moves to the front**: enrichment credits are the real budget line. **Enrich only
   pool admissions, not every badge scan** — another argument for running the relevance gate
   *before* enrichment rather than after.

Operational furniture worth naming: per-stage metrics (admission rate by conference, enrichment hit
rate, shortlist→contact conversion, contact→interview conversion), and an audit log of every score
with the config version that produced it — so "we changed the weights in March" is a traceable
statement.

## Multi-channel: one record, four doors

The talent pool should not be conference-only. Make `source_channel` a first-class field from the
first commit; the ingestion layer is pluggable, the scoring core is shared.

| Channel | What's different about it |
|---|---|
| **Inbound** (Comeet applications) | CV parsing gives skills and history directly, so enrichment is optional. These people have declared intent — worth more than any warmth score. A rejected applicant from last year resurfaces automatically when a better-fitting role opens. |
| **Referral** (employee-submitted) | Highest historic conversion of any channel. Capture the *relationship*, not just the name: how the referrer knows them, where and when they worked together, what they'd vouch for. That context is the referral's actual value. |
| **Conference** (badge scan) | Highest volume, lowest signal, needs the strongest gate. This is what the task covers. |
| **Sourced** (outbound research) | Recruiter-initiated. Record the researcher so the pool doesn't accumulate duplicate outreach. |

### Scope discipline for the submission

The task is scored on the conference flow. Three half-finished channels read worse than one complete
one plus a drawing. **Ship the conference path end-to-end, make `source_channel` first-class, write
one stub adapter to prove the seam is real, and put the rest here in the design doc.**

## The reverse-referral engine (the differentiating idea)

Referrals normally work as a **push**: an employee happens to remember someone and submits a name.
That depends entirely on recall, which is why most referral programmes produce a trickle.

Invert it into a **pull**. When a role opens, compute for every pool candidate the strongest
employee→candidate path — mutual connections, shared employers, same military unit, same university
lab, same department — and then message **the employee**, not the candidate:

> "Maya — we're hiring a Senior ML Engineer. Priya Anand overlapped with you at Mobileye (2019–21)
> and now leads computer vision at VidStream. She's a strong match on the role.
> Would you introduce us?"  →  *Yes / Not a fit / I don't really know them*

Why this is the right thing to demo:

- It turns the output from a list into a **next action** — which is what "with the context a
  recruiter needs to act" is asking for.
- It uses `work_history`, the column the brief never mentions, which shows we read the data rather
  than the field list.
- **It generates its own feedback loop.** Every "I don't really know them" is a labelled example
  that corrects the warmth model, and referral→hire conversion per employee becomes a real
  credibility weight over time.

Two guardrails to state alongside it: cap the referral boost so a warm path can never substitute for
competence, and monitor the demographic composition of referral-sourced hires — networks replicate
themselves, and an unmonitored referral engine narrows a team quietly.

## What I'd add with more time

- The reverse-referral outreach queue as a working feature, with employee responses feeding back.
- Embedding-based semantic matching as a secondary signal alongside the deterministic score.
- Comeet integration for the dedupe/rejection logic that is currently a stub.
- A feedback loop from recruiter outcomes: which shortlisted candidates actually replied, converted,
  got hired — used to re-weight the model rather than guessing at the weights.
- Fairness monitoring on shortlist composition, given how easily network-based signals encode bias.
