// "Paper & Pastel" — the single design system every screen must use.
//
// A soft grey desk with white and pastel cards lifted just off it. Depth comes
// from one gentle shadow and a hairline edge, never from heavy borders or hard
// drop shadows: a sticky note sits a millimetre above the desk, not a
// centimetre. Type is near-black on paper, so contrast is never in question.
//
// These are *semantic* tokens — `ink` means "the colour titles are", not "dark
// grey". That is what lets the whole app change temperature by editing this
// file instead of forty screens.

export const UI = {
  // Surfaces. The desk, the paper on it, and the wells pressed into that paper.
  bgDeep: "#E9EBEF", // under-page, edges of the desk
  bg: "#F3F4F6", // every main screen wrapper
  surface: "#FFFFFF", // cards — crisp white paper
  surfaceAlt: "#F8FAFC", // wells and inputs sitting on a card
  surfaceHi: "#EEF1F6", // pressed states, chips
  hairline: "#E7EAF0",
  glass: "rgba(255,255,255,0.86)", // floating nav — sits over blur

  // Ink
  ink: "#111827", // titles
  inkSoft: "#4B5563", // subtitles and body
  inkMuted: "#9CA3AF", // captions

  // Vibrant accents
  violet: "#7C3AED", // primary
  violetLo: "#6D28D9", // primary text on paper, where #7C3AED is too light
  cyan: "#0891B2", // progress / active
  coral: "#F43F5E", // floating actions
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  gold: "#B45309", // metallic accents, deposits at target

  // Rhythm. Generous radii, because a squircle reads as one continuous curve
  // rather than as a straight edge with a corner stuck on each end — and at
  // these sizes a plain rounded rect is close enough to a squircle that the
  // difference is invisible, while an SVG path per card is not free.
  radius: 20,
  radiusSm: 14,
  radiusLg: 28,
  cardPadding: 20,
  cardMarginH: 16,
  cardMarginB: 16,
  gap: 12,
  rowMinHeight: 60,
};

// Sticky-note stocks. Deliberately desaturated: a full-strength highlighter
// yellow behind #111827 text is exhausting to read at body size, and six of
// them on one board is a toy. `edge` is a slightly deeper shade of the same
// hue, used for the hairline so a pastel note never needs a grey border.
export const PASTEL = {
  white: { bg: "#FFFFFF", edge: "#E7EAF0", ink: "#111827" },
  butter: { bg: "#FEF6DA", edge: "#F3E3AE", ink: "#6B4E00" },
  mint: { bg: "#DCFCE7", edge: "#B3EFC9", ink: "#065F46" },
  sky: { bg: "#DBEAFE", edge: "#B4D4FB", ink: "#1E40AF" },
  blush: { bg: "#FCE7F3", edge: "#F7C9E3", ink: "#9D174D" },
  lilac: { bg: "#EDE9FE", edge: "#D6CDFA", ink: "#5B21B6" },
  peach: { bg: "#FFEDD5", edge: "#FBD5A8", ink: "#9A3412" },
};

export const PASTEL_KEYS = Object.keys(PASTEL).filter((k) => k !== "white");

// Deterministic note colour from any string, so a given dream or tag keeps its
// stock across launches. Random-per-render would reshuffle the whole board on
// every keystroke.
export function pastelFor(seed, keys = PASTEL_KEYS) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PASTEL[keys[h % keys.length]];
}

// Gradient ramps, for the few surfaces that are still coloured objects rather
// than paper — the money hero, the primary buttons, the note stocks.
export const GRAD = {
  canvas: ["#F8FAFC", "#EFF1F5"],
  surface: ["#FFFFFF", "#FBFCFE"],
  violet: ["#8B5CF6", "#6D28D9"],
  cyan: ["#22D3EE", "#0891B2"],
  coral: ["#FB7185", "#E11D48"],
  green: ["#34D399", "#059669"],
  gold: ["#FCD34D", "#D97706"],
  ink: ["#374151", "#111827"],
  glass: ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.72)"],
};

// The one card shadow: soft, low, close. A card lifted this little reads as
// paper; lifted more, it reads as a floating panel.
export const CARD_SHADOW = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

// Layered elevation. React Native gives one shadow per view, and one shadow
// always has to choose: tight and dark enough to define contact, or wide and
// soft enough to read as ambient light. Real depth is both at once, so this
// is a pair applied to two nested views — a tight contact shadow under a wide
// ambient one. Card renders it; nothing else needs to know.
export const SHADOW_CONTACT = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 2,
  elevation: 1,
};

export const SHADOW_AMBIENT = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 4,
};

export const SOFT_SHADOW = CARD_SHADOW;
export const SOFT_SHADOW_LG = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 7,
};

// A hairline edge. On paper the job is the opposite of on a dark canvas: a
// white card on a near-white desk needs a *darker* edge to be separable, not a
// lighter one.
export const BEVEL = {
  borderWidth: 1,
  borderColor: "#E7EAF0",
};

export const BEVEL_STRONG = {
  borderWidth: 1,
  borderColor: "#D8DDE7",
};

// Coloured halo for an active/primary element. Softer than on dark, because a
// strong coloured glow on a light desk reads as a printing error.
export function glow(color, strength = 0.22) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: strength,
    shadowRadius: 14,
    elevation: 6,
  };
}

// Translucent wash of a colour, for tinted chips and badges.
export function tint(color, alpha = 0.12) {
  return hexToRgba(color, alpha);
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Type scale. Critical numbers are deliberately large.
export const TYPE = {
  hero: 34,
  metric: 28,
  title: 21,
  section: 16,
  body: 14.5,
  caption: 12.5,
  micro: 11,
};
