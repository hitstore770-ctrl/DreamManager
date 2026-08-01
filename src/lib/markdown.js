// A small, dependency-free markdown subset: headings, blockquotes, checklists,
// fenced code (with a basic keyword/string/comment/number tokenizer), and
// inline bold/italic/code. Parses into blocks the renderer walks — no AST
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
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume the closing fence
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
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

// ---- Basic code-block syntax highlighting ------------------------------
const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "import", "export", "default", "from", "as", "class", "extends", "new", "this",
  "async", "await", "try", "catch", "finally", "throw", "switch", "case", "break",
  "continue", "typeof", "instanceof", "null", "undefined", "true", "false", "void",
  "def", "elif", "print", "in", "is", "not", "and", "or", "lambda", "yield", "pass",
  "self", "public", "private", "static", "interface", "implements", "package", "struct",
  "fn", "match", "impl", "use", "mod",
]);

// One line -> [{ text, kind }]. `kind` drives the color: comment / string /
// number / keyword / plain.
export function tokenizeCodeLine(line) {
  const tokens = [];
  const re = /(\/\/.*)|(#.*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\sA-Za-z0-9_$]+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1] !== undefined) tokens.push({ text: m[1], kind: "comment" });
    else if (m[2] !== undefined) tokens.push({ text: m[2], kind: "comment" });
    else if (m[3] !== undefined) tokens.push({ text: m[3], kind: "string" });
    else if (m[4] !== undefined) tokens.push({ text: m[4], kind: "number" });
    else if (m[5] !== undefined) tokens.push({ text: m[5], kind: KEYWORDS.has(m[5]) ? "keyword" : "plain" });
    else if (m[6] !== undefined) tokens.push({ text: m[6], kind: "plain" });
    else tokens.push({ text: m[7], kind: "punct" });
  }
  return tokens;
}

export function countWords(text) {
  const trimmed = (text || "").trim();
  return { words: trimmed ? trimmed.split(/\s+/).length : 0, chars: (text || "").length };
}
