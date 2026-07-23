// Neo-brutalist theme — flat cream desk, solid blocks of White / Navy /
// Mustard, thick black outlines and a hard (blur-less) offset shadow so every
// surface reads like a bold printed sticker. A clean bold sans-serif (Heebo)
// carries the Hebrew type.

export const COLORS = {
  background: "#FDF8F0", // light cream / beige
  card: "#FFFFFF", // solid white surface
  textPrimary: "#1A1A1A", // near-black ink
  textSecondary: "#3A3A3A",
  textMuted: "#8A8A8A",
  border: "#1A1A1A", // thick black outline
  shadow: "#1A1A1A", // hard black drop shadow
  accent: "#1B3A6B", // navy blue (primary action)
  navy: "#1B3A6B",
  mustard: "#F4B400", // mustard yellow (highlight)
  white: "#FFFFFF",
  danger: "#E23B3B",
  success: "#1E9E58",

  // Legacy aliases kept so older components restyle automatically: anything
  // that used the old translucent "glass" now sits on a solid white block.
  glass: "#FFFFFF",
  glassSolid: "#FFFFFF",
};

// Bold flat blocks cycled across tiles/cards. All keep dark text readable.
export const NOTE_COLORS = [
  "#FFFFFF", // white
  "#F4B400", // mustard
  "#BFE3FF", // sky
  "#C7F0D2", // mint
  "#FFC9D6", // pink
  "#E4D4FF", // lilac
];

// Deterministic block color from a seed (id/index) so a card keeps the same
// look across renders instead of flickering.
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

// Neo-brutalism keeps everything squared-up — no tilt.
export function getNoteTilt() {
  return "0deg";
}

// The signature hard drop shadow: solid black, offset 4px to the
// bottom-right, zero blur. Pair with BRUTAL_BORDER for the full effect.
export const BRUTAL_SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 6,
};

// A softer variant (2px) for smaller controls like inputs/chips.
export const BRUTAL_SHADOW_SM = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 3,
};

// Standard thick outline for every card/button/input.
export const BRUTAL_BORDER = {
  borderWidth: 2,
  borderColor: COLORS.border,
};

// Legacy alias — components that referenced the old "paper" shadow now get the
// hard neo-brutalist shadow automatically.
export const PAPER_SHADOW = BRUTAL_SHADOW;

// Squared-off but not fully sharp corners.
export const RADIUS = 10;

// Heebo — a clean, modern, bold Hebrew sans-serif. Three real weights so the
// type hierarchy is carried by weight, not just size.
export const FONTS = {
  regular: "Heebo_400Regular",
  medium: "Heebo_500Medium",
  bold: "Heebo_700Bold",
};
