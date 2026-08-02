// The app's single custom typeface — Rubik, loaded locally at startup (see
// App.js) — plus the small set of rules AppText/AppTextInput use to turn a
// plain `fontWeight`/`fontSize` into the right family, letter-spacing and
// line-height automatically, so most call sites never have to think about
// typography by hand.
export const FONTS = {
  light: "Rubik_300Light",
  regular: "Rubik_400Regular",
  medium: "Rubik_500Medium",
  semibold: "Rubik_600SemiBold",
  bold: "Rubik_700Bold",
};

// A named scale for the handful of places that want an explicit role
// (screen title, section heading, body, metadata) rather than an ad-hoc
// fontSize.
export const TYPE = {
  h1: { fontSize: 26, fontWeight: "700" },
  h2: { fontSize: 19, fontWeight: "700" },
  body: { fontSize: 15.5, fontWeight: "400" },
  meta: { fontSize: 12, fontWeight: "500" },
};

export function familyForWeight(weight) {
  const w = String(weight ?? "400").toLowerCase();
  if (w === "700" || w === "800" || w === "900" || w === "bold") return FONTS.bold;
  if (w === "600") return FONTS.semibold;
  if (w === "500") return FONTS.medium;
  if (w === "300" || w === "200" || w === "100" || w === "light") return FONTS.light;
  return FONTS.regular;
}

// Larger text reads better slightly tightened; very small text (metadata,
// badges) reads better slightly opened up. Body-range sizes are left at 0 —
// Rubik doesn't need help there.
export function defaultLetterSpacing(fontSize) {
  if (fontSize >= 24) return -0.4;
  if (fontSize >= 18) return -0.2;
  if (fontSize <= 12) return 0.1;
  return 0;
}

export function defaultLineHeight(fontSize) {
  return Math.round(fontSize * 1.5);
}

// Walks a (possibly nested/array) RN style prop and returns the last
// explicit value for `key` — later entries win, matching how RN itself
// flattens style arrays.
export function flattenStyleProp(style, key) {
  let found;
  const walk = (s) => {
    if (!s) return;
    if (Array.isArray(s)) {
      s.forEach(walk);
      return;
    }
    if (typeof s === "object" && s[key] != null) found = s[key];
  };
  walk(style);
  return found;
}
