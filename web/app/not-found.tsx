import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="font-serif text-8xl text-accent leading-none tabular">404</div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-faint font-mono mt-3">Not found</div>
        <div className="font-serif text-2xl text-text mt-2">This page does not exist.</div>
        <Link href="/"
          className="inline-block mt-6 border border-border hover:border-accent text-text px-4 py-2 text-xs uppercase tracking-wider font-mono transition">
          Back to shortlist
        </Link>
      </div>
    </div>
  );
}
