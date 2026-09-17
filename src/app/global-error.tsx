"use client";

/**
 * Last-resort boundary: catches failures in the root layout itself, which
 * `error.tsx` cannot reach. It replaces the whole document, so it must render
 * its own <html>/<body> and cannot rely on global styles being present.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e8eeff",
          color: "#0b1440",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <title>Er ging iets mis</title>
        <div style={{ maxWidth: "28rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#1e5bff",
            }}
          >
            Fout
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            De site kon niet worden geladen
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "#5b6478",
            }}
          >
            Probeer het over een moment opnieuw.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: "1.75rem",
              border: 0,
              borderRadius: "0.5rem",
              background: "#0b1440",
              color: "#fff",
              padding: "0.65rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Probeer opnieuw
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "2rem",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.75rem",
                color: "#5b6478",
              }}
            >
              Referentie: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
