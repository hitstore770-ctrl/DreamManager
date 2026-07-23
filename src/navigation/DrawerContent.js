import { DrawerContentScrollView } from "@react-navigation/drawer";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { FONTS, RADIUS } from "../utils/theme";
import { CATEGORIES, TOOLS, orderedCategories } from "./toolsRegistry";

// Custom drawer: a branded header with the user + coins, a Dashboard shortcut,
// the nine tools grouped under POS & Sales / Operations / Finance (order set by
// the active workspace mode), and Arcade + Settings pinned below.
export default function DrawerContent(props) {
  const { theme, workspace, censor, haptic } = useSettings();
  const { user } = useAuth();
  const { navigation, state } = props;
  const activeRoute = state.routeNames[state.index];

  const go = (name) => {
    haptic("light");
    navigation.navigate(name);
  };

  const catInfo = (key) => CATEGORIES.find((c) => c.key === key);
  const toolsFor = (key) => TOOLS.filter((t) => t.category === key);

  const Item = ({ name, emoji, label, active }) => (
    <TouchableOpacity
      style={[
        styles.item,
        active && { backgroundColor: theme.accent + "18" },
      ]}
      activeOpacity={0.7}
      onPress={() => go(name)}
    >
      <Text style={styles.itemEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.itemLabel,
          { color: active ? theme.accent : theme.textPrimary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        {/* Brand header */}
        <View style={[styles.header, { backgroundColor: theme.brand }]}>
          <Text style={styles.brandTitle}>DreamManager</Text>
          <Text style={styles.brandUser}>שלום, {user?.displayName ?? "אלוף"}</Text>
          <View style={styles.coinPill}>
            <Text style={styles.coinText}>🪙 {censor(user?.coins ?? 0)} מטבעות</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Item name="Dashboard" emoji="🏠" label="לוח בקרה" active={activeRoute === "Dashboard"} />

          {orderedCategories(workspace).map((catKey) => {
            const cat = catInfo(catKey);
            if (!cat) return null;
            return (
              <View key={catKey} style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  {cat.emoji}  {cat.label}
                </Text>
                {toolsFor(catKey).map((t) => (
                  <Item
                    key={t.key}
                    name={t.key}
                    emoji={t.emoji}
                    label={t.label}
                    active={activeRoute === t.key}
                  />
                ))}
              </View>
            );
          })}
        </View>
      </DrawerContentScrollView>

      {/* Pinned footer */}
      <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
        <Item name="Arcade" emoji="🎯" label="ארקייד" active={activeRoute === "Arcade"} />
        <Item name="Settings" emoji="⚙️" label="הגדרות" active={activeRoute === "Settings"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 54,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  brandTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: FONTS.bold },
  brandUser: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: FONTS.medium, marginTop: 4 },
  coinPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coinText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  body: { paddingHorizontal: 12, paddingTop: 10 },
  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    marginBottom: 4,
    marginHorizontal: 12,
    textAlign: "right",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: RADIUS,
    marginVertical: 1,
  },
  itemEmoji: { fontSize: 18, marginEnd: 12, width: 24, textAlign: "center" },
  itemLabel: { fontSize: 15, fontFamily: FONTS.medium, flex: 1, textAlign: "right" },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 24,
  },
});
