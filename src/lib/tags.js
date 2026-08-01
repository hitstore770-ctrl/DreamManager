// Inline #tag detection + nested tag-tree helpers for the Tag Index.
//
// A tag is "#" followed by a word-char, then any run of letters/numbers/_/-,
// optionally repeated after "/" for nesting: "#coding/react-native/hooks".
// The leading-word-char requirement is what stops "# Heading" (markdown
// headers use "# " with a space) and a bare "#" from being read as tags.
const TAG_RE = /#([\p{L}\p{N}_][\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_][\p{L}\p{N}_-]*)*)/gu;

// Root tags are the only ones assigned a color; nested tags inherit their
// root's color so a whole branch reads as one visual group.
const TAG_PALETTE = [
  "#3E7BD6",
  "#10B981",
  "#B05AC4",
  "#D4952C",
  "#E8635A",
  "#0EA5A5",
  "#7C6FE0",
  "#DB6FA1",
  "#5C9B3C",
  "#C2534B",
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function colorForRoot(root) {
  return TAG_PALETTE[hashString(root) % TAG_PALETTE.length];
}

// Pull every #tag / #nested/tag out of free text. Paths are lower-cased so
// "#Coding" and "#coding" collapse into one tag, and de-duped in first-seen
// order. Trailing slashes ("#coding/") are stripped by the regex itself,
// since a segment after the last "/" is required.
export function extractTags(text) {
  const matches = (text || "").match(TAG_RE) || [];
  const seen = [];
  for (const m of matches) {
    const path = m.slice(1).toLowerCase();
    if (!seen.includes(path)) seen.push(path);
  }
  return seen;
}

export function tagRoot(path) {
  return path.split("/")[0];
}

// Turn a flat [{ path, count }] list (one row per distinct tag path, with
// how many notes use it) into a nested tree. Intermediate segments that have
// no notes of their own still get a node (count 0) so the folder structure
// is complete even if only a leaf tag like "coding/react-native/hooks" is
// ever typed.
export function buildTagTree(rows) {
  const roots = new Map();
  const sorted = [...rows].sort((a, b) => a.path.localeCompare(b.path));

  for (const row of sorted) {
    const segments = row.path.split("/");
    let siblings = roots;
    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      if (!siblings.has(currentPath)) {
        siblings.set(currentPath, {
          name: seg,
          path: currentPath,
          color: colorForRoot(segments[0]),
          count: 0,
          children: new Map(),
        });
      }
      const node = siblings.get(currentPath);
      if (i === segments.length - 1) node.count += row.count;
      siblings = node.children;
    }
  }

  const toArray = (map) =>
    [...map.values()]
      .map((n) => ({ ...n, children: toArray(n.children) }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return toArray(roots);
}
