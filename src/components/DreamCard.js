import { I18nManager, StyleSheet, Text, View } from "react-native";

import { getCategory } from "../utils/dreamCategories";

function formatAmount(value, type) {
  const formatted = value.toLocaleString("he-IL");
  return type === "money" ? `₪${formatted}` : formatted;
}

export default function DreamCard({ title, type, current, target }) {
  const category = getCategory(type);
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <View style={[styles.card, { shadowColor: category.color }]}>
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
              shadowColor: category.color,
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
    marginEnd: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
    ...(I18nManager.isRTL ? { right: 0 } : { left: 0 }),
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  amount: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
  },
  percentage: {
    fontSize: 14,
    fontWeight: "700",
  },
});
