// Bridges the app's markdown subset (src/lib/markdown.js) with the HTML a
// contentEditable WYSIWYG surface needs.
//
// markdownToHtml() is a plain string builder -- reuses the existing
// parseBlocks/parseInline tokenizer, no DOM required, so it runs the same
// way on web and inside a native WebView.
//
// domToMarkdown() walks a *live DOM node* (not a re-parsed HTML string).
// That works identically in both places: on web the contentEditable div is
// a real browser DOM node, and inside a WebView the editor's content is
// also a real DOM in that WebView's own document -- no HTML-parser
// dependency needed either way.
import { parseBlocks, parseInline } from "./markdown";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function segsToHtml(segs) {
  const html = segs
    .map((seg) => {
      let t = escapeHtml(seg.text).replace(/\n/g, "<br>");
      if (seg.code) t = `<code>${t}</code>`;
      if (seg.bold) t = `<b>${t}</b>`;
      if (seg.italic) t = `<i>${t}</i>`;
      if (seg.strike) t = `<s>${t}</s>`;
      return t;
    })
    .join("");
  return html || "<br>";
}

function alignAttr(align) {
  return align && align !== "left" ? ` style="text-align:${align}"` : "";
}

const EMBED_LABEL = { table: "Table", drawing: "Drawing", code: "Code block" };

// A fenced block (table/drawing/code) becomes a non-editable placeholder
// card -- the WYSIWYG surface doesn't try to make these directly editable
// (that stays in the dedicated Table/Whiteboard editors, reached from
// Preview mode); it just needs to render as something other than raw
// backticks, and round-trip back out untouched.
function embedHtml(block) {
  const raw =
    block.type === "code"
      ? "```" + (block.lang || "") + "\n" + block.code + "\n```"
      : "```" + block.type + "\n" + block.content + "\n```";
  return `<div class="md-embed" contenteditable="false" data-embed="${encodeURIComponent(raw)}">${EMBED_LABEL[block.type]} — edit from Preview</div>`;
}

export function markdownToHtml(md) {
  const blocks = parseBlocks(md || "");
  let html = "";
  let bulletBuffer = [];
  const flushBullets = () => {
    if (bulletBuffer.length) {
      html += `<ul>${bulletBuffer.map((t) => `<li>${segsToHtml(parseInline(t))}</li>`).join("")}</ul>`;
      bulletBuffer = [];
    }
  };
  for (const b of blocks) {
    if (b.type !== "bullet") flushBullets();
    if (b.type === "heading") {
      const tag = `h${b.level}`;
      html += `<${tag}${alignAttr(b.align)}>${segsToHtml(parseInline(b.text))}</${tag}>`;
    } else if (b.type === "quote") {
      html += `<blockquote${alignAttr(b.align)}>${segsToHtml(parseInline(b.text))}</blockquote>`;
    } else if (b.type === "checklist") {
      html += `<p class="checklist-line"${alignAttr(b.align)}>${b.checked ? "☑" : "☐"} ${segsToHtml(parseInline(b.text))}</p>`;
    } else if (b.type === "bullet") {
      bulletBuffer.push(b.text);
    } else if (b.type === "table" || b.type === "drawing" || b.type === "code") {
      html += embedHtml(b);
    } else if (b.type === "paragraph") {
      html += `<p${alignAttr(b.align)}>${segsToHtml(parseInline(b.text))}</p>`;
    }
    // "blank" blocks are skipped -- block spacing is implicit in the rendered view.
  }
  flushBullets();
  return html || "<p><br></p>";
}

// Flattens a block's inline DOM into runs of plain text tagged with the
// *combined* set of formatting flags active at that point (accumulated
// from every ancestor, however deeply nested the tags are), then re-merges
// adjacent runs that ended up with identical flags. Emitting from flags
// this way -- rather than mirroring the DOM's actual tag nesting 1:1 --
// guarantees a canonical, unambiguous marker order that parseInline's
// regex (see src/lib/markdown.js) can always re-parse, regardless of how a
// browser's execCommand happened to nest the underlying <b>/<i>/<s> tags.
function collectRuns(node, flags, runs) {
  if (node.nodeType === 3) {
    const text = node.textContent || "";
    if (text) runs.push({ text, ...flags });
    return;
  }
  if (node.nodeType !== 1) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    runs.push({ text: "\n", bold: false, italic: false, strike: false, code: false });
    return;
  }
  // Toggling the bullets button off with the caret in only one list item
  // can leave the browser's contentEditable with a stray <ul> nested
  // inside a <p> instead of a clean top-level list. domToMarkdown only
  // special-cases <ul>/<ol> at the block level, so without this a nested
  // one would just get silently flattened into plain text, losing the
  // bullet markers and the line breaks between items entirely.
  if (tag === "ul" || tag === "ol") {
    Array.from(node.children).forEach((li, idx) => {
      runs.push({ text: `${idx === 0 ? "" : "\n"}- `, bold: false, italic: false, strike: false, code: false });
      Array.from(li.childNodes).forEach((child) => collectRuns(child, flags, runs));
    });
    return;
  }
  let next = flags;
  if (tag === "b" || tag === "strong") next = { ...flags, bold: true };
  else if (tag === "i" || tag === "em") next = { ...flags, italic: true };
  else if (tag === "s" || tag === "strike" || tag === "del") next = { ...flags, strike: true };
  else if (tag === "code") next = { ...flags, code: true };
  Array.from(node.childNodes).forEach((child) => collectRuns(child, next, runs));
}

function wrapRun(text, { bold, italic, strike, code }) {
  if (!text.trim()) return text;
  if (code) return `\`${text}\``;
  let t = text;
  if (strike) t = `~~${t}~~`;
  if (bold && italic) t = `***${t}***`;
  else if (bold) t = `**${t}**`;
  else if (italic) t = `*${t}*`;
  return t;
}

function blockInlineToMarkdown(node) {
  const runs = [];
  collectRuns(node, { bold: false, italic: false, strike: false, code: false }, runs);
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic && last.strike === r.strike && last.code === r.code) {
      last.text += r.text;
    } else {
      merged.push({ ...r });
    }
  }
  return merged.map((r) => wrapRun(r.text, r)).join("");
}

function blockAlign(el) {
  const align = el.style && el.style.textAlign;
  return align === "center" || align === "right" ? align : null;
}

function withAlignDirective(align, line) {
  return align ? `<!--align:${align}-->\n${line}` : line;
}

// Walks the top-level children of the editor's root content node and
// reconstructs the equivalent markdown source.
export function domToMarkdown(root) {
  const lines = [];
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      const t = (node.textContent || "").trim();
      if (t) lines.push(t);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const align = blockAlign(node);

    if (tag === "div" && node.dataset && node.dataset.embed) {
      lines.push(decodeURIComponent(node.dataset.embed));
      lines.push("");
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = blockInlineToMarkdown(node).trim();
      lines.push(withAlignDirective(align, `${"#".repeat(level)} ${text}`));
      lines.push("");
      return;
    }
    if (tag === "blockquote") {
      const text = blockInlineToMarkdown(node).trim();
      lines.push(withAlignDirective(align, text.split("\n").map((l) => `> ${l}`).join("\n")));
      lines.push("");
      return;
    }
    if (tag === "ul" || tag === "ol") {
      Array.from(node.children).forEach((li) => {
        const text = blockInlineToMarkdown(li).trim();
        lines.push(`- ${text}`);
      });
      lines.push("");
      return;
    }
    if (tag === "p" || tag === "div") {
      const raw = blockInlineToMarkdown(node);
      // A checklist line round-trips its leading glyph back into "- [ ]"/"- [x]".
      const checklist = raw.match(/^\s*[☐☑] ?(.*)$/s);
      if (checklist) {
        const checked = raw.trim().startsWith("☑");
        lines.push(withAlignDirective(align, `- [${checked ? "x" : " "}] ${checklist[1].trim()}`));
        lines.push("");
        return;
      }
      const text = raw.trim();
      if (text) lines.push(withAlignDirective(align, text));
      lines.push("");
      return;
    }
    if (tag === "br") {
      lines.push("");
    }
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

// Wraps a markdown fragment (e.g. from the Insert menu or Snippet picker)
// as an HTML fragment suitable for `insertAdjacentHTML`/`insertHTML` at the
// current caret position.
export function markdownFragmentToHtml(md) {
  return markdownToHtml(md);
}

// ---- Native (WebView) fallback: string-based HTML -> markdown ----------
// The WebView's page has a real DOM too, so domToMarkdown *could* run
// there, but getting a markdown string back out means either duplicating
// that logic inside the injected page's script (unverifiable from this
// sandbox, and Hermes can't be trusted to preserve function source via
// .toString() in a release build for the reverse trick) or parsing the
// HTML string it posts back here. This is that parser -- regex-based, but
// scoped tightly to exactly the tags our own editor page emits (h1-h6, p,
// div, ul/li, blockquote, b/strong/i/em/s/code/br, and our .md-embed
// placeholder), not a general HTML parser.
const B = "(?:b|strong)";
const I = "(?:i|em)";
const S = "(?:s|strike|del)";

// Resolves nested tag pairs from the innermost combination outward, so a
// run that's e.g. both bold *and* italic collapses to the same canonical
// `***text***` form domToMarkdown emits on web -- matching parseInline's
// combined-emphasis patterns (see markdown.js) instead of leaving stray
// asterisks behind. Covers two-level nesting in either tag order, which is
// what execCommand actually produces; a third level (bold+italic+strike
// all at once) is a rarer case this pass doesn't chase further.
function stripTags(inner) {
  let html = inner;
  const combos = [
    [new RegExp(`<${B}><${I}>([\\s\\S]*?)<\\/${I}><\\/${B}>`, "gi"), "***$1***"],
    [new RegExp(`<${I}><${B}>([\\s\\S]*?)<\\/${B}><\\/${I}>`, "gi"), "***$1***"],
    [new RegExp(`<${B}><${S}>([\\s\\S]*?)<\\/${S}><\\/${B}>`, "gi"), "**~~$1~~**"],
    [new RegExp(`<${S}><${B}>([\\s\\S]*?)<\\/${B}><\\/${S}>`, "gi"), "**~~$1~~**"],
    [new RegExp(`<${I}><${S}>([\\s\\S]*?)<\\/${S}><\\/${I}>`, "gi"), "*~~$1~~*"],
    [new RegExp(`<${S}><${I}>([\\s\\S]*?)<\\/${I}><\\/${S}>`, "gi"), "*~~$1~~*"],
  ];
  for (const [re, replacement] of combos) {
    html = html.replace(re, (_, t) => (t.trim() ? replacement.replace("$1", t) : t));
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `**${t}**` : t))
    .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `*${t}*` : t))
    .replace(/<(s|strike|del)>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `~~${t}~~` : t))
    .replace(/<code>([\s\S]*?)<\/code>/gi, (_, t) => (t.trim() ? `\`${t}\`` : t))
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function blockAlignFromAttrs(attrs) {
  const m = /text-align:\s*(center|right)/i.exec(attrs || "");
  return m ? m[1].toLowerCase() : null;
}

export function htmlStringToMarkdown(html) {
  const lines = [];
  const blockRe = /<(h[1-6]|p|div|ul|ol|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  let matchedAny = false;
  while ((m = blockRe.exec(html)) !== null) {
    matchedAny = true;
    const [, tagRaw, attrs, inner] = m;
    const tag = tagRaw.toLowerCase();
    const embedMatch = /data-embed="([^"]*)"/i.exec(attrs);
    if (embedMatch) {
      lines.push(decodeURIComponent(embedMatch[1]));
      lines.push("");
      continue;
    }
    const align = blockAlignFromAttrs(attrs);
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      lines.push(withAlignDirective(align, `${"#".repeat(level)} ${stripTags(inner)}`));
      lines.push("");
    } else if (tag === "blockquote") {
      const text = stripTags(inner);
      lines.push(withAlignDirective(align, text.split("\n").map((l) => `> ${l}`).join("\n")));
      lines.push("");
    } else if (tag === "ul" || tag === "ol") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li;
      while ((li = liRe.exec(inner)) !== null) lines.push(`- ${stripTags(li[1])}`);
      lines.push("");
    } else {
      const raw = stripTags(inner);
      const checklist = raw.match(/^\s*[☐☑] ?([\s\S]*)$/);
      if (checklist) {
        const checked = raw.trim().startsWith("☑");
        lines.push(withAlignDirective(align, `- [${checked ? "x" : " "}] ${checklist[1].trim()}`));
      } else if (raw.trim()) {
        lines.push(withAlignDirective(align, raw.trim()));
      } else {
        lines.push("");
      }
      lines.push("");
    }
  }
  if (!matchedAny) {
    const text = stripTags(html);
    if (text) lines.push(text);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
