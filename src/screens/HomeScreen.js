import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DreamCard from "../components/DreamCard";
import { useAuth } from "../context/AuthContext";
import { useDreams } from "../context/DreamContext";
import { BRUTAL_BORDER, BRUTAL_SHADOW, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../utils/theme";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { dreams, isLoading, error } = useDreams();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.greeting}>שלום, {user?.displayName ?? "אלוף"}</Text>
          <Text style={styles.subGreeting}>יאללה לעבודה - הפרויקטים שלי</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>התנתקות</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.arcadeButton}
        onPress={() => navigation.navigate("Arcade")}
        activeOpacity={0.85}
      >
        <Text style={styles.arcadeButtonText}>🎯 ארקייד: {user?.coins ?? 0} מטבעות</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonAlt]}
          onPress={() => navigation.navigate("Tools")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonTextAlt}>🧰 ארגז הכלים לעסק</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.loadingText}>טוען את הפרויקטים שלך מהענן...</Text>
        </View>
      ) : (
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>אין פרויקטים עדיין. הוסף אחד עם ה־+</Text>
          }
        />
      )}

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
    fontSize: 22,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  subGreeting: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  logoutButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  arcadeButton: {
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  arcadeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  actionButtonAlt: {
    backgroundColor: COLORS.navy,
  },
  actionButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  actionButtonTextAlt: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginTop: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginTop: 14,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: RADIUS,
    backgroundColor: "#FFE8D6",
    ...BRUTAL_BORDER,
  },
  errorBannerText: {
    color: "#8A3B00",
    fontSize: 12,
    fontFamily: FONTS.medium,
    textAlign: "right",
  },
  fab: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: FONTS.bold,
    marginTop: -4,
  },
});
