"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePool, type IntroRequest, type IntroStatus } from "@/lib/data";
import Avatar from "@/components/Avatar";
import StatsBar from "@/components/StatsBar";
import { Icon } from "@/components/Icon";

const STATUS_ORDER: IntroStatus[] = ["queued", "sent", "accepted", "declined"];

const STATUS_META: Record<IntroStatus, { label: string; tint: string; chipCls: string; hint: string }> = {
  queued:   { label: "Queued",   tint: "amber",   chipCls: "bg-amber-100 text-amber-800",       hint: "Ready to send — recruiter action pending" },
  sent:     { label: "Sent",     tint: "indigo",  chipCls: "bg-indigo-100 text-indigo-700",     hint: "Slack DM delivered · waiting for the employee to reply" },
  accepted: { label: "Accepted", tint: "emerald", chipCls: "bg-emerald-600 text-white",         hint: "Employee will make the intro" },
  declined: { label: "Declined", tint: "rose",    chipCls: "bg-rose-100 text-rose-700",         hint: "Employee said no — candidate stays in the pool" },
};

export default function Intros() {
  const { pool, loading, error, introRequests, updateIntroStatus, cancelIntroRequest } = usePool();

  const grouped = useMemo(() => {
    const g: Record<IntroStatus, IntroRequest[]> = { queued: [], sent: [], accepted: [], declined: [] };
    introRequests.forEach(r => g[r.status].push(r));
    return g;
  }, [introRequests]);

  if (loading) return <main className="p-6 md:p-8 text-mute text-sm">Loading…</main>;
  if (error) return <main className="p-6 md:p-8 text-red-600 text-sm">Error: {error}</main>;
  if (!pool) return <main className="p-6 md:p-8">No data.</main>;

  const totalActive = grouped.queued.length + grouped.sent.length;
  const totalAccepted = grouped.accepted.length;
  const responseRate = introRequests.length > 0
    ? Math.round(((grouped.accepted.length + grouped.declined.length) / introRequests.length) * 100)
    : 0;

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <div className="text-xs font-medium text-mute mb-1">Outreach queue · intros you've asked for</div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Introductions</h1>
        <p className="text-sm text-mute mt-1 max-w-2xl">
          Every &ldquo;Ask X to intro&rdquo; you fire from a job shortlist lands here.
          Track who's been asked, who's replied, and who's ready to make the intro.
        </p>
      </header>

      <StatsBar stats={[
        { label: "In flight",     value: totalActive,        sub: "queued + sent",             iconName: "message" },
        { label: "Accepted",      value: totalAccepted,      sub: "employee will intro",       iconName: "check", accent: true },
        { label: "Total asked",   value: introRequests.length, sub: "this session",            iconName: "users" },
        { label: "Response rate", value: `${responseRate}%`, sub: "of asks got a reply",       iconName: "gauge" },
      ]} />

      {introRequests.length === 0 ? <EmptyState pool={pool} /> : (
        <div className="space-y-6">
          {STATUS_ORDER.map(status => {
            const requests = grouped[status];
            if (requests.length === 0) return null;
            const meta = STATUS_META[status];
            return (
              <section key={status}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                    {meta.label} <span className="text-mute font-mono ml-1">· {requests.length}</span>
                  </h2>
                  <div className="text-xs text-mute italic">{meta.hint}</div>
                </div>
                <div className="space-y-2">
                  {requests.map(r => (
                    <IntroRow
                      key={r.id}
                      request={r}
                      onMark={s => updateIntroStatus(r.id, s)}
                      onCancel={() => cancelIntroRequest(r.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {introRequests.length > 0 && (
        <div className="mt-8 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 flex items-start gap-3">
          <Icon name="info" className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
          <div className="text-sm text-indigo-900">
            <strong>Ask for more intros</strong> from any job shortlist — the button lives on the candidate card,
            next to the warm-intro path.
            <span className="ml-2 text-xs">
              {pool.jobs.map((j, i) => (
                <span key={j.job_id}>
                  {i > 0 && " · "}
                  <Link href={`/jobs/${j.job_id}/`} className="underline hover:no-underline">{j.job_id}</Link>
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState({ pool }: { pool: NonNullable<ReturnType<typeof usePool>["pool"]> }) {
  return (
    <div className="card p-10 text-center border-dashed">
      <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
        <Icon name="message" className="w-6 h-6" strokeWidth={2} />
      </div>
      <h2 className="text-lg font-semibold text-text mb-2">No intro requests yet</h2>
      <p className="text-sm text-mute max-w-md mx-auto mb-6">
        The recruiter workflow starts on a job. Open a shortlist, find a candidate worth chasing,
        and hit <strong className="text-text">&ldquo;Ask X to intro&rdquo;</strong> on their card.
        Every ask lands here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl mx-auto">
        {pool.jobs.map(j => (
          <Link
            key={j.job_id}
            href={`/jobs/${j.job_id}/`}
            className="card card-interactive p-3 text-left flex items-center justify-between hover:border-accent"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">{j.title}</div>
              <div className="text-xs text-mute">{j.job_id} · {j.department}</div>
            </div>
            <Icon name="arrow-right" className="w-4 h-4 text-mute flex-shrink-0" strokeWidth={2} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function IntroRow({
  request, onMark, onCancel,
}: {
  request: IntroRequest;
  onMark: (s: IntroStatus) => void;
  onCancel: () => void;
}) {
  const meta = STATUS_META[request.status];
  return (
    <div className="card p-4 flex items-center gap-4">
      {/* candidate */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar name={request.candidateName} size="sm" />
        <div className="min-w-0">
          <div className="text-sm text-text font-semibold truncate">{request.candidateName}</div>
          <div className="text-[11px] text-mute">candidate</div>
        </div>
      </div>

      <Icon name="arrow-right" className="w-4 h-4 text-faint flex-shrink-0" strokeWidth={2} />

      {/* employee being asked */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar name={request.employeeName} size="sm" />
        <div className="min-w-0">
          <div className="text-sm text-text font-semibold truncate">{request.employeeName}</div>
          <div className="text-[11px] text-mute truncate">{request.path}</div>
        </div>
      </div>

      {/* target job */}
      <div className="hidden md:block flex-shrink-0 border-l border-border-faint pl-4">
        <div className="text-[10px] uppercase tracking-wider text-mute font-semibold">for</div>
        <Link
          href={`/jobs/${request.jobId}/`}
          className="text-xs font-mono font-semibold text-indigo-700 hover:underline"
          title={request.jobTitle}
        >
          {request.jobId}
        </Link>
        <div className="text-[11px] text-mute truncate max-w-[140px]">{request.jobTitle}</div>
      </div>

      {/* status */}
      <span className={`text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-1 whitespace-nowrap ${meta.chipCls} flex-shrink-0`}>
        {meta.label}
      </span>

      {/* actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {request.status === "queued" && (
          <button
            onClick={() => onMark("sent")}
            className="text-[11px] font-medium px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            title="Simulate: Slack DM sent to the employee"
          >
            Mark sent
          </button>
        )}
        {request.status === "sent" && (
          <>
            <button
              onClick={() => onMark("accepted")}
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              title="Simulate: employee replied yes"
            >
              Accepted
            </button>
            <button
              onClick={() => onMark("declined")}
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              title="Simulate: employee replied no"
            >
              Declined
            </button>
          </>
        )}
        <button
          onClick={onCancel}
          aria-label="Remove this intro request"
          className="text-mute hover:text-rose-600 p-1"
          title="Remove from queue"
        >
          <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
