import { describe, it, expect } from "vitest";
import { formatCsv } from "../../src/domain/reports/exports.service.js";

describe("exports CSV formatting", () => {
  it("formats standard headers and rows", () => {
    const headers = ["ID", "Name", "Amount"];
    const rows = [
      ["1", "Alice", 100],
      ["2", "Bob", 250],
    ];
    const csv = formatCsv(headers, rows);
    expect(csv).toBe("ID,Name,Amount\r\n1,Alice,100\r\n2,Bob,250");
  });

  it("escapes fields containing commas", () => {
    const headers = ["Quote Number", "Customer Name"];
    const rows = [["Q-100", "Acme, Inc."]];
    const csv = formatCsv(headers, rows);
    expect(csv).toBe('Quote Number,Customer Name\r\nQ-100,"Acme, Inc."');
  });

  it("escapes fields containing double quotes according to RFC 4180", () => {
    const headers = ["Title", "Note"];
    const rows = [["Quote 1", 'Contains "quoted" text']];
    const csv = formatCsv(headers, rows);
    expect(csv).toBe('Title,Note\r\nQuote 1,"Contains ""quoted"" text"');
  });

  it("escapes fields containing newlines", () => {
    const headers = ["ID", "Description"];
    const rows = [["1", "Line 1\nLine 2"]];
    const csv = formatCsv(headers, rows);
    expect(csv).toBe('ID,Description\r\n1,"Line 1\nLine 2"');
  });

  it("treats null and undefined as empty strings", () => {
    const headers = ["ID", "Discount", "Note"];
    const rows = [["1", null, undefined]];
    const csv = formatCsv(headers, rows);
    expect(csv).toBe("ID,Discount,Note\r\n1,,");
  });
});
