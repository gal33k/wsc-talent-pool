"use client";

import { Icon } from "./Icon";

export default function Banner() {
  return (
    <div className="bg-[var(--warn-soft)] border-b border-[#f6d99a] text-[#7c4a0a] px-6 py-1.5 text-xs flex items-center gap-2">
      <Icon name="alert" className="w-3.5 h-3.5" strokeWidth={2.25} />
      <span><span className="font-semibold">Synthetic data.</span> Recruitment take-home exercise — no real candidate profiles.</span>
    </div>
  );
}
