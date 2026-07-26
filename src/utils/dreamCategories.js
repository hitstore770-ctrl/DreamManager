export const DREAM_CATEGORIES = [
  { key: "money", label: "כסף", color: "#10B981" },
  { key: "km", label: "קילומטרים", color: "#E07C1D" },
  { key: "weight", label: "משקל", color: "#7C3AED" },
  { key: "knowledge", label: "ידע", color: "#2563EB" },
];

export function getCategory(key) {
  return DREAM_CATEGORIES.find((category) => category.key === key) ?? DREAM_CATEGORIES[0];
}
