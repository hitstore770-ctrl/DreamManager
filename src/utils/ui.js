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
  // Surfaces. Warm cream, on cream, on cream — "770JLM": a paper the eye
  // reads as premium rather than as a default Bootstrap white. Told apart by
  // their rules, same as before; only the temperature changed.
  bgDeep: "#F5F1E8",
  bg: "#FCFBF9",
  surface: "#FEFDFA",
  surfaceAlt: "#F7F2E9", // wells, inputs, table stripes
  surfaceHi: "#F0E9DC", // pressed states, chips
  hairline: "#E8E1D2", // the one border colour
  glass: "#FEFDFA", // the nav bar is opaque now; no blur, no translucency

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
  // A deep royal blue, not the flat Bootstrap/Material "informational" blue
  // (#175CD3) this used to be — same job (links, informational badges,
  // secondary accents), a genuinely richer colour to do it in.
  cyan: "#1E3A78",
  // A real gold, not a second copy of `amber`'s hex. Reserved for the
  // premium touches — Noa's chat bubble, special badges — that this file's
  // main discipline (colour only where it is functional) deliberately
  // doesn't otherwise allow room for.
  gold: "#AD8A32",

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

// Note stocks — for the notes board and the chat bubbles.
//
// Classic sticky-note colour, not the desaturated fintech tint: this is
// deliberately the one place in the app that is allowed to look like paper
// pinned to a corkboard rather than a financial statement. Ink is the same
// dark, near-black tone on every stock rather than a colour matched to the
// paper, the way a real pen writes the same colour on yellow, blue or green
// paper.
export const PASTEL = {
  white: { bg: "#FFFFFF", edge: "#EAEAEA", ink: UI.ink },
  butter: { bg: "#FFF3B0", edge: "#F0DA6B", ink: UI.ink },
  mint: { bg: "#C9F2D6", edge: "#8FDDA8", ink: UI.ink },
  sky: { bg: "#CFE8FB", edge: "#8FC7ED", ink: UI.ink },
  blush: { bg: "#FBD6E0", edge: "#F0A8BE", ink: UI.ink },
  lilac: { bg: "#E4D9F7", edge: "#C7AEEA", ink: UI.ink },
  peach: { bg: "#FFDCB0", edge: "#F2B570", ink: UI.ink },
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
  canvas: ["#FCFBF9", "#FCFBF9"],
  surface: ["#FEFDFA", "#FEFDFA"],
  violet: ["#1A1A1A", "#111111"],
  accent: ["#1A1A1A", "#111111"],
  cyan: ["#1E3A78", "#16295A"],
  coral: ["#D92D20", "#C0271B"],
  green: ["#067647", "#05633B"],
  gold: ["#AD8A32", "#8F6F24"],
  ink: ["#1A1A1A", "#111111"],
  glass: ["#FEFDFA", "#FEFDFA"],
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

// The one deliberate exception to "nothing glows, nothing floats" — a sticky
// note styled as paper is supposed to look like it is lifted off the surface
// behind it, not resting flush against it. The offset is asymmetric (not
// straight down) so it reads as a corner lifting rather than a flat card, and
// it is paired with a slight rotation wherever it is used.
export const STICKY_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 2, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 6,
  elevation: 8,
};

// A second, deliberately calmer exception — for Noa's chat bubbles. Sticky
// paper is supposed to look tossed onto a desk; a chat bubble is supposed to
// look like a considered, premium surface, so this is soft and symmetric
// rather than sharp and off-kilter, with no rotation paired with it anywhere.
export const BUBBLE_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 9,
  elevation: 3,
};

// Deterministic tilt from any string seed, in degrees within ±spread.
//
// Deterministic rather than Math.random() on purpose: a note keeps the same
// angle across re-renders (a new render is not a new "toss of the note"),
// while still landing on a different, organic-looking angle from its
// neighbours because the seed — a note id — differs.
export function tiltFor(seed, spread = 1.5) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (((h % 1000) / 1000) * 2 - 1) * spread;
}

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
