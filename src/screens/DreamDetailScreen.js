import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDreams } from "../context/DreamContext";
import { getCategory } from "../utils/dreamCategories";
import { COLORS } from "../utils/theme";

function formatAmount(value, type) {
  const formatted = value.toLocaleString("he-IL");
  return type === "money" ? `₪${formatted}` : formatted;
}

export default function DreamDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { dreams, updateDreamProgress } = useDreams();
  const insets = useSafeAreaInsets();
  const [addedValue, setAddedValue] = useState("");

  const dream = dreams.find((item) => item.id === id);

  if (!dream) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundText}>החלום לא נמצא</Text>
      </View>
    );
  }

  const category = getCategory(dream.type);
  const percentage =
    dream.target > 0 ? Math.min(100, Math.round((dream.current / dream.target) * 100)) : 0;
  const remaining = Math.max(0, dream.target - dream.current);

  const handleAddProgress = () => {
    const value = Number(addedValue);
    if (!addedValue || Number.isNaN(value) || value <= 0) {
      alert("נא להזין ערך תקין");
      return;
    }
    updateDreamProgress(dream.id, value);
    setAddedValue("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>פרטי החלום</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>חזרה</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{dream.title}</Text>
            <View style={[styles.categoryBadge, { borderColor: category.color }]}>
              <Text style={[styles.categoryBadgeText, { color: category.color }]}>
                {category.label}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage}%`, backgroundColor: category.color },
              ]}
            />
          </View>
          <Text style={[styles.percentageText, { color: category.color }]}>
            {percentage}% הושלם
          </Text>

          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>יעד</Text>
              <Text style={styles.breakdownValue}>{formatAmount(dream.target, dream.type)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>התקדמות נוכחית</Text>
              <Text style={styles.breakdownValue}>{formatAmount(dream.current, dream.type)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>מה נשאר כדי להגשים את החלום</Text>
              <Text style={[styles.remainingValue, { color: category.color }]}>
                {formatAmount(remaining, dream.type)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.updateTitle}>עדכן התקדמות</Text>
          <TextInput
            style={styles.input}
            value={addedValue}
            onChangeText={setAddedValue}
            placeholder="הזן ערך להוספה"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: category.color }]}
            onPress={handleAddProgress}
            activeOpacity={0.85}
          >
            <Text style={styles.updateButtonText}>הוסף התקדמות</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  notFoundText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: "center",
    marginTop: 100,
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
    fontWeight: "700",
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "right",
    marginEnd: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 8,
  },
  breakdown: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  breakdownValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  remainingRow: {
    marginBottom: 0,
  },
  remainingLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  remainingValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  updateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 14,
  },
  updateButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
