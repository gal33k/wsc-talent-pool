# 07 — Build plan

Ordered so the highest-scoring artefacts survive if time runs short. **The pipeline and the docs are
graded; the web app is the bonus.** Do not let the app eat the README.

---

## Phase 0 — before any code  ← the brief explicitly asks for this

- [ ] `docs/flow.md` — pipeline diagram + schema at each stage (ASCII or Mermaid)
- [ ] Lock the output schema from `docs/04-output-spec.md` and the JSON contract from `docs/08`
- [ ] Draft the assumptions into `README.md` from `docs/05-assumptions.md`

## Phase 1 — config and taxonomy

- [ ] `config/scoring.yaml` — weights, bands, curves, tier cutoffs (skeleton in `docs/03`)
- [ ] `config/taxonomy.yaml`:
  - [ ] role families with title patterns, including the `not_talent` bucket
  - [ ] skill synonym map — decide and document: is TensorFlow ≈ PyTorch within a DL family?
  - [ ] sports/media/broadcast domain lexicon
  - [ ] **generic-employer stoplist** (`startup`, `freelance`, `university`, `public sector`, …).
        Without it, warm-path matching produces ~40 false positives.

## Phase 2 — mock integrations

- [ ] `src/integrations/base.py` — the Protocol each adapter implements
- [ ] `src/integrations/call_log.py` — structured log, exportable to JSON for the UI
- [ ] `mock_badge_scan.py`, `mock_enrichment.py` (cache + miss rate + credit counter),
      `mock_hubspot.py`, `mock_comeet.py`, `mock_notifier.py`, `mock_narrator.py`
- [ ] `data/comeet_status_stub.csv` — one active, one previously-rejected-other-role, one hired
- [ ] Every adapter docstring names its real counterpart and endpoint. See `docs/09`.

## Phase 3 — Decision A: build the pool

- [ ] `src/ingest.py`, `src/resolve.py`, `src/enrich.py`, `src/normalize.py`
- [ ] `src/gate.py` — 3 signals, 2-of-3 admits, every decision carries a reason string
- [ ] **CHECKPOINT A:** dump gate decisions for all 75 rows and read them.
      Are Viktor Novak, Ingrid Svensson, Mei Zhang, Kim Soo-Jin and Javier Morales all **admitted**
      despite zero mutual connections? If not, the gate is leaking network signal — fix it before
      going further.
- [ ] Write `output/talent_pool.csv`

## Phase 4 — Decision B: match a job

- [ ] `src/score.py` — five fit components as 0–1 values, weights applied last
- [ ] `src/signal.py` — 8-component signal axis (peer vouch + team overlap + culture affinity + reachability) → named people,
      diminishing-returns curve, recency decay, `best_intro_path`
- [ ] `src/report.py` — CSV writer, standalone HTML, and the `pool.json` emitter
- [ ] `run.py` — `python run.py --job-id JOB001 [--emit-json]`
- [ ] **CHECKPOINT B:** run JOB001 against the indicative ranking in `docs/01`.
      Verify Jin Park is flagged `above_band` rather than ranked #1, and Sara Lindqvist is visibly
      penalised for recommendation systems over vision.
- [ ] Commit `output/JOB001_shortlist.csv`, `.html`, `output/JOB001_excluded.csv`

## Phase 5 — tests and edge cases

- [ ] `data/test_edge_cases.csv` — no LinkedIn URL, URL with no profile, empty skills, duplicate
      person across two conferences, blank title
- [ ] `tests/test_scoring.py` — component maths, connection curve, band fit above/below/inside
- [ ] `tests/test_gate.py` — a known noise row rejects, a strong row admits, a 1-of-3 holds
- [ ] `tests/test_missing_data.py` — confidence ceiling applies, nothing crashes
- [ ] `tests/test_json_parity.py` — recomputing from `components` × default weights reproduces
      `score_default` to 1dp

## Phase 6 — the web app (localhost)

- [ ] `npx create-next-app@latest web --typescript --tailwind --app`
- [ ] Load `public/data/pool.json`; typed models mirroring the contract in `docs/08`
- [ ] **Scoring hook** — `useScores(weights)` recombines components; assert parity with
      `score_default` on mount in dev
- [ ] Screen 1: shortlist with tier grouping, job selector, candidate cards
- [ ] Screen 2: weight tuner panel with live re-rank + reset + "what moved"
- [ ] Screen 3: candidate detail with full breakdown bars and the outreach draft
- [ ] Screen 4: talent pool audit view — all 75, gate decision, 3 signals, reason
- [ ] Screen 5: "who can introduce us", grouped by WSC employee
- [ ] Screen 6: integrations log
- [ ] Synthetic-data banner + `noindex` meta on every page
- [ ] **CHECKPOINT C:** drag a slider to zero on `required_skills` and confirm the ranking collapses
      to network-driven order. That is the demo that proves the model is not a black box.

## Phase 7 — the writing (do not let this get squeezed)

- [ ] `README.md`:
  - [ ] one-paragraph problem statement (signal-to-noise framing, not the technical task)
  - [ ] setup + run instructions for both the pipeline and the app
  - [ ] **all seven assumptions** with positions
  - [ ] design doc section: approach, real integrations, at scale, what's next
  - [ ] **one worked scoring example computed by hand**
  - [ ] the "runs offline with no credentials" guarantee, stated explicitly
  - [ ] known limitations
  - [ ] executive summary paragraph for a non-technical Head of HR
- [ ] Final pass: fresh-clone test. Does `python run.py --job-id JOB001` then `cd web && npm i &&
      npm run dev` work with only the README to go on?

## Phase 8 — Vercel (later, separate session)

- [ ] `output: 'export'` in `next.config.js`, verify the static build
- [ ] Deploy, point the subdomain, confirm `noindex` and the banner survived the build

---

## Suggested split

| | |
|---|---|
| **Day 1 AM** | Phases 0–1 |
| **Day 1 PM** | Phases 2–3, through Checkpoint A |
| **Day 2 AM** | Phase 4 through Checkpoint B, then Phase 5 |
| **Day 2 PM** | Phase 6 |
| **Day 3 AM** | Phase 7 — the writing |

If time runs out, **cut app screens 5 and 6 before cutting any part of Phase 7.**

## Traps to avoid

- **Over-engineering** — no Kubernetes, no vector DB, no embeddings, for 75 rows.
- **Overfitting** — any candidate name hardcoded anywhere is fatal.
- **A single opaque compatibility percentage** — the rubric asks for the opposite.
- **Reimplementing scoring in TypeScript** — the browser does the weighted sum and nothing else.
- **The app eating the docs** — six of seven graded rows are writing and thinking.
- **The quiet one**: a beautiful ranked list that never tells the recruiter what to do next.

## Questions worth asking the recruiter (Shir)

1. Does the pool belong in HubSpot or Comeet? Which is the record of truth changes the write-back.
2. Is there Comeet history to dedupe against, and can the pipeline read candidate status?
3. Is location or work authorisation a hard filter? The dataset is heavily European.
4. Who owns outreach after the shortlist — a recruiter sending, or the system drafting a queue?
5. Which enrichment vendors are already approved by legal?
