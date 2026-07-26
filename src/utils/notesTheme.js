// "770JLM Modern Light" — a scoped design token set used ONLY by the Pro Notes
// Hub components (list, editor, cards, date tools, PIN gate). Deliberately
// always-light and airy: ultra-clean whites and soft off-whites, with elegant
// Deep-Blue / refined-Gold accents reserved for interactive elements. Pairs
// with the light Assistant Hebrew typeface below.

export const NOTES_THEME = {
  scheme: "light",

  // Surfaces — clean whites and very soft greys, no heavy color blocks.
  background: "#F9FAFC", // soft grey canvas
  surface: "#FFFFFF", // clean white cards
  surfaceAlt: "#F9FAFC", // subtle raised / input fill
  surfaceMuted: "#EEF1F4", // chips / progress track

  // Ink.
  textPrimary: "#111827",
  textSecondary: "#4B5563",
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

// Sleek modern Hebrew typeface (Assistant) with light weights for a crisp,
// high-end, airy feel.
export const NOTES_FONTS = {
  light: "Assistant_300Light",
  regular: "Assistant_400Regular",
  medium: "Assistant_500Medium",
  semibold: "Assistant_600SemiBold",
  // Titles top out at 600: 700+ reads blocky against the soft surfaces.
  bold: "Assistant_600SemiBold",
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
