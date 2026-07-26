import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "../context/SettingsContext";
import { FONTS, RADIUS } from "../utils/theme";

// A clean, on-brand "in build" placeholder for the four tabs that aren't the
// focus yet. Intentionally minimal — a big glyph, the tab name, and a calm
// note so the screen never reads as broken or empty.
function Placeholder({ emoji, title, subtitle }) {
  const { theme, fontScale } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: theme.textPrimary, fontSize: 22 * fontScale }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted, fontSize: 14 * fontScale }]}>{subtitle}</Text>
      <View style={[styles.pill, { backgroundColor: theme.accent + "18" }]}>
        <Text style={[styles.pillText, { color: theme.accent, fontSize: 13 * fontScale }]}>בבנייה · בקרוב</Text>
      </View>
    </View>
  );
}

export function DreamsPlaceholder() {
  return <Placeholder emoji="✨" title="חלומות" subtitle="היעדים והחלומות שלך יופיעו כאן" />;
}
export function ToolsPlaceholder() {
  return <Placeholder emoji="🧰" title="כלים" subtitle="כלי העבודה המהירים יופיעו כאן" />;
}
export function SettingsPlaceholder() {
  return <Placeholder emoji="⚙️" title="הגדרות" subtitle="ההעדפות והאבטחה יופיעו כאן" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: RADIUS + 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 24,
  },
  emoji: { fontSize: 48 },
  title: { fontFamily: FONTS.bold, marginBottom: 8 },
  subtitle: { fontFamily: FONTS.regular, textAlign: "center", lineHeight: 22 },
  pill: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  pillText: { fontFamily: FONTS.bold },
});
