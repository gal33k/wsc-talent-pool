# WSC Sports — Talent Pool Pipeline

Take-home submission for the **AI Solution Manager** role.

**Live demo:** `https://web-phi-ivory-95.vercel.app`
**Repo:** `https://github.com/gal33k/wsc-talent-pool`

---

## The problem

Recruiters meet hundreds of strong people at conferences every year and lose almost all of them
within a week. Even the ones we capture arrive mixed in with vendor reps, IT managers and
adjacent-industry attendees who happened to be in the same room. Capturing is the easier half —
this project builds the second half: a queryable talent pool with the noise filtered out and,
when a role opens, a ranked shortlist that names the WSC employee best placed to make the
introduction.

## Quick start

```bash
pip install -r requirements.txt
python run.py --all-jobs --emit-json    # writes output/JOB001-004 + web/public/data/pool.json

cd web
npm install
npm run dev                              # http://localhost:3000
```

**Runs offline on a fresh clone.** No env vars, no network, no credentials. Every external
system is a mock adapter — swap surface documented in `docs/09-mock-integrations.md`.

Single-job usage:
```bash
python run.py --job-id JOB001            # → output/JOB001_shortlist.{csv,html}
python run.py --gate-audit               # dump gate decisions for all 75 rows
```

Tests:
```bash
for t in test_json_parity test_gate test_scoring test_missing_data; do python tests/$t.py; done
# 40 tests across 4 files, all pass
```

## Executive summary (for a non-technical Head of HR)

We built a system that turns conference badge scans, employee referrals, and inbound CVs into a
queryable talent pool. For each open role we produce a ranked shortlist scored on two things —
how well the person **fits** the job (competence) and how strong our **signal** on them is
(peer vouches, shared teams, culture fit, reachability). Every score has an evidence trail a
recruiter can defend; a human always has the final call. When a new role opens, we don't just
re-score — we also flag previously-rejected candidates whose skills would newly match. Clay is
the enrichment orchestrator; LinkedIn Sales Navigator handles recruiter search + outreach.

## Architecture — two decisions, never one function

The single most common failure mode is one big scoring function. This pipeline splits into two
separate decisions:

**Decision A — Pool admission** (job-agnostic, runs once at ingest).
Three independent signals decide if the person is talent in a domain we hire for:
1. **Role family** from title (pattern-matched against a taxonomy)
2. **Skills evidence** — do their skills confirm the claimed family?
3. **Sports/media proximity** — lexicon hits across industry and employers

**2-of-3 admits.** 1-of-3 holds for manual review. 0-of-3 rejects with a reason string a
recruiter could read to the person.

**Decision B — Job match** (per `job_id`, on demand).
Produces two independent scores per candidate:

- **`fit_score`** — competence only, never touches network
- **`signal_score`** — everything non-competence that predicts they'd convert AND fit

The scores are **never combined into one number.** A single "compatibility rate" would bury
strong candidates with no mutual connections — we have five of those in this dataset. Keeping
them separate makes the trade-off visible so the recruiter picks the right action.

Full stage-by-stage flow in [`docs/flow.md`](docs/flow.md).

## Scoring methodology

Every component is a weight-independent 0-1 sub-score. Weights apply in the final aggregation.
The browser recombines the same components live under whatever the tuner sliders show — the
Python and JS aggregations are asserted equal to 1dp in `tests/test_json_parity.py`.

### Fit (competence, weights sum to 100)

| Component | Weight | Formula |
|---|---:|---|
| Required skills | 35 | Coverage of required list. Exact match = 1.0, family alias = 0.6. `*`-marked skills are critical — missing any caps the component at 0.4. |
| Role family | 25 | Exact family = 1.0. Adjacent = **directional per-pair credit** (e.g. `ml_general → ml_cv = 0.7`, `data_engineering → ml_cv = 0.2`). |
| Seniority | 15 | Tier-based band fit. In-band = 1.0. Above-band = 0.6 + flag. Below-band = 0.5 + flag. Floor at 0.2. |
| Domain | 15 | Sports/media lexicon hits across industry, employers, skills. Diminishing-returns curve `[0, 0.5, 0.8, 1.0]`. |
| Nice-to-have | 10 | Coverage of the nice-to-have list. |

### Signal (reachability + endorsement + culture + engagement)

Renamed from "Warmth" — reachability alone was too narrow. Actual signal includes vouches,
team overlap, culture indicators.

| Component | Weight | What it captures |
|---|---:|---|
| Peer vouch | 35 | Active endorsement from a same-team WSC employee. Multiplied by role-match × tenure, normalized 0-1. |
| Same-team overlap | 18 | Shared employer with a same-team WSC person, WITHOUT an active vouch. |
| Cross-team vouch | 12 | Active endorsement from cross-department WSC employee. |
| Culture affinity | 12 | OSS in our stack + domain-topic engagement + past adjacent-conference attendance. Strict definition, no bias-prone proxies. |
| Prior WSC engagement | 8 | Followed WSC, engaged with our posts, past event history. |
| Recency | 7 | 12-month half-life on conference date. |
| Notes present | 5 | Recorded booth conversation. |
| Mutual connections | 3 | Bare LinkedIn mutual, no team overlap, no vouch. |

**Vouch multipliers** (applied to peer + cross-team vouch components):

| Multiplier | Value | Range |
|---|---:|---|
| Role match — same role family | ×3.0 | Same role family = biggest signal |
| Role match — same department | ×2.0 | |
| Role match — leadership (CTO/VP) | ×1.5 | Carries organizational weight regardless of dept |
| Role match — adjacent family | ×1.3 | |
| Role match — cross-department | ×1.0 | Baseline |
| Tenure — 3+ years | ×1.25 | Deep culture knowledge |
| Tenure — 1-3 years | ×1.00 | Baseline |
| Tenure — 6-12 months | ×0.85 | Forming judgment |
| Tenure — <6 months | ×0.60 | Knows candidate, not WSC's bar |

Max composite = 3.0 × 1.25 = **3.75**. Vouch scores are normalized by this so the component
fits 0-1 like every other sub-score. Multiple vouches sum, capped at 1.0.

### Tier assignment

| Tier | Rule | Meaning |
|---|---|---|
| **Call this week** | `fit ≥ 70 AND signal ≥ 20` | Strong fit + warm intro path — phone them |
| **Direct outreach** | `fit ≥ 70` | Strong fit but network is cold — evidence-based cold email |
| **Nurture** | `fit ≥ 45` | Below strong-fit line — worth keeping warm for future roles |

## Worked example — Priya Anand vs JOB001 (Senior ML Engineer)

**Given:** Sr Computer Vision Engineer at VidStream, 7y, skills `Python;OpenCV;YOLO;Real-time Processing;AWS;Deep Learning`, past Mobileye + Intel, 2 mutuals, note *"Spoke about real-time tracking."*

**Fit:**
- required_skills: Python ✓, Computer Vision ✓ (via opencv), Object Detection ✓ (via yolo), AWS ✓, PyTorch ✗ (Deep Learning is family, not exact for PyTorch) → 4/5 = **0.80**
- role_family: `ml_cv` = JOB001 target family → **1.00**
- seniority: Senior title, 7y, target Senior → in-band → **1.00**
- domain: 4+ lexicon hits (video, computer vision, Mobileye, Intel) → **1.00**
- nice_to_have: 1/3 → **0.33**

**Weighted fit** = (0.80×35 + 1.00×25 + 1.00×15 + 1.00×15 + 0.33×10) / 100 × 100 = **86.3**

**Signal** (with the seeded data, no active vouches yet — culture + notes + recency + mutuals):
- culture_affinity: 1.0 (video CV, Mobileye) → 12
- notes_present: 1.0 → 5
- mutual_connections: 0.8 (2 mutuals) → 2.4
- recency: ~0.30 (21mo, half-life 12mo) → 2.1
- rest: 0
**Total ≈ 21.5**

**Tier:** fit 86.3 ≥ 70 AND signal 21.5 ≥ 20 → **Call this week**

## The 7 assumptions we made

Full versions in [`docs/05-assumptions.md`](docs/05-assumptions.md) and rendered in the app at
`/methodology` → Assumptions section.

1. **Domain relevance** — 3 independent gate signals, 2-of-3 admits. Attendance is never
   evidence by itself.
2. **Missing LinkedIn** — keep the candidate; cap fit at 60; flag `data_confidence=low`. Never
   drop silently.
3. **Number of mutuals** — 0→0, 1→0.5, 2→0.8, 3+→1.0 diminishing returns. Lives on the Signal
   axis, never Fit.
4. **Already in Comeet** — differentiated by status: active-in-process suppresses,
   previously-rejected shows with flag, hired excludes, declined-offer shows with flag.
5. **Refresh cadence** — 3 schedules: event-driven ingest, ~6-month enrichment refresh,
   on-demand per-role matching.
6. **Who triggers** — both. Auto on ingest, manual on match, auto on Comeet job publish.
7. **GDPR** — legitimate interest with LIA, Article 14 notice in first outreach, data
   minimisation, 12-24mo TTL, EU residency, **Article 22** (no solely-automated decisions
   with legal effect — recruiter always decides).

## Repo layout

```
config/scoring.yaml       weights, thresholds, curves, tier cutoffs, vouch multipliers
config/taxonomy.yaml      role families, skill synonyms, domain lexicon, employer stoplist

src/ingest.py             load + normalise attendee rows, tag source_channel
src/resolve.py            identity resolution + dedupe
src/enrich.py             Clay join (mocked); missing profile is a state, not an error
src/normalize.py          title canonicalisation, skill expansion, seniority parsing
src/gate.py               Decision A — pool admission (2-of-3 signals + reason string)
src/score.py              Decision B — fit_score components
src/signal.py             Decision B — signal_score (renamed from warmpath.py in the refactor)
src/report.py             CSV writer + standalone HTML view + JSON emitter
src/integrations/         mock adapters — see docs/09

run.py                    python run.py --job-id JOB001 [--emit-json]
tests/                    40 tests: parity, gate, scoring, missing-data
data/                     4 supplied CSVs + comeet stub + edge-case fixtures
output/                   committed JOB001-004 shortlists (CSV + HTML) + excluded + pool.csv
web/                      Next.js app — see docs/08-web-app.md
docs/                     design docs (highest-scoring part of the submission)
```

## The web app — 10 recruiter-facing routes

The brief called for "a simple HTML or CLI summary" as bonus. We shipped a full app.

| Route | Purpose |
|---|---|
| `/` | Jobs-first landing. Grid of open roles with pipeline stats + top-3 per role. "Required demo · JOB001" highlighted. |
| `/jobs/[jobId]` | Ranked shortlist for a role. Weight tuner + sort + tier filter + search + Export CSV. "Reconsider rejects" panel surfaces gated-out candidates whose skills match this role. |
| `/pool` | All 75 contacts. Source/decision filters. Every row clickable → dossier. Plain-English gate reasons. |
| `/capture` | Conference lead capture. **Badge scan** (upload image OR try example) with mock OCR prefills the form → runs the live enrichment reveal → persists to session pool. |
| `/referrals` | Employee-referral capture. Vouched-lift applied to Signal on the target role. |
| `/intros` | Outreach queue. Every "Ask X to intro" from the shortlist lands here; track queued → sent → accepted/declined. |
| `/analytics` | KPIs, conversion funnel, BigQuery mock activity feed with real SQL. |
| `/integrations` | 9 systems each documented with **business value first** + technical trace below. |
| `/taxonomy` | **Claude-assisted rule editor.** Claude analyses the pool + proposes taxonomy changes (title patterns, skill synonyms, stopwords, family evidence). HR approves/edits/rejects. |
| `/methodology` | Single-scroll editorial doc: TL;DR → mechanism → assumptions → worked examples → technical deep-dive. |

## Session persistence

Session captures (via `/capture` or `/referrals`) persist across page refreshes via
`localStorage`. Same browser gets the same session state. For real multi-user cross-device
persistence, swap for Vercel KV or Postgres — the swap surface is one hook in
`web/lib/data.tsx::addSessionCandidate`.

## Design decisions defended in the app

- **`conference_domain` not used as a gate signal** — attendance is opportunity, not fit.
- **Filter state doesn't persist in the URL** — session-only. Prioritised elsewhere.
- **Same-team preference lives in intro-path selection, not the Signal score** — keeps Signal
  job-agnostic in the JSON contract.
- **Mock narrator uses templates, not a live LLM** — brief forbids live keys. Prompt-shaped
  evidence dict is still built and logged, so the swap surface is visible.

## What we'd build next

Full list in `/methodology` §12. Top three:

1. **Shareable filter URLs** — sync active job/filters/tuner into query params
2. **"Employee replied yes/no" tracking** — closes the labelled-data feedback loop
3. **Vector-search prefilter at scale** — for hundreds of conferences × thousands of contacts

## Constraints held

- No real personal data · no real API keys · no live LinkedIn/HubSpot/Comeet calls
- Every external system is a mock adapter with a documented real counterpart
- Python 3.11+, stdlib `csv` only (no pandas), single third-party dep is `PyYAML`
- Runs to completion on a fresh clone offline with no env vars

## Definition of done

- [x] `python run.py --job-id JOB001` runs clean, offline, no env vars
- [x] `output/JOB001_shortlist.csv` + `.html` committed
- [x] All 7 assumptions answered (docs + app)
- [x] Design doc section (README + `/methodology`)
- [x] Executive summary for non-technical HR (above)
- [x] Tests pass (40 tests, 4 files); edge-case fixture demonstrates missing-data handling
- [x] No candidate names, no API keys, no live calls
- [x] `npm run dev` in `web/` serves the app against the emitted JSON
- [x] Browser-computed default scores match Python to 1dp (asserted in tests)
- [x] Synthetic-data banner present on every page

Co-Authored-By: Claude Opus 4.7 &lt;noreply@anthropic.com&gt;
