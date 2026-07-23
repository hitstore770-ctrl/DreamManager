// "Sticky Notes" (Post-it) theme — soft pastel paper on a warm desk, with
// a handwriting font and gentle drop shadows / tilts to feel physical.

export const COLORS = {
  background: "#F1ECE1", // warm desk / paper
  card: "#FFFDF5", // default note (off-white paper)
  textPrimary: "#2D2A32", // dark ink
  textSecondary: "#6B655E",
  textMuted: "#A79F94",
  border: "rgba(45, 42, 50, 0.08)",
  shadow: "#3A3226",
  accent: "#3B5BDB", // fine-liner pen ink (blue)

  // Legacy aliases kept so existing components restyle automatically:
  // anything that used the old translucent "glass" now sits on paper.
  glass: "#FFFDF5",
  glassSolid: "#FFFDF5",
};

// Pastel Post-it colors, cycled across cards/tiles.
export const NOTE_COLORS = [
  "#FFF3B0", // pale yellow
  "#D4F5DE", // mint green
  "#D6ECFF", // light blue
  "#FFDCE5", // soft pink
  "#FFE6C7", // peach
  "#E8DEFF", // lavender
];

// Deterministic pastel + tilt from a seed (id/index) so a note keeps the
// same look across renders instead of flickering.
function hashSeed(seed) {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

export function getNoteColor(seed) {
  return NOTE_COLORS[hashSeed(seed) % NOTE_COLORS.length];
}

// A small tilt in [-2.5, 2.5] degrees for a hand-stuck-note feel.
export function getNoteTilt(seed) {
  const steps = [-2.5, -1.5, -1, 1, 1.5, 2.5];
  return `${steps[hashSeed(seed) % steps.length]}deg`;
}

// Soft paper drop shadow (offset down-right like a lifted sticky note).
export const PAPER_SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 1.5, height: 4 },
  shadowOpacity: 0.18,
  shadowRadius: 6,
  elevation: 4,
};

// The app loads a single Hebrew handwriting face (Gveret Levin). It ships
// one weight, so every token maps to it — hierarchy comes from size/color,
// which suits a handwritten look.
export const FONTS = {
  regular: "GveretLevin_400Regular",
  medium: "GveretLevin_400Regular",
  bold: "GveretLevin_400Regular",
};
