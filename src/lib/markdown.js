// A small, dependency-free markdown subset: headings, blockquotes, checklists,
// fenced code, tables and drawings (see lib/table.js, lib/syntaxHighlight.js),
// and inline bold/italic/code. Parses into blocks the renderer walks — no AST
// library, because the feature list is fixed and small.

// ---- Block-level -----------------------------------------------------
// A block can carry an `align` of "left" (default, omitted) | "center" |
// "right", set by a standalone `<!--align:x-->` directive line immediately
// above it -- the WYSIWYG editor's alignment buttons write this directive,
// parseBlocks consumes it and attaches it to whatever block follows.
export function parseBlocks(raw) {
  const lines = (raw || "").split("\n");
  const blocks = [];
  let i = 0;
  let pendingAlign = null;
  const push = (block) => {
    if (pendingAlign) {
      block.align = pendingAlign;
      pendingAlign = null;
    }
    blocks.push(block);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    const alignMatch = trimmed.match(/^<!--align:(left|center|right)-->$/);
    if (alignMatch) {
      pendingAlign = alignMatch[1] === "left" ? null : alignMatch[1];
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const startLine = i;
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume the closing fence
      const endLine = i - 1;
      const content = codeLines.join("\n");
      if (lang === "table") push({ type: "table", content, startLine, endLine });
      else if (lang === "drawing") push({ type: "drawing", content, startLine, endLine });
      else if (lang === "calc") push({ type: "calc", content, startLine, endLine });
      else push({ type: "code", lang, code: content, startLine, endLine });
      continue;
    }

    const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      push({
        type: "checklist",
        lineIndex: i,
        checked: /x/i.test(checklistMatch[2]),
        text: checklistMatch[3],
      });
      i++;
      continue;
    }

    // A plain "- item" / "* item" bullet -- must come after the checklist
    // check above, since a checklist line also starts with "- "/"* ".
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      push({ type: "bullet", text: bulletMatch[2], indent: bulletMatch[1].length });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#{1,6}/)[0].length;
      push({ type: "heading", level, text: line.replace(/^#{1,6}\s+/, "") });
      i++;
      continue;
    }

    if (trimmed === "") {
      push({ type: "blank" });
      i++;
      continue;
    }

    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^\s*>/.test(lines[i]) &&
      !/^(\s*)[-*]\s+/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^<!--align:(left|center|right)-->$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

// Replaces a fenced block (identified by the source line range parseBlocks
// gave it) with fresh content for the same fence language — used by the
// Table editor and the Whiteboard to write their edits back into the note's
// raw markdown without disturbing anything else in it.
export function replaceFence(raw, startLine, endLine, lang, content) {
  const lines = raw.split("\n");
  const next = [`\`\`\`${lang}`, ...content.split("\n"), "```"];
  lines.splice(startLine, endLine - startLine + 1, ...next);
  return lines.join("\n");
}

// Flips the "[ ]"/"[x]" on one specific line of the raw source — used when
// a checklist row is tapped in the rendered view.
export function toggleChecklistLine(raw, lineIndex) {
  const lines = raw.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return raw;
  const m = lines[lineIndex].match(/^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/);
  if (!m) return raw;
  lines[lineIndex] = `${m[1]}${/x/i.test(m[2]) ? " " : "x"}${m[3]}`;
  return lines.join("\n");
}

// ---- Inline (bold / italic / strike / code span) ----------------------
// Combined emphasis (e.g. text that's both bold *and* italic) needs its own
// alternatives here, tried most-specific-first -- a naive single-marker
// scan would stop at the first inner `*` of a nested run and leave stray
// asterisks as literal text. The WYSIWYG editor's serializer (see
// src/lib/richtext.js) emits exactly these canonical combined forms, so
// round-tripping through save/reload preserves multi-format runs.
export function parseInline(text) {
  if (!text) return [{ text: "" }];
  const segs = [];
  const re =
    /(\*\*\*~~([^~]+)~~\*\*\*|\*\*~~([^~]+)~~\*\*|\*~~([^~]+)~~\*|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true, italic: true, strike: true });
    else if (m[3] !== undefined) segs.push({ text: m[3], bold: true, strike: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], italic: true, strike: true });
    else if (m[5] !== undefined) segs.push({ text: m[5], bold: true, italic: true });
    else if (m[6] !== undefined) segs.push({ text: m[6], bold: true });
    else if (m[7] !== undefined) segs.push({ text: m[7], strike: true });
    else if (m[8] !== undefined) segs.push({ text: m[8], code: true });
    else if (m[9] !== undefined) segs.push({ text: m[9], italic: true });
    else if (m[10] !== undefined) segs.push({ text: m[10], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

// Code-block syntax highlighting now lives in its own module — see
// src/lib/syntaxHighlight.js — since it's substantial enough (and reused by
// both the editor's rendered view and the PDF print path) to earn one.

export function countWords(text) {
  const trimmed = (text || "").trim();
  return { words: trimmed ? trimmed.split(/\s+/).length : 0, chars: (text || "").length };
}
