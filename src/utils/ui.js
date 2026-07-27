// "Obsidian & Neon" — the single design system every screen must use.
//
// Deep slate surfaces stacked in four steps, lit from above by a hairline of
// white and from below by a coloured halo. Nothing is flat: every raised
// surface carries a bevel (a 1px top-light border) so it reads as a physical
// slab rather than a coloured rectangle.
//
// These are *semantic* tokens — `ink` means "the colour titles are", not "dark
// grey". That is what lets the whole app change temperature by editing this
// file instead of forty screens.

export const UI = {
  // Surfaces, darkest to lightest. A card on the canvas is `surface`; a well
  // or input inside that card drops back to `surfaceAlt`; anything that has to
  // pop off the card (chips, pressed states) rises to `surfaceHi`.
  bgDeep: "#080D1A", // gradient floor, behind everything
  bg: "#0F172A", // every main screen wrapper
  surface: "#1A2337", // cards
  surfaceAlt: "#131C2E", // wells and inputs sitting on a card
  surfaceHi: "#26314A", // raised chips, pressed states
  hairline: "rgba(255,255,255,0.07)",
  glass: "rgba(17,24,41,0.78)", // floating nav — sits over blur

  // Ink
  ink: "#F1F5F9", // titles
  inkSoft: "#94A3B8", // subtitles and body
  inkMuted: "#64748B", // captions

  // Vibrant accents
  violet: "#7C3AED", // primary
  violetLo: "#A78BFA", // primary, on dark where #7C3AED is too heavy
  cyan: "#06B6D4", // progress / active
  coral: "#FF4E50", // floating actions
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  gold: "#E7C46B", // metallic accents, deposits at target

  // Rhythm
  radius: 24,
  radiusSm: 16,
  radiusLg: 32,
  cardPadding: 20,
  cardMarginH: 16,
  cardMarginB: 16,
  gap: 12,
  rowMinHeight: 60,
};

// Gradient ramps. Two stops each, top-left to bottom-right unless a component
// says otherwise. Kept here so a violet button and a violet card are lit the
// same way.
export const GRAD = {
  canvas: ["#0F172A", "#080D1A"],
  surface: ["#1F2A41", "#151E31"],
  violet: ["#8B5CF6", "#6D28D9"],
  cyan: ["#22D3EE", "#0891B2"],
  coral: ["#FF7A5C", "#E11D48"],
  green: ["#34D399", "#059669"],
  gold: ["#F4D68A", "#B98F3E"],
  ink: ["#1E293B", "#0B1220"],
  glass: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"],
};

// The one card shadow. On a dark canvas a tinted shadow disappears, so depth
// comes from a deep black pool plus the bevel below.
export const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.45,
  shadowRadius: 26,
  elevation: 10,
};

export const SOFT_SHADOW = CARD_SHADOW;
export const SOFT_SHADOW_LG = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 22 },
  shadowOpacity: 0.55,
  shadowRadius: 38,
  elevation: 16,
};

// A hairline of light along the top edge. Physical objects are lit from above,
// and this single border is what separates a "premium slab" from a "coloured
// div" more than any amount of shadow does.
export const BEVEL = {
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
};

export const BEVEL_STRONG = {
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
};

// Coloured halo for an active/primary element — the shadow picks up the
// element's own colour, so a violet button sits in a violet glow.
export function glow(color, strength = 0.35) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: strength,
    shadowRadius: 22,
    elevation: 10,
  };
}

// Translucent wash of a colour, for tinted chips and badges. On a dark canvas
// a flat `color + "14"` reads as mud, so this mixes toward light instead.
export function tint(color, alpha = 0.16) {
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
