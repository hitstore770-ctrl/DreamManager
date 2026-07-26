import { Feather, Ionicons } from "@expo/vector-icons";

import { UI } from "../utils/ui";

// One place to reach for a glyph, so stroke weight and colour stay consistent.
// Feather is the default (thin, even stroke); a few glyphs Feather lacks come
// from Ionicons' outline set, which matches its weight closely.

const IONICONS = new Set(["sparkles-outline", "diamond-outline", "receipt-outline", "color-wand-outline"]);

export default function Icon({ name, size = 20, color = UI.inkSoft, style }) {
  const Family = IONICONS.has(name) ? Ionicons : Feather;
  return <Family name={name} size={size} color={color} style={style} />;
}
