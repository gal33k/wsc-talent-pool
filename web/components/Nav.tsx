"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shortlist" },
  { href: "/pool/", label: "Talent pool" },
  { href: "/intros/", label: "Who can introduce us" },
  { href: "/integrations/", label: "Integrations" },
];

export default function Nav() {
  const path = usePathname() || "/";
  const norm = path.endsWith("/") ? path : path + "/";
  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center gap-6 text-sm">
      <div className="font-semibold text-base">WSC · Talent Pool</div>
      <div className="flex gap-4">
        {LINKS.map(l => {
          const active = l.href === "/" ? norm === "/" : norm.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                "px-2 py-1 rounded transition " +
                (active ? "bg-white/15 text-white" : "text-slate-300 hover:text-white")
              }
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
