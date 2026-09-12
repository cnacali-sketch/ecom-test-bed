// Building a CSV the shop can open in Excel without it lying to them.
//
// Three things make this more than string joining, and all three are silent
// failures rather than errors — the file opens, it just says something other
// than what was exported.
//
// **Formula injection.** A cell whose text begins with =, +, -, @, tab or
// carriage return is executed as a formula by Excel, Google Sheets and
// LibreOffice. Every name, address line and coupon code in this export was
// typed by a member of the public into a checkout form, so a customer called
// `=HYPERLINK(...)` is a live attack on whoever opens the spreadsheet. Those
// cells are prefixed so they are read as text.
//
// **Quoting.** Indian addresses routinely contain commas, and a support note
// can contain a newline or a quote. Any of the three silently shifts every
// later column on that row into the wrong heading.
//
// **The BOM.** Excel on Windows assumes the system codepage unless a UTF-8
// byte-order mark says otherwise, so ₹ and any non-Latin name arrive as
// mojibake. The three bytes at the front are what stop that.

/** One exported column: a heading and how to read it off a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** A plain number, with an optional sign and decimals.
 *
 * Checked before the formula guard because a negative amount starts with a
 * minus and would otherwise be neutralised into text — and money arrives here
 * as a string ("-200.00"), not a number, so this is the common case rather
 * than an edge one. An export whose amounts do not add up is useless to the
 * accountant who is the main reason it exists. Nothing hostile survives the
 * exception: no formula parses as a plain number. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Render one cell.
 *
 * Exported for its tests — the escaping rules are the whole substance of this
 * module and are worth pinning individually.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);

  // A leading apostrophe is the convention every major spreadsheet
  // understands as "this is text". Prefixed before quoting, so the guard is
  // inside the quotes and survives the round trip.
  const guarded =
    !PLAIN_NUMBER.test(text) && FORMULA_START.test(text) ? `'${text}` : text;

  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/** Rows and columns to a CSV string, header row included. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  }
  // CRLF: the line ending the CSV RFC specifies and the one Excel is least
  // surprised by.
  return lines.join("\r\n");
}

/** A filename-safe stamp, so repeated exports do not overwrite each other. */
export function csvStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Hand the CSV to the browser as a download.
 *
 * Separated from `toCsv` so the interesting part stays a pure function that
 * can be tested without a DOM.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;

  // ﻿ is the UTF-8 BOM. Without it Excel reads the file in the system
  // codepage and every ₹ and non-Latin character arrives corrupted.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released on the next tick rather than immediately: revoking synchronously
  // can cancel the download in some browsers before it has started reading.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
