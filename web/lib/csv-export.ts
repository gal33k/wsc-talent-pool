// Client-side CSV export. No dependency — just Blob + download link.
// Excel-compatible: BOM prefix so Hebrew/UTF-8 characters render correctly
// when the file is opened directly in Excel.

export type CsvColumn<T> = {
  label: string;
  get: (row: T) => string | number | undefined | null;
};

function escapeCell(v: string | number | undefined | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map(c => escapeCell(c.label)).join(",");
  const body = rows.map(r => columns.map(c => escapeCell(c.get(r))).join(",")).join("\r\n");
  // UTF-8 BOM so Excel opens the file with the correct encoding.
  return "﻿" + header + "\r\n" + body + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportRows<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadCsv(filename, buildCsv(rows, columns));
}
