"use client";

import { useEffect } from "react";

export default function Error({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[app error]", error); }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-elevated border border-bad/40 p-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-bad font-mono mb-2">Error</div>
        <div className="font-serif text-2xl text-text leading-tight">Something went wrong</div>
        <div className="text-xs text-mute mt-2 font-mono break-all">{error.message || "unknown error"}</div>
        {error.digest && (
          <div className="text-[10px] text-faint mt-1 font-mono">digest: {error.digest}</div>
        )}
        <button onClick={reset}
          className="mt-4 border border-border hover:border-accent text-text px-4 py-2 text-xs uppercase tracking-wider font-mono transition">
          Try again
        </button>
      </div>
    </div>
  );
}
