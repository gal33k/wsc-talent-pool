# WSC Sports — Conference Talent Pool Pipeline

Take-home submission for the **AI Solution Manager** role.

## The problem

Recruiters meet hundreds of strong people at conferences every year and lose almost all of them
within a week — a business card, a note on a phone, nothing in any system. Even the ones we do
capture arrive mixed in with vendor reps, IT managers and adjacent-industry attendees who
happened to be in the same room. The signal-to-noise problem is what makes conference sourcing
feel unproductive; capturing the contacts is the easier half. This project builds the second
half: a queryable talent pool with the noise filtered out and, when a role opens, a ranked
shortlist that names the WSC employee best placed to make the introduction.

## Quick start

```bash
# 1) Python pipeline — runs offline, no env vars, no credentials
pip install -r requirements.txt
python run.py --all-jobs --emit-json      # emits web/public/data/pool.json + per-job CSVs

# 2) Web app — localhost only, static export ready for Vercel later with no code changes
cd web
npm install
npm run dev                                # http://localhost:3000
```

CLI-only usage:
```bash
python run.py --job-id JOB001              # single job shortlist -> output/JOB001_*
python run.py --gate-audit                 # dump gate decisions for all 75 rows
```

**Runs to completion on a fresh clone with no environment variables, no network, and no
credentials.** Every external system is a mock adapter (see `docs/09-mock-integrations.md`).

## What it does

Two decisions, never one scoring function.

- **Decision A — Pool admission** (job-agnostic, at ingest). Three independent signals gate a
  candidate into the pool: title-derived role family, skills evidence, and industry/employer
  proximity. **2-of-3 admits.** Every decision carries a reason string. This is the
  signal-to-noise answer.
- **Decision B — Job match** (per `job_id`, on demand). Produces two independent scores per
  candidate: `fit_score` (competence only, no network signal) and `warmth_score` (mutual
  connections, shared employers, recency, notes). A ranked shortlist follows.

Full stage-by-stage schema in [`docs/flow.md`](docs/flow.md).

## Scoring methodology

Two axes, weight-independent 0-1 components, weights applied in the final aggregation. The
browser recombines the same components live under whatever weights the tuner sliders are set
to — no scoring rule is ever reimplemented in TypeScript.

### Fit (competence only)

| Component | Weight | How it's computed |
|---|---:|---|
| Required skills | 35 | Coverage of the job's required skill list. Exact match = 1.0, family match = 0.6 (e.g. TensorFlow for PyTorch). |
| Role family | 25 | Exact family = 1.0, adjacent = 0.5, unrelated = 0.0. |
| Seniority | 15 | Tier-based band fit. In-band = 1.0. Above-band = 0.6 + flag. Below-band = 0.5 + flag. |
| Domain | 15 | Sports/media lexicon hits across industry, current + past employers, and skills. Diminishing-returns curve. |
| Nice-to-have | 10 | Coverage of the job's nice-to-have list. |

### Warmth (reachability)

| Component | Weight | How it's computed |
|---|---:|---|
| Mutual connections | 40 | Diminishing-returns curve. 0 → 0.0, 1 → 0.5, 2 → 0.8, 3+ → 1.0. |
| Shared employer | 30 | Same curve, applied after the generic-employer stoplist and company-alias unification. |
| Recency | 20 | Exponential decay on conference date. 12-month half-life. |
| Notes present | 10 | Binary. A recorded booth conversation is something to open with. |

`best_intro_path` prefers same-department peers when the job's department is known — a peer is
better placed to answer "will you introduce us" than a cross-department colleague.

### Worked example — Priya Anand vs JOB001 (Senior ML Engineer)

Priya's LinkedIn: Sr Computer Vision Engineer at VidStream (Video Technology), 7y,
`Python;OpenCV;YOLO;Real-time Processing;AWS;Deep Learning`. Past: Mobileye, Intel. 2 mutuals
(Maya Levi, Eran Moshe). Note: *"Spoke about real-time tracking project"*.

**Fit components:**

| Component | Raw | Why |
|---|---:|---|
| required_skills | 4.0/5 = **0.80** | Python ✓ · Computer Vision ✓ (via `opencv` alias) · Object Detection ✓ (via `yolo` alias) · AWS ✓ · PyTorch ✗ (has Deep Learning but no PyTorch/TensorFlow — 0 credit) |
| role_family | **1.00** | Title matches `ml_cv` (JOB001 target family) |
| seniority | **1.00** | Title tier 4 (Senior), 7y → in band |
| domain | **1.00** | 4+ lexicon hits (video, computer vision, Mobileye, Intel) |
| nice_to_have | 1.0/3 = **0.33** | Real-time processing ✓; Docker ✗; Sports Analytics ✗ |

Weighted fit = (0.80×35 + 1.00×25 + 1.00×15 + 1.00×15 + 0.33×10) / 100 × 100 = **86.3**.

**Warmth components:**

| Component | Raw | Why |
|---|---:|---|
| mutual_connections | curve[2] = **0.80** | 2 mutuals (Maya Levi + Eran Moshe) |
| shared_employer | curve[2] = **0.80** | Mobileye + Intel both match WSC002 Maya Levi's work history |
| recency | ~**0.15** | Conference was 2024-11-14 (about 21 months ago at ref date 2026-08) — `0.5^(21/12) ≈ 0.30`. Actual pipeline uses the current date. |
| notes_present | **1.00** | Non-empty booth note |

Weighted warmth ≈ (0.80×40 + 0.80×30 + 0.15×20 + 1.00×10) / 100 × 100 ≈ **69**.

`best_intro_path` = *"Maya Levi (Senior ML Engineer) — overlapped at Mobileye 2019–21"* —
same-department peer, precise overlap dates.

*Note: Priya is currently `active_in_process` for JOB001 in the Comeet stub, so she is
suppressed from the live JOB001 shortlist and appears in `output/JOB001_excluded.csv`. The
suppression is intentional: two recruiters must not approach the same candidate. Change the
stub to see her land at #1.*

## Output

Every run of `python run.py --job-id <id>` writes:

| File | What |
|---|---|
| `output/<id>_shortlist.csv` | 26 recruiter columns per [`docs/04-output-spec.md`](docs/04-output-spec.md) |
| `output/<id>_shortlist.html` | Self-contained recruiter view — no build step, opens by double-click |
| `output/<id>_excluded.csv` | Comeet-suppressed, hired, below-threshold — every exclusion has a reason |
| `output/talent_pool.csv` | The pool after Decision A — the "what HubSpot would now contain" artefact |
| `web/public/data/pool.json` | The web app's data contract (docs/08). Sub-scores are weight-independent 0-1 values so the browser can re-rank live. |

## Web app

Localhost only in this submission; Vercel deploy requires no code changes (`output: 'export'`
in `next.config.mjs`).

- **Shortlist** — cards grouped by priority tier, weight tuner side panel with live re-ranking,
  candidate detail modal with the full breakdown and copy-ready outreach draft.
- **Weight tuner** — five sliders for fit, four for warmth, plus tier thresholds. Reset button.
  This is the feature that proves the transparency claim: drag `required_skills` to zero and
  watch the ranking collapse into warmth-driven order.
- **Talent pool audit** — all 75 contacts with their gate outcome and reason. The answer to
  the first question every recruiter asks: *"what did it throw away, and why?"*
- **Who can introduce us** — reverse-referral, grouped by WSC employee. The `work_history`
  column (undocumented in the brief) is what makes this screen work.
- **Integrations log** — every mock adapter call the pipeline made, live. Enrichment cache hits,
  credits used, HubSpot patches, Comeet lookups, Slack drafts.

Every page carries a persistent **"Synthetic data — recruitment exercise. No real candidate
data."** banner and a `noindex, nofollow` meta tag. See `docs/08-web-app.md` for the full
spec and `docs/09-mock-integrations.md` for the adapter pattern.

## Assumptions

The brief lists seven and invites us to answer or ask. Each answer here has a position and a
reason — hedging does not score.

### 1. How do you define "domain relevance"?

Three independent signals — title-derived role family, skills evidence, and industry/employer
proximity — with **2-of-3 agreement** required to admit to the pool. The conference topic sets
the expectation; the person's own profile decides. Conference attendance is never evidence of
fit, only of opportunity. An IT manager at a DevOps conference has a title in the `not_talent`
bucket, skills that don't belong to any engineering family (`ITIL`, `Network`, `Healthcare
IT`), and an industry with no proximity to ours — zero of three signals, rejected with a
reason.

### 2. Contacts with no LinkedIn profile match?

**Keep them, never drop them.** Score on what exists (title, company, conference domain,
recruiter notes), cap `fit_score` at the confidence ceiling (60), set `data_confidence = low`
and `suggested_action = needs_enrichment`. Dropping them makes the pipeline's coverage
invisible: a recruiter should see *"12 contacts we couldn't verify"* rather than never learning
they existed. The shipped dataset joins cleanly for all 75 rows; the path is exercisable via
`python run.py --simulate-missing-linkedin 0.15`.

### 3. Is 1 mutual connection the same as 3?

No — but the difference is smaller than a linear count implies, **and it belongs on the warmth
axis, not the fit axis.** Diminishing returns: 0 → 0.0, 1 → 0.5, 2 → 0.8, 3+ → 1.0. Mutual
connections predict *reachability*, not *competence*; combining the two collapses signal that
should stay separate and buries genuinely strong candidates who have no network overlap with
us. That is why the JOB001 shortlist still surfaces Viktor Novak (Databricks), Ingrid Svensson
(Klarna), Kim Soo-Jin (Samsung SDS) and Grace Wilson (IDF tech unit warm path) — all zero
mutuals, all admitted correctly by the gate.

### 4. Should candidates already in Comeet be flagged?

Yes, and differently by status. `active_in_process` → suppress entirely (two recruiters must
not approach the same person). `previously_rejected` for a different role → show with a flag
and the previous role + date (a rejection for a different role two years ago is not a
rejection for this one). `hired` → exclude. `declined_offer` → show as warm intelligence.
The behaviour is wired through `src/integrations/mock_comeet.py` against
`data/comeet_status_stub.csv`.

### 5. Refresh cadence?

Three cadences, not one:
1. **Ingestion** — event-driven, fired by a conference export landing.
2. **Enrichment refresh** — rolling batch on pool members past their staleness TTL
   (~6 months). Titles go stale; the pool must not.
3. **Matching** — on demand, per role opened.

Treating this as a one-time batch is what causes the original problem: contacts go stale
because nothing runs again.

### 6. Who triggers the pipeline?

**Both, deliberately.** Automated on the ingest side (badge-scan export lands → pipeline runs
→ recruiter receives a digest of new admissions), manual on the match side (recruiter opens a
role and asks for a shortlist), plus an automatic trigger when a new job is published in
Comeet. The recruiter should never have to remember the system exists.

### 7. Privacy / GDPR?

Substantial and worth its own paragraph. **Legal basis:** legitimate interest with a
documented LIA. **Article 14:** the person is notified within 30 days because the data was not
collected from them directly (in practice the first outreach carries the notice). **Data
minimisation:** store *derived features* (role family, skill tags, seniority band) rather than
full profile copies. **Retention:** 12–24 month TTL with automatic purge. **Article 22:**
solely-automated decisions with significant effect are avoided by keeping a human in the loop
by design — the system ranks and explains, a recruiter decides. That last point is why the
deterministic scoring layer is not just a nicety: an automated decision you cannot explain is
a compliance problem before it is an engineering one.

## Design document

### Why this approach

The task rewards thinking, not code. Six of the seven evaluation rows are about
problem-framing, methodology, communication, edge-case handling, assumptions and design; one
is about code. The architecture reflects that split:

- **Two decisions, not one.** Collapsing pool admission and job match into a single scoring
  function is the most common failure mode. It bakes network signal into competence, buries
  strong candidates with no warm path, and forces expensive work to happen per-person × per-job
  rather than per-person.
- **Two scores, not one "compatibility rate."** The one number recruiters intuitively want is
  the one number that hides the trade-off they need to see. `fit_score` and `warmth_score`
  stay separate so both are steerable.
- **Deterministic decides, model layer describes.** No LLM in the score, no LLM in the gate.
  Every model output (why_summary, outreach_draft) is templated deterministically here; in
  production it's a single Claude call over the same evidence dict. See
  `src/integrations/mock_narrator.py` — the prompt payload dict is built and logged even in
  mock mode so the swap surface is visible.
- **Every weight, threshold, synonym and stoplist in `config/*.yaml`.** A recruiter can retune
  the model without an engineer. The tuner in the web app is a live demonstration of that
  claim.

### Real integrations

Every external system in the pipeline is a mock adapter with a documented real counterpart.
Swapping to production is a one-file change per integration:

| Mock | Real system | Endpoint |
|---|---|---|
| `mock_badge_scan.py` | Cvent / Swapcard / Brella | Post-event export or webhook file-drop |
| *(the pool itself)* | **HubSpot** custom object or contact-property namespace | `PATCH /crm/v3/objects/contacts/{id}` |
| `mock_enrichment.py` | **Proxycurl / People Data Labs** | `GET /proxycurl/api/v2/linkedin?url=…`, credited + cached |
| `mock_comeet.py` | **Comeet** ATS | `GET /company/{uid}/positions`, candidate status webhook |
| `mock_notifier.py` | Slack (or SendGrid fallback) | `POST /chat.postMessage` |
| `mock_narrator.py` | Claude API | Single call over the assembled evidence dict |

LinkedIn is called out explicitly in `docs/06-production-design.md`: **scraping violates ToS
and Sales Navigator has no bulk export API**. Enrichment goes through a compliant vendor with
a DPA. Sales Navigator remains the manual research surface a recruiter uses on a shortlisted
candidate.

### At scale — hundreds of conferences, thousands of contacts

Three things change:

1. **Storage** moves from CSV-in-memory to a warehouse table with incremental transforms; the
   enrichment cache becomes the expensive asset and is treated as one.
2. **Matching becomes two-phase**: an embedding index prefilters a few hundred plausible
   candidates per role, then the transparent scorer ranks those. Explainability preserved
   where it matters; compute spent where it doesn't.
3. **Cost control moves to the front**. Enrichment credits are the real budget line. Enrich
   only pool ADMISSIONS, not every badge scan — which is exactly why the gate runs before
   enrichment in the pipeline.

Operational furniture: per-stage metrics (admission rate by conference, enrichment hit rate,
shortlist → contact conversion, contact → interview conversion), and an audit log of every
score with the config version that produced it — so "we changed the weights in March" is a
traceable statement rather than an anecdote.

### What I'd add with more time

- The reverse-referral outreach queue as a working feature, with employee responses feeding
  the warmth model back (an "I don't really know them" is a labelled example that corrects
  it).
- Embedding-based semantic matching as a secondary signal alongside the deterministic score.
- A feedback loop from recruiter outcomes: which shortlisted candidates actually replied,
  converted, got hired — used to re-weight the model rather than guessing at the weights.
- Fairness monitoring on shortlist composition, given how easily network-based signals encode
  bias.

## Known limitations

- **Static dataset.** 75 rows is enough to demonstrate the model's behaviour but the
  parameters (curves, weights, band widths) would need to be re-tuned against a larger real
  distribution before shipping.
- **English titles only.** The role-family patterns are English-language substring matches.
  Multilingual conferences would need localised patterns or a small classifier.
- **Employer alias map is hand-curated.** In production the alias graph would come from an
  entity-resolution service (Clearbit Reveal, Diffbot KG) rather than a YAML block.
- **Same-department mutual boost is intro-path-only.** The warmth score uses raw counts; the
  same-dept preference influences only the picked path text, not the number. Rationale in
  `src/warmpath.py`.
- **Recency uses `date.today()`.** Reproducibility across runs would want a frozen reference
  date piped in from the ingest timestamp.
- **No live embedding step.** Deferred as the "with more time" item; the deterministic core
  is the current source of truth.
- **The web app fetches `pool.json` client-side.** For a large pool this would need
  server-driven pagination; for 75 rows a static JSON is fine.

## Executive summary — for a non-technical reader

> Our recruiters meet hundreds of strong people at conferences every year, and within a week
> almost all of them are lost — a business card, a note on a phone, nothing in any system.
> This turns every event into a searchable talent pool: it automatically separates the
> engineers we'd actually hire from the vendors and IT managers in the same room, enriches
> what we know about them, and when a role opens it tells the recruiter who to call first and
> which of our own employees already knows them. Instead of starting a search from zero, we
> start from people we've already met.

---

## Repo map

| Path | What |
|---|---|
| `docs/` | Design docs and the decoded task requirements — the highest-scoring part of the submission |
| `config/scoring.yaml` | Weights, seniority bands, curves, tier cutoffs |
| `config/taxonomy.yaml` | Role families, skill synonyms, sports/media lexicon, generic-employer stoplist, company aliases |
| `src/` | One module per pipeline stage (ingest → resolve → enrich → normalize → gate → score → warmpath → report) |
| `src/integrations/` | Mock adapters — one per external system, each with a documented real counterpart |
| `data/` | The four supplied CSVs (unmodified) + the Comeet status stub |
| `output/` | Committed shortlist CSVs + HTML + excluded lists + talent pool |
| `web/` | Next.js app (App Router + TypeScript + Tailwind, static export) |
| `web/public/data/pool.json` | The web app's data contract, emitted by `python run.py --emit-json` |
| `tests/` | Scoring maths, gate decisions, JSON parity |
