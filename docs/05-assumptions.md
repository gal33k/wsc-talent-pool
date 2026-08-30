# 05 — Assumptions (drafted answers)

The brief lists these seven explicitly and says we may either assume or ask. **A position with a
reason scores; a hedge does not.** These go in the README near the top.

---

### Q1 — How do you define "domain relevance"?

Three independent signals — title-derived role family, skills evidence, and industry/employer
proximity — with **two-of-three agreement** required to admit to the pool. The conference topic sets
the expectation; the person's own profile decides.

Conference attendance is never evidence of fit, only of opportunity. An IT manager at a DevOps
conference has a title in the `not_talent` bucket, skills that don't belong to any engineering
family (`ITIL`, `Network`, `Healthcare IT`), and an industry with no proximity to ours — zero of
three signals, rejected with a reason.

---

### Q2 — Contacts with no LinkedIn profile match?

**Keep them. Never drop them.** Score on what exists (title, company, conference domain, recruiter
notes), cap `fit_score` at the confidence ceiling (~60), set `data_confidence = low` and
`suggested_action = needs_enrichment`.

Dropping them makes the pipeline's coverage invisible. A recruiter should see *"12 contacts we
couldn't verify"* rather than never learning they existed.

*(Note: the sample data has zero such rows despite the brief warning about them twice — we built
`data/test_edge_cases.csv` to exercise the path.)*

---

### Q3 — Is 1 mutual connection the same as 3?

No — but the difference is smaller than a linear count implies, **and it belongs on the Signal axis,
not the fit axis.**

Diminishing returns: 0 → 0.0, 1 → 0.5, 2 → 0.8, 3+ → 1.0. The jump from nobody to somebody is the
whole value. A same-department connection is weighted above a cross-department one, because the ask
is "will you introduce us" and the person best placed to make it is a peer.

The deeper answer: mutual connections predict **reachability**, not **competence**. In this dataset
they correlate strongly with relevance, which makes them a tempting shortcut — and that shortcut
would bury five genuinely strong candidates who happen to have no network overlap with us.

---

### Q4 — Should candidates already in Comeet be flagged?

Yes, and **differently by status**:

| ATS status | Treatment |
|---|---|
| Active in process | Suppress entirely — two recruiters must not approach the same person |
| Previously rejected | Show, with reason and date. A rejection for a different role two years ago is not a rejection for this one |
| Hired | Exclude |
| Declined an offer | Show with a flag — warm intelligence, not a disqualifier |

No Comeet data ships with this task, so this is built as a **documented interface with a stub CSV**
(`data/comeet_status_stub.csv`) and called out as such.

---

### Q5 — Refresh cadence?

**Three cadences, not one:**

1. **Ingestion** — event-driven, fired by a conference export landing.
2. **Enrichment refresh** — rolling batch; profiles go stale, so a ~6-month refresh on pool members
   keeps titles current.
3. **Matching** — on demand, per role.

Treating this as a one-time batch is what caused the original problem: contacts went stale because
nothing ever ran again.

---

### Q6 — Who triggers it?

**Both, deliberately.**

- *Automated on the ingest side*: badge-scan export lands → pipeline runs → pool updated → recruiter
  receives a digest of new admissions.
- *Manual on the match side*: a recruiter opens a role and asks for a shortlist.
- *Plus* an automatic trigger when a new job is published in Comeet.

The recruiter should never have to remember the system exists.

---

### Q7 — Privacy / GDPR?

Substantial, and worth its own paragraph in the design doc.

- **Legal basis**: legitimate interest, with a documented Legitimate Interests Assessment.
- **Article 14**: because the data is not collected from the person directly, they must be notified
  within 30 days — in practice the first outreach message carries the notice.
- **Data minimisation**: store *derived features* (role family, skill tags, seniority band) rather
  than full profile copies.
- **Retention**: TTL of 12–24 months with automatic purge; re-consent or drop.
- **Rights**: honour objection and erasure across HubSpot, the pool, and any enrichment cache.
- **Residency**: EU data region; DPA signed with any enrichment vendor.
- **Article 22**: no solely-automated decisions with legal or similarly significant effect. Keep a
  human in the loop by design — **the system ranks and explains, a recruiter decides.**

That last point is the reason the deterministic scoring layer isn't just a nicety: an automated
decision you cannot explain is a compliance problem, not only an engineering one.

---

## Additional assumptions we are making (state these too)

- `years_experience` is treated as trustworthy where present; `past_titles` is used as a cross-check.
- Skills are self-reported and therefore evidence of *exposure*, not proficiency — the score is a
  prioritisation signal for a human, not a hiring decision.
- Conference `notes` are unstructured and optional; their presence contributes to the Signal score, their content
  is displayed but not scored.
- One person may appear at multiple conferences; identity resolves on LinkedIn URL first, and the
  most recent contact date wins for recency.
- Location is displayed but not filtered on, absent a stated policy on remote/hybrid.
- The `source` column exists so the pipeline can accept referrals, inbound applications and sourced
  candidates later — the scoring core is channel-agnostic by design.
