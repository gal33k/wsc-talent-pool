# CLAUDE.md — WSC Sports Talent Pool Pipeline

Context file for Claude Code. Read this first, then `docs/07-build-plan.md`.

## What this repo is

A submission for the **WSC Sports "AI Solution Manager" take-home task**. We are building a
pipeline that turns raw conference badge-scan data into a queryable talent pool, and produces a
ranked, actionable shortlist for a given `job_id`.

The original task brief is at `docs/original-task-brief.html` (open in a browser) and summarised
in `docs/00-task-requirements.md`.

## The one-paragraph version

Recruiters meet strong people at conferences and lose them within a week. We ingest the badge-scan
export, separate real engineering talent from the IT managers / vendor reps / adjacent-industry
noise in the same room, enrich each person with LinkedIn data, and — when a role opens — surface a
ranked shortlist that tells the recruiter **who to call and which WSC employee already knows them**.

## Non-negotiables (these are the graded parts)

1. **Two separate decisions, never one scoring function.**
   - *Decision A — pool admission*: job-agnostic, runs at ingest, answers "is this person talent in
     a domain we hire in?"
   - *Decision B — job match*: job-specific, runs on demand against the clean pool.
2. **Two output scores, not one "compatibility rate".**
   - `fit_score` = competence only. **No network signal in this number, ever.**
   - `signal_score` (dict key still `warmth_score` for pipeline API stability) = endorsements + team overlap + reachability. 8 components — peer_vouch, same_team_overlap, cross_team_vouch, culture_affinity, prior_wsc_engagement, recency, notes_present, mutual_connections.
   - Combining them buries strong candidates who happen to have no mutual connections. See
     `docs/01-data-findings.md` § "The mutual-connections trap".
3. **Transparent scoring.** Every weight, threshold, synonym and stoplist lives in `config/*.yaml`.
   Every scored candidate carries a sub-score breakdown in the output. No black boxes — this is
   literally a row on their evaluation table.
4. **No LLM decides anything.** Deterministic layer decides; a model layer may only normalise and
   describe. See `docs/02-architecture.md` § "Where AI belongs".
5. **Every exclusion carries a reason string.** Rejected-from-pool and failed-hard-requirement rows
   must be retrievable with the reason attached.
6. **No hardcoded candidate names anywhere.** Overfitting to the 75-row sample is fatal.
7. **No live API calls, no real keys, no scraping, no LLM at runtime.** Every external system is a
   mock adapter that logs the call it would have made. See `docs/09-mock-integrations.md`.
8. **`python run.py --job-id JOB001` must run on a fresh clone with no env vars, no network and no
   credentials.** Whoever grades this has to be able to run it.
9. **Python owns all matching logic; the browser only does the weighted sum.** Sub-score components
   are weight-independent and are exported in the JSON. Never reimplement scoring rules in
   TypeScript — that is the drift risk the whole design is built to avoid.

## Repo layout

```
config/scoring.yaml       weights, thresholds, decay half-life, tier cutoffs
config/taxonomy.yaml      role families, skill synonyms, domain lexicon, employer stoplist

src/ingest.py             load + normalise attendee rows, tag source_channel
src/resolve.py            identity resolution + dedupe
src/enrich.py             LinkedIn join; missing profile is a state, not an error
src/normalize.py          title canonicalisation, skill expansion, seniority parsing
src/gate.py               Decision A — domain relevance + pool admission, with reasons
src/score.py              Decision B — fit_score components
src/signal.py             Decision B — 8-component Signal axis + intro paths (renamed from warmpath.py)
src/report.py             CSV writer + standalone HTML view + JSON emitter
src/integrations/         mock adapters — see docs/09-mock-integrations.md

run.py                    entry point: python run.py --job-id JOB001 [--emit-json]
tests/                    scoring maths, gate decisions, missing-data, JSON/browser parity
data/                     the four supplied CSVs (do not edit) + fixtures + stubs
output/                   committed JOB001 shortlist (CSV + HTML) + excluded + pool
web/                      Next.js app — see docs/08-web-app.md
web/public/data/pool.json the app's data contract, emitted by the pipeline
docs/                     design docs — the highest-scoring part of the submission
```

## Conventions

- Python 3.11+. **Stdlib `csv` only — do not use pandas.** 75 rows do not need a dataframe, and
  dropping it removes the only dependency likely to fail to build on a new Python. The single
  third-party dependency is `PyYAML`, for the config files.
- Web: Next.js (App Router) + TypeScript + Tailwind, static export. `npm run dev` for localhost.
  No database, no auth, no API routes in v1. Vercel comes later and requires no code changes.
- Pure functions where possible; each `src/` module does one thing and is independently testable.
- Type hints on public functions. Docstrings that say *why*, not *what*.
- Entry point is `python run.py --job-id JOB001`. Flags obvious, defaults sensible.
- Scores are floats 0–100, rounded to 1dp in output.
- Never mutate the files in `data/`.

## Data quick reference

| File | Rows | Notes |
|---|---|---|
| `conference_attendees.csv` | 75 | 4 conferences, Nov 2024 – Apr 2025. Has an undocumented `conference_domain` column. |
| `linkedin_profiles.csv` | 75 | Has an undocumented `past_titles` column. All 75 join cleanly. |
| `wsc_employees.csv` | 15 | Has an undocumented `work_history` column — this is the key to warm paths. |
| `job_openings.csv` | 4 | JOB001 Senior ML Engineer is the required demo. |

Read `docs/01-data-findings.md` before writing gate or scoring logic. The dataset is hand-built and
contains deliberate test cases.

## Definition of done

- [ ] `python run.py --job-id JOB001` runs clean from a fresh clone, offline, with no env vars
- [ ] `output/JOB001_shortlist.csv` and `.html` committed
- [ ] All 7 assumptions answered in README (see `docs/05-assumptions.md`)
- [ ] Design doc section in README (see `docs/06-production-design.md`)
- [ ] Executive summary paragraph for a non-technical Head of HR
- [ ] Tests pass; edge-case fixture demonstrates missing-data handling
- [ ] No candidate names, no API keys, no live calls in the code
- [ ] `npm run dev` in `web/` serves the app against the emitted JSON
- [ ] Browser-computed default scores match the Python scores to 1dp (asserted in a test)
- [ ] Synthetic-data banner present on every page
