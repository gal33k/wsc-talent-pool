# Prompt for Claude Code

Paste this as the next message.

---

Scope has expanded — read `docs/08-web-app.md` and `docs/09-mock-integrations.md`, and re-read
`CLAUDE.md` and `docs/07-build-plan.md`, both of which I've updated. Summary of what changed:

**1. We're building a web app, not just a CLI.** Next.js + TypeScript + Tailwind in `web/`, static
export, running on localhost for now. Vercel comes later and must require no code changes. Screens:
shortlist with tier grouping, a live weight tuner, candidate detail, the 75-row pool audit view with
gate reasons, "who can introduce us" grouped by WSC employee, and an integrations log.

**2. Python owns all matching logic. The browser only does the weighted sum.** Export per-candidate
sub-score *components* (0–1, weight-independent) in `web/public/data/pool.json`. The UI recombines
them with whatever the sliders are set to. Never reimplement a scoring rule in TypeScript. Ship
Python's default-weight scores in the JSON and assert the browser reproduces them to 1dp.

**3. No LLM, no API keys, no live calls — everything is a mock adapter.** `src/integrations/` holds
one adapter per external system: badge scan, enrichment, HubSpot, Comeet, notifier, and a
"narrator" that renders `why_summary` and `outreach_draft` from deterministic templates. Each
adapter's docstring names its real counterpart and endpoint, and every call appends to a structured
log that the UI surfaces on the integrations screen. `mock_enrichment` should simulate a cache, a
configurable miss rate, and a credit counter, because those are what make the cost and edge-case
arguments concrete.

**4. Hard guarantee:** `python run.py --job-id JOB001` must run to completion on a fresh clone with
no environment variables, no network, and no credentials. Whoever grades this has to be able to run
it. Same for `cd web && npm i && npm run dev`.

**5. Every page carries a "Synthetic data — recruitment exercise. No real candidate data." banner
and a `noindex` meta tag.** The submission argues for GDPR Article 14 compliance; unlabelled
realistic candidate profiles would undercut it.

Build in the order in `docs/07-build-plan.md`. Stop at each checkpoint and show me the output before
continuing:

- **Checkpoint A** (after the gate): the gate decision for all 75 rows. I want to confirm Viktor
  Novak, Ingrid Svensson, Mei Zhang, Kim Soo-Jin and Javier Morales are all *admitted* despite zero
  mutual connections. If they aren't, the gate is leaking network signal into a competence decision.
- **Checkpoint B** (after scoring): the JOB001 ranking, compared against the indicative list in
  `docs/01-data-findings.md`. Jin Park should be flagged `above_band`, not ranked first. Sara
  Lindqvist should be visibly penalised for recommendation systems over vision.
- **Checkpoint C** (after the tuner): dragging `required_skills` to zero should collapse the ranking
  into network-driven order.

Start with Phase 0 and Phase 1 — `docs/flow.md`, then `config/scoring.yaml` and
`config/taxonomy.yaml`. Show me the taxonomy before you build anything on top of it; the role-family
patterns and the generic-employer stoplist are the two things most likely to be wrong, and
everything downstream depends on them.
