/** CSV export tests. Run: node --experimental-strip-types tests/csv.test.mjs */
import assert from "node:assert/strict";
import { toCsv, centsToDecimal } from "../src/lib/csv.ts";

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL  ${name}\n      ${e.message}`); } };

test("quotes cells containing commas", () => {
  const csv = toCsv(["a"], [["Amsterdam, NL"]], { bom: false });
  assert.equal(csv, 'a\r\n"Amsterdam, NL"');
});

test("escapes embedded double quotes", () => {
  const csv = toCsv(["a"], [['He said "hi"']], { bom: false });
  assert.equal(csv, 'a\r\n"He said ""hi"""');
});

test("quotes cells containing newlines", () => {
  const csv = toCsv(["a"], [["line1\nline2"]], { bom: false });
  assert.equal(csv, 'a\r\n"line1\nline2"');
});

test("neutralises formula injection", () => {
  // Excel would execute these; they must arrive as text.
  for (const evil of ["=cmd|'/c calc'!A1", "+1+1", "-1+1", "@SUM(A1)"]) {
    const csv = toCsv(["a"], [[evil]], { bom: false });
    const cell = csv.split("\r\n")[1];
    assert.ok(cell.includes("\t"), `expected tab guard for ${evil}, got ${cell}`);
    assert.ok(!cell.startsWith("="), "cell must not start with =");
  }
});

test("writes a BOM by default so Excel reads UTF-8", () => {
  const csv = toCsv(["naam"], [["café"]]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes("café"));
});

test("empty and null cells become empty strings, not 'null'", () => {
  const csv = toCsv(["a", "b"], [[null, undefined]], { bom: false });
  assert.equal(csv, "a,b\r\n,");
});

test("money renders exactly, never as a float", () => {
  assert.equal(centsToDecimal(0), "0.00");
  assert.equal(centsToDecimal(5), "0.05");
  assert.equal(centsToDecimal(100), "1.00");
  assert.equal(centsToDecimal(102222), "1022.22");
  assert.equal(centsToDecimal(-2500), "-25.00");
});

test("no float drift on a value that breaks naive division", () => {
  // 8.11 would print as 8.110000000000001 via cents/100 in some engines.
  assert.equal(centsToDecimal(811), "8.11");
  assert.equal(centsToDecimal(1015), "10.15");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
