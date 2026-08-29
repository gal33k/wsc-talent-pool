"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { usePool } from "@/lib/data";

const LINKS = [
  { href: "/",              label: "Open positions", icon: "briefcase" as const, section: "recruit" },
  { href: "/pool/",         label: "Talent pool",    icon: "users" as const,     section: "recruit" },
  { href: "/capture/",      label: "Capture lead",   icon: "plus" as const,      section: "recruit" },
  { href: "/referrals/",    label: "Refer",          icon: "message" as const,   section: "recruit" },
  { href: "/intros/",       label: "Introductions",  icon: "link" as const,      section: "recruit" },
  { href: "/analytics/",    label: "Analytics",      icon: "gauge" as const,     section: "system" },
  { href: "/integrations/", label: "Integrations",   icon: "terminal" as const,  section: "system" },
  { href: "/methodology/",  label: "How it works",   icon: "book" as const,      section: "system" },
];

export default function Sidebar() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  const { pool } = usePool();

  return (
    <aside className="w-[240px] sidebar-surface sidebar-border border-r flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Brand */}
      <Link href="/" className="block px-5 pt-5 pb-6 group" aria-label="WSC Talent Intelligence · Home">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-md bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 flex items-center justify-center text-white text-[11px] font-bold tracking-tight shadow-md ring-1 ring-emerald-900/60">
            <span className="relative z-10">WSC</span>
            <div className="absolute inset-0 rounded-md bg-gradient-to-tr from-white/0 via-white/10 to-white/25 pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-serif italic sidebar-ink leading-tight truncate group-hover:text-emerald-300 transition-colors">
              Talent Intelligence
            </div>
            <div className="text-[10px] sidebar-faint uppercase tracking-wider font-medium mt-0.5">
              WSC Sports · Take-home 2026
            </div>
          </div>
        </div>
      </Link>

      <nav className="flex-1 px-2.5 overflow-y-auto">
        <NavGroup label="Recruit" links={LINKS.filter(l => l.section === "recruit")} norm={norm} />
        <NavGroup label="System"  links={LINKS.filter(l => l.section === "system")}  norm={norm} />
      </nav>

      {/* Status footer */}
      <div className="px-5 pb-5 pt-4 border-t sidebar-border">
        {pool ? (
          <div className="rounded-md bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="text-[10px] uppercase tracking-wider sidebar-faint font-medium mb-1">Pipeline</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold sidebar-ink tabular">{pool.candidates.length}</span>
              <span className="text-xs sidebar-dim">contacts</span>
            </div>
            <div className="text-[10px] sidebar-faint mt-1.5 font-mono truncate">{pool.config_version}</div>
          </div>
        ) : (
          <div className="text-[11px] sidebar-faint">Loading…</div>
        )}
      </div>
    </aside>
  );
}

function NavGroup({ label, links, norm }: {
  label: string;
  links: Array<{ href: string; label: string; icon: React.ComponentProps<typeof Icon>["name"] }>;
  norm: string;
}) {
  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-wider sidebar-faint font-medium px-3 mb-1.5">
        {label}
      </div>
      <div className="space-y-0.5">
        {links.map(l => {
          const active = l.href === "/" ? norm === "/" : norm.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-colors ${
                active
                  ? "bg-[var(--sidebar-active)] text-emerald-300 font-medium border-l-2 border-emerald-600 -ml-[2px] pl-[calc(0.75rem+2px)]"
                  : "sidebar-dim sidebar-hover"
              }`}
            >
              <Icon name={l.icon} className="w-4 h-4" strokeWidth={active ? 2 : 1.75} />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
