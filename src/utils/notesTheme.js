// "770JLM Modern Light" — a scoped design token set used ONLY by the Pro Notes
// Hub components (list, editor, cards, date tools, PIN gate). Deliberately
// always-light and airy: ultra-clean whites and soft off-whites, with elegant
// Deep-Blue / refined-Gold accents reserved for interactive elements. Pairs
// with the light Assistant Hebrew typeface below.

export const NOTES_THEME = {
  scheme: "light",

  // Surfaces — warm cream and soft off-whites, no heavy color blocks and no
  // cool grey. The values here used to be a blue-grey (#F4F6F9) despite the
  // comment above claiming "ultra-clean whites and soft off-whites" — that
  // mismatch between the stated intent and the actual hex is exactly the
  // "generic, sterile" look this file is meant to avoid.
  background: "#FBF7ED", // warm cream canvas
  surface: "#FEFDFA", // clean cards, barely off pure white
  surfaceAlt: "#F5EFDF", // subtle raised / input fill
  surfaceMuted: "#EFE6D2", // chips / progress track

  // Ink.
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  // Hairlines.
  border: "#E8DEC7",
  hairline: "#E8DEC7",

  // Accents — used only on interactive elements. `accent` really was a flat
  // violet (#7C3AED) and `gold` really was cyan (#06B6D4) — the two names
  // and their colours had swapped meaning somewhere, which is the other half
  // of the same bug: this now actually is a deep blue and an actual gold.
  accent: "#1E3A78", // deep royal blue (primary interactive)
  brand: "#1E3A78",
  gold: "#AD8A32", // refined gold (special touches)

  danger: "#EF4444",
  warning: "#B54708",
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
  shadowColor: "#1E3A78",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

export const NOTES_SHADOW_LG = {
  shadowColor: "#1E3A78",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 5,
};
