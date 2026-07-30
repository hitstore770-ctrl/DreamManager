// Shared data layer for the Pro Notes Hub. The list screen and the editor both
// read/write the same AsyncStorage key via usePersistentState, so edits made in
// the editor show up in the list (only one is focused at a time).

export const NOTES_KEY = "@dreammanager/pro-notes";

// Soft pastel backgrounds selectable per note (matches the sleek design system).
export const NOTE_BG = [
  { key: "white", color: "#FFFFFF", dark: "#171B22" },
  { key: "yellow", color: "#FFF7D6", dark: "#2A2818" },
  { key: "blue", color: "#E3F0FF", dark: "#16212E" },
  { key: "green", color: "#E4F8EC", dark: "#152417" },
  { key: "pink", color: "#FCE4EE", dark: "#2A1820" },
  { key: "purple", color: "#EEE8FE", dark: "#1F1A2C" },
  { key: "peach", color: "#FFEBDD", dark: "#2A1D14" },
];

export function noteBg(key, dark) {
  const b = NOTE_BG.find((x) => x.key === key) || NOTE_BG[0];
  return dark ? b.dark : b.color;
}

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function makeNote(overrides = {}) {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    body: "",
    bg: "white",
    fontSize: 16,
    pinned: false,
    // A different pin from `pinned` above (which pins to the top of the
    // notes board) — this one surfaces the note's title in a banner on the
    // POS register screen, for the note that is actually about today's
    // shift rather than the one the owner wants to see first.
    isPinnedToPOS: false,
    readOnly: false,
    isChecklist: false,
    checklist: [], // [{ id, text, done }]
    tags: [],
    hebrewDate: null, // { iso, formatted }
    locked: false, // PIN-gated privacy lock
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Split free text into checklist items (one per non-empty line).
export function textToChecklist(text) {
  return (text || "")
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean)
    .map((t) => ({ id: uid(), text: t, done: false }));
}

export function checklistToText(items) {
  return (items || []).map((i) => `${i.done ? "[v]" : "[ ]"} ${i.text}`).join("\n");
}

// Pull #hashtags out of free text (Unicode-aware, so Hebrew tags work), and
// dedupe while preserving order.
export function extractTags(text) {
  const matches = (text || "").match(/#[\p{L}\p{N}_]+/gu) || [];
  const seen = [];
  matches.forEach((m) => {
    const tag = m.slice(1);
    if (tag && !seen.includes(tag)) seen.push(tag);
  });
  return seen;
}
