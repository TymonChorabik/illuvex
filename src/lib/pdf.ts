import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

/**
 * Renders one of the app's own server-rendered pages (invoice, quote) to a
 * PDF, reusing its existing print stylesheet rather than a second layout
 * that could drift out of sync with what staff see on screen -- same
 * philosophy as the "Print -> Save as PDF" hint those pages already carry,
 * just automated instead of asking a human to drive the browser dialog.
 *
 * Needs a real Chrome/Chromium binary: puppeteer-core (unlike plain
 * puppeteer) does not ship one. Locally this finds the browser already on
 * the machine. In production, point PDF_CHROME_PATH at one, or swap this
 * for @sparticuz/chromium if you deploy somewhere serverless (Vercel,
 * Lambda) -- a contained follow-up, not a rewrite of this file.
 */

const CANDIDATE_PATHS = [
  process.env.PDF_CHROME_PATH,
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((path): path is string => Boolean(path));

function findChrome(): string | null {
  return CANDIDATE_PATHS.find((path) => existsSync(path)) ?? null;
}

export class PdfUnavailableError extends Error {}

/**
 * @param url The full URL of the page to render (its own origin, so
 *   relative asset/API calls resolve the same way they do in a browser).
 * @param cookie The incoming request's Cookie header, forwarded so the
 *   headless page hits the target as the same signed-in staff member --
 *   without it the target renders its signed-out state instead.
 */
export async function renderPagePdf(
  url: string,
  cookie: string | null,
): Promise<Buffer> {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new PdfUnavailableError(
      "No Chrome/Chromium found to render PDFs. Set PDF_CHROME_PATH to a browser executable.",
    );
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    if (cookie) {
      await page.setExtraHTTPHeaders({ Cookie: cookie });
    }
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
