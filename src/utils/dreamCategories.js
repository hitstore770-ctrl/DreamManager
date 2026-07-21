export const DREAM_CATEGORIES = [
  { key: "money", label: "כסף", color: "#39FF88" },
  { key: "km", label: "קילומטרים", color: "#FF9F1C" },
  { key: "weight", label: "משקל", color: "#B983FF" },
  { key: "knowledge", label: "ידע", color: "#3EC8FF" },
];

export function getCategory(key) {
  return DREAM_CATEGORIES.find((category) => category.key === key) ?? DREAM_CATEGORIES[0];
}
