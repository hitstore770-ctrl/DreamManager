// ```table fenced blocks store a small typed spreadsheet as JSON — an array
// of typed columns and rows of matching length. JSON rather than a
// hand-typed pipe-table grammar, because these tables are always edited
// through TableEditorModal, never by hand in raw mode: round-trip fidelity
// (typed cells, stable column order) matters more than raw-text readability
// for a structured feature like this.
export const COLUMN_TYPES = ["text", "number", "checkbox"];

function defaultForType(type) {
  if (type === "number") return 0;
  if (type === "checkbox") return false;
  return "";
}

export function emptyTable() {
  return {
    columns: [
      { name: "Item", type: "text" },
      { name: "Qty", type: "number" },
      { name: "Done", type: "checkbox" },
    ],
    rows: [["", 0, false]],
  };
}

export function parseTable(content) {
  try {
    const data = JSON.parse(content);
    if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) return emptyTable();
    const columns = data.columns.map((c) => ({
      name: c?.name || "Column",
      type: COLUMN_TYPES.includes(c?.type) ? c.type : "text",
    }));
    const rows = data.rows.map((r) => columns.map((c, i) => (r?.[i] !== undefined ? r[i] : defaultForType(c.type))));
    return { columns, rows };
  } catch {
    return emptyTable();
  }
}

export function serializeTable(table) {
  return JSON.stringify({ columns: table.columns, rows: table.rows });
}

export function sortedRows(table, columnIndex, direction) {
  if (columnIndex == null || !direction) return table.rows;
  const col = table.columns[columnIndex];
  if (!col) return table.rows;
  const indexed = table.rows.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => {
    const av = a.row[columnIndex];
    const bv = b.row[columnIndex];
    let cmp;
    if (col.type === "number") cmp = (Number(av) || 0) - (Number(bv) || 0);
    else if (col.type === "checkbox") cmp = (av ? 1 : 0) - (bv ? 1 : 0);
    else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    if (cmp === 0) cmp = a.i - b.i; // stable sort
    return direction === "desc" ? -cmp : cmp;
  });
  return indexed.map((x) => x.row);
}

// { sum, avg } for a number column, or null for any other column type.
export function columnStats(table, columnIndex) {
  const col = table.columns[columnIndex];
  if (!col || col.type !== "number") return null;
  const values = table.rows.map((r) => Number(r[columnIndex]) || 0);
  const sum = values.reduce((a, b) => a + b, 0);
  return { sum, avg: values.length ? sum / values.length : 0 };
}

function formatNumber(n) {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}
export { formatNumber };
