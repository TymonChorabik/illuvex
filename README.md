# Illudesk

A booking-and-enquiry app for a web design business. Visitors browse service
packages, narrow them with filters, request one, and get an emailed
confirmation. An AI assistant answers questions about the packages, and a
Transactions page lets people look up everything they have requested.

## Running it

Two processes: the database and the app.

```bash
npm --prefix illuvex run db:start
```

```bash
npm --prefix illuvex run dev
```

Then open http://localhost:3000.

First time only, with the database running:

```bash
npm --prefix illuvex run db:migrate && npm --prefix illuvex run db:seed
```

`db:seed` prints an admin email and password once. Store it in a password
manager — it is never written to disk.

### The local database

`npm run db:start` runs **PGlite**, real Postgres compiled to WebAssembly, on
port 5433. No Docker, no install, no cloud account, works offline. Data lives
in `.pgdata/` (gitignored); delete that folder to reset.

It is a development convenience, not a production database — single
connection, no backups or replication. For production set `DATABASE_URL` to a
managed Postgres; nothing else changes.

> One known quirk: PGlite's socket server can desync after a failed query, and
> Prisma's *migration engine* cannot connect to it at all. That is why
> migrations run through `npm run db:migrate` (which applies the same checked-in
> SQL over the `pg` driver) rather than `prisma migrate deploy`. Against a real
> Postgres either command works.

### Database commands

| Command | What it does |
| --- | --- |
| `npm run db:start` | Start the local Postgres |
| `npm run db:migrate` | Apply pending migrations (transactional, idempotent) |
| `npm run db:seed` | Create the tenant, admin account and packages |
| `npm run db:diff` | Regenerate migration SQL after editing `schema.prisma` |
| `npm run db:studio` | Browse the data in Prisma Studio |

> **New here, or picking this up again?** Read
> **[NEXT-STEPS.md](NEXT-STEPS.md)** first — it covers what is done, what is
> still a placeholder, and what to do in what order.

## Working on another machine

Everything runs on macOS and Linux as well as Windows — the local database is
WebAssembly, so there is nothing platform-specific to install.

```bash
git clone <this repo> && cd illuvex
npm install
cp .env.example .env
cp .env.example .env.local
```

Generate a signing secret and put it in `.env.local` as `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Then, in two terminals:

```bash
npm run db:start
```

```bash
npm run db:migrate && npm run db:seed && npm run dev
```

`db:seed` prints an admin email and password once — store it in a password
manager.

> The database lives in `.pgdata/`, which is **not** in git. Each machine gets
> its own empty database and its own seeded admin account; data does not follow
> the code. That is deliberate — a database in version control is a data leak
> waiting to happen. To move real data between machines, use a hosted Postgres
> and point `DATABASE_URL` at it from both.

One Windows-only bit: `tools/screenshots.mjs` looks for Microsoft Edge. On a
Mac, change `executablePath` to
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Setup

Fill in `.env.local` (already created from `.env.example`):

| Variable | What it does | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Powers the chat assistant. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). | Chat replies with "not configured yet"; everything else works. |
| `RESEND_API_KEY` | Sends confirmation emails. Free tier at [resend.com](https://resend.com/api-keys). | Orders still save; the email body is printed to the terminal instead. |
| `FROM_EMAIL` | The "from" address. Must be a domain verified in Resend. | Falls back to `onboarding@resend.dev`, which can **only** deliver to the address that owns your Resend account. |
| `ADMIN_PASSWORD` | Guards the `/admin` dashboard. | `/admin` refuses to load until you set it to something other than `change-me`. |

Restart the dev server after editing `.env.local`.

## Making it yours

Almost everything you'll want to change lives in two files.

**`src/lib/site.ts`** — business name, tagline, intro text, currency symbol,
order-reference prefix, and the contact details.

> Every contact detail shipped here is a **placeholder**: `hello@illudesk.example`,
> `+00 0000 000000`, `City, Country`. The `.example` domain is reserved and can
> never be registered, so nothing can accidentally reach a real inbox. Replace
> them all before launch.

The logo in `src/components/logo.tsx` is a placeholder geometric mark. That file
has a comment showing how to swap in a real image.

**`src/lib/offers.ts`** — the packages themselves. Each entry sets its name,
price, summary, turnaround, what's included, and which filters it answers to.
Add or remove entries freely; the grid, the filters, the confirmation email, and
the chatbot's knowledge all read from this one list.

Mark one package with `popular: true` to give it the "Most picked" badge.

## How it fits together

```
src/app/page.tsx               Packages page — filter sidebar + card grid
src/app/transactions/page.tsx  Look up past requests by email
src/app/admin/page.tsx         Staff dashboard — all requests, change status
src/app/admin/quotes/          Offertes: list, send, and the new-quote editor
src/app/admin/tickets/         Staff ticket queue and thread (with internal notes)
src/app/admin/clients/         Client list + portal invitations
src/app/admin/invoices/        Facturen: list, bookkeeping totals, CSV export
src/app/admin/invoices/[id]/   The invoice document (print to PDF)
src/app/portal/                Client portal: sign in, tickets, set password
src/app/quote/[token]/page.tsx What the client sees — accept or decline, no login
src/app/layout.tsx             Navbar, footer, and the chat widget on every page
src/app/api/orders/route.ts    POST saves a request and emails it; GET looks them up
src/app/api/chat/route.ts      Streams the assistant's replies
src/app/api/admin/orders/...   Staff-only list + status updates
src/app/api/admin/quotes/...   Staff-only quote create/edit/send
src/app/api/quotes/[token]     The client's accept/decline endpoint
src/app/api/portal/...         Portal auth, tickets, set-password
src/app/api/admin/tickets/...  Staff-only ticket queue and replies
src/lib/tickets.ts             Ticket lifecycle, scoped by tenant and client
src/lib/invite.ts              Portal invitations and set-password tokens
src/lib/invoices.ts            Invoice lifecycle, numbering, payments
src/lib/csv.ts                 CSV writing (has tests — injection + BOM)
src/lib/money.ts               Cents + basis-point arithmetic (has tests)
src/lib/quotes.ts              Quote lifecycle and reference numbering
src/lib/db.ts                  Order storage
src/lib/email.ts               Email templates and sending
src/components/                Navbar, filters, cards, request modal, chat widget
```

### Orders

Orders live in Postgres. Prices are read from the server-side catalogue, never
from the browser, so a visitor cannot submit their own price. Each order also
snapshots the package name and price at the time it was placed — editing the
catalogue later must not rewrite what someone already agreed to.

Money is stored as integer cents and VAT as basis points (2100 = 21%). Never
introduce a float into a money path; rounding drift on invoices is the kind of
bug you discover from an accountant.

### Quotes (offertes)

Staff raise a quote against a client, add lines with quantity, unit price and
BTW rate, then send it. The client gets a link and can accept or decline
without an account.

Rules the code enforces, not just intends:

- **Only drafts are editable.** Once sent, the quote is a document the client
  has seen; editing is refused with a `409`.
- **Sending is once.** A second send is refused rather than minting a new link.
- **Decisions are final but idempotent.** Clicking Accept twice succeeds
  quietly; trying to reverse a decision is refused.
- **Expiry is checked at decision time**, so a quote cannot be accepted the day
  after it lapsed.
- **The link is the credential.** Only a SHA-256 of the token is stored, the
  page is `noindex`, and an unknown, expired and non-existent token are
  indistinguishable from outside.

References are `OFF-<year>-<0001>`, allocated per tenant per year under a
Postgres advisory lock so two simultaneous creates cannot claim the same
number.

### Invoices and bookkeeping

An invoice starts as a **draft with no number**. Numbers are allocated only at
issue, which is what keeps the sequence gapless when a draft is deleted — tax
authorities require gapless numbering, and a burnt number is a hole you have to
explain.

- **Issued invoices are immutable.** Editing one returns `409`; the fix for a
  mistake is to cancel and issue a corrected invoice.
- **Cancelling never releases the number.** The cancelled record is the audit
  trail; releasing it would create a gap.
- **Billing details are frozen at issue.** If the client moves office next
  year, last year's invoice still shows the old address.
- **Payments are cumulative**, so a partial payment can be topped up.
  Overpaying and negative amounts are refused.
- **Customers see an invoice only once it has a number.** The filter tests the
  number, not the status — a draft that was cancelled is `CANCELLED` with no
  number, and filtering on status alone leaked it into the portal.

**PDF:** the invoice page is a server-rendered document with a print
stylesheet, so browser Print → Save as PDF produces the file you send. That is
deliberately one layout rather than a separate PDF template that can drift out
of sync with what you see on screen.

**Bookkeeping export**, from the Facturen page:

| Export | One row per | Use |
| --- | --- | --- |
| Export CSV | invoice | Reconciliation — totals, paid, outstanding |
| Export for BTW | invoice line | The VAT return: each line with its own rate |

Both exclude drafts and cancellations, carry a UTF-8 BOM so Excel does not
mangle accented names, and neutralise cells starting with `=`, `+`, `-` or `@`
so a malicious client name cannot execute as a formula on your bookkeeper's
machine. Money is written as a plain decimal string, never a float.

### Money

`src/lib/money.ts` is the only place money is calculated. Amounts are integer
cents, VAT rates are basis points (2100 = 21%), and VAT is rounded per line
then summed — so the printed line amounts add up to the printed total instead
of leaving a stray cent. Run `npm test` after touching it.

### Tickets and the client portal

Staff invite a client from **/admin/clients**; the client gets a link, chooses
their own password, and can then raise tickets at **/portal**. We never email a
password — an emailed password lives in an inbox forever.

The rules that matter, all covered by the checks below:

- **A customer only ever sees their own client's tickets.** Every portal query
  is scoped by the `clientId` on the session, never by anything in the request
  body. Reading or replying to another client's ticket returns `404`, not
  `403` — we do not confirm the ticket exists.
- **Internal notes are staff-only.** `getTicket` takes a required
  `includeInternal` argument rather than an optional flag, so a caller cannot
  leak notes by forgetting it. The portal passes `false`; nothing else can.
- **Roles do not overlap.** A customer hitting a staff route gets `403`; staff
  signing in at the portal are refused and their session revoked.
- **Replies move the status automatically** — staff reply sets "waiting on
  client", client reply sets "needs a reply". An internal note changes nothing,
  because it is not a reply to the customer.
- **Closed tickets are closed.** Replies return `409` until staff reopen.
- **Invite links are single-use** and expire in 14 days; setting a password
  invalidates every session opened before it.

### The admin dashboard

Go to **/admin** and enter `ADMIN_PASSWORD`. You get every request, newest
first, with the customer's email as a pre-addressed mailto link and a dropdown
to move each one between Awaiting reply → Confirmed → In progress → Complete.
Customers see the new status on their Transactions page immediately.

It is a single shared password, checked server-side with a constant-time
compare — fine for one operator on a private URL. If several people need
access, or the dashboard will sit on a public domain, upgrade to real accounts
before then.

### The assistant

`src/app/api/chat/route.ts` builds its system prompt from the package catalog,
so the bot always quotes current prices and never invents a package. It cannot
place orders or take payment details — it points people at the request buttons.
Edit the `SYSTEM_PROMPT` in that file to change its tone or boundaries.

## Security

What is in place, so a reviewer can check it rather than take it on trust:

| Concern | How it is handled | Where |
| --- | --- | --- |
| Admin auth | Real accounts: email + password, scrypt-hashed (OWASP parameters, salted). Sessions live in the database — only a SHA-256 of the cookie token is stored, so a leaked dump yields no usable sessions. `httpOnly`, so page scripts cannot read the cookie. | `src/lib/auth.ts`, `src/lib/password.ts` |
| Account lockout | 8 consecutive failures locks the account for 15 minutes, independently of the per-IP throttle. | `src/lib/auth.ts` |
| Account enumeration | "No such user" and "wrong password" return the same message, and a miss still spends hashing time so response timing does not reveal which addresses exist. | `src/lib/auth.ts` |
| Role separation | A customer account with the correct password is refused admin access, and its session is revoked rather than left dangling. | `src/app/api/admin/session/route.ts` |
| Tenant isolation | Every query is scoped by `tenantId`; updates use `updateMany` with the tenant in the filter, because `update()` by id alone would ignore it. | `src/lib/db.ts` |
| Brute force | 5 sign-in attempts per IP per 15 min, then `429`. | `src/lib/rate-limit.ts` |
| Endpoint abuse | Orders 5/10min, lookups 20/min, chat 20/5min per IP. | same |
| XSS | Strict CSP; no `unsafe-eval` in production. All email HTML is escaped before interpolation. | `next.config.ts`, `src/lib/email.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. | `next.config.ts` |
| CSRF | `SameSite=Lax` on the session cookie (Lax not Strict so links from confirmation emails still work; state-changing routes are all POST/PATCH). | `src/lib/auth.ts` |
| MIME sniffing | `X-Content-Type-Options: nosniff`. | `next.config.ts` |
| Transport | HSTS (2y, preload) in production only — never from localhost. | `next.config.ts` |
| Price tampering | Prices are read from the server-side catalog; the browser's number is ignored. | `src/app/api/orders/route.ts` |
| Info leaking | `X-Powered-By` removed; `/api` and `/admin` marked `noindex` and `no-store`; production errors show a digest, not a stack trace. | `next.config.ts`, `src/app/error.tsx` |
| Failure UX | Custom 404 (`not-found.tsx`), route error boundary (`error.tsx`), root boundary (`global-error.tsx`). | `src/app/` |

**Two limits you must know about:**

1. **Rate limiting is per Node process.** Real protection on one server; useless across several. Deploying to Vercel or scaling past one container means moving it to Redis — `@upstash/ratelimit` is a drop-in and the call sites do not change.
2. **`x-forwarded-for` is spoofable** unless a trusted proxy sets it. Behind nginx/Cloudflare/Vercel this is sound. If the server is directly exposed, set `TRUSTED_PROXY=false`.

## Before going live

- Add both API keys and verify a sending domain in Resend.
- Replace the placeholder packages and prices with your real ones.
- Replace every placeholder contact detail in `src/lib/site.ts`.
- Swap the placeholder logo in `src/components/logo.tsx`.
- Set a real `ADMIN_PASSWORD` (8+ chars) and a random `AUTH_SECRET` (32+ chars).
- Confirm `TRUSTED_PROXY` matches your hosting setup.
- Move rate limiting to Redis if you run more than one instance.
- Consider moving orders off `data/orders.json` if you expect real volume, since
  most hosts do not persist a writable filesystem between deploys.
