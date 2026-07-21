import { I18nManager, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { getCategory } from "../utils/dreamCategories";
import { formatAmount } from "../utils/format";
import { COLORS } from "../utils/theme";

export default function DreamCard({ title, type, current, target, onPress }) {
  const category = getCategory(type);
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
            {
              width: `${percentage}%`,
              backgroundColor: category.color,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.amount}>
          {formatAmount(current, type)} מתוך {formatAmount(target, type)}
        </Text>
        <Text style={[styles.percentage, { color: category.color }]}>{percentage}%</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 17,
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
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    ...(I18nManager.isRTL ? { right: 0 } : { left: 0 }),
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  amount: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  percentage: {
    fontSize: 14,
    fontWeight: "700",
  },
});
