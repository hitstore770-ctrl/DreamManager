// 770JLM Ultra-Modern — the single token set every screen shares.
//
// The look: a very soft grey canvas, pure-white interactive cards, no hard
// borders anywhere, and elevation that reads as depth rather than as a drop
// shadow (low opacity over a wide blur). Spacing is deliberately generous so
// tall, narrow screens (Galaxy Z Flip) breathe instead of feeling packed.

export const UI = {
  // Surfaces
  bg: "#F0F2F5", // canvas
  surface: "#FFFFFF", // cards, sheets, inputs on cards
  surfaceAlt: "#F5F7FA", // inputs and wells sitting on white
  hairline: "#EDEFF2", // the only "border" in the app

  // Ink
  ink: "#1A1D21",
  inkSoft: "#5A6470",
  inkMuted: "#8E8E93",

  // Brand
  blue: "#003366",
  gold: "#D4AF37",
  green: "#1E9E58",
  red: "#E14848",

  // Rhythm
  radius: 18,
  radiusSm: 14,
  radiusLg: 26,
  gap: 12,
  padScreen: 16,
  padCard: 18,
  rowMinHeight: 60,
};

// Soft, wide, barely-there elevation. Used for every raised surface.
export const SOFT_SHADOW = {
  shadowColor: "#0A1F44",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 2,
};

// Slightly deeper, for sheets and floating actions that sit above content.
export const SOFT_SHADOW_LG = {
  shadowColor: "#0A1F44",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 4,
};
