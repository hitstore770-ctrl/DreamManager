// Modern, sleek design system — a soft iOS / Material surface language.
// Light-grey canvas, white cards, a deep-blue brand and a swappable accent,
// gentle drop shadows (low opacity, soft blur), generous rounded corners and
// the light Assistant Hebrew sans-serif.
//
// The legacy neo-brutalist export names (BRUTAL_SHADOW, BRUTAL_BORDER, …) are
// kept as *soft* aliases so every existing tool restyles automatically without
// touching its code.

// ---------------------------------------------------------------------------
// Accent palette — user-pickable in Settings. First entry is the default.
// ---------------------------------------------------------------------------
export const ACCENTS = [
  { key: "blue", label: "כחול", color: "#2E6BE6" },
  { key: "violet", label: "סגול", color: "#7C5CFC" },
  { key: "teal", label: "טורקיז", color: "#12B5A5" },
  { key: "coral", label: "אלמוג", color: "#F5643A" },
  { key: "pink", label: "ורוד", color: "#EC4899" },
  { key: "green", label: "ירוק", color: "#16A34A" },
];

export function accentColor(key) {
  return (ACCENTS.find((a) => a.key === key) || ACCENTS[0]).color;
}

// ---------------------------------------------------------------------------
// makeTheme(scheme, accentKey) → a full palette object for the active mode.
// Consumed by SettingsContext and every new shell screen via useSettings().
// ---------------------------------------------------------------------------
export function makeTheme(scheme = "light", accentKey = "blue") {
  const accent = accentColor(accentKey);
  const dark = scheme === "dark";

  if (dark) {
    return {
      scheme: "dark",
      accent,
      background: "#0E1116", // near-black canvas
      surface: "#171B22", // card
      surfaceAlt: "#1F242D", // slightly raised / input
      surfaceMuted: "#22272F",
      brand: "#3B6FD4", // deep blue
      textPrimary: "#F2F4F7",
      textSecondary: "#AEB6C2",
      textMuted: "#6B7480",
      border: "#262C36",
      hairline: "#20252E",
      danger: "#F26060",
      warning: "#F5B33C",
      success: "#3FBE77",
      onAccent: "#FFFFFF",
      overlay: "rgba(0,0,0,0.6)",
    };
  }

  return {
    scheme: "light",
    accent,
    background: "#F2F4F7", // light grey canvas
    surface: "#FFFFFF", // white card
    surfaceAlt: "#F7F9FC", // subtle raised / input fill
    surfaceMuted: "#EEF1F6",
    brand: "#17315C", // deep navy blue
    textPrimary: "#7C3AED",
    textSecondary: "#475467",
    textMuted: "#98A2B3",
    border: "#E4E8EF",
    hairline: "#EDF0F5",
    danger: "#EF4444",
    warning: "#E5A400",
    success: "#10B981",
    onAccent: "#FFFFFF",
    overlay: "rgba(16,24,40,0.45)",
  };
}

// Static default palette (light) — kept for modules that import COLORS at the
// top level. Keys mirror the legacy names so nothing breaks.
const T = makeTheme("light", "blue");

export const COLORS = {
  background: T.background,
  card: T.surface,
  surface: T.surface,
  surfaceAlt: T.surfaceAlt,
  textPrimary: T.textPrimary,
  textSecondary: T.textSecondary,
  textMuted: T.textMuted,
  border: T.hairline,
  shadow: "#7C3AED",
  accent: T.accent, // primary action → the vivid accent
  navy: T.brand, // deep blue brand
  brand: T.brand,
  mustard: T.warning, // legacy "mustard" now maps to the amber warning tone
  warning: T.warning,
  white: "#FFFFFF",
  danger: T.danger,
  success: T.success,

  // Legacy translucent aliases → solid white surface.
  glass: "#FFFFFF",
  glassSolid: "#FFFFFF",
};

// Soft pastel tints cycled across tool tiles / sticky notes.
export const NOTE_COLORS = [
  "#EAF1FF", // sky
  "#E7FBF3", // mint
  "#FFF3E0", // cream
  "#FDE8EF", // blush
  "#EFEAFE", // lilac
  "#E9F7FF", // ice
];

function hashSeed(seed) {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

export function getNoteColor(seed) {
  return NOTE_COLORS[hashSeed(seed) % NOTE_COLORS.length];
}

// Modern cards sit flat — no tilt.
export function getNoteTilt() {
  return "0deg";
}

// ---------------------------------------------------------------------------
// Elevation — soft, blurred, low-opacity shadows (replaces the hard brutal
// offset shadow). Legacy names preserved.
// ---------------------------------------------------------------------------
export const SHADOW = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

export const SHADOW_SM = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.04,
  shadowRadius: 10,
  elevation: 1,
};

export const SHADOW_LG = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.14,
  shadowRadius: 28,
  elevation: 10,
};

// Legacy aliases → soft shadows so existing tools pick up the new elevation.
export const BRUTAL_SHADOW = SHADOW;
export const BRUTAL_SHADOW_SM = SHADOW_SM;
export const PAPER_SHADOW = SHADOW;

// A hairline border (was a 2px black outline). Kept subtle so cards read as
// soft surfaces, not boxed blocks.
export const BRUTAL_BORDER = {
  borderWidth: 1,
  borderColor: T.hairline,
};
export const HAIRLINE = BRUTAL_BORDER;

// Generous rounded corners.
export const RADIUS = 16;
export const RADIUS_SM = 12;
export const RADIUS_LG = 22;

// Spacing scale for consistent, generous padding.
export const SPACING = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };

// Assistant, app-wide. Body sits at 400 and "bold" resolves to 600 — the
// blockier 700/800 cuts read as heavy next to the soft surfaces.
export const FONTS = {
  light: "Assistant_300Light",
  regular: "Assistant_400Regular",
  medium: "Assistant_500Medium",
  semibold: "Assistant_600SemiBold",
  bold: "Assistant_600SemiBold",
};

// Font-scale multipliers for the accessibility setting.
export const FONT_SCALES = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};
