/**
 * Creates the default tenant, an admin account, and the package catalogue.
 * Idempotent: safe to re-run.
 *
 *   node tools/seed.mjs
 *
 * The admin password comes from SEED_ADMIN_PASSWORD, or is generated and
 * printed once. It is never written to a file.
 */
import crypto from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

try {
  process.loadEnvFile(".env");
} catch {}
try {
  process.loadEnvFile(".env.local");
} catch {}

const scrypt = promisify(crypto.scrypt);
const N = 65536,
  R = 8,
  P = 1;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, 64, {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

const TENANT_SLUG = "illuvex";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@illuvex.example";

const PACKAGES = [
  ["landing-page", "Landing Page", "One high-converting page to launch a product, run ads against, or replace a dead social bio link.", 39900, null, "website", "5–7 days",
    ["Single scrolling page, custom designed", "Mobile + tablet + desktop layouts", "Contact form wired to your inbox", "Basic SEO tags and analytics", "2 rounds of revisions"], ["seo", "copywriting", "hosting"], 1],
  ["business-website", "Business Website", "The standard five-page site — home, services, about, contact, and one extra of your choosing.", 89900, null, "website", "2–3 weeks",
    ["Up to 5 custom-designed pages", "CMS so you can edit text and images", "Google Business + maps integration", "SEO setup and sitemap submission", "3 rounds of revisions"], ["cms", "seo", "copywriting", "hosting"], 2],
  ["site-refresh", "Redesign & Refresh", "Keep your content, replace the look. For sites that work but look ten years old.", 64900, null, "website", "1–2 weeks",
    ["New design across your existing pages", "Speed and mobile fixes", "Content migrated for you", "Accessibility pass", "2 rounds of revisions"], ["cms", "seo"], 3],
  ["online-store", "Online Store", "A full e-commerce build with payments, stock tracking, and an order dashboard you actually understand.", 189900, null, "ecommerce", "4–6 weeks",
    ["Up to 50 products loaded for you", "Card payments via Stripe", "Stock, shipping, and tax rules", "Abandoned-cart emails", "Staff training call"], ["cms", "ecommerce", "seo", "hosting"], 4],
  ["booking-system", "Booking System", "For salons, trades, clinics, and anyone still taking appointments over DMs.", 120000, null, "webapp", "3 weeks",
    ["Calendar with staff availability", "Automatic email + SMS reminders", "Deposits taken at booking", "Syncs with Google Calendar", "Admin view for your team"], ["booking", "cms", "hosting"], 5],
  ["custom-web-app", "Custom Web App", "Dashboards, portals, internal tools — when an off-the-shelf template genuinely won't do it.", 350000, "+", "webapp", "6+ weeks",
    ["Discovery workshop and written spec", "User accounts and permissions", "Custom database and admin panel", "API integrations with your tools", "30 days of post-launch support"], ["cms", "booking", "hosting"], 6],
  ["seo-starter", "SEO Starter", "A one-off audit and fix-up so people can actually find the site you already paid for.", 29900, null, "marketing", "4–5 days",
    ["Full technical SEO audit", "Keyword research for your area", "Titles and descriptions rewritten", "Google Search Console setup", "Plain-English report"], ["seo", "copywriting"], 7],
  ["care-plan", "Care Plan", "Hosting, backups, updates, and a human who answers when something breaks.", 7900, "/mo", "care", "Starts immediately",
    ["Fast managed hosting + SSL", "Daily backups, 30-day history", "Software and security updates", "1 hour of content edits monthly", "Uptime monitoring and alerts"], ["hosting", "seo"], 8],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const now = new Date();
const cuid = () => "c" + crypto.randomBytes(12).toString("hex");

// --- tenant ---------------------------------------------------------------
let { rows } = await client.query("SELECT id FROM tenants WHERE slug = $1", [TENANT_SLUG]);
let tenantId;
if (rows.length) {
  tenantId = rows[0].id;
  console.log(`tenant "${TENANT_SLUG}" already exists`);
} else {
  tenantId = cuid();
  await client.query(
    `INSERT INTO tenants (id, slug, name, settings, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$5)`,
    [tenantId, TENANT_SLUG, "Illuvex", JSON.stringify({}), now],
  );
  console.log(`created tenant "${TENANT_SLUG}"`);
}

// --- admin user -----------------------------------------------------------
const existing = await client.query(
  'SELECT id FROM users WHERE "tenantId" = $1 AND email = $2',
  [tenantId, ADMIN_EMAIL],
);

if (existing.rows.length) {
  console.log(`admin ${ADMIN_EMAIL} already exists — not touching the password`);
} else {
  const password =
    process.env.SEED_ADMIN_PASSWORD?.trim() || crypto.randomBytes(12).toString("base64url");
  await client.query(
    `INSERT INTO users (id, "tenantId", email, "passwordHash", name, role,
                        "emailVerifiedAt", "failedAttempts", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,'ADMIN',$6,0,$6,$6)`,
    [cuid(), tenantId, ADMIN_EMAIL, await hashPassword(password), "Illuvex Admin", now],
  );
  console.log(`\ncreated admin account`);
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${password}`);
  console.log(`  (shown once — store it in a password manager now)\n`);
}

// --- packages -------------------------------------------------------------
let created = 0;
for (const [slug, name, summary, priceCents, priceUnit, category, timeline, includes, features, sortOrder] of PACKAGES) {
  const hit = await client.query(
    'SELECT id FROM packages WHERE "tenantId" = $1 AND slug = $2',
    [tenantId, slug],
  );
  if (hit.rows.length) continue;
  await client.query(
    `INSERT INTO packages (id, "tenantId", slug, name, summary, "priceCents", "priceUnit",
                           currency, category, timeline, includes, features, active,
                           "sortOrder", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,'EUR',$8,$9,$10,$11,true,$12,$13,$13)`,
    [cuid(), tenantId, slug, name, summary, priceCents, priceUnit, category, timeline, includes, features, sortOrder, now],
  );
  created += 1;
}
console.log(`packages: ${created} created, ${PACKAGES.length - created} already present`);

const counts = await client.query(`
  SELECT (SELECT count(*) FROM tenants)::int  AS tenants,
         (SELECT count(*) FROM users)::int    AS users,
         (SELECT count(*) FROM packages)::int AS packages
`);
console.log("totals:", counts.rows[0]);
await client.end();
