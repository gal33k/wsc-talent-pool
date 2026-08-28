# 00 — Task requirements (decoded)

Source: `docs/original-task-brief.html`

## Meta

| | |
|---|---|
| Role | AI Solution Manager |
| Expected effort | 1–2 working days |
| Time to submit | 4–5 days from receipt |
| Language | English |
| Submission | GitHub repo (or zip) with README |
| Required demo job | `JOB001` — Senior ML Engineer |

## The stated mission

> Design and build a system that turns raw conference attendance into a queryable talent pool — so
> that when a role opens up, the right candidates surface automatically, with the context a
> recruiter needs to act.

Two problems are named in the background section:

1. **Capture** — conference contacts land nowhere and are forgotten within days.
2. **Signal-to-noise** — a conference on any topic contains people whose real role matches the
   topic and people who don't. A DevOps conference has platform engineers *and* IT managers,
   network admins and vendor reps. The system must separate them **without manual screening**.

Company context given: HubSpot as marketing/contact tool, Comeet as ATS, LinkedIn access. The
vision is to extend HubSpot's contact infrastructure into a talent pool of passive candidates.

## Required deliverables

- [ ] **Working pipeline** — script, notebook or small app. Runnable against the provided CSVs
      with a selected `job_id` as input. README with dependencies + run instructions.
- [ ] **Output CSV for at least one job** — must run against `JOB001` and include the file.
- [ ] **Design document (1–2 pages or a structured README section)** covering:
      - why you chose this approach
      - what tools/integrations a real production version would use
        (actual LinkedIn API, HubSpot API, Comeet webhook)
      - what the pipeline looks like at scale (hundreds of conferences, thousands of contacts)
      - what you'd add with more time
- [ ] **Stated assumptions** — data quality, business logic, scope.

## Optional / bonus

- **Executive summary** — 5 min verbal or one paragraph, aimed at a non-technical Head of HR.
- **Recruiter view** — simple HTML or CLI summary usable without opening a spreadsheet.
  The brief calls this "optional but impressive".

## Explicitly asked of us before coding

> Define the schema and flow — before building, map out what your pipeline does at each step:
> what goes in, what happens, and what comes out.

> Define the output — decide what the output looks like and what fields it contains. The output
> should be structured and usable by a recruiter without additional processing.

## Hard constraints

> Do not include any real personal data, real API keys, or attempt to connect to live LinkedIn,
> HubSpot, or Comeet accounts. Work entirely with the provided CSV files.

## Their evaluation table (verbatim dimensions)

| Dimension | What a strong submission looks like |
|---|---|
| Problem understanding | Clearly frames the core pain (signal-to-noise in recruiting), not just the technical task |
| Solution design | Explains why each step exists and what real integrations would replace the CSV mocks |
| Scoring logic | Transparent, documented methodology — not a black box |
| Code quality | Clean, readable, modular — another engineer could extend it |
| Edge case handling | Missing profiles, no mutual connections, partial skill matches — all handled gracefully |
| Assumptions | Explicit and well-reasoned — shows critical thinking about real-world constraints |
| Communication | Can explain the system to a non-technical audience in plain language |

**Read this table as the spec.** Six of the seven rows are about thinking and communication; one is
about code. Budget effort accordingly — the design docs and README are where this is won.

## The seven assumption questions we must answer

1. How do you define "domain relevance"? DevOps professional vs IT manager vs vendor rep?
2. How do you handle a contact with no LinkedIn profile match — filter out, or keep with lower relevance?
3. Is 1 mutual connection the same as 3? Does the number matter?
4. Should candidates already in Comeet be flagged differently — e.g. previously rejected?
5. What is the intended refresh cadence — one-time batch, or after every conference?
6. In a real deployment, who triggers the pipeline — recruiter, or automated (badge-scan export)?
7. Are there privacy/GDPR considerations affecting how LinkedIn data is stored or processed at scale?

Answers are drafted in `docs/05-assumptions.md`. They must end up in the README.

## Note the brief makes about the data

> Because this is a take-home task, the CSV files provided simulate the *end state* of what a real
> system would produce ... Part of your design document should explain how you would build the
> capture and enrichment layer in a real deployment.

So: the capture + enrichment layer is a **design deliverable**, not a code deliverable.
