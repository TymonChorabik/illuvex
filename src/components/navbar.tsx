"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/logo";
import { OPEN_CHAT_EVENT } from "@/components/chat-widget";

const LINKS = [
  { href: "/", label: "Packages" },
  { href: "/transactions", label: "Transactions" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label="Home">
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-subtle text-ink"
                    : "text-muted hover:bg-subtle hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {/* Opens the chat rather than a mailto: — plenty of people have no
              desktop mail client, and a dead link reads as a broken site. */}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT))
            }
            className="ml-2 hidden rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 sm:block"
          >
            Talk to us
          </button>
        </div>
      </nav>
    </header>
  );
}
