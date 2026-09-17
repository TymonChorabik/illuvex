import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pagina niet gevonden — ${SITE.name}`,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-20 text-center">
      <p className="font-mono text-sm font-medium text-accent">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Die pagina bestaat niet
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        De link kan verouderd zijn, of het adres is verkeerd getypt. Er is
        niets kapot aan onze kant.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Offerte aanvragen
        </Link>
        <Link
          href="/transactions"
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-subtle"
        >
          Mijn aanvraag opzoeken
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted">
        Op zoek naar iets specifieks? Mail{" "}
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
