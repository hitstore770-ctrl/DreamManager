// Pastel note-card backgrounds, selectable per note. Same key set works in
// both themes — light/dark just pick a different swatch.
export const NOTE_COLORS = [
  { key: "default", light: "#FFFFFF", dark: "#1C1F26" },
  { key: "yellow", light: "#FFF7D6", dark: "#2A2818" },
  { key: "blue", light: "#E3F0FF", dark: "#16212E" },
  { key: "green", light: "#E4F8EC", dark: "#152417" },
  { key: "pink", light: "#FCE4EE", dark: "#2A1820" },
  { key: "purple", light: "#EEE8FE", dark: "#1F1A2C" },
];

export function noteColor(key, dark) {
  const c = NOTE_COLORS.find((x) => x.key === key) || NOTE_COLORS[0];
  return dark ? c.dark : c.light;
}
