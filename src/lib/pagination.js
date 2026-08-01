import { parseBlocks } from "./markdown";

// Rough, deterministic block -> line-count estimate used to decide where
// page breaks fall, for both the in-app Print Preview and the page-number
// markup baked into the exported PDF's HTML. There's no real text-layout
// engine available offline, so this estimates from character counts against
// an assumed characters-per-line for the target page width — "basic"
// pagination, not typeset-perfect. The actual PDF's page *boundaries* are
// still exact regardless (each estimated page becomes one CSS page-break),
// only how much content lands on a given page is approximate.
function estimateLines(block, charsPerLine) {
  switch (block.type) {
    case "blank":
      return 1;
    case "heading":
      return Math.ceil((block.text.length || 1) / (charsPerLine * 0.7)) + 1;
    case "code":
      return block.code.split("\n").length + 2;
    case "table":
      return 4;
    case "drawing":
      return 12;
    case "quote":
    case "checklist":
    case "paragraph":
    default: {
      const text = block.text || "";
      return Math.max(1, Math.ceil(text.length / charsPerLine));
    }
  }
}

export function paginate(body, { linesPerPage = 42, charsPerLine = 84 } = {}) {
  const blocks = parseBlocks(body);
  const pages = [[]];
  let used = 0;
  for (const block of blocks) {
    const lines = estimateLines(block, charsPerLine);
    if (used + lines > linesPerPage && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block);
    used += lines;
  }
  return pages;
}
