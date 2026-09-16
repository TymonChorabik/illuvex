"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Requests" },
  { href: "/admin/quotes", label: "Offertes" },
  { href: "/admin/invoices", label: "Facturen" },
  { href: "/admin/clients", label: "Clients" },
] as const;

/**
 * One consistent section switcher for every admin page. Each page used to
 * grow its own ad-hoc row of links to *some* of the other sections (never
 * all of them, never showing which one you were on) — this replaces every
 * one of those. Sign out lives here too, so it works the same everywhere
 * instead of only existing on /admin.
 */
export function AdminNav() {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    // A full reload, not router.push: every admin page holds its own local
    // "am I authed" state from a client-side fetch on mount, so a soft
    // navigation to a route already mounted (e.g. signing out from
    // /admin itself) would leave stale data on screen. This guarantees a
    // fresh mount everywhere, at the cost of the lint hint below.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin";
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-subtle hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
