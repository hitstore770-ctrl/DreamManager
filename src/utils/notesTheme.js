// "770JLM Modern Light" — a scoped design token set used ONLY by the Pro Notes
// Hub components (list, editor, cards, date tools, PIN gate). Deliberately
// always-light and airy: ultra-clean whites and soft off-whites, with elegant
// Deep-Blue / refined-Gold accents reserved for interactive elements. Pairs
// with the light Assistant Hebrew typeface below.

export const NOTES_THEME = {
  scheme: "light",

  // Surfaces — clean whites and very soft greys, no heavy color blocks.
  background: "#F4F6F9", // soft grey canvas
  surface: "#FFFFFF", // clean white cards
  surfaceAlt: "#F4F6F9", // subtle raised / input fill
  surfaceMuted: "#EEF1F4", // chips / progress track

  // Ink.
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  // Hairlines.
  border: "#EEF1F6",
  hairline: "#EEF1F6",

  // Accents — used only on interactive elements.
  accent: "#7C3AED", // deep blue (primary interactive)
  brand: "#7C3AED",
  gold: "#06B6D4", // refined gold (special touches)

  danger: "#EF4444",
  warning: "#06B6D4",
  success: "#10B981",
  onAccent: "#FFFFFF",
  overlay: "rgba(16, 24, 40, 0.32)",
};

// Heebo, app-wide. One family, four weights, named explicitly — no system
// font is ever reached for, which is what stops the app looking like every
// other React Native build on the store.
//
// Heebo is a Hebrew/Latin superfamily, so Hebrew body copy and Latin model ids
// share one set of metrics instead of silently falling back to two different
// faces mid-line.
//
// `semibold` maps to 500 rather than to its own file: at these sizes the gap
// between 500 and 700 already carries the hierarchy, and a fifth weight is
// ~45KB in the bundle for a difference nobody can see.
export const NOTES_FONTS = {
  light: "Heebo_300Light",
  regular: "Heebo_400Regular",
  medium: "Heebo_500Medium",
  semibold: "Heebo_500Medium",
  bold: "Heebo_700Bold",
};

// Soft, barely-there elevation per the spec (elevation 2, opacity 0.05).
export const NOTES_SHADOW = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

export const NOTES_SHADOW_LG = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 5,
};
