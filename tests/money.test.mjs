/**
 * Money math tests. Run: node tests/money.test.mjs
 * No test framework on purpose — these must run anywhere, forever.
 */
import assert from "node:assert/strict";
import {
  roundHalfUp, lineTotals, documentTotals, parseMoneyToCents,
  formatVatRate, formatMoney,
} from "../src/lib/money.ts";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

test("rounds half up on positives", () => {
  assert.equal(roundHalfUp(0.5), 1);
  assert.equal(roundHalfUp(1.5), 2);
  assert.equal(roundHalfUp(2.4), 2);
});

test("rounds symmetrically on negatives (Math.round does not)", () => {
  assert.equal(roundHalfUp(-0.5), -1);
  assert.equal(roundHalfUp(-1.5), -2);
});

test("line total: 1 x EUR 899.00 at 21%", () => {
  const t = lineTotals({ quantity: 1, unitPriceCents: 89900, vatRateBps: 2100 });
  assert.equal(t.netCents, 89900);
  assert.equal(t.vatCents, 18879);      // 899.00 * 0.21 = 188.79
  assert.equal(t.grossCents, 108779);
});

test("line total: quantity multiplies before VAT", () => {
  const t = lineTotals({ quantity: 3, unitPriceCents: 33333, vatRateBps: 2100 });
  assert.equal(t.netCents, 99999);
  assert.equal(t.vatCents, 21000);      // 999.99 * 0.21 = 209.9979 -> 210.00
  assert.equal(t.grossCents, 120999);
});

test("0% VAT line produces no VAT", () => {
  const t = lineTotals({ quantity: 2, unitPriceCents: 5000, vatRateBps: 0 });
  assert.equal(t.vatCents, 0);
  assert.equal(t.grossCents, 10000);
});

test("printed line VAT amounts sum to the printed total", () => {
  // Three lines that each round up; rounding once at the end would differ.
  const lines = Array.from({ length: 3 }, () => ({
    quantity: 1, unitPriceCents: 1005, vatRateBps: 2100,
  }));
  const perLine = lines.reduce((n, l) => n + lineTotals(l).vatCents, 0);
  const doc = documentTotals(lines);
  assert.equal(doc.vatCents, perLine, "document VAT must equal sum of line VAT");
  assert.equal(doc.subtotalCents, 3015);
  assert.equal(doc.totalCents, doc.subtotalCents + doc.vatCents);
});

test("mixed VAT rates are grouped for the summary block", () => {
  const doc = documentTotals([
    { quantity: 1, unitPriceCents: 10000, vatRateBps: 2100 },
    { quantity: 1, unitPriceCents: 10000, vatRateBps: 900 },
    { quantity: 1, unitPriceCents: 5000,  vatRateBps: 2100 },
  ]);
  assert.equal(doc.vatByRate.length, 2);
  const high = doc.vatByRate.find(r => r.rateBps === 2100);
  assert.equal(high.netCents, 15000);
  assert.equal(high.vatCents, 3150);
  const low = doc.vatByRate.find(r => r.rateBps === 900);
  assert.equal(low.vatCents, 900);
  assert.equal(doc.totalCents, 25000 + 3150 + 900);
});

test("empty document totals to zero, not NaN", () => {
  const doc = documentTotals([]);
  assert.deepEqual(
    { s: doc.subtotalCents, v: doc.vatCents, t: doc.totalCents },
    { s: 0, v: 0, t: 0 },
  );
});

test("no float drift across many lines", () => {
  // 0.1 + 0.2 !== 0.3 in floats; in cents it must be exact.
  const lines = Array.from({ length: 1000 }, () => ({
    quantity: 1, unitPriceCents: 10, vatRateBps: 2100,
  }));
  const doc = documentTotals(lines);
  assert.equal(doc.subtotalCents, 10000);
  assert.equal(doc.vatCents, 2000);   // 1000 lines x round(2.1) = 1000 x 2
  assert.equal(Number.isInteger(doc.totalCents), true);
});

test("rejects non-integer input rather than rounding silently", () => {
  assert.throws(() => lineTotals({ quantity: 1.5, unitPriceCents: 100, vatRateBps: 2100 }));
  assert.throws(() => lineTotals({ quantity: 1, unitPriceCents: 99.99, vatRateBps: 2100 }));
});

test("parses Dutch and English number formats", () => {
  assert.equal(parseMoneyToCents("1234,56"), 123456);
  assert.equal(parseMoneyToCents("1.234,56"), 123456);
  assert.equal(parseMoneyToCents("1,234.56"), 123456);
  assert.equal(parseMoneyToCents("1234.56"), 123456);
  assert.equal(parseMoneyToCents("€ 899"), 89900);
  assert.equal(parseMoneyToCents("899"), 89900);
});

test("parse returns null on junk instead of 0", () => {
  assert.equal(parseMoneyToCents(""), null);
  assert.equal(parseMoneyToCents("abc"), null);
  assert.equal(parseMoneyToCents("--"), null);
});

test("formats VAT rate and money", () => {
  assert.equal(formatVatRate(2100), "21%");
  assert.equal(formatVatRate(900), "9%");
  assert.equal(formatMoney(108779, "EUR").replace(/ | /g, " "), "€ 1.087,79");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
