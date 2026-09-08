/**
 * CSV writing for the bookkeeping export.
 *
 * Two things most hand-rolled CSV writers get wrong, both handled here:
 *
 * 1. **Injection.** A cell starting with = + - or @ is executed as a formula
 *    when the file is opened in Excel or Sheets. A client called
 *    "=cmd|'/c calc'!A1" would run on the bookkeeper's machine. Such cells are
 *    prefixed with a tab so they are read as text.
 * 2. **Excel and the BOM.** Without a UTF-8 byte-order mark, Excel on Windows
 *    reads the file as the local codepage and mangles every accented name.
 */
const RISKY_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  // Neutralise formula injection without altering the visible value.
  if (RISKY_PREFIX.test(text)) text = `\t${text}`;

  // Quote when the cell contains a delimiter, quote or newline.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: (unknown[])[],
  opts: { bom?: boolean } = {},
): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  // CRLF is what Excel expects.
  const body = lines.join("\r\n");
  return opts.bom === false ? body : `﻿${body}`;
}

/** Money as a plain decimal string — never a float, never a currency symbol. */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Quoted so a filename with a space cannot truncate the header.
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
