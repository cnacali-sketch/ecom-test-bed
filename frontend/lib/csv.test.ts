/**
 * CSV escaping.
 *
 * Every failure this covers is silent: the file opens, Excel shows something,
 * and it is wrong. Nobody gets an error to investigate — they get a
 * spreadsheet that quietly disagrees with the shop's own records, or in the
 * formula-injection case, one that runs code when opened.
 */

import { describe, expect, test } from "vitest";

import { csvCell, csvStamp, toCsv, type CsvColumn } from "./csv";

describe("formula injection", () => {
  /**
   * Every name, address line and note in these exports was typed by a member
   * of the public into a checkout form. Excel, Google Sheets and LibreOffice
   * all execute a cell that starts with one of these characters.
   */
  test.each([
    ["=HYPERLINK(\"http://evil\",\"Click\")", "="],
    ["+1+1", "+"],
    ["-2+3", "-"],
    ["@SUM(A1:A9)", "@"],
  ])("neutralises a cell starting with %s", (payload) => {
    expect(csvCell(payload).replace(/^"|"$/g, "")).toMatch(/^'/);
  });

  test("a leading tab or carriage return is treated the same way", () => {
    /** Both are accepted by spreadsheets as formula leaders, and both are
     * invisible to whoever is reading the export. */
    expect(csvCell("\t=1+1")).toContain("'");
    expect(csvCell("\r=1+1")).toContain("'");
  });

  test("the guard survives quoting rather than sitting outside it", () => {
    const cell = csvCell("=cmd|'/c calc'!A1, and more");
    expect(cell.startsWith("\"'")).toBe(true);
  });

  test("an ordinary name is left exactly as typed", () => {
    /** Over-escaping is its own bug: a shop that sees apostrophes on every
     * row stops trusting the export. */
    expect(csvCell("Priya Nair")).toBe("Priya Nair");
    expect(csvCell("O'Brien")).toBe("O'Brien");
  });

  test("a negative amount is left as a number, not guarded into text", () => {
    /** A refund line is legitimately negative, and money reaches this
     * function as a string ("-200.00"), so the leading-minus guard would hit
     * the common case rather than an edge one. Guarding it breaks every SUM
     * in the accountant's sheet, which is the main reason this export
     * exists. */
    expect(csvCell(-200)).toBe("-200");
    expect(csvCell("-200.00")).toBe("-200.00");
    expect(csvCell("1499.00")).toBe("1499.00");
  });

  test("a formula that merely opens with a minus is still neutralised", () => {
    /** The exemption is only for text that parses as a plain number, and no
     * formula does. */
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("-1e9")).toBe("'-1e9");
  });
});

describe("quoting", () => {
  test("a comma does not shift every later column", () => {
    /** Indian addresses contain commas as a matter of course. Unquoted, the
     * city lands under the postcode heading and nobody notices. */
    expect(csvCell("12 MG Road, Bangalore")).toBe('"12 MG Road, Bangalore"');
  });

  test("a quote is doubled, not dropped", () => {
    expect(csvCell('He said "leave it at the gate"')).toBe(
      '"He said ""leave it at the gate"""',
    );
  });

  test("a newline inside a note stays inside its cell", () => {
    expect(csvCell("Line one\nLine two")).toBe('"Line one\nLine two"');
  });

  test("empty and missing values are blank, not the word null", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });

  test("zero is exported as zero, not as blank", () => {
    /** The classic falsy bug. A zero refund is a fact; a blank is a gap. */
    expect(csvCell(0)).toBe("0");
  });
});

describe("assembling the file", () => {
  interface Row {
    name: string;
    total: number;
  }
  const columns: CsvColumn<Row>[] = [
    { header: "Customer", value: (r) => r.name },
    { header: "Total", value: (r) => r.total },
  ];

  test("writes a header row followed by the data", () => {
    const csv = toCsv([{ name: "Priya", total: 1499 }], columns);
    expect(csv).toBe("Customer,Total\r\nPriya,1499");
  });

  test("uses CRLF, which is what the CSV spec says and Excel expects", () => {
    const csv = toCsv(
      [
        { name: "A", total: 1 },
        { name: "B", total: 2 },
      ],
      columns,
    );
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  test("an empty export is still a valid file with headings", () => {
    /** Exporting a filter that matched nothing should open and show the
     * columns, not produce a zero-byte file that looks like a failure. */
    expect(toCsv([], columns)).toBe("Customer,Total");
  });

  test("headers are escaped too", () => {
    /** They are ordinary strings, and a column named "Total, incl. GST" would
     * otherwise break the header row specifically. */
    const csv = toCsv([], [{ header: "Total, incl. GST", value: () => "" }]);
    expect(csv).toBe('"Total, incl. GST"');
  });

  test("a row with a comma keeps its columns aligned with the header", () => {
    const csv = toCsv([{ name: "Nair, Priya", total: 1499 }], columns);
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toBe('"Nair, Priya",1499');
  });
});

describe("the filename stamp", () => {
  test("is a sortable local date", () => {
    expect(csvStamp(new Date(2026, 8, 12))).toBe("2026-09-12");
  });

  test("pads single digits so filenames sort correctly", () => {
    expect(csvStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("uses local time, not UTC", () => {
    /** Same trap as the analytics window: toISOString() would name the file
     * after yesterday for anything before 05:30 in IST. */
    const lateEvening = new Date(2026, 8, 12, 23, 30);
    expect(csvStamp(lateEvening)).toBe("2026-09-12");
  });
});

describe("downloading", () => {
  test("does nothing outside a browser instead of throwing", async () => {
    /** This module is imported by components that Next renders on the server
     * during the build. */
    const { downloadCsv } = await import("./csv");
    const doc = globalThis.document;
    // @ts-expect-error - deliberately removing it to stand in for SSR
    delete globalThis.document;
    try {
      expect(() => downloadCsv("x.csv", "a,b")).not.toThrow();
    } finally {
      globalThis.document = doc;
    }
  });
});

describe("a realistic order export", () => {
  test("survives an address with a comma and a customer named as a formula", () => {
    /** Both hazards on one row, which is the case that actually reaches a
     * shop: the hostile value arrives in the same export as ordinary data. */
    const csv = toCsv(
      [{ name: "=1+1", address: "12 MG Road, Bangalore", total: 1499 }],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Address", value: (r) => r.address },
        { header: "Total", value: (r) => r.total },
      ],
    );
    expect(csv.split("\r\n")[1]).toBe("'=1+1,\"12 MG Road, Bangalore\",1499");
  });
});
