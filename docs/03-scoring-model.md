# 03 — Scoring model

## Two axes, not one "compatibility rate"

Report two numbers. **Fit** answers *can they do the job*. **Warmth** answers *can we get to them*.
Collapsing them into a single percentage is exactly how good candidates with no network get buried
and well-connected mismatches float to the top — see `docs/01-data-findings.md` § "The
mutual-connections trap".

---

## Axis 1 — `fit_score` (0–100)

Competence only. **No network signal anywhere in this number.**

| Component | Weight | How it's computed |
|---|---:|---|
| Required skills coverage | 35 | matched required skills / total required, via the synonym map |
| Role-family match | 25 | exact family = 1.0, adjacent family = 0.5, other = 0.0 |
| Seniority band fit | 15 | band fit, not linear years — see below |
| Domain relevance | 15 | sports/media/broadcast lexicon hit on industry + employers + skills |
| Nice-to-have coverage | 10 | matched nice-to-have / total nice-to-have |

### Seniority as a band, not a line

Map the job's `seniority` field to a years band:

| Job seniority | Band |
|---|---|
| Junior | 0–3 |
| Mid | 3–6 |
| Mid-Senior | 5–8 |
| Senior | 6–10 |
| Lead / Principal | 9+ |

- inside the band → 1.0
- below the band → penalise ~0.2 per year under, floor 0
- above the band → mild penalty (~0.1 per year over, floor 0.5) **plus** an `above_band` flag in the
  output. Do not silently demote a Principal — surface the judgement to the recruiter.

Cross-check the band against `past_titles` trajectory where available, not just `years_experience`.

### Hard requirements

If the job has a genuine hard requirement that the candidate fails, exclude with a reason rather
than scoring near-zero. Excluded rows stay retrievable, they are just not in the default view.

---

## Axis 2 — `warmth_score` (0–100)

Reachability. Everything about how you get a reply to a cold message.

| Component | Weight | How it's computed |
|---|---:|---|
| Mutual connections | 40 | diminishing returns, weighted by department match |
| Shared employer path | 30 | after stoplist filtering; same-department employee worth more |
| Contact recency | 20 | exponential decay on `conference_date`, ~12-month half-life |
| Recruiter notes present | 10 | a real conversation happened; there is something to open with |

### Diminishing returns on connections

```
0 mutuals -> 0.0
1 mutual  -> 0.5
2 mutuals -> 0.8
3+        -> 1.0
```

The jump from nobody to somebody is the whole value; the jump from three to four is noise. Use the
same curve for shared employers.

Weight a **same-department** employee above a cross-department one — the ask is "will you introduce
us", and the person best placed to make it is a peer. Maya Levi (Senior ML Engineer) is a better
intro path for JOB001 than Hila Peled (UX Designer), even though both are one connection.

### Recency decay

A badge scan from Nov 2024 is a colder lead than one from Apr 2025. Apply decay **to the warmth axis
only** — skills don't expire, but someone's memory of a 20-minute booth conversation does.

```
recency_factor = 0.5 ** (months_since_contact / 12)
```

---

## Priority tiers

| Tier | Condition | Recruiter action |
|---|---|---|
| `call_this_week` | fit ≥ 70 and warmth ≥ 50 | Ask the named employee for a warm intro. Highest conversion, lowest effort. |
| `direct_outreach` | fit ≥ 70 and warmth < 50 | Strong candidate, cold approach. Personalise from profile evidence. |
| `nurture` | fit 45–70 | Adjacent fit. Keep in pool, re-score on the next role. |
| `excluded` | failed gate or hard requirement | Not in the default view; retrievable with reason. |

---

## Everything above lives in config, not code

`config/scoring.yaml`:

```yaml
fit_weights:
  required_skills: 35
  role_family: 25
  seniority: 15
  domain: 15
  nice_to_have: 10

signal_weights:                # renamed from warmth_weights in the Signal-axis refactor
  peer_vouch:            35    # active same-team WSC endorsement (× role_match × tenure, normalized)
  same_team_overlap:     18    # shared employer with a same-team person, no active vouch
  cross_team_vouch:      12    # active endorsement from cross-department WSC employee
  culture_affinity:      12    # OSS in our stack + domain-topic engagement (strict definition)
  prior_wsc_engagement:   8    # followed WSC, engaged with our posts, past event history
  recency:                7    # 12-month half-life decay
  notes_present:          5    # a recorded booth conversation
  mutual_connections:     3    # bare LinkedIn mutual (no team overlap, no vouch)

vouch_role_match:              # multipliers applied to any active vouch
  same_role_family:  3.0
  same_department:   2.0
  leadership:        1.5
  adjacent_family:   1.3
  cross_department:  1.0

vouch_tenure:                  # multipliers based on WSC tenure of the voucher
  senior_bands:
    - {min_months: 36, multiplier: 1.25}
    - {min_months: 12, multiplier: 1.00}
    - {min_months:  6, multiplier: 0.85}
    - {min_months:  0, multiplier: 0.60}

vouch_normalizer: 3.75         # divides composite (role × tenure) so vouch component fits 0-1

connection_curve: [0.0, 0.5, 0.8, 1.0]     # index = count, capped
same_department_multiplier: 1.25
recency_half_life_months: 12

seniority_bands:
  Junior:      [0, 3]
  Mid:         [3, 6]
  Mid-Senior:  [5, 8]
  Senior:      [6, 10]
  Lead:        [9, 99]
under_band_penalty_per_year: 0.2
over_band_penalty_per_year: 0.1
over_band_floor: 0.5

tiers:
  call_this_week:  {min_fit: 70, min_warmth: 50}
  direct_outreach: {min_fit: 70}
  nurture:         {min_fit: 45}

gate:
  admit_min_signals: 2      # of 3
  hold_min_signals: 1
low_confidence_fit_ceiling: 60
```

It takes ten extra minutes, it makes the "transparent methodology" claim concrete, and it lets you
say in the debrief: **"a recruiter can re-tune this without an engineer."** That sentence is worth
more than the feature.

## Worked example for the README

Pick the top JOB001 candidate and compute the score by hand in the README — component by component,
arriving at the same number the code produces. One worked example converts "transparent methodology"
from a claim into a demonstration.
