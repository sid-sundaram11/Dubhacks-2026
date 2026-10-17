import type { CatalogStar } from "../../domain/star";

export interface ParsedHyg {
  sourceCount: number;
  invalidCount: number;
  rows: CatalogStar[];
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function optionalNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseHygCsv(text: string): ParsedHyg {
  const table = parseCsv(text);
  const header = table[0] ?? [];
  const index = new Map(header.map((name, column) => [name, column]));
  const column = (name: string) => index.get(name) ?? -1;
  const idCol = column("id");
  const hipCol = column("hip");
  const bfCol = column("bf");
  const properCol = column("proper");
  const raCol = column("ra");
  const decCol = column("dec");
  const magCol = column("mag");
  const ciCol = column("ci");
  const conCol = column("con");
  const rows: CatalogStar[] = [];
  let invalidCount = 0;
  const sourceCount = Math.max(0, table.length - 1);

  for (const record of table.slice(1)) {
    const id = optionalNumber(record[idCol]);
    const ra = optionalNumber(record[raCol]);
    const dec = optionalNumber(record[decCol]);
    const magnitude = optionalNumber(record[magCol]);
    if (id == null || ra == null || dec == null || magnitude == null || !Number.isInteger(id)) {
      invalidCount += 1;
      continue;
    }
    const proper = (record[properCol] ?? "").trim();
    const designation = (record[bfCol] ?? "").trim();
    const constellation = (record[conCol] ?? "").trim();
    rows.push({
      id,
      hip: optionalNumber(record[hipCol]),
      name: proper.length > 0 ? proper : null,
      designation: designation.length > 0 ? designation : null,
      ra,
      dec,
      magnitude,
      colorIndex: optionalNumber(record[ciCol]),
      constellation: constellation.length > 0 ? constellation : null,
    });
  }

  return { sourceCount, invalidCount, rows };
}
