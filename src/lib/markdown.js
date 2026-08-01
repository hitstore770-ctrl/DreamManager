// A small, dependency-free markdown subset: headings, blockquotes, checklists,
// fenced code, tables and drawings (see lib/table.js, lib/syntaxHighlight.js),
// and inline bold/italic/code. Parses into blocks the renderer walks — no AST
// library, because the feature list is fixed and small.

// ---- Block-level -----------------------------------------------------
export function parseBlocks(raw) {
  const lines = (raw || "").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

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
      if (lang === "table") blocks.push({ type: "table", content, startLine, endLine });
      else if (lang === "drawing") blocks.push({ type: "drawing", content, startLine, endLine });
      else blocks.push({ type: "code", lang, code: content, startLine, endLine });
      continue;
    }

    const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      blocks.push({
        type: "checklist",
        lineIndex: i,
        checked: /x/i.test(checklistMatch[2]),
        text: checklistMatch[3],
      });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#{1,6}/)[0].length;
      blocks.push({ type: "heading", level, text: line.replace(/^#{1,6}\s+/, "") });
      i++;
      continue;
    }

    if (trimmed === "") {
      blocks.push({ type: "blank" });
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
      !/^(\s*)[-*]\s+\[([ xX])\]/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
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

// ---- Inline (bold / italic / code span) -------------------------------
export function parseInline(text) {
  if (!text) return [{ text: "" }];
  const segs = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) segs.push({ text: m[3], code: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], italic: true });
    else if (m[5] !== undefined) segs.push({ text: m[5], italic: true });
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
