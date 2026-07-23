// Ultra-light inline markdown for the note preview. Supports **bold**,
// *italic* and __underline__. Returns an array of style segments the editor
// renders with <Text>. Non-nested by design (keeps it predictable and fast).

export function parseInline(text) {
  if (!text) return [{ text: "" }];
  const segs = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) segs.push({ text: m[3], underline: true });
    else if (m[4] !== undefined) segs.push({ text: m[4], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

// Wrap the current selection [start,end) of `value` with `marker` on both
// sides — used by the B/I/U toolbar buttons. Returns the new string plus the
// caret position to restore.
export function wrapSelection(value, start, end, marker) {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const selected = value.slice(s, e) || "טקסט";
  const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
  return { text: next, caret: s + marker.length + selected.length + marker.length };
}

export function countWords(text) {
  const trimmed = (text || "").trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return { chars: (text || "").length, words };
}
