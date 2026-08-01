// Merges an ordered set of notes into one "Master Document" with a Table of
// Contents auto-generated from each note's H1/H2 headings (falling back to
// the note's own title when it has none).
export function extractHeadings(body) {
  const headings = [];
  for (const line of (body || "").split("\n")) {
    const m = line.match(/^(#{1,2})\s+(.+)$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }
  return headings;
}

export function compileNotes(notes) {
  const toc = [];
  notes.forEach((note) => {
    const headings = extractHeadings(note.body);
    if (headings.length === 0) {
      toc.push({ level: 1, text: note.title || "Untitled" });
    } else {
      headings.forEach((h) => toc.push(h));
    }
  });

  const tocLines = toc.map((h) => `${"  ".repeat(h.level - 1)}- ${h.text}`);
  const header = ["# Table of Contents", "", ...tocLines, "", "---", ""].join("\n");
  const body = notes.map((n) => n.body || "").join("\n\n---\n\n");

  return { toc, mergedBody: `${header}\n${body}` };
}
