// Detects a Kanban board inside a note's markdown: a run of "### Column
// Name" headings, each followed by "- item" / "- [ ] item" list lines (e.g.
// "### To Do" / "### Doing" / "### Done"). Everything outside that run is
// left completely untouched by extract/serialize, so a board can live
// alongside ordinary notes above or below it.
const H3_RE = /^###\s+(.+)$/;
const HIGHER_HEADING_RE = /^#{1,2}\s+/;
const LIST_ITEM_RE = /^\s*[-*]\s+(?:\[([ xX])\]\s*)?(.+)$/;

// { columns: [{ name, cards: [{ raw, text, done }] }], region: [startLine, endLine] | null }
export function extractBoard(raw) {
  const lines = (raw || "").split("\n");
  const columns = [];
  let current = null;
  let firstIdx = null;
  let lastContentIdx = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h3 = line.match(H3_RE);
    if (h3) {
      current = { name: h3[1].trim(), cards: [] };
      columns.push(current);
      if (firstIdx === null) firstIdx = i;
      lastContentIdx = i;
      continue;
    }
    if (current === null) continue; // not inside a kanban run yet
    if (HIGHER_HEADING_RE.test(line)) {
      current = null;
      continue;
    }
    const item = line.match(LIST_ITEM_RE);
    if (item) {
      current.cards.push({ raw: line, text: item[2].trim(), done: item[1] ? /x/i.test(item[1]) : null });
      lastContentIdx = i;
      continue;
    }
    if (line.trim() === "") continue; // blank lines don't end the section
    current = null; // any other content ends it
  }

  if (firstIdx === null) return { columns: [], region: null };
  return { columns, region: [firstIdx, lastContentIdx] };
}

// A note only "is" a board once it has at least two named columns -- a
// single "### To Do" with a list underneath is just a heading, not a board.
export function isKanbanBoard(raw) {
  return extractBoard(raw).columns.length >= 2;
}

export function serializeBoard(raw, columns, region) {
  const lines = (raw || "").split("\n");
  const before = lines.slice(0, region[0]);
  const after = lines.slice(region[1] + 1);
  const rebuilt = [];
  columns.forEach((col, i) => {
    rebuilt.push(`### ${col.name}`);
    col.cards.forEach((card) => rebuilt.push(card.raw));
    if (i < columns.length - 1) rebuilt.push("");
  });
  return [...before, ...rebuilt, ...after].join("\n");
}

// Moves one card to the end of a different column and returns the new raw
// text. `fromCol`/`cardIdx`/`toCol` are indices into `columns`.
export function moveCard(raw, columns, region, fromCol, cardIdx, toCol) {
  if (fromCol === toCol) return raw;
  const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
  const [card] = next[fromCol].cards.splice(cardIdx, 1);
  if (!card) return raw;
  next[toCol].cards.push(card);
  return serializeBoard(raw, next, region);
}

// Flips a card's own "[ ]"/"[x]" state in place (no-op for plain bullets,
// which have no checkbox to toggle).
export function toggleCard(raw, columns, region, colIdx, cardIdx) {
  const card = columns[colIdx]?.cards[cardIdx];
  if (!card || card.done === null) return raw;
  const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
  const target = next[colIdx].cards[cardIdx];
  const m = target.raw.match(/^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/);
  if (!m) return raw;
  target.raw = `${m[1]}${/x/i.test(m[2]) ? " " : "x"}${m[3]}`;
  target.done = !target.done;
  return serializeBoard(raw, next, region);
}
