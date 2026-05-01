const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export type CsvCellValue = string | number | null | undefined;

export function csvCell(value: CsvCellValue) {
  const rawValue = String(value ?? "");
  const safeValue = CSV_FORMULA_PREFIX_PATTERN.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvCellValue[][]) {
  return rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
}
