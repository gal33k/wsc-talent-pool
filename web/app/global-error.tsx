"use client";

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{
        fontFamily: "system-ui, sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", margin: 0, background: "#0b0b0e", color: "#efece5",
      }}>
        <div style={{
          maxWidth: 420, background: "#131319", border: "1px solid #33333e",
          padding: 24,
        }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>Application error</div>
          <div style={{ fontSize: 12, color: "#a4a09a", marginTop: 8, fontFamily: "monospace" }}>
            {error.message || "unknown error"}
          </div>
          <button onClick={reset} style={{
            marginTop: 16, background: "transparent", color: "#efece5",
            border: "1px solid #33333e", padding: "8px 16px", cursor: "pointer",
            fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 11,
          }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
