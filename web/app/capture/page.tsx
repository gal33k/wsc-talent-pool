"use client";

import { useState } from "react";
import { usePool } from "@/lib/data";
import { computeFit } from "@/lib/scoring";
import { Icon } from "@/components/Icon";
import StatsBar from "@/components/StatsBar";
import EnrichmentReveal, { type EnrichmentPlayback } from "@/components/EnrichmentReveal";

const CONFERENCES = [
  "SportsTech Innovation Summit",
  "Data & AI Summit Europe",
  "Broadcast & Streaming Technology Expo",
  "DevOps World 2025",
];

// Example badge-scan payloads — a mock OCR would return one of these from
// a real badge photo. Clearly labelled as examples in the UI; nothing here
// persists into the pool without the recruiter hitting "Enrich & score".
//
// The linkedinUrl points at a LinkedIn search URL (not a fake profile) so
// clicking it lands on a real, working page — the recruiter's actual next
// action for an unknown person from a badge is "search LinkedIn for them".
function _searchUrl(name: string, company: string): string {
  const q = encodeURIComponent(`${name} ${company}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
}
const BADGE_EXAMPLES = [
  { name: "Alex Chen",      title: "Senior ML Engineer",       company: "DAZN",                 note: "Video ML at broadcast latency; came by asking about real-time pose estimation." },
  { name: "Priya Sharma",   title: "Backend Engineer",         company: "Netflix",              note: "Owns streaming-service backend; interested in our Kafka footprint." },
  { name: "Marco Rossi",    title: "Video AI Engineer",        company: "Sky Sports",           note: "Sports broadcast production; wants to compare our object-detection stack." },
  { name: "Sofia Nakamura", title: "Sports Data Analyst",      company: "Opta / Stats Perform", note: "Sports analytics; asked about our data pipeline architecture." },
].map(e => ({ ...e, linkedinUrl: _searchUrl(e.name, e.company) }));

export default function CaptureLead() {
  const { pool, loading, error, fitWeights, logBq } = usePool();
  const [name, setName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [conference, setConference] = useState(CONFERENCES[0]);
  const [notes, setNotes] = useState("");
  const [playback, setPlayback] = useState<EnrichmentPlayback | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [recentCaptures, setRecentCaptures] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedFilename, setScannedFilename] = useState<string | null>(null);

  const runBadgeScan = (filename: string | null) => {
    setScanning(true);
    setScannedFilename(filename);
    // Pick an example rotating so repeated scans surface different personas.
    // In production this is the mock_badge_scan → OCR → fields extraction path.
    const pick = BADGE_EXAMPLES[Math.floor(Math.random() * BADGE_EXAMPLES.length)];
    logBq({
      op: "INSERT",
      table: "wsc.telemetry.badge_scan_events",
      sql: `INSERT INTO wsc.telemetry.badge_scan_events\n  (source, filename, extracted_name, extracted_company, extracted_title, scanned_at)\nVALUES ('cvent', ${JSON.stringify(filename ?? "example-badge")}, ${JSON.stringify(pick.name)}, ${JSON.stringify(pick.company)}, ${JSON.stringify(pick.title)}, CURRENT_TIMESTAMP())`,
      rows: 1,
    });
    setTimeout(() => {
      setName(pick.name);
      setTitle(pick.title);
      setCompany(pick.company);
      setLinkedinUrl(pick.linkedinUrl);
      setNotes(pick.note);
      setScanning(false);
    }, 900);
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runBadgeScan(file.name);
    // Reset the input so picking the same file again re-triggers.
    e.target.value = "";
  };

  if (loading) return <main className="p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-8">No data.</main>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!name.trim()) { setValidationError("The candidate needs a name — that's the minimum."); return; }
    if (!title.trim()) { setValidationError("Enter their title. The gate uses it to classify role family."); return; }

    // Fabricate a plausible enrichment result. In production this is the actual
    // pipeline (mock_badge_scan -> mock_enrichment -> normalise -> gate -> score).
    // Here we use a lightweight heuristic against the taxonomy so the playback
    // shows the same shape a real run would produce.

    const skills = extractLikelySkills(title, notes);
    const roleFamily = guessRoleFamily(title);
    const gateSignals = {
      role_family: roleFamily !== "not_talent" && roleFamily !== "unknown",
      skills_evidence: skills.length >= 3,
      proximity: /sports|broadcast|streaming|video|media|cdn/i.test(
        `${company} ${title} ${notes} ${conference}`.toLowerCase()
      ),
    };
    const signalCount = Object.values(gateSignals).filter(Boolean).length;
    const gateDecision: "ADMIT" | "HOLD" | "REJECT" =
      signalCount >= 2 ? "ADMIT" : signalCount === 1 ? "HOLD" : "REJECT";
    const gateReason = `${signalCount}/3 signals: family=${roleFamily}; skills=${gateSignals.skills_evidence ? "y" : "n"}; proximity=${gateSignals.proximity ? "y" : "n"}`;

    const jobs = pool.jobs.map(j => {
      const requiredCount = j.required_skills.length;
      const matched = j.required_skills.filter(rs => {
        const clean = rs.replace(/\*$/, "").toLowerCase();
        return skills.some(s => s.toLowerCase().includes(clean) || clean.includes(s.toLowerCase()));
      }).length;
      const familyMatch = j.job_id === "JOB001" && roleFamily === "ml_cv" ? 1.0
                       : j.job_id === "JOB002" && roleFamily === "backend" ? 1.0
                       : j.job_id === "JOB003" && roleFamily === "product" ? 1.0
                       : j.job_id === "JOB004" && roleFamily === "data_engineering" ? 1.0
                       : 0.4;
      const fitScore = Math.min(100,
        (matched / Math.max(1, requiredCount)) * 35 +
        familyMatch * 25 +
        15 +
        (gateSignals.proximity ? 15 : 5) +
        5
      );
      const tier: "call_this_week" | "direct_outreach" | "nurture" | "excluded" =
        gateDecision !== "ADMIT" ? "excluded"
      : fitScore >= 70 ? "direct_outreach"
      : fitScore >= 45 ? "nurture"
      : "excluded";
      return { jobId: j.job_id, jobTitle: j.title, matchedCount: matched, totalRequired: requiredCount, fitScore: Math.round(fitScore * 10) / 10, tier };
    });

    const pb: EnrichmentPlayback = {
      candidateName: name.trim(),
      linkedinUrl: linkedinUrl.trim(),
      discoveredSkills: skills,
      roleFamily,
      gateSignals,
      gateDecision,
      gateReason,
      jobs,
      channel: "conference",
    };
    setPlayback(pb);

    // Log the mock adapter calls into the client-side BigQuery activity so the
    // /analytics page sees them and /integrations shows the technical trace.
    logBq({
      op: "INSERT",
      table: "wsc.talent_pool.contacts",
      sql: `INSERT INTO wsc.talent_pool.contacts (source_channel, full_name, role_family, gate_decision, top_fit_job, top_fit_score)\nVALUES ('conference', '${name.trim()}', '${roleFamily}', '${gateDecision}', '${jobs.sort((a, b) => b.fitScore - a.fitScore)[0].jobId}', ${jobs[0].fitScore})`,
      rows: 1,
    });

    setRecentCaptures(prev => [`${name.trim()} · ${title.trim()}`, ...prev].slice(0, 6));
  };

  const resetForm = () => {
    setPlayback(null);
    setName(""); setLinkedinUrl(""); setCompany(""); setTitle(""); setNotes("");
    setValidationError(null);
  };

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">Conference capture · new lead</div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Just met someone worth remembering?</h1>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Add them to the pool now. The system enriches their profile, runs the admission gate, and
          scores them against every open role — you&rsquo;ll see exactly what happens.
        </p>
      </header>

      <StatsBar stats={[
        { label: "In the pool",         value: pool.candidates.length, sub: "grows with every capture", iconName: "users" },
        { label: "Captured this session", value: recentCaptures.length, sub: "mock — not persisted", iconName: "plus", accent: true },
        { label: "Enrichment credits",  value: `${pool.call_log.filter(c => c.system === "enrichment").length}/500`, sub: "per Clay budget", iconName: "database" },
        { label: "Open roles",          value: pool.jobs.length,       sub: "scored against each capture", iconName: "briefcase" },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="min-w-0">
          {!playback ? (
            <>
              {/* Badge scan — the primary way conference contacts actually
                  enter the pipeline in production. Recruiter uploads/snaps
                  a badge photo, OCR extracts the fields, they land in the
                  form below for review before submit. */}
              <section className="card p-5 mb-4 border-dashed border-2 border-emerald-200 bg-emerald-50/30">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <Icon name={scanning ? "search" : "download"} className={`w-5 h-5 ${scanning ? "animate-pulse" : ""}`} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-text">Scan a badge</h3>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold">
                        primary production path
                      </span>
                    </div>
                    <p className="text-xs text-mute leading-relaxed mb-3">
                      In production, badge scans arrive as a bulk export from Cvent / Swapcard / Brella after the event.
                      In this demo, upload any image OR try an example — OCR extracts name, title, company, and prefills
                      the form below. Review and edit before hitting <em>Enrich &amp; score</em>.
                    </p>

                    {scanning ? (
                      <div className="rounded-md bg-white border border-emerald-200 px-4 py-3 flex items-center gap-3">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <div className="text-xs text-emerald-900">
                          Reading badge{scannedFilename ? ` (${scannedFilename})` : ""} — running OCR + field extraction…
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md hover:bg-emerald-600 cursor-pointer shadow-sm">
                          <Icon name="plus" className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Upload badge image
                          <input type="file" accept="image/*" onChange={onFilePicked} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={() => runBadgeScan(null)}
                          className="inline-flex items-center gap-1.5 text-xs bg-white text-emerald-800 border border-emerald-300 font-medium px-3 py-1.5 rounded-md hover:bg-emerald-50 hover:border-emerald-500"
                        >
                          <Icon name="sparkles" className="w-3.5 h-3.5" strokeWidth={2.25} />
                          Try example badge scan
                        </button>
                        <div className="text-[11px] text-mute self-center italic">
                          OCR is mocked · real system: POST /cvent/events/{"{id}"}/attendees
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cap-name" className="block text-sm font-medium text-text mb-1.5">
                    Full name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="cap-name" name="name" type="text" value={name} onChange={e => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                    placeholder="e.g. Nadia Cohen"
                  />
                </div>
                <div>
                  <label htmlFor="cap-title" className="block text-sm font-medium text-text mb-1.5">
                    Title <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="cap-title" name="title" type="text" value={title} onChange={e => setTitle(e.target.value)}
                    autoComplete="organization-title"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                    placeholder="e.g. Senior ML Engineer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cap-company" className="block text-sm font-medium text-text mb-1.5">
                    Company <span className="text-mute text-xs font-normal">— optional</span>
                  </label>
                  <input
                    id="cap-company" name="company" type="text" value={company} onChange={e => setCompany(e.target.value)}
                    autoComplete="organization"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                    placeholder="e.g. Second Spectrum"
                  />
                </div>
                <div>
                  <label htmlFor="cap-linkedin" className="block text-sm font-medium text-text mb-1.5">
                    LinkedIn URL <span className="text-mute text-xs font-normal">— optional but helps enrichment</span>
                  </label>
                  <input
                    id="cap-linkedin" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                    spellCheck={false} autoComplete="off"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-mono focus:outline-none focus-visible:border-accent"
                    placeholder="linkedin.com/in/…"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cap-conf" className="block text-sm font-medium text-text mb-1.5">
                  Where did you meet them? <span className="text-red-600">*</span>
                </label>
                <select
                  id="cap-conf" name="conference"
                  value={conference} onChange={e => setConference(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                >
                  {CONFERENCES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="cap-notes" className="block text-sm font-medium text-text mb-1.5">
                  Booth conversation <span className="text-mute text-xs font-normal">— what did you talk about?</span>
                </label>
                <textarea
                  id="cap-notes" name="notes"
                  value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:border-accent"
                  placeholder="e.g. Spoke about real-time player tracking. Currently owns the CV pipeline at their shop."
                />
                <div className="text-xs text-mute mt-1.5">
                  A note is worth 10 points on the warmth axis — a recorded conversation is warmth signal.
                </div>
              </div>

              {validationError && (
                <div role="alert" aria-live="polite" className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
                  <Icon name="alert" className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  {validationError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-xs text-mute">
                  The pipeline runs live — you&rsquo;ll see each stage.
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm"
                >
                  <Icon name="sparkles" className="w-4 h-4" strokeWidth={2} />
                  Enrich &amp; score
                </button>
              </div>
            </form>
            </>
          ) : (
            <EnrichmentReveal playback={playback} onDone={resetForm} />
          )}
        </div>

        <aside>
          <div className="card p-5 sticky top-4">
            <div className="text-xs uppercase tracking-wider text-mute font-medium mb-3">Recent captures</div>
            {recentCaptures.length === 0 ? (
              <div className="text-sm text-mute italic">Nothing yet this session.</div>
            ) : (
              <ul className="space-y-2">
                {recentCaptures.map((c, i) => (
                  <li key={i} className="text-sm text-text flex items-start gap-2">
                    <Icon name="check" className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="truncate">{c}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 pt-4 border-t border-border text-xs text-mute space-y-1.5 leading-relaxed">
              <div className="font-medium text-dim">What happens under the hood</div>
              <div>· <code className="text-[11px]">mock_badge_scan</code> ingests the row</div>
              <div>· <code className="text-[11px]">mock_enrichment</code> pulls LinkedIn (cached, credited)</div>
              <div>· <code className="text-[11px]">gate.py</code> runs the 3 signals</div>
              <div>· <code className="text-[11px]">score.py</code> ranks against all 4 open positions</div>
              <div>· <code className="text-[11px]">mock_hubspot</code> writes the pool properties</div>
              <div>· <code className="text-[11px]">mock_bigquery</code> logs the pipeline event</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* -------- Lightweight heuristic mirrors of the Python pipeline -------- */

function extractLikelySkills(title: string, notes: string): string[] {
  const text = `${title} ${notes}`.toLowerCase();
  const skills = new Set<string>();
  const candidates: Record<string, string[]> = {
    Python: ["ml", "data", "engineer", "python"],
    PyTorch: ["ml engineer", "deep learning", "cv", "video ai", "pytorch"],
    TensorFlow: ["tensorflow"],
    "Computer Vision": ["computer vision", "cv engineer", "video ai", "vision"],
    "Object Detection": ["object detection", "yolo", "tracking", "highlight"],
    AWS: ["aws", "amazon"],
    Spark: ["spark", "databricks", "data engineer"],
    dbt: ["dbt", "analytics engineer"],
    Kubernetes: ["kubernetes", "k8s", "devops", "platform", "sre"],
    Terraform: ["terraform", "iac"],
    Kafka: ["kafka", "streaming", "real-time"],
    Airflow: ["airflow", "data engineer"],
    FFmpeg: ["ffmpeg", "video encoding", "broadcast"],
    "Live Streaming": ["streaming", "live", "cdn"],
    "Product Management": ["product manager", "product management"],
    "Sports Analytics": ["sports", "analytics"],
  };
  for (const [skill, hints] of Object.entries(candidates)) {
    if (hints.some(h => text.includes(h))) skills.add(skill);
  }
  return Array.from(skills);
}

function guessRoleFamily(title: string): string {
  const t = title.toLowerCase();
  if (/computer vision|cv engineer|video ai|ml engineer.*video|vision engineer/.test(t)) return "ml_cv";
  if (/ml engineer|ml research|machine learning|data scientist|ai engineer/.test(t)) return "ml_general";
  if (/data engineer|data platform|analytics engineer|head of data/.test(t)) return "data_engineering";
  if (/solutions architect|sales engineer|customer engineer/.test(t)) return "sales_engineering";
  if (/broadcast|video engineer|video systems|streaming engineer|media delivery/.test(t)) return "video_broadcast";
  if (/devops|sre|platform engineer|infrastructure|cloud engineer/.test(t)) return "platform_devops";
  if (/backend|software engineer|software developer/.test(t)) return "backend";
  if (/product manager|head of product/.test(t)) return "product";
  if (/it manager|it support|it engineer|marketing manager|network engineer/.test(t)) return "not_talent";
  return "unknown";
}
