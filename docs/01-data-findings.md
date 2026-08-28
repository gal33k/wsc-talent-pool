# 01 — Data findings

Profiled from the four supplied CSVs. **Read this before writing gate or scoring logic.** The
dataset is hand-built; most of what looks like noise is a deliberate test case.

## Shape

| File | Rows | Key fields |
|---|---|---|
| `conference_attendees.csv` | 75 | hubspot_id, full_name, email, company, title, conference_name, **conference_domain**, conference_date, source, notes, linkedin_url |
| `linkedin_profiles.csv` | 75 | linkedin_url, full_name, current_company, current_title, location, years_experience, top_skills, industry, past_companies, **past_titles**, wsc_mutual_connections |
| `wsc_employees.csv` | 15 | employee_id, full_name, title, department, linkedin_id, **work_history** |
| `job_openings.csv` | 4 | job_id, title, department, seniority, key_domains, required_skills, nice_to_have |

Bolded columns **are not documented in the task brief**. They exist in the files anyway.

## Three undocumented columns — use all of them

- **`conference_domain`** (attendees) — one of: `Sports Technology & Analytics`,
  `Data Engineering & AI/ML`, `DevOps & Platform Engineering`, `Broadcast & Video Technology`.
  Lets the gate compare a person's real role against the room they were in, without hardcoding
  conference names.
- **`past_titles`** (LinkedIn) — employers *with date ranges*. Gives career trajectory and a second,
  independent read on seniority beyond `years_experience`.
- **`work_history`** (WSC employees) — the most valuable column in the dataset. Enables
  **shared-employer warm paths** that `wsc_mutual_connections` misses entirely.

## Data quality — the actual state

| Check | Result |
|---|---|
| Attendees with blank `linkedin_url` | **0** |
| Attendees whose URL has no profile row | **0** |
| Orphan LinkedIn profiles | **0** |
| Duplicate names / emails / hubspot_ids | **0** |
| Blank `notes` | 34 of 75 |
| Blank `wsc_mutual_connections` | 33 of 75 |
| `source` values | all `Conference - Badge Scan` |

**The brief warns twice that "not every attendee has a matching LinkedIn profile." In the shipped
data, all 75 join cleanly.** Handle the missing-profile path anyway — and say in the README that we
checked and built a fixture for it, since the sample can't exercise it. That single sentence scores
the "Edge case handling" row.

Build `data/test_edge_cases.csv` containing: a row with no LinkedIn URL, a URL with no profile row,
a profile with empty skills, a person appearing at two conferences, and a person with a blank title.

## Conference spread

| Conference | Domain | Dates | Attendees |
|---|---|---|---|
| SportsTech Innovation Summit | Sports Technology & Analytics | 14–15 Nov 2024 | 40 |
| Broadcast & Streaming Technology Expo | Broadcast & Video Technology | 6–7 Feb 2025 | 12 |
| Data & AI Summit Europe | Data Engineering & AI/ML | 20–21 Mar 2025 | 12 |
| DevOps World 2025 | DevOps & Platform Engineering | 10–11 Apr 2025 | 11 |

Spread of 5 months means **recency decay is a real signal**, not a theoretical one.

---

## THE PLANTED TEST CASES

### 1. The mutual-connections trap  ← most important finding

All 33 attendees with zero mutual connections *look* like noise (healthcare, insurance, legal,
agritech, textiles, government, marketing). So a model that leans on `wsc_mutual_connections`
produces a great-looking shortlist **for the wrong reason** — and silently buries these five:

| Candidate | Title | Company | Yrs | Why it matters |
|---|---|---|---|---|
| Viktor Novak | Senior Data Engineer | Databricks | 7 | Spark, Delta Lake, dbt, Airflow, Kafka — near-exact JOB004 match, zero warm path |
| Ingrid Svensson | Data Engineer | Klarna | 5 | Full JOB004 stack, fintech domain |
| Kim Soo-Jin | DevOps Lead | Samsung SDS | 7 | Real platform leadership, no sports domain |
| Mei Zhang | Platform Engineer | CloudNative Labs | 4 | Legitimate K8s/Terraform/GCP, just unconnected |
| Javier Morales | Broadcast Engineer | TeleDeporte (RTVE) | 5 | Genuinely in the sports-broadcast domain, zero network overlap |

**Consequence for the build:** mutual connections must stay out of `fit_score` entirely. They
predict *reachability*, not *fit*. This belongs in the README as a stated design decision.

### 2. Role-family collision

Sports-domain signal is strong enough that, without a discipline gate, sports **Data Engineers**
outrank **Computer Vision** engineers on an ML role. In a naive weighted model, Scarlett Green
(Senior Data Engineer, NFL, 3 mutuals) lands in the JOB001 top ten ahead of Nathan Brooks
(CV Engineer, Second Spectrum).

**Consequence:** gate on role family first, then score on domain. They are different axes.

### 3. Partial skill matches (JOB001 requires Python; PyTorch; Computer Vision; Object Detection; AWS)

| Candidate | The wrinkle |
|---|---|
| Mason Young | Automated highlight generation at Sky Sports — but **TensorFlow**, not PyTorch |
| Emily Carter | Video AI Engineer, CV + FFmpeg + AWS + Docker, 8 yrs — **no DL framework listed at all** |
| Sara Lindqvist | Senior ML Engineer, PyTorch — but **recommendation systems**, not vision |

Decide explicitly: are frameworks interchangeable within a family (PyTorch ≈ TensorFlow ≈ "Deep
Learning") or matched literally? Either answer is defensible; having no answer is not. Put the
decision in `config/taxonomy.yaml` so it's visible.

### 4. Seniority above the band

Jin Park (Principal Data Scientist, 10 yrs), Fatima Al-Rashid (Head of Data), Adaora Okafor (Head of
Technology), Lars Andersen (Solutions Architect, 11 yrs).

A linear "more experience = better" score puts leadership profiles at the top of an IC role. Score
seniority as **band fit** with a mild penalty above band, and surface an `above_band` flag rather
than silently demoting.

### 5. The vendor archetype

The brief names "vendor sales reps" as noise. The dataset's version is subtler: **Ethan Clark** and
**Tobias Braun** are AWS Solutions Architects covering sports-media clients — credible, domain-
relevant, and on a pre-sales track that rarely converts to IC engineering. Flag as a different
hiring motion; do not silently filter out.

### 6. Implementation trap — generic employer tokens

Naive substring matching between attendee employers and WSC `work_history` generates ~40 false warm
paths, because `startup`, `freelance`, `university`, `public sector` and similar appear all over
both files.

**A generic-employer stoplist is mandatory.** Put it in `config/taxonomy.yaml`. Real signals are
specific: Opta Sports, Stats Perform, Mobileye, Intel, Akamai, Nielsen Sports, Sportradar, KINEXON,
Deltatre, BBC Sport, Sky Sports, ESPN, Turner Sports, IDF tech unit.

## Genuine shared-employer warm paths (validated)

| Candidate | Shared employer | WSC employee | Also a mutual? |
|---|---|---|---|
| Priya Anand | Mobileye, Intel | Maya Levi (Sr ML Eng), David Cohen (VP Eng) | yes |
| Marcus Reid | Opta Sports, Stats Perform | Itai Nahum (ML Research), Liron Katz | yes |
| James Thornton | Opta Sports | Itai Nahum | yes |
| Yuki Tanaka | Nielsen Sports, Sportradar | Avi Goldberg, Liron Katz, Tal Mizrahi | partial |
| Chris Lee | Sportradar | Tal Mizrahi | yes |
| Rafa Torres | Sportradar, LaLiga Tech | Tal Mizrahi | yes |
| Liam Harris | KINEXON Sports | Michal Barak | yes |
| Sophie Martin | Akamai | Yuval Stern, David Cohen | yes |
| Tom Barker | Akamai | Yuval Stern, David Cohen | yes |
| David Strauss | Akamai, ESPN | Yuval Stern, David Cohen | yes |
| Yael Ben-David | Akamai, IDF tech unit | Yuval Stern, Itai Nahum | yes |
| Nia Campbell | BBC Sport | Omer Levy | yes |
| Mason Young | Sky Sports | Omer Levy | yes |
| Elijah Allen | Deltatre | Dana Friedman | yes |
| Scarlett Green | Nielsen Sports | Avi Goldberg, Liron Katz | yes |
| Jin Park | Stats Perform / Opta | Liron Katz, Itai Nahum | yes |
| **Grace Wilson** | **IDF tech unit** | **Yuval Stern, Itai Nahum** | **NO mutuals** |

Grace Wilson is the demonstration row: **zero mutual connections, but a real shared-unit path**.
Invisible to a mutual-connections model, visible to ours.

## Indicative JOB001 ranking (sanity check)

A first-pass version of the model in `docs/03-scoring-model.md` produces:

1. Priya Anand — Sr CV Engineer, VidStream — 5/5 required skills, 7 yrs, Mobileye+Intel path
2. Lucas Evans — Senior ML Engineer, IMG Media — sports highlights CV, 3 mutuals incl. CTO
3. Marcus Reid — ML Research Engineer, Stats Perform — Opta alumni path
4. Chiara Russo — Sr ML Engineer Video, Mediaset — automated sports clipping
5. Nathan Brooks — CV Engineer, Second Spectrum — pose estimation / sports tracking
6. Emily Carter — Video AI Engineer, BroadcastAI
7. Mason Young — ML Engineer, Sky Sports — TensorFlow flag
8. James Thornton — ML Engineer, SportsVision

Correct behaviours to verify: **Jin Park flagged `above_band` rather than ranked #1**, and
**Sara Lindqvist visibly penalised** for RecSys over vision. If those two hold, the seniority and
skill-specificity logic works.

Note WSC's actual product is AI-generated sports highlights. Candidates 2, 4 and 7 literally build
that product elsewhere — a model that rewards "does what our product does" is scoring correctly.
