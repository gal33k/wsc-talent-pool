"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  { href: "/taxonomy/",     label: "Taxonomy",       icon: "sliders" as const,   section: "system" },
  { href: "/methodology/",  label: "How it works",   icon: "book" as const,      section: "system" },
];

export default function Sidebar() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  const { pool } = usePool();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeLabel = LINKS.find(l =>
    l.href === "/" ? norm === "/" : norm.startsWith(l.href)
  )?.label ?? "Talent Intelligence";

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [path]);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // Lock scroll while drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <>
      {/* Mobile top bar — only visible below md. Sticks to top of viewport. */}
      <header className="md:hidden sticky top-0 z-40 sidebar-surface sidebar-border border-b h-14 px-4 flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="w-9 h-9 rounded-md flex items-center justify-center sidebar-ink sidebar-hover"
        >
          <Icon name="menu" className="w-5 h-5" strokeWidth={2} />
        </button>
        <Link href="/" className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 flex items-center justify-center text-white text-[10px] font-bold ring-1 ring-emerald-900/60 flex-shrink-0">
            WSC
          </div>
          <div className="min-w-0">
            <div className="text-xs font-serif italic sidebar-ink leading-tight truncate">
              {activeLabel}
            </div>
            <div className="text-[9px] sidebar-faint uppercase tracking-wider font-medium">
              Talent Intelligence
            </div>
          </div>
        </Link>
        {pool && (
          <div className="text-[10px] sidebar-faint tabular flex-shrink-0">
            <span className="sidebar-ink font-semibold">{pool.candidates.length}</span> contacts
          </div>
        )}
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm fade-in"
          role="presentation"
        >
          <aside
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Navigation menu"
            className="w-[280px] max-w-[85vw] h-full sidebar-surface sidebar-border border-r flex flex-col fade-up"
          >
            <SidebarInner
              norm={norm}
              pool={pool}
              onNavigate={() => setDrawerOpen(false)}
              showClose
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile. */}
      <aside className="hidden md:flex w-[240px] sidebar-surface sidebar-border border-r flex-col h-screen sticky top-0 flex-shrink-0">
        <SidebarInner norm={norm} pool={pool} />
      </aside>
    </>
  );
}

function SidebarInner({
  norm, pool, onNavigate, showClose, onClose,
}: {
  norm: string;
  pool: ReturnType<typeof usePool>["pool"];
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-6">
        <Link href="/" onClick={onNavigate} className="block group flex-1 min-w-0" aria-label="WSC Talent Intelligence · Home">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-md bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 flex items-center justify-center text-white text-[11px] font-bold tracking-tight shadow-md ring-1 ring-emerald-900/60 flex-shrink-0">
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
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-md flex items-center justify-center sidebar-ink sidebar-hover flex-shrink-0"
          >
            <Icon name="close" className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2.5 overflow-y-auto">
        <NavGroup label="Recruit" links={LINKS.filter(l => l.section === "recruit")} norm={norm} onNavigate={onNavigate} />
        <NavGroup label="System"  links={LINKS.filter(l => l.section === "system")}  norm={norm} onNavigate={onNavigate} />
      </nav>

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
    </>
  );
}

function NavGroup({ label, links, norm, onNavigate }: {
  label: string;
  links: Array<{ href: string; label: string; icon: React.ComponentProps<typeof Icon>["name"] }>;
  norm: string;
  onNavigate?: () => void;
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
              onClick={onNavigate}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13.5px] transition-colors ${
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
