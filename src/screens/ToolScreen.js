import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "../context/SettingsContext";
import { toolByKey } from "../navigation/toolsRegistry";
import { FONTS, RADIUS, SHADOW_SM } from "../utils/theme";

// Generic host screen for any of the nine tools. The drawer routes here with a
// { toolKey } param; we look the tool up in the registry and render it inside a
// single parent ScrollView (the tools rely on the parent for scrolling).
export default function ToolScreen({ route, navigation }) {
  const { theme } = useSettings();
  const insets = useSafeAreaInsets();
  const tool = toolByKey(route.params?.toolKey);

  const Tool = tool?.Component;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.surface, borderBottomColor: theme.hairline }]}>
        <TouchableOpacity
          style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
          onPress={() => navigation.openDrawer()}
          activeOpacity={0.7}
        >
          <Text style={[styles.menuIcon, { color: theme.textPrimary }]}>☰</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          {tool ? `${tool.emoji}  ${tool.label}` : "כלי"}
        </Text>
        <View style={styles.menuBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {Tool ? (
          <View style={[styles.card, { backgroundColor: theme.surface, ...SHADOW_SM }]}>
            <Tool />
          </View>
        ) : (
          <Text style={{ color: theme.textMuted, textAlign: "center", marginTop: 40, fontFamily: FONTS.medium }}>
            הכלי לא נמצא
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { fontSize: 20, fontFamily: FONTS.bold },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: FONTS.bold },
  content: { padding: 16 },
  card: {
    borderRadius: RADIUS,
    padding: 16,
  },
});
