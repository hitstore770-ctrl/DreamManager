import { FlatList, I18nManager, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DreamCard from "../components/DreamCard";
import { useAuth } from "../context/AuthContext";
import { useDreams } from "../context/DreamContext";
import { COLORS, FONTS } from "../utils/theme";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { dreams } = useDreams();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.greeting}>שלום, {user?.displayName ?? "חולם"}</Text>
          <Text style={styles.subGreeting}>אלו החלומות שלך</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>התנתקות</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("Arcade")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>🕹️ ארקייד: {user?.coins ?? 0} מטבעות</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("Tools")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>🛠️ ארגז כלים</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={dreams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DreamCard
            {...item}
            onPress={() => navigation.navigate("DreamDetail", { id: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + 24 },
          I18nManager.isRTL ? { left: 24 } : { right: 24 },
        ]}
        onPress={() => navigation.navigate("AddDream")}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  subGreeting: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  fab: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 30,
    fontFamily: FONTS.regular,
    marginTop: -2,
  },
});
