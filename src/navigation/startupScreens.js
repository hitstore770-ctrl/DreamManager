// The five bottom-tab zones, as data.
//
// This is the single list; AppNavigator imports it and attaches the screen
// components, and Settings imports it to build the "open the app on…" picker.
// Keeping it here rather than exporting it from AppNavigator avoids a cycle
// (SettingsScreen is itself a route inside that navigator) and — more usefully
// — makes it impossible for the picker to offer a route the navigator does not
// register, which would silently fall back to the default tab.
//
// Order is RTL reading order: first entry sits rightmost on a real RTL build.
export const STARTUP_SCREENS = [
  { name: "Money", icon: "trending-up", label: "הכסף שלי" },
  { name: "Library", icon: "star", label: "חלומות" },
  { name: "Assistant", icon: "message-circle", label: "נועה" },
  { name: "CashFlow", icon: "bar-chart-2", label: "תזרים" },
  { name: "Workshop", icon: "tool", label: "כלים" },
];

// Noa. The tab the app opened on before the preference existed, and the
// fallback whenever a stored value names a zone that no longer exists.
export const DEFAULT_STARTUP_SCREEN = "Assistant";

/** A stored preference, validated against the zones that actually exist. */
export function resolveStartupScreen(name) {
  return STARTUP_SCREENS.some((z) => z.name === name) ? name : DEFAULT_STARTUP_SCREEN;
}
