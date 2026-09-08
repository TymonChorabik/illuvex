import puppeteer from "puppeteer-core";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = process.argv[2];
const BASE = "http://localhost:3000";
const PASSWORD = "dev-only-password";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--disable-gpu", "--no-sandbox", "--hide-scrollbars"],
});

async function shot(page, name, opts = {}) {
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, name), ...opts });
  console.log("captured", name);
}

// 1. Packages page, full height
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 2 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await shot(page, "01-packages.png", { fullPage: true });

// 2. Filters applied — tick "Online store" + "1,500 - 3,000"
await page.evaluate(() => {
  const tick = (label) => {
    const el = [...document.querySelectorAll("label")].find((l) =>
      l.innerText.trim().startsWith(label),
    );
    el?.querySelector("input")?.click();
  };
  tick("Online store");
  tick("1,500");
});
await shot(page, "02-filtered.png");

// 3. Request modal
await page.evaluate(() => {
  document.querySelector("article button")?.click();
});
await sleep(400);
await page.evaluate(() => {
  const set = (sel, v) => {
    const el = document.querySelector(sel);
    const setter = Object.getOwnPropertyDescriptor(
      el.constructor.prototype,
      "value",
    ).set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("#name", "Jordan Fields");
  set("#email", "jordan@example.com");
  set("#company", "Fields Ceramics");
  set("#notes", "Around 40 products to start, launching in October.");
});
await shot(page, "03-request-modal.png");

// 4. Submit it -> confirmation state
await page.evaluate(() => document.querySelector("form button[type=submit]")?.click());
await sleep(1500);
await shot(page, "04-confirmation.png");

// 5. Chat widget open
await page.evaluate(() => {
  document.querySelector("[role=dialog] button:last-of-type")?.click();
});
await sleep(400);
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-label") === "Open chat")
    ?.click();
});
await shot(page, "05-chat.png");

// 6. Transactions
await page.goto(`${BASE}/transactions`, { waitUntil: "networkidle0" });
await page.evaluate((email) => {
  const el = document.querySelector("input[type=email]");
  el.value = email;
  document.querySelector("form button[type=submit]").click();
}, "jordan@example.com");
await sleep(1200);
await shot(page, "06-transactions.png");

// 7. Admin sign-in
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
await shot(page, "07-admin-signin.png");

// 8. Admin dashboard
await page.evaluate((pw) => {
  const el = document.querySelector("input[type=password]");
  const setter = Object.getOwnPropertyDescriptor(
    el.constructor.prototype,
    "value",
  ).set;
  setter.call(el, pw);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("form button[type=submit]").click();
}, PASSWORD);
await sleep(1500);
await shot(page, "08-admin.png", { fullPage: true });

// 9. Mobile packages
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await shot(page, "09-mobile.png");

await browser.close();
console.log("done");
