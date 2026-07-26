// "770JLM Modern Light" — a scoped design token set used ONLY by the Pro Notes
// Hub components (list, editor, cards, date tools, PIN gate). Deliberately
// always-light and airy: ultra-clean whites and soft off-whites, with elegant
// Deep-Blue / refined-Gold accents reserved for interactive elements. Pairs
// with the light Assistant Hebrew typeface below.

export const NOTES_THEME = {
  scheme: "light",

  // Surfaces — clean whites and very soft greys, no heavy color blocks.
  background: "#F0F2F5", // soft grey canvas
  surface: "#FFFFFF", // clean white cards
  surfaceAlt: "#F8F9FA", // subtle raised / input fill
  surfaceMuted: "#EEF1F4", // chips / progress track

  // Ink.
  textPrimary: "#1A1D21",
  textSecondary: "#5A6470",
  textMuted: "#9AA4B0",

  // Hairlines.
  border: "#ECEEF1",
  hairline: "#EEF0F3",

  // Accents — used only on interactive elements.
  accent: "#003366", // deep blue (primary interactive)
  brand: "#003366",
  gold: "#D4AF37", // refined gold (special touches)

  danger: "#E14848",
  warning: "#D4AF37",
  success: "#12965A",
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
  shadowColor: "#0A1F44",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 2,
};

export const NOTES_SHADOW_LG = {
  shadowColor: "#0A1F44",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 5,
};
