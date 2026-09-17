"use client";

import { useEffect } from "react";
import { SITE } from "@/lib/site";

/**
 * Route-level error boundary. In production `error.message` from a Server
 * Component is deliberately generic — Next replaces it so server internals
 * never reach the browser. `error.digest` is the hash to grep for in the
 * server logs.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Replace with your error reporting service (Sentry et al) when you have one.
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-20 text-center">
      <p className="font-mono text-sm font-medium text-accent">Fout</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Er ging iets mis
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Dit ligt aan ons, niet aan jou. Probeer het opnieuw — blijft het
        gebeuren, stuur ons dan de referentie hieronder en we zoeken het uit.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Probeer opnieuw
        </button>
        <a
          href={`mailto:${SITE.businessEmail}?subject=Website fout${
            error.digest ? ` (ref ${error.digest})` : ""
          }`}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Meld het
        </a>
      </div>

      {error.digest && (
        <p className="mt-8 font-mono text-xs text-muted">
          Referentie: {error.digest}
        </p>
      )}
    </div>
  );
}
