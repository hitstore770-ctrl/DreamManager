// The design system. One file, and every screen reads from it.
//
// A strict light fintech aesthetic: white paper, hairline rules, one 12pt
// radius, and colour used only where it carries meaning. The previous system
// leaned on violet gradients, coloured haloes and soft floating cards — the
// look every AI product shipped in the same eighteen months. This one is built
// from the opposite instinct: nothing glows, nothing floats, and a surface is
// separated from the one behind it by a 1px line rather than by a shadow.
//
// Two consequences worth stating, because they are the whole discipline:
//
//   • Depth comes from borders. A shadow is present but almost invisible; if a
//     card is not readable without it, the layout is wrong, not the shadow.
//   • Colour is functional. Green means money in, red means money out, amber
//     means attention. Nothing is coloured to be attractive, so when something
//     is coloured it means something.
//
// These are *semantic* tokens — `ink` means "the colour titles are", not "near
// black". That is what lets the whole app change temperature by editing this
// file instead of forty screens.

export const UI = {
  // Surfaces. White, on white, on white — told apart by their rules.
  bgDeep: "#F7F7F8",
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAFA", // wells, inputs, table stripes
  surfaceHi: "#F2F2F3", // pressed states, chips
  hairline: "#EAEAEA", // the one border colour
  glass: "#FFFFFF", // the nav bar is opaque now; no blur, no translucency

  // Ink. A near-black rather than a true one: #000 on #FFF is harsh at body
  // size and is not what print or any good financial interface uses.
  ink: "#111111",
  inkSoft: "#5C5C5C",
  inkMuted: "#8E8E93",

  // The primary accent is ink itself. A fintech primary button is black or
  // white; a coloured one belongs to a consumer app, and a violet one belongs
  // to an AI demo.
  accent: "#111111",
  accentSoft: "#3A3A3A",

  // Kept under their old names so the forty screens that reference them do not
  // all have to change in one commit. `violet` is no longer violet — it is the
  // primary accent, whatever this file says that is.
  violet: "#111111",
  violetLo: "#000000",

  // Functional colour. Restrained, high-contrast, and each one earns its place.
  green: "#067647", // money in, positive change
  red: "#D92D20", // money out, destructive, error
  amber: "#B54708", // attention, unknown, degraded
  cyan: "#175CD3", // informational / links
  gold: "#B54708",

  // Was the floating-action pink. Eight screens still name it, and a token
  // that silently evaluates to undefined does not throw — it renders a
  // transparent button, which is how the voice control on the register
  // disappeared into the page. Mapped onto the primary accent rather than
  // deleted, so those call sites keep working and stop being pink.
  coral: "#111111",

  // Rhythm. One radius, used everywhere, with a tighter one for controls.
  radius: 12,
  radiusSm: 10,
  radiusLg: 16,
  cardPadding: 16,
  cardMarginH: 16,
  cardMarginB: 12,
  gap: 12,
  rowMinHeight: 56,
};

// Note stocks for the dreams board.
//
// Desaturated hard: on a white fintech surface a full pastel reads as a
// children's app, and six of them next to each other read as a toy. These are
// tints — a few percent of hue over white — so the board stays legible as a
// set of cards while a single note is still identifiable by colour.
export const PASTEL = {
  white: { bg: "#FFFFFF", edge: "#EAEAEA", ink: "#111111" },
  butter: { bg: "#FDFBF3", edge: "#EDE6D2", ink: "#6B4E00" },
  mint: { bg: "#F3FAF6", edge: "#D6EADF", ink: "#067647" },
  sky: { bg: "#F4F8FE", edge: "#D9E5F7", ink: "#175CD3" },
  blush: { bg: "#FDF5F7", edge: "#EFDCE2", ink: "#B42318" },
  lilac: { bg: "#F7F6FB", edge: "#E2DFEE", ink: "#4A4458" },
  peach: { bg: "#FDF7F3", edge: "#EFE0D4", ink: "#B54708" },
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

// Gradient ramps.
//
// Deliberately almost flat. The API stays because a dozen call sites pass
// `colors` to GradCard, but a two-stop violet-to-indigo sweep is the single
// most recognisable "AI product" signature there is, so every ramp here is now
// a solid or a barely-there shift within one hue.
export const GRAD = {
  canvas: ["#FFFFFF", "#FFFFFF"],
  surface: ["#FFFFFF", "#FFFFFF"],
  violet: ["#1A1A1A", "#111111"],
  accent: ["#1A1A1A", "#111111"],
  cyan: ["#175CD3", "#134FB8"],
  coral: ["#D92D20", "#C0271B"],
  green: ["#067647", "#05633B"],
  gold: ["#B54708", "#9C3D07"],
  ink: ["#1A1A1A", "#111111"],
  glass: ["#FFFFFF", "#FFFFFF"],
};

// Nearly nothing. Present so a sheet or a menu still lifts off the page, but
// far too faint to be what separates a card from its background — that is the
// border's job, and a card that needs the shadow is a card in the wrong place.
export const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 2,
  elevation: 1,
};

// Kept for the two components that render nested views for layered depth.
// Both are now so faint that the pair reads as a single hairline of contact.
export const SHADOW_CONTACT = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 1,
  elevation: 1,
};

export const SHADOW_AMBIENT = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 2,
};

export const SOFT_SHADOW = CARD_SHADOW;

// For genuinely floating surfaces only — a bottom sheet, a modal. Still far
// short of the old drop shadows.
export const SOFT_SHADOW_LG = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 5,
};

// The rule. One weight, one colour, everywhere — this is what the design is
// actually made of.
export const BEVEL = {
  borderWidth: 1,
  borderColor: "#EAEAEA",
};

export const BEVEL_STRONG = {
  borderWidth: 1,
  borderColor: "#DCDCDC",
};

// Was a coloured halo; now deliberately inert.
//
// Every call site that wanted to make something glow still compiles, and
// nothing glows. Left as a function rather than deleted because removing it
// would mean editing a dozen screens to say the same thing this says once:
// emphasis in this system comes from weight and contrast, not from light.
export function glow() {
  return CARD_SHADOW;
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
