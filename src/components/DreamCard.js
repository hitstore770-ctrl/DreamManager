import { I18nManager, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { getCategory } from "../utils/dreamCategories";
import { formatAmount } from "../utils/format";
import { COLORS, FONTS, PAPER_SHADOW, getNoteColor, getNoteTilt } from "../utils/theme";

export default function DreamCard({ id, title, type, current, target, onPress }) {
  const category = getCategory(type);
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const noteColor = getNoteColor(id ?? title);
  const tilt = getNoteTilt(id ?? title);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: noteColor, transform: [{ rotate: tilt }] }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
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
    borderRadius: 6,
    marginBottom: 18,
    marginHorizontal: 4,
    ...PAPER_SHADOW,
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
    fontFamily: FONTS.bold,
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
    fontFamily: FONTS.bold,
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
    fontFamily: FONTS.regular,
  },
  percentage: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
});
