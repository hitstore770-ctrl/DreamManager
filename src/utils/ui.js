// "Luminous & Alive" — the single design system every screen must use.
//
// Radiant white cards float on a cool light canvas, lifted by a violet-tinted
// shadow rather than a grey one. Type is charcoal on white with a soft grey
// for anything secondary. Shapes are bubbly; nothing has a hard border.

export const UI = {
  // Surfaces
  bg: "#F4F6F9", // every main screen wrapper
  surface: "#FFFFFF", // cards
  surfaceAlt: "#F4F6F9", // wells and inputs sitting on a card
  hairline: "#EEF1F6",
  glass: "rgba(255,255,255,0.9)", // floating nav

  // Ink
  ink: "#111827", // titles
  inkSoft: "#6B7280", // subtitles and body
  inkMuted: "#9CA3AF", // captions

  // Vibrant accents
  violet: "#7C3AED", // primary
  cyan: "#06B6D4", // progress / active
  coral: "#FF4E50", // floating actions
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",

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

// The one card shadow. A violet tint at low opacity over a wide blur reads as
// depth rather than as a drop shadow.
export const CARD_SHADOW = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 4,
};

// Aliases kept so older imports keep resolving to the same values.
export const SOFT_SHADOW = CARD_SHADOW;
export const SOFT_SHADOW_LG = {
  ...CARD_SHADOW,
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.12,
  shadowRadius: 32,
  elevation: 8,
};

// Coloured halo for an active/primary element — the shadow picks up the
// element's own colour, so a violet button sits in a violet glow.
export function glow(color, strength = 0.35) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: strength,
    shadowRadius: 20,
    elevation: 8,
  };
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
