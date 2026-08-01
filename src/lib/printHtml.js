import { parseInline } from "./markdown";
import { columnStats, formatNumber, parseTable } from "./table";

// Page sizes in points (72pt = 1in), the unit expo-print's `width`/`height`
// options expect. A5: 148x210mm, A4: 210x297mm.
export const PAGE_SIZES = {
  A5: { width: 420, height: 595 },
  A4: { width: 595, height: 842 },
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(text) {
  return parseInline(text)
    .map((seg) => {
      let t = escapeHtml(seg.text);
      if (seg.bold) t = `<b>${t}</b>`;
      if (seg.italic) t = `<i>${t}</i>`;
      if (seg.code) t = `<code>${t}</code>`;
      return t;
    })
    .join("");
}

function blockHtml(block) {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${inlineHtml(block.text)}</h${block.level}>`;
    case "quote":
      return `<blockquote>${inlineHtml(block.text).replace(/\n/g, "<br/>")}</blockquote>`;
    case "checklist":
      return `<div class="check"><span class="box">${block.checked ? "&#10003;" : ""}</span><span${
        block.checked ? ' class="done"' : ""
      }>${inlineHtml(block.text)}</span></div>`;
    case "code":
      return `<pre>${escapeHtml(block.code)}</pre>`;
    case "table": {
      const table = parseTable(block.content);
      const headerCells = table.columns.map((c) => `<th>${escapeHtml(c.name)}</th>`).join("");
      const bodyRows = table.rows
        .map(
          (row) =>
            `<tr>${row
              .map((v, i) => `<td>${table.columns[i].type === "checkbox" ? (v ? "&#10003;" : "") : escapeHtml(v)}</td>`)
              .join("")}</tr>`
        )
        .join("");
      const hasNumber = table.columns.some((c) => c.type === "number");
      const footer = hasNumber
        ? `<tr class="stats">${table.columns
            .map((c, i) => {
              const stats = columnStats(table, i);
              return `<td>${stats ? `&Sigma; ${formatNumber(stats.sum)}` : i === 0 ? "Totals" : ""}</td>`;
            })
            .join("")}</tr>`
        : "";
      return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${footer}</tbody></table>`;
    }
    case "drawing": {
      const c = block.content.trim();
      const uri = c.startsWith("data:") ? c : `data:image/png;base64,${c}`;
      return `<img class="drawing" src="${uri}" />`;
    }
    case "blank":
      return `<div class="blank"></div>`;
    case "paragraph":
    default:
      return block.text ? `<p>${inlineHtml(block.text)}</p>` : "";
  }
}

const BASE_CSS = `
  * { -webkit-print-color-adjust: exact; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1A19; margin: 0; }
  h1, h2, h3, h4, h5, h6 { margin: 0.6em 0 0.3em; }
  p { margin: 0.35em 0; line-height: 1.5; }
  blockquote { margin: 0.5em 0; padding-inline-start: 12px; border-inline-start: 3px solid #ccc; color: #555; font-style: italic; }
  pre { background: #F0EEE8; padding: 10px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; }
  code { font-family: 'Courier New', monospace; background: #F0EEE8; padding: 1px 4px; border-radius: 3px; }
  .check { display: flex; align-items: flex-start; gap: 6px; margin: 0.25em 0; }
  .box { display: inline-block; width: 12px; }
  .done { text-decoration: line-through; color: #888; }
  table { border-collapse: collapse; width: 100%; margin: 0.5em 0; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: start; }
  th { background: #F0EEE8; }
  tr.stats td { background: #F7F5EE; font-style: italic; }
  img.drawing { max-width: 100%; border: 1px solid #ccc; border-radius: 6px; margin: 0.5em 0; }
  .blank { height: 0.6em; }
  .page { box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: auto; }
  .page-header { font-size: 9px; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; display: flex; justify-content: space-between; }
  .page-body { flex: 1; overflow: hidden; }
  .page-footer { font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 4px; margin-top: 10px; text-align: center; }
`;

// Every page is pre-split into its own sized <section> with a baked-in
// header/footer/page-number, rather than relying on CSS running elements
// (poorly/inconsistently supported by the WebView-based PDF engines behind
// expo-print) — this is what guarantees the header, footer and "Page X of
// N" actually show up on *every* page of the exported PDF.
export function buildPrintHtml(title, pages, paperSize = "A5") {
  const { width, height } = PAGE_SIZES[paperSize] || PAGE_SIZES.A5;
  const margin = 34;
  const pagesHtml = pages
    .map((blocks, i) => {
      const body = blocks.map(blockHtml).join("\n");
      return `
        <section class="page" style="width:${width}px;min-height:${height}px;padding:${margin}px;">
          <div class="page-header"><span>${escapeHtml(title)}</span><span>Second Brain</span></div>
          <div class="page-body">${body}</div>
          <div class="page-footer">Page ${i + 1} of ${pages.length}</div>
        </section>`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${BASE_CSS}</style></head><body>${pagesHtml}</body></html>`;
}
