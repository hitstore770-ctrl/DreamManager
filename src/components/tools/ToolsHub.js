import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
  getNoteColor,
} from "../../utils/theme";
import { ToolSheet } from "./ToolKit";

// A full tools hub: header, an optional action button, a grid of tools, and
// the shared bottom-sheet modal. ToolsScreen renders this with its `tools`
// array of the nine business tools.
export default function ToolsHub({ title, tools, navigation, headerButton }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeTool, setActiveTool] = useState(null);

  // Narrow cover screens (e.g. Galaxy Z Flip) get a single-column list;
  // everything wider keeps the 2-column grid.
  const isNarrow = width < 400;

  const ActiveComponent = activeTool?.Component;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>חזרה</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
        {headerButton && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={headerButton.onPress}
            activeOpacity={0.85}
          >
            <Text style={styles.headerButtonText}>{headerButton.label}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.grid}>
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.key}
              style={[
                isNarrow ? styles.toolCardNarrow : styles.toolCardWide,
                { backgroundColor: getNoteColor(tool.key) },
              ]}
              onPress={() => setActiveTool(tool)}
              activeOpacity={0.85}
            >
              <Text style={isNarrow ? styles.toolEmojiNarrow : styles.toolEmoji}>
                {tool.emoji}
              </Text>
              <Text style={[styles.toolLabel, isNarrow && styles.toolLabelNarrow]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ToolSheet
        visible={activeTool !== null}
        title={activeTool ? `${activeTool.emoji}  ${activeTool.label}` : ""}
        onClose={() => setActiveTool(null)}
      >
        {ActiveComponent && <ActiveComponent />}
      </ToolSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  gridContent: {
    paddingBottom: 30,
  },
  headerButton: {
    paddingVertical: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    marginBottom: 20,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  toolCardWide: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 18,
    marginHorizontal: 4,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  toolCardNarrow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  toolEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  toolEmojiNarrow: {
    fontSize: 28,
    marginEnd: 14,
  },
  toolLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  toolLabelNarrow: {
    fontSize: 16,
    textAlign: "right",
    flex: 1,
  },
});
