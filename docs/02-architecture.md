# 02 — Architecture

## The core insight: two decisions, not one

The most common way to lose this task is to build one big scoring function. There are two separate
decisions, with different inputs, different timing, and different owners.

### Decision A — Pool admission
**"Is this person talent at all, in a domain we hire in?"**
Job-agnostic. Runs once at ingestion, right after a conference export lands. This is the answer to
the signal-to-noise problem the brief spends three paragraphs on.
Output: a `domain_relevance` band and a `role_family` label written back to the contact record.

### Decision B — Job match
**"Given JOB001, who should the recruiter call this week?"**
Job-specific. Runs on demand. Scores only pool members.
Output: a ranked shortlist with per-candidate evidence and a route to the person.

**Why the split matters** (say this in the README):
- the noise filter is explainable on its own terms, independent of any job
- a new role costs one cheap pass over a clean pool, not a full re-enrichment
- expensive work (enrichment, classification, embeddings) happens once *per person*, not once per
  person *per job* — which is the whole answer to the "at scale" question in the design doc

## Pipeline — 8 stages

Stages 1–5 are Decision A (per ingestion). Stages 6–8 are Decision B (per `job_id`).

```
                    ── DECISION A: build the pool (job-agnostic) ──

 [1] INGEST         attendee CSV -> normalised rows, source_channel tagged
       |
 [2] RESOLVE        identity resolution: linkedin_url > email > name+company
       |            dedupe people seen at two conferences
       |
 [3] ENRICH         left-join LinkedIn profile
       |            missing profile = a STATE (enrichment_status), not an error
       |
 [4] NORMALISE      canonical titles, skill synonym expansion, seniority parse,
       |            employer tokenisation against the stoplist
       |
 [5] GATE  ✋       role_family + domain_relevance -> ADMIT / HOLD / REJECT
       |            every decision carries a reason string
       |
       v
   TALENT POOL  (persisted; in production this is HubSpot)
       |
                    ── DECISION B: match a job (per job_id) ──
       |
 [6] MATCH          fit_score vs required skills, nice-to-have, seniority band, key domains
       |
 [7] ROUTE          signal_score + best_intro_path
       |            mutual connections + shared-employer overlap -> named people
       |
 [8] DELIVER        rank, tier, evidence strings -> CSV + HTML recruiter view
```

## Stage 5 — the relevance gate (the heart of the task)

The brief's central question: *how do you tell a real DevOps engineer from an IT manager at the same
conference?* Use three **independent** signals and require agreement, so no single noisy field
decides:

1. **Role family from title** — a rules table in `config/taxonomy.yaml` mapping title patterns to
   families: `ml_cv`, `data`, `backend`, `platform_devops`, `video_broadcast`, `product`, and a
   `not_talent` bucket (IT support, IT manager, network admin, sales, marketing, procurement).
2. **Skills evidence** — do the listed skills actually belong to that family?
   `IT Management; ITIL; Network; Healthcare IT` does not survive contact with `platform_devops`.
3. **Industry & employer proximity** — `industry` plus current/past employers against a
   sports/media/streaming lexicon, and against the row's own `conference_domain`.

**Decision rule:** 2 of 3 agree → `ADMIT`. 1 of 3 → `HOLD` (review queue). 0 of 3 → `REJECT`.

Recording *why* someone was rejected is what makes the filter auditable — and it is the first thing
a recruiter will challenge.

> Conference attendance is never evidence of fit, only of opportunity. The conference topic sets the
> expectation; the person's own profile decides.

## Where AI belongs

We are applying for an **AI Solution Manager** role, so the judgement being assessed is not "did you
use an LLM" — it's "did you know where to put one."

**Use a model for:**
- title canonicalisation → role family (where a rules table gets brittle)
- skill synonym expansion (generated offline, reviewed, committed as data in `taxonomy.yaml`)
- parsing free-text `notes` into structured interest tags
- semantic similarity (profile ↔ job description embeddings) as *one more scored signal*
- generating `why_summary` and a draft outreach line from fields already computed

**Never use a model for:**
- the final score — non-reproducible, non-auditable, unexplainable to a rejected candidate
- the admission gate — an excluded person deserves a reason a human wrote
- anything unlogged — every model output lands in an inspectable field, cached by input hash

**The rule to state in the README:**
> The deterministic layer decides. The model layer describes and normalises. Every model-derived
> value is reproducible from a cache and overridable by a human.

That is also the GDPR-safe architecture — see Article 22 in `docs/05-assumptions.md` Q7.

## For this submission, keep it simple

The 75-row dataset does not need embeddings, a vector DB, or Kubernetes. Build the deterministic
core with the taxonomy in config. Mention the model layer in the design doc as the
"what I'd add with more time" section, and — if time permits — ship the synonym map as
LLM-generated-then-human-reviewed data, which demonstrates the principle without adding a runtime
dependency.
