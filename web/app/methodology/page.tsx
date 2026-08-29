"use client";

import { Icon } from "@/components/Icon";
import { Chip } from "@/components/Chip";
import { usePool } from "@/lib/data";

const TOC = [
  { id: "tldr",        label: "TL;DR" },
  { id: "mechanism",   label: "The mechanism" },
  { id: "assumptions", label: "7 assumptions" },
  { id: "examples",    label: "Worked examples" },
  { id: "deepdive",    label: "Technical deep-dive" },
];

// Documentation as ONE editorial scroll — no tabs. The reader progresses top-down:
// elevator pitch → mechanism → examples → assumptions → technical deep-dive.
export default function Methodology() {
  const { pool } = usePool();

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <header className="mb-10 pb-8 border-b border-border">
        <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-800 mb-3">Complete documentation</div>
        <h1 className="text-4xl md:text-5xl font-semibold text-text tracking-tight display-tight leading-[1.05] mb-4">
          How the WSC talent pool works
        </h1>
        <p className="text-lg text-dim max-w-2xl font-serif italic leading-snug">
          One long-form document — top to bottom, elevator pitch to technical deep-dive.
          Everything an interviewer would want to check, in the order they'd want to check it.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10">
        <article className="min-w-0 space-y-20">
          <section id="tldr" className="scroll-mt-6">
            <TLDR pool={pool} />
          </section>

          <SectionDivider n="01" label="The mechanism" />
          <section id="mechanism" className="scroll-mt-6">
            <HowItWorks />
          </section>

          <SectionDivider n="02" label="Assumptions we made" />
          <section id="assumptions" className="scroll-mt-6">
            <Assumptions />
          </section>

          <SectionDivider n="03" label="Worked examples" />
          <section id="examples" className="scroll-mt-6">
            <WorkedExamples />
          </section>

          <SectionDivider n="04" label="Technical deep-dive" />
          <section id="deepdive" className="scroll-mt-6">
            <DesignDoc pool={pool} />
          </section>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-4 card p-4">
            <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-3">On this page</div>
            <nav className="space-y-1">
              {TOC.map((t, i) => (
                <a
                  key={t.id}
                  href={"#" + t.id}
                  className="flex items-baseline gap-2 py-1 text-[13px] text-dim hover:text-emerald-700 transition-colors rounded px-2 hover:bg-emerald-50/60"
                >
                  <span className="font-mono text-[10px] text-faint w-4 tabular">{String(i).padStart(2, "0")}</span>
                  <span>{t.label}</span>
                </a>
              ))}
            </nav>
            {pool && (
              <div className="mt-5 pt-4 border-t border-border text-[11px] text-mute space-y-1">
                <div>Config <code className="text-dim">{pool.config_version}</code></div>
                <div>{pool.candidates.length} contacts · {pool.jobs.length} jobs · {pool.employees.length} employees</div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

/* Big editorial divider between the 5 top-level sections. Serif numeral + wide rule. */
function SectionDivider({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline gap-6 pt-10 pb-2">
      <div className="font-serif italic text-4xl text-emerald-700 leading-none tabular">{n}</div>
      <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-mute">{label}</div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ============================================================================
 * TAB 1 — TL;DR
 * The plain-English 30-second version. What we do, for whom, and what makes
 * the design defensible.
 * ============================================================================ */

function TLDR({ pool }: { pool: ReturnType<typeof usePool>["pool"] }) {
  return (
    <section className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100 p-5 md:p-8">
        <div className="text-xs uppercase tracking-wider text-indigo-700 font-semibold mb-4">TL;DR</div>
        <p className="text-2xl text-text leading-snug font-medium mb-4">
          We turn <em>badge scans, employee referrals, and inbound CVs</em> into a queryable talent
          pool — then, for each open role, we rank the pool on <em>how well someone fits</em> and{" "}
          <em>how easy they are to reach</em>.
        </p>
        <p className="text-base text-dim leading-relaxed">
          Every score has an evidence trail a recruiter can defend. Nothing is a black box. A recruiter
          can always override the model, and their override sticks — no LLM decides who gets hired.
        </p>
      </div>

      {pool && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBig n={pool.candidates.length}   label="contacts in the pool"  sub="across 4 conferences" />
          <StatBig n={pool.jobs.length}         label="open roles scored"     sub="on demand, per job" />
          <StatBig n={pool.employees.length}    label="WSC employees"         sub="the warm-intro graph" />
          <StatBig n={32}                       label="tests passing"         sub="scoring maths locked" />
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-3">The pipeline at a glance</div>
        <MiniFlowDiagram />
        <div className="mt-3 text-xs text-mute italic">
          Same shape for every channel — the enrichment, gate, and scoring are shared. Only the source door changes.
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-3">Who this is for</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PersonaCard title="Recruiter"    hint="picks up the phone this week" href="/">
            Open positions grid → shortlist per role. Tier chip tells them who to call today.
          </PersonaCard>
          <PersonaCard title="Head of HR"   hint="tracks channel & role KPIs"   href="/analytics/">
            Admission rate by conference, funnel conversion, override quality — with the actual BigQuery SQL.
          </PersonaCard>
          <PersonaCard title="WSC engineer" hint="refers & introduces"          href="/referrals/">
            Referral form + Intros view (the reverse-referral: system → employee it's asking to intro).
          </PersonaCard>
        </div>
      </div>

    </section>
  );
}

/* ============================================================================
 * TAB 2 — HOW IT WORKS
 * The visual pipeline explanation. 5 boxes + arrows + plain-English captions.
 * ============================================================================ */

function HowItWorks() {
  return (
    <section className="max-w-3xl">
      {/* The flow diagram — one visual, not one visual + five cards saying the same thing */}
      <FlowDiagramLarge />

      {/* Pull quote — the design's central claim */}
      <blockquote className="my-10 pl-6 border-l-2 border-emerald-600 relative">
        <span className="font-serif text-6xl text-emerald-500 leading-none absolute -left-1 -top-3 opacity-30">&ldquo;</span>
        <p className="font-serif text-2xl leading-tight text-text mb-3 italic">
          Two decisions, never one scoring function. Two scores, never one compatibility rate.
        </p>
        <cite className="text-xs uppercase tracking-widest text-mute font-semibold not-italic">
          The design invariant — everything below serves it
        </cite>
      </blockquote>

      {/* Narrative sections — no card-in-card, editorial rhythm */}
      <div className="space-y-12">
        <NarrativeStep
          num={1}
          title="Source"
          lead="Where every contact comes in."
          seeIt="/capture/"
          seeLabel="Capture a lead"
        >
          <p>
            Three doors — <strong>conference badge scans</strong>, <strong>employee referrals</strong>,
            <strong> inbound CVs</strong>. Same downstream pipeline; only the <em>source_channel</em>
            tag differs, and referrals earn a vouched-lift on the signal axis.
          </p>
        </NarrativeStep>

        <NarrativeStep
          num={2}
          title="Enrich"
          lead="Fill in what a badge scan doesn't tell us."
          seeIt="/capture/"
          seeLabel="Watch enrichment run"
        >
          <p>
            Clay pulls the profile via its provider waterfall (Apollo → PDL → Sales-Nav-backed) the LinkedIn profile — past employers, recent posts, publications, connections.
            The one that pays off: cross-check the candidate's connections against the WSC employee
            directory. <em>Who do we already know that knows them?</em>
          </p>
        </NarrativeStep>

        <NarrativeStep
          num={3}
          title="Gate — decision A"
          lead="Is this person talent we hire? Three independent signals, 2-of-3 admits."
        >
          <p>
            <strong>Role family from title</strong>, <strong>skills evidence</strong>, and{" "}
            <strong>sports/media proximity</strong>. No single signal decides. Every excluded person
            carries a reason string a recruiter can read to them.
          </p>
        </NarrativeStep>

        <NarrativeStep
          num={4}
          title="Score — decision B"
          lead="Two scores per role. Never combined."
          seeIt="/jobs/JOB001/"
          seeLabel="Open the shortlist"
        >
          <p>
            <strong>Fit</strong> — competence only (skills, family, seniority, domain).{" "}
            <strong>Signal</strong> — endorsements + team overlap + culture + reachability (peer vouches, shared employers, recency, notes, mutuals).
            A single &ldquo;compatibility rate&rdquo; would bury strong candidates with no mutual
            connections.
          </p>
        </NarrativeStep>

        <NarrativeStep
          num={5}
          title="Shortlist"
          lead="Ranked list per role, with the person best placed to make the intro."
          seeIt="/pool/"
          seeLabel="Audit the pool"
        >
          <p>
            Sorted by fit, tier as a label. Each card has a one-click <em>Ask X to introduce</em>{" "}
            that lands in the outreach queue. Recruiter overrides win — the model can't put a
            &ldquo;not-a-fit&rdquo; candidate back on the list. Exportable to CSV.
          </p>
        </NarrativeStep>
      </div>

    </section>
  );
}

/* A single narrative step — big serif number, clean prose, no bullet lists inside a card.
   Editorial rhythm: number, title, lead paragraph, body. Optional inline "see it" link. */
function NarrativeStep({
  num, title, lead, seeIt, seeLabel, children,
}: {
  num: number;
  title: string;
  lead: string;
  seeIt?: string;
  seeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 sm:gap-6 md:gap-8">
      <div className="text-right">
        <div className="font-serif italic text-3xl sm:text-5xl md:text-6xl leading-none text-emerald-500 tabular">
          {String(num).padStart(2, "0")}
        </div>
      </div>
      <div className="min-w-0 pt-1">
        <h3 className="text-xl md:text-2xl font-semibold text-text tracking-tight mb-2 display-tight">{title}</h3>
        <p className="text-base text-text font-medium leading-snug mb-3">{lead}</p>
        <div className="text-[15px] text-dim leading-relaxed space-y-3 [&_strong]:text-text [&_strong]:font-semibold [&_em]:italic [&_em]:not-italic">
          {children}
        </div>
        {seeIt && seeLabel && (
          <a href={seeIt} className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-900">
            {seeLabel}
            <Icon name="arrow-right" className="w-3.5 h-3.5" strokeWidth={2.25} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * TAB — ASSUMPTIONS
 * The 7 brief-mandated questions, answered in recruiter-facing language.
 * Source: docs/05-assumptions.md (the canonical version).
 * ============================================================================ */

const ASSUMPTIONS: Array<{ q: string; short: string; answer: React.ReactNode }> = [
  {
    q: "How do you tell a real ML engineer apart from an IT manager who happened to attend an ML conference?",
    short: "Three checks, two have to pass",
    answer: (
      <>
        We look at three things about each person, independently:
        <ol className="space-y-1 pl-1 my-2">
          <li>1. Does their <strong>job title</strong> match a role we hire (like ML Engineer, Data Engineer, Backend)?</li>
          <li>2. Do their <strong>listed skills</strong> back that up (PyTorch, Kafka, etc.)?</li>
          <li>3. Do they work in an <strong>adjacent industry</strong> (sports, broadcast, video)?</li>
        </ol>
        <strong>Two out of three has to say yes.</strong> That way no single missing detail decides.
        An IT manager at a DevOps conference passes 0 of 3 → out, with a written reason. A senior
        data engineer at a bank passes 2 of 3 (title + skills, but wrong industry) → in.
        <div className="mt-2 text-xs text-mute italic">
          Just showing up at a sports conference doesn't make someone a fit — the room sets the
          expectation, the person's own profile decides.
        </div>
      </>
    ),
  },
  {
    q: "What if we can't find someone's LinkedIn profile?",
    short: "Keep them, but score them cautiously",
    answer: (
      <>
        <strong>We keep them.</strong> Silently dropping people would mean losing candidates the
        recruiter would want to know about — better to see &ldquo;12 people we couldn't verify&rdquo;
        than never know they existed.
        <div className="mt-2">
          We score them on what we DO have (title, company, conference notes) and cap their score
          at 60 out of 100. They stay visible but can't accidentally rank #1 on a role we know
          almost nothing about them for.
        </div>
      </>
    ),
  },
  {
    q: "Is knowing 1 person at WSC the same as knowing 3?",
    short: "No — but 1 is closer to 3 than 3 is to 10",
    answer: (
      <>
        <strong>The big jump is 0 → 1.</strong> Going from &ldquo;we have no way in&rdquo; to
        &ldquo;someone can make the intro&rdquo; is the whole point. Going from 1 mutual to 3 is
        a smaller improvement. Our math reflects that: 0 = no credit, 1 = half credit,
        2 = 80% credit, 3+ = full credit.
        <div className="mt-2">
          This lives in the <em>Signal</em> score (about reachability), never the <em>Fit</em>{" "}
          score (about competence). Mixing them would bury strong candidates who happen to have
          zero mutual connections with WSC — of which we have five in this dataset.
        </div>
      </>
    ),
  },
  {
    q: "What if a candidate is already known to us in Comeet (our ATS)?",
    short: "Depends on why — not one-size-fits-all",
    answer: (
      <>
        Four cases, four different actions:
        <table className="w-full text-xs my-2 border-collapse">
          <tbody>
            <tr className="border-b border-border-faint"><td className="py-1.5 pr-3 font-semibold text-text">Currently interviewing for another role</td><td className="py-1.5 text-mute">Hide them completely. Two recruiters must never chase the same person.</td></tr>
            <tr className="border-b border-border-faint"><td className="py-1.5 pr-3 font-semibold text-text">Rejected for a different role in the past</td><td className="py-1.5 text-mute">Show them, flagged with the reason. A no for one role isn't a no for another.</td></tr>
            <tr className="border-b border-border-faint"><td className="py-1.5 pr-3 font-semibold text-text">Already hired</td><td className="py-1.5 text-mute">Exclude — they work for us.</td></tr>
            <tr><td className="py-1.5 pr-3 font-semibold text-text">Declined an offer before</td><td className="py-1.5 text-mute">Show them, flagged. Useful context to soften the outreach, not a dealbreaker.</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    q: "How often does the pipeline actually run?",
    short: "Three different schedules for three different jobs",
    answer: (
      <>
        <ol className="space-y-1.5 pl-1 my-2">
          <li><strong>1. When new data arrives</strong> — a conference export drops → the pipeline runs immediately, recruiter gets a digest of new admissions.</li>
          <li><strong>2. Every ~6 months</strong> — we refresh LinkedIn data for pool members because job titles and companies change.</li>
          <li><strong>3. On demand</strong> — when a recruiter opens a role, the pool gets scored against it right away.</li>
        </ol>
        <div className="mt-2 text-xs text-mute italic">
          Treating this as a one-time batch job is what caused the original problem — contacts went
          stale because nothing ever ran again.
        </div>
      </>
    ),
  },
  {
    q: "Who kicks off the pipeline — a person, or automation?",
    short: "Both — and the recruiter shouldn't have to remember",
    answer: (
      <>
        <ul className="space-y-1.5 pl-1 my-2">
          <li>· <strong>Automation on the way in</strong>: a badge-scan export lands → pipeline runs on its own → recruiter gets an email with new pool members.</li>
          <li>· <strong>Recruiter on the way out</strong>: they open a role, the shortlist is generated live.</li>
          <li>· <strong>Comeet integration</strong>: a new job posted in Comeet auto-triggers a fresh shortlist against the pool.</li>
        </ul>
        The recruiter never has to remember the system exists. It runs quietly, surfaces the
        right people when they need them.
      </>
    ),
  },
  {
    q: "What about GDPR and privacy? Can we legally do this?",
    short: "Yes — with the right guardrails baked in",
    answer: (
      <>
        Six things we do to stay compliant at scale:
        <ol className="space-y-1.5 pl-1 my-2">
          <li><strong>1. Legal basis</strong>: we use &ldquo;legitimate interest&rdquo; (the standard for B2B recruiting), backed by a written assessment.</li>
          <li><strong>2. Tell them we have their data</strong>: GDPR Article 14 requires a notice within 30 days when we didn't collect the data from them directly. We put this notice in the first outreach message.</li>
          <li><strong>3. Store the minimum</strong>: we save derived tags (role family, seniority band) instead of full LinkedIn profile copies. Less to breach, less to explain.</li>
          <li><strong>4. Auto-delete</strong>: 12–24 month retention limit. After that, we ask again or drop the record.</li>
          <li><strong>5. Keep data in the EU</strong>: EU data region + a Data Processing Agreement with any vendor (Clay, HubSpot).</li>
          <li><strong>6. Never fully automate a hiring decision</strong>: GDPR Article 22 says a person has to be in the loop for anything with legal effect. Our system ranks and explains; a recruiter decides.</li>
        </ol>
        <div className="mt-2 text-xs text-mute italic">
          That last point is why the whole scoring layer is deterministic instead of an LLM — an
          automated decision you can't explain is a compliance problem, not just an engineering one.
        </div>
      </>
    ),
  },
];

function Assumptions() {
  return (
    <section className="max-w-4xl">
      <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/40 p-5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-indigo-700 mb-2">
          Why this tab exists
        </div>
        <p className="text-sm text-indigo-900 leading-relaxed">
          The brief names <strong>seven assumption questions</strong> and says candidates may either
          answer or ask. A position with a reason scores; a hedge does not. These are the seven
          questions verbatim, with the positions we took and why. Full versions live in{" "}
          <code>docs/05-assumptions.md</code>.
        </p>
      </div>

      <div className="space-y-3">
        {ASSUMPTIONS.map((a, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text mb-0.5">{a.q}</div>
                <div className="text-[11px] uppercase tracking-wider text-indigo-700 font-semibold">
                  {a.short}
                </div>
              </div>
            </div>
            <div className="pl-10 text-sm text-dim leading-relaxed [&_code]:text-indigo-700 [&_code]:bg-indigo-50 [&_code]:font-mono [&_code]:text-[12px] [&_code]:px-1 [&_code]:rounded [&_strong]:text-text [&_strong]:font-semibold">
              {a.answer}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-mute leading-relaxed">
        <strong className="text-text">Also documented</strong> — additional assumptions about the
        data itself (self-reported skills, identity resolution on LinkedIn URL, location displayed
        but not filtered on, source_channel first-class) live in the design doc tab and{" "}
        <code>docs/05-assumptions.md</code>.
      </div>
    </section>
  );
}

/* ============================================================================
 * TAB 3 — WORKED EXAMPLES
 * Real candidates + real referrals flowing through the pipeline.
 * ============================================================================ */

function WorkedExamples() {
  return (
    <section className="space-y-10">
      <div>
        <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">Gate decisions — 4 candidates</div>
        <p className="text-sm text-mute mb-4 max-w-3xl">
          Four rows from the dataset — two admits and two rejects — showing what the 3 signals do and
          why each ended where it did. Every exclusion has a reason a recruiter could read to the person.
        </p>

        <div className="space-y-2">
          <GateExample
            name="Grace Wilson" role="DevOps Engineer, CyberShield" family="platform_devops"
            s1 s2 s3={false} verdict="admit" verdictLabel="Admit · 2/3"
            note="Zero mutuals, zero shared employers we'd trust, no sports-industry proximity — admitted purely because her role family and skills line up. This is what &lsquo;fit and signal are independent&rsquo; means in practice: strong candidates without a network still land in the pool."
          />
          <GateExample
            name="Viktor Novak" role="Senior Data Engineer, Databricks" family="data_engineering"
            s1 s2 s3={false} verdict="admit" verdictLabel="Admit · 2/3"
            note="Full data-engineering stack. No sports/media proximity — that alone would have buried him. Family + skills carry the admission."
          />
          <GateExample
            name="Laura Gibson" role="IT Manager, City Hospital" family="not_talent"
            s1={false} s2={false} s3={false} verdict="reject" verdictLabel="Reject · 0/3"
            note="Classic noise. ITIL + Healthcare IT skills, no engineering family, no proximity. Reason recorded."
          />
          <GateExample
            name="Olivia Scott" role="Digital Marketing Manager" family="not_talent"
            s1={false} s2={false} s3={false} verdict="reject" verdictLabel="Reject · 0/3"
            note="Almost slipped through — her 'Social Media' skill originally hit a bare 'media' keyword. Fixed by requiring compound tokens."
          />
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">End-to-end walkthroughs</div>
        <p className="text-sm text-mute mb-4 max-w-3xl">
          The same candidate would take a different path through the pipeline depending on how they
          entered. The scoring core is shared; only the inputs and the signal lift differ.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChannelWalkthrough
            channel="Conference"
            tint="sky"
            steps={[
              { title: "Source",    body: "SportsTech Innovation Summit — 240 badge scans exported from Cvent." },
              { title: "Enrich",    body: "Clay pulls the profile via its provider waterfall (Apollo → PDL → Sales-Nav-backed) profile → past employers (DAZN, Meta), 3 recent posts on real-time inference, CVPR paper, 2.1k-star GitHub." },
              { title: "Gate",      body: "family=ml_cv ✓ · skills evidence ✓ · sports proximity ✓ → ADMIT (3/3)." },
              { title: "Score",     body: "JOB001 fit 82 (Computer Vision + Object Detection matched), signal 45 (Maya Levi 2°)." },
              { title: "Shortlist", body: "Tier: Direct outreach. Warm intro via Maya Levi (2° via shared Meta stint)." },
            ]}
            takeaway="Rich enrichment justifies the credit spend. Two of the 3 gate signals came from LinkedIn, not the badge scan."
          />
          <ChannelWalkthrough
            channel="Referral"
            tint="emerald"
            steps={[
              { title: "Source",    body: "Maya Levi (Sr ML Engineer) submits via /referrals form, targets JOB001." },
              { title: "Enrich",    body: "Same LinkedIn pull as conference — plus the referrer becomes an automatic 1° warm-intro path." },
              { title: "Gate",      body: "Referral-admit path — 3/3 signals; Maya's vouch is proximity evidence." },
              { title: "Score",     body: "JOB001 fit 82 (same), signal 70 (base 55 + vouched-by-employee lift 15)." },
              { title: "Shortlist", body: "Tier: Call this week. Warm intro is the referrer themselves." },
            ]}
            takeaway="Same candidate, same fit — but signal is dramatically higher because someone actively vouched. The recruiter picks up the phone faster."
          />
          <ChannelWalkthrough
            channel="CV inbound"
            tint="amber"
            steps={[
              { title: "Source",    body: "CV lands in Comeet application. Parsed into skills + past employers." },
              { title: "Enrich",    body: "Light enrichment — scan LinkedIn connections against WSC directory to find warm-intro paths. Skip evidence extraction (CV already declared skills)." },
              { title: "Gate",      body: "Deduped against active pool. If already in Comeet as active, suppressed." },
              { title: "Score",     body: "Stated fit from CV. Signal from any connection paths found in the WSC directory." },
              { title: "Shortlist", body: "Recruiter sees 'Alex applied and we know Ronit — do you want to ask Ronit about them?'" },
            ]}
            takeaway="CVs come with self-declared data. The high-value question is 'who do we already know that knows them?' — that's what enrichment focuses on for this channel."
          />
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">Try it yourself</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TryItCard href="/capture/"   label="Capture a conference lead"        hint="Enrichment reveal runs on submit." />
          <TryItCard href="/referrals/" label="Submit an employee referral"      hint="Vouched lift applied to signal on the target role." />
          <TryItCard href="/jobs/JOB001/" label="Open the JOB001 shortlist"     hint="Ranked pool, tier chips, warm-intro paths." />
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * TAB 4 — DESIGN DOC
 * The technical deep-dive. Everything an auditor might want to check.
 * ============================================================================ */

function DesignDoc({ pool: _pool }: { pool: ReturnType<typeof usePool>["pool"] }) {
  return (
    <section>
      <article className="min-w-0 space-y-10 max-w-[780px]">

        <Section id="architecture" num={1} title="Two decisions, not one">
          <p>
            The single most common failure mode is one big scoring function. Instead the pipeline
            splits into <strong>two separate decisions</strong>, run at different times, with
            different inputs and different owners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
            <DecisionCard letter="A" tint="indigo" title="Pool admission" subtitle="Job-agnostic · at ingest"
              bullets={[
                "Is this person talent in a domain we hire in?",
                "Runs once per person when a conference export lands",
                "Output: role_family + gate decision + reason",
                "Production: writes back to HubSpot as contact properties",
              ]} />
            <DecisionCard letter="B" tint="emerald" title="Job match" subtitle="Per job_id · on demand"
              bullets={[
                "Given JOB001, who does the recruiter call this week?",
                "Runs against the clean pool — cheap re-pass, no re-enrichment",
                "Output: fit_score, signal_score, best_intro_path",
                "Production: writes shortlisted rows into Comeet",
              ]} />
          </div>
          <Callout tint="indigo">
            Expensive work — enrichment, taxonomy classification, embeddings if we add them —
            happens once <em>per person</em>, not once per <em>person × job</em>. That is the whole
            answer to the &ldquo;at scale&rdquo; question in the brief.
          </Callout>
        </Section>

        <Section id="gate" num={2} title="Decision A — the gate">
          <p>
            Three <em>independent</em> signals evaluated per candidate at ingest. Requiring 2-of-3
            to agree means no single noisy field decides. Every decision carries a reason string, so
            a recruiter can audit <em>why</em> someone was kept out.
          </p>
          <div className="space-y-3 my-5">
            <SignalRow num={1} name="Role family from title" detail="Pattern list in taxonomy.yaml. Order-sensitive first-match-wins. Ten families including a dedicated not_talent bucket." example={`"Senior Data Engineer" → data_engineering`} />
            <SignalRow num={2} name="Skills evidence" detail="Does the candidate's top_skills list contain at least one skill that confirms the claimed family?" example="ml_cv: computer vision · pytorch · yolo · deep learning" />
            <SignalRow num={3} name="Sports / media proximity" detail="Lexicon hits across industry, current + past companies, and skills. Compound tokens only for 'media' (no 'Social Media' false positives)." example={`"Broadcasting" industry → hit on "broadcast" keyword`} />
          </div>
          <div className="grid grid-cols-3 gap-3 my-5">
            <GateResult n="2 of 3" label="Admit"   tone="emerald" />
            <GateResult n="1 of 3" label="Hold"    tone="amber" />
            <GateResult n="0 of 3" label="Reject"  tone="rose"  />
          </div>
        </Section>

        <Section id="scoring" num={3} title="Decision B — two scores, never one">
          <p>
            Collapsing competence and reachability into a single &ldquo;compatibility rate&rdquo; is
            exactly how strong candidates with no network get buried and well-connected mismatches
            float to the top. Fit and Signal stay separate — the tier assignment reads them
            independently.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
            <ScoreTable title="Fit" subtitle="Competence only" tone="indigo" rows={[
              ["Required skills", 35, "Exact = 1.0, family = 0.6"],
              ["Role family",     25, "Exact = 1.0, adjacent = 0.5"],
              ["Seniority",       15, "Tier-based band fit"],
              ["Domain",          15, "Sports/media lexicon"],
              ["Nice-to-have",    10, "Bonus skills"],
            ]} />
            <ScoreTable title="Signal" subtitle="Endorsements + reachability" tone="emerald" rows={[
              ["Mutual connections", 40, "Diminishing returns"],
              ["Shared employer",    30, "Post-stoplist, aliased"],
              ["Recency",            20, "12-month half-life"],
              ["Notes present",      10, "Real conversation"],
            ]} />
          </div>
          <Callout tint="indigo">
            Fit ≥ 70 <em>and</em> signal ≥ 20 → <em>Call this week</em>. Fit ≥ 70 alone → <em>Direct outreach</em>.
            Fit ≥ 45 → <em>Nurture</em>. Below that: not shortlisted.
          </Callout>
        </Section>

        <Section id="taxonomy" num={4} title="The taxonomy">
          <p>
            Every classification rule lives in one YAML file. A recruiter can add a synonym, teach
            the system a new role family, or exclude a generic-employer token — without touching
            code.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-5">
            {TAX_BLOCKS.map(b => (
              <div key={b.title} className="card p-4">
                <div className="text-xs font-semibold text-text mb-1.5">{b.title}</div>
                <div className="text-xs text-mute mb-3">{b.description}</div>
                <div className="text-[11px] text-dim font-mono border-l-2 border-indigo-200 pl-2.5">{b.example}</div>
              </div>
            ))}
          </div>
          <Callout tint="amber">
            The stoplist is not optional. Without it, generic tokens like <code>startup</code>,{" "}
            <code>freelance</code>, <code>university</code>, and every <code>IDF</code> variant
            generate around 40 false warm paths on this dataset. A WSC employee <em>vouching</em>{" "}
            for an IDF alum through <a href="/referrals/" className="underline hover:no-underline">/referrals</a>{" "}
            still counts — the stoplist only blocks passive matching, not active endorsements.
          </Callout>
        </Section>

        <Section id="reveal" num={5} title="Honest scope of the enrichment reveal">
          <p>
            The live enrichment animation on <em>/capture</em> and <em>/referrals</em> shows five
            categories of extracted signal: <strong>past employers (with a notable-tier flag)</strong>,{" "}
            <strong>recent posts</strong>, <strong>publications, talks &amp; repos</strong>,{" "}
            <strong>warm-intro paths against the WSC directory</strong>, and the final <strong>gate + fit
            scoring</strong>.
          </p>
          <p>
            Of these, <strong>only skills, mutual connections, shared employers, and the gate + fit
            scoring are computed by the shipped Python pipeline</strong> from the CSVs. The other
            reveal cards — posts, publications, employer-tier flag — illustrate what a production
            enrichment adapter <em>would</em> return (Clay + GitHub API + a Featured-section
            parse), rendered from a clearly-labeled example payload so the recruiter can see the
            shape of the data. They are not scored today; the UI marks each such reveal &ldquo;example
            enrichment output.&rdquo;
          </p>
          <p>
            Why keep them visible instead of dropping them: enrichment is the invisible half of a
            talent-pool pipeline. Showing the shape recruiters would see makes the credit spend,
            latency, and privacy trade-offs concrete — and marks the exact swap surface where a real
            Clay + Claude-normalisation call plugs in.
          </p>
        </Section>

        <Section id="ai" num={6} title="Where AI belongs">
          <p>
            This is an <strong>AI Solution Manager</strong> take-home. The judgement being assessed
            is not &ldquo;did you use an LLM&rdquo; — it's &ldquo;did you know where to put one.&rdquo;
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Model describes
              </div>
              <ul className="text-xs text-emerald-900/80 space-y-1.5">
                <li>Title canonicalisation → role family (offline batch)</li>
                <li>Skill synonym expansion (generated, reviewed, committed)</li>
                <li>Parsing free-text notes into structured tags</li>
                <li>why_summary + outreach_draft prose from evidence dict</li>
              </ul>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
              <div className="text-xs font-semibold text-rose-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> Deterministic decides
              </div>
              <ul className="text-xs text-rose-900/80 space-y-1.5">
                <li>The gate — an excluded person deserves a reason a human wrote</li>
                <li>The final score — non-reproducible ranking is a compliance problem</li>
                <li>Tier assignment</li>
                <li>Any decision with legal or hiring effect (GDPR Art. 22)</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="storage" num={7} title="Queryable pool — mocked BigQuery">
          <p>
            The pool needs to be queryable. Not a CSV, not a JSON blob — a real analytical store that
            recruiters can slice by conference, department, family, tier, or timestamp.
          </p>
          <p>
            This build uses <strong>BigQuery mocked as an adapter</strong>
            {" "}(<code>src/integrations/mock_bigquery.py</code>). Every meaningful event writes a row.
            The exact SQL is shown on <em>/analytics · Activity</em>. Swapping to real BigQuery is a
            one-file change.
          </p>
          <div className="my-5 rounded-lg border border-border bg-slate-50 p-4">
            <div className="text-xs font-semibold text-text mb-2">Tables</div>
            <table className="w-full text-xs font-mono">
              <tbody>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.talent_pool.contacts</td><td className="py-1.5 text-mute">one row per person, mutable</td></tr>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.talent_pool.gate_events</td><td className="py-1.5 text-mute">immutable · one row per decision</td></tr>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.talent_pool.score_events</td><td className="py-1.5 text-mute">immutable · one row per (contact × job × run)</td></tr>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.hitl.overrides</td><td className="py-1.5 text-mute">per-role recruiter overrides</td></tr>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.hitl.blacklist</td><td className="py-1.5 text-mute">globally excluded contacts</td></tr>
                <tr className="border-t border-border-faint"><td className="py-1.5 pr-4 text-indigo-700">wsc.telemetry.enrichment_calls</td><td className="py-1.5 text-mute">Clay call log with credit accounting</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="hitl" num={8} title="Human in the loop — recruiter overrides AI">
          <p>
            An AI ranking without a human override is a compliance problem waiting to happen.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="text-sm font-semibold text-amber-900 mb-1.5 flex items-center gap-2">
                <Icon name="filter" className="w-4 h-4" strokeWidth={2} />
                Not a fit for this role
              </div>
              <div className="text-xs text-mute leading-relaxed">
                Adds a recorded reason, hides the candidate from this specific role's shortlist,
                keeps them in the pool for every other job.
              </div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
              <div className="text-sm font-semibold text-rose-900 mb-1.5 flex items-center gap-2">
                <Icon name="close" className="w-4 h-4" strokeWidth={2.5} />
                Blacklist globally
              </div>
              <div className="text-xs text-mute leading-relaxed">
                Requires a written reason plus a confirmation modal. Removes the candidate from
                every scoring pass across every role. Reversible.
              </div>
            </div>
          </div>
          <Callout tint="rose">
            This is also our answer to <strong>AI hallucination</strong>. The model can't
            hallucinate a candidate onto the shortlist that the recruiter has marked &ldquo;not a
            fit&rdquo; — the override wins deterministically.
          </Callout>
        </Section>

        <Section id="shipped" num={9} title="What we shipped">
          <div className="card overflow-hidden my-4">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-mute font-medium border-b border-border bg-slate-50/50">
                <tr>
                  <th scope="col" className="text-left px-4 py-2.5">Requirement</th>
                  <th scope="col" className="text-left px-4 py-2.5">Status</th>
                  <th scope="col" className="text-left px-4 py-2.5">Where to look</th>
                </tr>
              </thead>
              <tbody>
                {SHIPPED.map(r => (
                  <tr key={r[0]} className="border-t border-border-faint">
                    <td className="px-4 py-2.5 text-text">{r[0]}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        r[1] === "Done"     ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : r[1] === "Exceeded" ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : r[1] === "Partial"  ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>{r[1]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-mute font-mono text-[11px]">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="tests" num={10} title="What we tested">
          <p className="mb-3">
            <strong>32 tests across 4 files, all passing.</strong> Focused on the invariants that
            would silently break the tuner, the pool, or the gate if they drifted.
          </p>
          <div className="space-y-2 my-3">
            <TestRow status="pass" name="tests/test_json_parity.py"    detail="Browser weighted-sum recompute matches Python's default within 0.1dp." />
            <TestRow status="pass" name="tests/test_gate.py · 7 tests" detail="Critical admits, known rejects, every row has a reason, stoplist filters generic employers." />
            <TestRow status="pass" name="tests/test_scoring.py · 16 tests" detail="Connection curve, exact-vs-family skill credit, seniority bands, adjacency, ceilings." />
            <TestRow status="pass" name="tests/test_missing_data.py · 9 tests" detail="Missing enrichment, blank fields, dedupe, miss-rate simulator." />
          </div>
        </Section>

        <Section id="tradeoffs" num={11} title="Design decisions we deliberately made — and could defend either way">
          <p className="mb-4">
            Every project has calls that go one way and could reasonably go the other. Here are the four
            biggest ones. If a reviewer disagrees, these are the levers we'd argue.
          </p>
          <div className="space-y-3 mt-3">
            <Tradeoff
              title="Being at a sports-tech conference doesn't automatically count in your favour"
              choice="Kept out"
              why="A lot of people at a sports-tech event aren't sports-tech engineers — vendors, analysts, journalists, students, plus-ones. If we gave everyone a bonus just for being in the room, we'd let the venue vouch for people instead of their actual profile. We judge each person on what's on their LinkedIn, not on which door they walked through." />
            <Tradeoff
              title="Filters don't persist in the URL"
              choice="Session only"
              why="When you filter the pool or the shortlist, refreshing the page loses the filter. In production you'd want shareable URLs — send a colleague 'here's the JOB001 Call-this-week list' as a link. Adding this is ~2 hours of work and a small library dependency. We deprioritised it because it's a UX polish item, not a correctness one." />
            <Tradeoff
              title="'Same team' preference lives in intro-path picking, not the signal score"
              choice="Preference-only"
              why="When we recommend WHO should make an intro, we prefer a same-team person (Maya from AI/ML over Hila from UX for a Senior ML Engineer role). But we don't add points to the candidate's signal score for being connected to a same-team person. Reason: it would make the signal score per-candidate × per-employee × per-job — a 4,500-row explosion. Keeping the signal score job-agnostic in the data, and applying preference at the display layer, is cleaner." />
            <Tradeoff
              title="The AI-written outreach draft is a template, not a real LLM call"
              choice="Deterministic template"
              why="Every candidate gets a why-summary and a first-touch outreach draft. In production these would be Claude API calls. In this build they're filled from a template because the brief forbids live API keys. Importantly: the code still builds the exact prompt-shaped 'evidence dict' the LLM would receive — visible in the integrations trace. Swapping to a real Claude call is a two-line change." />
          </div>
        </Section>

        <Section id="next" num={12} title="What we'd build next if we had another week">
          <p className="mb-4">
            Concrete gaps we know about, in the order we'd close them. Not vague future ambitions —
            actual next tasks.
          </p>
          <ol className="space-y-4 mt-3 pl-0 list-none">
            <li>
              <div className="text-sm font-semibold text-text">1. Shareable links to a specific view</div>
              <div className="text-sm text-mute mt-1">
                Today, if a recruiter filters the shortlist a certain way and wants to send it to a
                colleague, they have to describe how they got there — the filter resets on refresh.
                We'd make every view have its own link, so &ldquo;the JOB001 people worth calling this
                week&rdquo; is one URL a recruiter can paste into Slack. Small change, big daily-use win.
              </div>
            </li>
            <li>
              <div className="text-sm font-semibold text-text">2. Real "employee replied yes/no" tracking</div>
              <div className="text-sm text-mute mt-1">
                When a recruiter asks an employee to intro a candidate, we currently track the request
                but not the reply. Adding &ldquo;yes / no / not a fit / never heard back&rdquo; responses
                gives us labelled examples — which employees' vouches convert, which candidates got
                intro'd. That data feeds back into the scoring model as ground truth. This is what turns
                a good pipeline into a learning one.
              </div>
            </li>
            <li>
              <div className="text-sm font-semibold text-text">3. Real Claude API for the outreach draft</div>
              <div className="text-sm text-mute mt-1">
                Flip a config switch (<code>--use-live-narrator</code>) and the templated outreach
                message becomes a real Claude call on the same evidence dict. Two-line change; the
                whole surface is already there.
              </div>
            </li>
            <li>
              <div className="text-sm font-semibold text-text">4. Vector-search prefilter for scale</div>
              <div className="text-sm text-mute mt-1">
                Today's pool is 75 rows × 4 jobs = 300 scoring ops. At hundreds of conferences and
                thousands of contacts, that grows quickly. Before scoring, run a cheap vector-similarity
                search to shortlist ~200 plausible candidates per job — then let the transparent scorer
                do its work on that subset. Explainability preserved where it matters (in the final
                ranking); cost cut where it matters (early filtering).
              </div>
            </li>
            <li>
              <div className="text-sm font-semibold text-text">5. Fairness monitoring on shortlists</div>
              <div className="text-sm text-mute mt-1">
                Network-based signals (mutual connections, shared employers) encode existing bias fast
                and quietly — the pool starts to look like the current team. We'd track shortlist
                composition across gender, geography, and channel as a first-class metric, and alert
                when the pipeline drifts toward homogeneity.
              </div>
            </li>
            <li>
              <div className="text-sm font-semibold text-text">6. Hire-outcome feedback loop</div>
              <div className="text-sm text-mute mt-1">
                Which shortlisted candidates actually replied, converted to interview, got offered, got
                hired? Every one is a labelled example. Use them to re-weight the model quarterly rather
                than guessing at the numbers. Requires ATS integration (Comeet outcomes → BigQuery).
              </div>
            </li>
          </ol>
        </Section>

      </article>
    </section>
  );
}

/* ============================================================================
 * Shared visual components
 * ============================================================================ */

const BOXES: Array<{
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  hint: string;
  role: "source" | "shared";
}> = [
  { id: "source",    label: "Source",    icon: "download", hint: "conference · referral · CV",  role: "source" },
  { id: "enrich",    label: "Enrich",    icon: "search",   hint: "LinkedIn · employers · posts",  role: "shared" },
  { id: "gate",      label: "Gate",      icon: "filter",   hint: "is this person talent we hire?", role: "shared" },
  { id: "score",     label: "Score",     icon: "sliders",  hint: "fit + signal, per role",         role: "shared" },
  { id: "shortlist", label: "Shortlist", icon: "list",     hint: "ranked list · warm intros",      role: "shared" },
];

function MiniFlowDiagram() {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
      {BOXES.map((b, i) => (
        <div key={b.id} className="flex items-center gap-2 flex-shrink-0">
          <div className={`rounded-md border px-3 py-2.5 min-w-[130px] bg-white ${
            b.role === "source" ? "border-emerald-400 ring-1 ring-emerald-100" : "border-border"
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-stone-100 text-stone-700">
                <Icon name={b.icon} className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <div className="text-sm font-semibold text-text">{b.label}</div>
            </div>
            <div className="text-[10px] mt-1 text-mute">{b.hint}</div>
          </div>
          {i < BOXES.length - 1 && (
            <Icon name="arrow-right" className="w-4 h-4 text-faint flex-shrink-0" strokeWidth={2} />
          )}
        </div>
      ))}
    </div>
  );
}

function FlowDiagramLarge() {
  return (
    <div className="card p-6 md:p-8 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
        {BOXES.map((b, i) => {
          const isSource = b.role === "source";
          return (
            <div key={b.id} className="relative">
              <div className={`rounded-lg border p-4 h-full transition-colors ${
                isSource
                  ? "bg-white border-emerald-500 border-2 ring-2 ring-emerald-100/60"
                  : "bg-stone-50/60 border-border hover:border-border-strong"
              }`}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mute font-semibold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {isSource && (
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-100 rounded-sm px-1.5 py-0.5">
                      variable
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded flex items-center justify-center ${
                    isSource ? "bg-emerald-100 text-emerald-800" : "bg-white text-text border border-border"
                  }`}>
                    <Icon name={b.icon} className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="text-base font-semibold text-text">{b.label}</div>
                </div>
                <div className="text-xs text-mute leading-snug">{b.hint}</div>
              </div>
              {i < BOXES.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-border items-center justify-center shadow-sm">
                  <Icon name="arrow-right" className="w-3.5 h-3.5 text-mute" strokeWidth={2.5} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-5 border-t border-border-faint space-y-3 text-xs text-dim leading-relaxed">
        <div className="flex items-start gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
          <div>
            The <strong className="text-text">Source</strong> box is the only variable — three doors
            (conference badge scans · employee referrals · inbound CVs) hitting the same shared pipeline.
            Enrichment, gate, and scoring are identical across channels. That's the point of a
            channel-tuned but shared core: add a new channel = add an adapter, not a scoring model.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-stone-400 mt-1.5 flex-shrink-0" />
          <div>
            <strong className="text-text">At production scale, Enrich and Gate can swap.</strong>{" "}
            The current build enriches everyone then gates (75 rows, cheap either way). At{" "}
            thousands of contacts per year, gating first on cheap deterministic signals — then only
            paying Clay's per-record enrichment credits for admitted candidates — is the real cost win.
            One-line config change, same outputs.
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowBoxDetail({
  num, title, iconName, plain, detail, seeIt,
}: {
  num: number;
  title: string;
  iconName: React.ComponentProps<typeof Icon>["name"];
  plain: string;
  detail: string[];
  seeIt?: string;
}) {
  return (
    <div className="card p-5 flex gap-4">
      <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
        <Icon name={iconName} className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-mute font-semibold">Step {num}</span>
          <h3 className="text-lg font-semibold text-text">{title}</h3>
        </div>
        <p className="text-sm text-text mb-3 font-medium">{plain}</p>
        <ul className="space-y-1.5 text-sm text-mute leading-relaxed">
          {detail.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-faint mt-0.5">·</span>
              <span dangerouslySetInnerHTML={{ __html: renderInlineBold(d) }} />
            </li>
          ))}
        </ul>
        {seeIt && (
          <a href={seeIt} className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            See it running
            <Icon name="arrow-right" className="w-3.5 h-3.5" strokeWidth={2.25} />
          </a>
        )}
      </div>
    </div>
  );
}

function renderInlineBold(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong class=\"text-text font-semibold\">$1</strong>");
}

function StatBig({ n, label, sub }: { n: number | undefined; label: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-3xl font-bold text-text tabular font-mono">{n ?? "—"}</div>
      <div className="text-sm text-text font-medium mt-1">{label}</div>
      <div className="text-xs text-mute mt-0.5">{sub}</div>
    </div>
  );
}

function PersonaCard({ title, hint, href, children }: { title: string; hint: string; href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="card p-4 hover:border-accent transition-colors block">
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <div className="text-sm font-semibold text-text">{title}</div>
        <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold">{hint}</div>
      </div>
      <div className="text-xs text-mute leading-relaxed">{children}</div>
    </a>
  );
}

function ChannelWalkthrough({
  channel, tint, steps, takeaway,
}: {
  channel: string;
  tint: "sky" | "emerald" | "amber";
  steps: Array<{ title: string; body: string }>;
  takeaway: string;
}) {
  const chip = { sky: "bg-sky-100 text-sky-800", emerald: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800" }[tint];
  const bar  = { sky: "bg-sky-500",              emerald: "bg-emerald-500",                  amber: "bg-amber-500" }[tint];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`text-xs font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 ${chip}`}>{channel}</div>
      </div>
      <ol className="space-y-2 mb-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <div className={`w-5 h-5 rounded-full ${bar} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text">{s.title}</div>
              <div className="text-xs text-mute leading-relaxed">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="pt-3 border-t border-border-faint">
        <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-1">Takeaway</div>
        <div className="text-xs text-dim leading-relaxed">{takeaway}</div>
      </div>
    </div>
  );
}

function TryItCard({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a href={href} className="card p-4 hover:border-accent transition-colors flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
        <Icon name="play" className="w-4 h-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text">{label}</div>
        <div className="text-xs text-mute mt-0.5">{hint}</div>
      </div>
    </a>
  );
}

/* ============================================================================
 * Design-doc helpers (reused from the previous methodology page)
 * ============================================================================ */

function Section({ id, num, title, children }: { id: string; num: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-baseline gap-3 mb-4">
        <div className="font-mono text-xs text-faint tabular w-6">{String(num).padStart(2, "0")}</div>
        <h2 className="text-xl font-semibold text-text tracking-tight">{title}</h2>
      </div>
      <div className="text-sm text-dim leading-relaxed space-y-3 [&_code]:text-indigo-700 [&_code]:bg-indigo-50 [&_code]:font-mono [&_code]:text-[12px] [&_code]:px-1 [&_code]:rounded [&_strong]:text-text [&_strong]:font-semibold pl-9">
        {children}
      </div>
    </section>
  );
}

function Callout({ children, tint }: { children: React.ReactNode; tint: "indigo" | "amber" | "emerald" | "rose" }) {
  const cls = {
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-900",
    amber:   "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose:    "bg-rose-50 border-rose-200 text-rose-900",
  }[tint];
  return <div className={`rounded-lg border p-4 text-sm ${cls} my-4`}>{children}</div>;
}

function DecisionCard({ letter, tint, title, subtitle, bullets }: { letter: string; tint: "indigo" | "emerald"; title: string; subtitle: string; bullets: string[] }) {
  const gradient = tint === "indigo" ? "from-indigo-500 to-indigo-700" : "from-emerald-500 to-emerald-700";
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center flex-shrink-0`}>
          {letter}
        </div>
        <div className="pt-1">
          <div className="text-sm font-semibold text-text">{title}</div>
          <div className="text-xs text-mute mt-0.5">{subtitle}</div>
        </div>
      </div>
      <ul className="text-xs text-dim space-y-1.5">
        {bullets.map(b => (
          <li key={b} className="flex gap-2">
            <span className="text-faint mt-0.5">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalRow({ num, name, detail, example }: { num: number; name: string; detail: string; example: string }) {
  return (
    <div className="flex gap-3 card p-4">
      <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text">{name}</div>
        <div className="text-xs text-mute mt-1">{detail}</div>
        <div className="text-[11px] text-dim font-mono bg-slate-50 rounded px-2 py-1 mt-2 border border-border-faint">{example}</div>
      </div>
    </div>
  );
}

function GateResult({ n, label, tone }: { n: string; label: string; tone: "emerald" | "amber" | "rose" }) {
  const bg = { emerald: "bg-emerald-50 border-emerald-200 text-emerald-800", amber: "bg-amber-50 border-amber-200 text-amber-800", rose: "bg-rose-50 border-rose-200 text-rose-800" }[tone];
  return (
    <div className={`rounded-lg border ${bg} p-4 text-center`}>
      <div className="text-2xl font-bold leading-none">{n}</div>
      <div className="text-[11px] uppercase tracking-wider mt-2 font-medium">{label}</div>
    </div>
  );
}

function GateExample({ name, role, family, s1, s2, s3, verdict, verdictLabel, note }:
  { name: string; role: string; family: string; s1: boolean; s2: boolean; s3: boolean; verdict: "admit" | "reject"; verdictLabel: string; note: string }) {
  const cls = verdict === "admit" ? "border-emerald-200" : "border-rose-200";
  const ink = verdict === "admit" ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100";
  return (
    <div className={`rounded-lg border bg-white ${cls} p-4`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-text">{name}</div>
          <div className="text-xs text-mute">{role} · <code className="text-[11px]">{family}</code></div>
        </div>
        <div className="flex items-center gap-2">
          {[s1, s2, s3].map((ok, i) => (
            <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center ${ok ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
              <Icon name={ok ? "check" : "close"} className="w-3 h-3" strokeWidth={3} />
            </span>
          ))}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ink}`}>{verdictLabel}</span>
        </div>
      </div>
      <div className="text-xs text-mute mt-2.5">{note}</div>
    </div>
  );
}

function ScoreTable({ title, subtitle, tone, rows }: { title: string; subtitle: string; tone: "indigo" | "emerald"; rows: Array<[string, number, string]> }) {
  const dot = tone === "indigo" ? "bg-indigo-500" : "bg-emerald-500";
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          <div className="text-sm font-semibold text-text">{title}</div>
        </div>
        <div className="text-xs text-mute mt-0.5">{subtitle}</div>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([name, w, detail], i) => (
            <tr key={name} className={i > 0 ? "border-t border-border-faint" : ""}>
              <td className="px-4 py-2 font-medium text-text">{name}</td>
              <td className="px-4 py-2 text-right font-mono font-semibold text-indigo-700 tabular w-12">{w}</td>
              <td className="px-4 py-2 text-mute">{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestRow({ status = "pass", name, detail }: { status?: "pass" | "manual" | "missing"; name: string; detail: string }) {
  const style = {
    pass:    { bg: "bg-emerald-100 text-emerald-600", icon: "check" as const, label: "PASS" },
    manual:  { bg: "bg-indigo-100 text-indigo-600",   icon: "check" as const, label: "MANUAL" },
    missing: { bg: "bg-slate-100 text-slate-400",     icon: "minus" as const, label: "TODO" },
  }[status];
  return (
    <div className="flex gap-3 card p-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
        <Icon name={style.icon} className="w-3.5 h-3.5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-medium text-text">{name}</div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-mute">{style.label}</span>
        </div>
        <div className="text-xs text-mute mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function Tradeoff({ title, choice, why }: { title: string; choice: string; why: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1.5">
        <div className="text-sm font-semibold text-text">{title}</div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          {choice}
        </span>
      </div>
      <div className="text-sm text-mute leading-relaxed">{why}</div>
    </div>
  );
}

const TAX_BLOCKS = [
  { title: "Role families",     description: "Title-pattern → family. Ordered so 'Video AI Engineer' hits ml_cv before ml_general.", example: "ml_cv · ml_general · data_engineering · platform_devops · video_broadcast · sales_engineering · not_talent" },
  { title: "Family evidence",   description: "Skills that confirm the claimed family. Gate signal 2 needs at least one hit.",       example: "ml_cv: computer vision · pytorch · yolo · deep learning · sports tracking" },
  { title: "Skill synonyms",    description: "Exact + family aliases. Exact match earns 1.0, family match earns 0.6.",              example: "PyTorch → exact: pytorch · family: tensorflow, keras, deep learning" },
  { title: "Domain lexicon",    description: "Keywords + known companies. Compound tokens for 'media' to avoid false positives.",   example: "sports · broadcast · streaming · cdn · Opta · Sportradar · KINEXON · DAZN" },
  { title: "Employer stoplist", description: "Exact case-insensitive match on employer strings. Filters ~40 false passive warm paths. Active vouches through /referrals are unaffected.", example: "freelance · startup · university · public sector · hospital group · IDF · IDF tech unit · IDF Intelligence Unit" },
  { title: "Company aliases",   description: "Cluster different names for the same organisation. Enables real overlaps to surface. IDF variants are deliberately NOT clustered — they're stoplisted instead.", example: "Opta ~ Opta Sports ~ Stats Perform · Akamai ~ Akamai Technologies ~ Akamai Media" },
];

const SHIPPED: Array<[string, "Done" | "Exceeded" | "Partial" | "Not shipped", string]> = [
  ["Working pipeline with --job-id input",       "Done",     "run.py"],
  ["Output CSV for JOB001 committed",            "Exceeded", "JOB001–004 + excluded + pool CSVs"],
  ["Design document",                            "Done",     "README + docs/ + this page"],
  ["7 assumptions positioned with reasoning",    "Done",     "README + docs/05"],
  ["Executive summary for non-technical HR",     "Done",     "README + TL;DR tab"],
  ["Recruiter view (bonus)",                     "Exceeded", "Full Next.js app · 12+ routes"],
  ["Two decisions, never one function",          "Done",     "src/gate.py + src/score.py"],
  ["Two scores (fit never touches network)",     "Done",     "src/score.py / src/signal.py"],
  ["Transparent — every weight in YAML",         "Done",     "config/scoring.yaml + taxonomy.yaml"],
  ["No LLM decides",                             "Done",     "mock_narrator is deterministic templates"],
  ["Every exclusion has a reason string",        "Done",     "JOB001_excluded.csv + gate.reason"],
  ["No hardcoded candidate names in src/",       "Done",     "verified via grep"],
  ["Runs offline on fresh clone",                "Done",     "no env vars, no network, no keys"],
  ["Python owns matching; JS does weighted sum", "Done",     "lib/scoring.ts + parity test"],
  ["Mock integration adapters",                  "Done",     "src/integrations/ · 7 systems"],
  ["Multi-channel architecture",                 "Done",     "source_channel first-class on every row"],
  ["Conference channel end-to-end",              "Done",     "/capture · live enrichment reveal"],
  ["Referral channel with vouched lift",         "Done",     "/referrals · +15 signal on target role"],
  ["Reverse-referral (system → employee)",       "Done",     "/intros"],
  ["Recruiter-first UI · jobs as landing",       "Done",     "/ → open positions grid"],
  ["Human-in-the-loop overrides",                "Done",     "per-role override + global blacklist + notes"],
  ["Queryable database (BigQuery mock)",         "Done",     "src/integrations/mock_bigquery.py"],
  ["BI dashboard with KPIs",                     "Done",     "/analytics · 4 tabs"],
  ["Business-level integrations view",           "Done",     "/integrations"],
  ["Enrichment as a visible flow",               "Done",     "shared EnrichmentReveal on capture + referral"],
  ["Inbound (Comeet application) channel",       "Partial",  "status stub for dedupe; capture path designed"],
  ["Sourced (outbound research) channel",        "Not shipped", "documented in docs/06"],
  ["Live-narrator flag",                         "Not shipped", "swap surface documented in /integrations"],
];
