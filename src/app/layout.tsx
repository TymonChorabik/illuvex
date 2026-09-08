import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { ChatWidget } from "@/components/chat-widget";
import { SITE } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.blurb,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="site-footer border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 text-xs text-muted">
            <span>
              &copy; {new Date().getFullYear()} {SITE.name}
            </span>
            <a
              href={`mailto:${SITE.businessEmail}`}
              className="hover:text-ink hover:underline"
            >
              {SITE.businessEmail}
            </a>
            {SITE.phone && <span>{SITE.phone}</span>}
            {SITE.location && <span>{SITE.location}</span>}
            <span className="ml-auto">
              Prices are estimates — final quotes are confirmed by email.
            </span>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
