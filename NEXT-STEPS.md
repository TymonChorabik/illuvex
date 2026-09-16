# What to do next

Written 8 September 2026, updated 16 September 2026. This is the honest state
of the project: what works, what is still a placeholder, and what to do in
what order.

For how to run it, see [README.md](README.md).

---

## 1. Things only you can do

These are blocked on accounts or decisions, not on code.

### Get the two API keys (~10 minutes)

Two features are built and tested but inert without keys. Both fail gracefully
— nothing crashes, they just tell you they are not configured.

| Key | Where | What it turns on |
| --- | --- | --- |
| `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) | Confirmation emails, quote links, portal invites |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) | The chat assistant on the public site |

Put them in `.env.local` and restart. Note that Resend's default sender only
delivers to the address that owns the Resend account until you verify a domain
— so test with your own address first.

### Decide the fate of the ticket tables

The built-in ticket system (admin queue, portal ticket list) has been removed
— you're integrating a separately-built one instead. The `Ticket` and
`TicketMessage` tables are still in `prisma/schema.prisma` and the database,
untouched but unused, in case that integration wants to reuse them. Say the
word if you'd rather have them dropped with a migration.

### Replace the placeholder content

- **Packages and prices** in `src/lib/offers.ts` are invented. The public
  homepage no longer shows them as cards (resolved: it's quote-only now,
  per "cards under filter not needed"), but the catalogue still backs the
  chat assistant's pricing knowledge and the admin quote-line suggestions.
- **Contact and legal details** in `src/lib/site.ts` are deliberately fake —
  business name/email/phone/address, plus KVK number, BTW number, bank
  account and BIC, all of which now print on every quote and invoice. The
  `.example` domain can never be registered, so nothing can accidentally
  reach a real inbox.
- **The logo** in `src/components/logo.tsx` is a placeholder geometric mark.
  That file has a comment showing the two-line swap to a real image.
- **The admin password.** Change it before this leaves your laptop.

---

## 2. What is built

All of it is browser-tested and covered in the README's security section.

- **Public site** — filter sidebar feeding a custom-quote request, emailed
  confirmation, Claude assistant, custom 404 and error pages.
- **Security** — CSP, HSTS, rate limiting, scrypt password hashing, database
  sessions, account lockout, `npm audit` clean.
- **Admin** — real accounts (not a shared password), order queue, client
  list, one consistent nav across every section.
- **Quotes (offertes)** — create, send (emailed, or copy the link when
  Resend isn't configured), client accepts or declines from a no-account
  link, printable/downloadable. Sent quotes are immutable; decisions are
  final but idempotent. An accepted quote turns into an invoice in one click.
- **Client portal** — invite a client, they set their own password, sign in
  to see their own invoices.
- **Invoices** — draft to issue to payment, gapless numbering allocated at
  issue, billing snapshot frozen at issue, print-to-PDF, and CSV exports for
  reconciliation and the BTW return.
- **Every quote/invoice carries the full field set**: client company,
  contact, address and BTW number; your own company's address, KVK number,
  BTW number, bank account and BIC; a permanent per-client number (KLT-0001,
  allocated once); invoice/quote number, dates, line items, subtotal, tax,
  total.

Run `npm test` for the money and CSV test suites (21 cases).

---

## 3. Sensible next features

Roughly in order of how much they are worth relative to the effort.

### Email quotes and invoices automatically

Right now sending a quote marks it sent and shows you a link to paste. Once
`RESEND_API_KEY` exists, quote emails send themselves. Invoices still need a
human to hit Print → Save as PDF; attaching a PDF to an email needs
server-side rendering (headless Chrome on the server, or a PDF library). A
contained job, not a rewrite.

### Recurring invoices for the Care Plan

A monthly package that has to be invoiced by hand every month will get
forgotten. A scheduled job that drafts next month's invoices would pay for
itself quickly.

### Credit notes

Today a mistake on an issued invoice means cancel and reissue. A proper credit
note (a negative invoice referencing the original) is what an accountant will
eventually ask for.

### Payment links

An invoice with an iDEAL or card link gets paid faster than one with bank
details. Mollie suits the Dutch market; Stripe if you go international.

---

## 4. Before this goes on the internet

The local database (`npm run db:start`) is **development only** — it is
Postgres compiled to WebAssembly, single-connection, with no backups. It
cannot be your production database.

When you deploy:

1. Create a hosted Postgres (Neon and Supabase both have free tiers) and set
   `DATABASE_URL` to it.
2. Raise `DATABASE_POOL_MAX` — it is capped at 1 for the local database.
3. **Move rate limiting to Redis.** It currently counts per Node process,
   which is real protection on one server and useless across several.
   `@upstash/ratelimit` is a drop-in; the call sites do not change.
4. Set `TRUSTED_PROXY` correctly. It is `true`, which is right behind
   Vercel/Cloudflare/nginx and wrong if the server is directly exposed —
   `x-forwarded-for` is spoofable otherwise.
5. Set a real `AUTH_SECRET` (32+ random characters) and `ADMIN_PASSWORD`.
6. Verify a sending domain in Resend so email reaches real inboxes.

---

## 5. Known limitations, stated plainly

- **The local database serves one connection.** `src/lib/prisma.ts` caps the
  pool at 1 for it so requests queue rather than fail. A side effect: the
  concurrency safety of invoice and quote numbering is *demonstrated* locally
  but not *proven*, because the pool serialises requests. The mechanism is a
  Postgres advisory lock and will hold on a real database.
- **Prisma's migration engine cannot talk to the local database.** That is why
  migrations run through `npm run db:migrate` (which applies the same
  checked-in SQL) rather than `prisma migrate deploy`. Both work against real
  Postgres.
- **Invoices are printed to PDF by a human.** See above.
- **The database does not travel with the code.** Each machine gets its own
  empty database and its own seeded admin. That is deliberate.

---

## 6. Reselling the system

The brief mentioned selling this to other agencies. The architecture already
assumes it: every table carries a `tenantId` and every query is scoped by it.
`src/lib/tenant.ts` resolves the single current tenant and is the one place
that changes when you want many — resolve from the subdomain instead.

Doing it now would have been speculative work; retrofitting it later would
have meant auditing every query for leaks between agencies' client data. This
way it costs about 5% extra today and stays a switch you can flip.
