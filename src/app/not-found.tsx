import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Page not found — ${SITE.name}`,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-20 text-center">
      <p className="font-mono text-sm font-medium text-accent">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        That page doesn&apos;t exist
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The link may be out of date, or the address mistyped. Nothing is broken
        on our end.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Browse packages
        </Link>
        <Link
          href="/transactions"
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Find my request
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted">
        Looking for something specific? Email{" "}
        <a
          href={`mailto:${SITE.businessEmail}`}
          className="font-medium text-accent hover:underline"
        >
          {SITE.businessEmail}
        </a>
      </p>
    </div>
  );
}
