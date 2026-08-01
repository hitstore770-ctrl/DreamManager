// [[Note Title]] internal links — used by the Knowledge Graph to draw edges
// between notes that explicitly reference each other, in addition to edges
// from shared tags.
const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;

export function extractWikiLinks(text) {
  const matches = (text || "").match(WIKILINK_RE) || [];
  const seen = [];
  for (const m of matches) {
    const title = m.slice(2, -2).trim();
    if (title && !seen.includes(title)) seen.push(title);
  }
  return seen;
}
