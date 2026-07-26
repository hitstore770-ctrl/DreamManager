import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../utils/theme";

const CLAW_MACHINE_COST = 50;

function rollClawPrize() {
  const roll = Math.random() * 100;
  if (roll < 70) return { emoji: "🥉", label: "תג ארד" };
  if (roll < 90) return { emoji: "🥈", label: "תג כסף" };
  return { emoji: "👑", label: "כתר זהב נדיר" };
}

export default function ArcadeScreen({ navigation }) {
  const { user, spendCoins } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSpinning, setIsSpinning] = useState(false);

  const handlePlay = () => {
    const success = spendCoins(CLAW_MACHINE_COST);
    if (!success) {
      alert("אין מספיק מטבעות כדי להפעיל את מכונת המנוף. השלימו משימות או עדכנו התקדמות כדי לצבור עוד!");
      return;
    }

    setIsSpinning(true);
    setTimeout(() => {
      const prize = rollClawPrize();
      setIsSpinning(false);
      alert(`הזרוע תפסה... ${prize.emoji} ${prize.label}!`);
    }, 900);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.headerTitle}>ארקייד</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>חזרה</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>המטבעות שלך</Text>
        <Text style={styles.balanceValue}>🪙 {user?.coins ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.machineEmoji}>🧸</Text>
        <Text style={styles.machineTitle}>מכונת מנוף</Text>
        <Text style={styles.machineSubtitle}>
          70% תג ארד · 20% תג כסף · 10% כתר זהב נדיר
        </Text>

        <TouchableOpacity
          style={[styles.playButton, isSpinning && styles.playButtonDisabled]}
          onPress={handlePlay}
          disabled={isSpinning}
          activeOpacity={0.85}
        >
          {isSpinning ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.playButtonText}>
              הפעל מכונת מנוף ({CLAW_MACHINE_COST} מטבעות)
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  headerRow: {
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
  balanceCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  balanceLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginBottom: 8,
  },
  balanceValue: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontFamily: FONTS.bold,
  },
  card: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  machineEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  machineTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 6,
  },
  machineSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginBottom: 20,
  },
  playButton: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  playButtonDisabled: {
    opacity: 0.75,
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
});
