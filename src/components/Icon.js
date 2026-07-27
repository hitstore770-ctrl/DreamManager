// Import each family by its own entry point, not the "@expo/vector-icons"
// barrel: the barrel pulls in all 26 icon fonts (~4MB of TTF) whether or not
// they are used. These two paths register only Feather and Ionicons.
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";

import { UI } from "../utils/ui";

// One place to reach for a glyph, so stroke weight and colour stay consistent.
// Feather is the default (thin, even stroke). Anything Feather lacks comes
// from Ionicons' outline set, which matches its weight closely — those names
// are listed here so the wrapper knows which family to use.

const IONICONS = new Set([
  "sparkles-outline",
  "diamond-outline",
  "receipt-outline",
  "color-wand-outline",
  "cafe-outline",
  "bed-outline",
  "restaurant-outline",
  "git-compare",
  "water-outline",
  "flash-outline",
  "nutrition-outline",
  "cube-outline",
  "wallet-outline",
  "pricetags-outline",
  "gift-outline",
  "cash-outline",
  "card-outline",
  "calculator-outline",
  "stats-chart-outline",
  "person-add-outline",
  "snow-outline",
  "bulb-outline",
  "happy-outline",
  "warning-outline",
  "shield-checkmark-outline",
]);

export default function Icon({ name, size = 20, color = UI.inkSoft, style }) {
  const Family = IONICONS.has(name) ? Ionicons : Feather;
  return <Family name={name} size={size} color={color} style={style} />;
}
