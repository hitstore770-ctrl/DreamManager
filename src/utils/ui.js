// "Luminous & Alive" — the bright, high-energy token set.
//
// Radiant white surfaces on a pearl canvas, vivid accents on anything
// interactive, charcoal type for contrast, and elevation expressed as a soft
// *coloured* glow rather than grey shadow. Shapes are deliberately bubbly:
// big squircle radii everywhere a card or sheet appears.

export const UI = {
  // Surfaces
  bg: "#F9FAFC", // pearl canvas
  surface: "#FFFFFF", // radiant cards
  surfaceAlt: "#F4F6FB", // wells and inputs sitting on white
  hairline: "#EEF1F6", // the only "border" in the app
  glass: "rgba(255,255,255,0.9)", // floating nav / sheets

  // Ink
  ink: "#111827", // crisp charcoal
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",

  // Vibrant accents
  violet: "#7C3AED", // primary — buttons, active nav, brand
  cyan: "#06B6D4", // secondary — progress, active states
  coral: "#FF4E50", // energy — floating actions, celebration
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",

  // Rhythm — bubbly squircles
  radius: 28,
  radiusSm: 18,
  radiusLg: 34,
  gap: 12,
  padScreen: 16,
  padCard: 18,
  rowMinHeight: 60,
};

// A soft neutral lift for resting surfaces.
export const SOFT_SHADOW = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

export const SOFT_SHADOW_LG = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.1,
  shadowRadius: 28,
  elevation: 6,
};

// Coloured glow for an active/primary element — the shadow picks up the
// element's own colour so a violet button sits in a violet halo.
export function glow(color, strength = 0.35) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: strength,
    shadowRadius: 20,
    elevation: 8,
  };
}
