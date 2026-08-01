// The app's pure-JS, fully offline code-block tokenizer. There is no bundled
// external grammar database (no highlight.js/Prism/TextMate grammars) — that
// is a deliberate choice to keep the app's zero-network promise and bundle
// size small, not an oversight. This *is* "the pure-JS offline syntax
// highlighting library" the note editor ships.
//
// Tokenizes a whole code block in a single pass (not line-by-line), so block
// comments (`/* ... */`, `<!-- ... -->`) and multi-line strings (Python
// triple-quotes, JS template literals) are classified correctly across line
// breaks — a per-line tokenizer can't do that.

const KEYWORDS = new Set([
  // control flow / declarations, shared loosely across C-family + scripting
  // languages — a single merged set rather than one grammar per language.
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch",
  "case", "break", "continue", "default", "class", "extends", "implements", "interface",
  "enum", "namespace", "type", "satisfies", "keyof", "readonly", "new", "this", "super",
  "import", "export", "from", "as", "async", "await", "yield", "try", "catch", "finally",
  "throw", "typeof", "instanceof", "public", "private", "protected", "static", "abstract",
  "package", "struct", "impl", "trait", "fn", "mod", "use", "match", "mut", "def", "elif",
  "lambda", "pass", "self", "cls", "with", "in", "is", "not", "and", "or", "raise", "global",
  "local", "then", "do", "done", "begin", "end", "echo", "func", "var", "let", "guard",
  "print", "printf", "console",
]);

const LITERALS = new Set(["null", "undefined", "none", "nil", "nan", "true", "false"]);

function lineCommentPrefix(lang) {
  const l = (lang || "").toLowerCase();
  if (["css", "scss", "less", "html", "htm", "xml", "svg"].includes(l)) return null; // block-only comments
  if (["py", "python", "sh", "bash", "zsh", "shell", "yaml", "yml", "ruby", "rb", "r", "toml", "dockerfile", "make", "makefile"].includes(l)) {
    return "#";
  }
  if (["sql", "lua", "hs", "haskell"].includes(l)) return "--";
  return "//";
}

// Whole code block -> flat [{ text, kind }]. `kind`: comment / string /
// number / keyword / literal / plain / punct.
export function tokenizeCode(code, lang) {
  const linePrefix = lineCommentPrefix(lang);
  const src = code || "";
  const n = src.length;
  const tokens = [];
  let i = 0;

  while (i < n) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      tokens.push({ text: src.slice(i, stop), kind: "comment" });
      i = stop;
      continue;
    }
    if (src.slice(i, i + 4) === "<!--") {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ text: src.slice(i, stop), kind: "comment" });
      i = stop;
      continue;
    }
    if (linePrefix && src.slice(i, i + linePrefix.length) === linePrefix) {
      let end = src.indexOf("\n", i);
      if (end === -1) end = n;
      tokens.push({ text: src.slice(i, end), kind: "comment" });
      i = end;
      continue;
    }
    const triple = src.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      const end = src.indexOf(triple, i + 3);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ text: src.slice(i, stop), kind: "string" });
      i = stop;
      continue;
    }
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === "\\") j++;
        else if (ch !== "`" && src[j] === "\n") break; // single/double quotes don't span lines
        j++;
      }
      const stop = Math.min(j + 1, n);
      tokens.push({ text: src.slice(i, stop), kind: "string" });
      i = stop;
      continue;
    }
    if (/[0-9]/.test(ch) && !/[A-Za-z0-9_$]/.test(src[i - 1] || "")) {
      const m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (m) {
        tokens.push({ text: m[0], kind: "number" });
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      const word = m[0];
      const lower = word.toLowerCase();
      tokens.push({ text: word, kind: LITERALS.has(lower) ? "literal" : KEYWORDS.has(word) ? "keyword" : "plain" });
      i += word.length;
      continue;
    }
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(src.slice(i));
      tokens.push({ text: m[0], kind: "plain" });
      i += m[0].length;
      continue;
    }
    tokens.push({ text: ch, kind: "punct" });
    i += 1;
  }

  return tokens;
}

// Splits the flat token stream back into per-line token arrays for
// rendering (one <Text> row per source line), preserving each token's kind
// across the split so multi-line tokens still color consistently.
export function tokenizeCodeLines(code, lang) {
  const tokens = tokenizeCode(code, lang);
  const lines = [[]];
  for (const tok of tokens) {
    const parts = tok.text.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: tok.kind });
    });
  }
  return lines;
}
