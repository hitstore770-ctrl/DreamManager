import { I18nManager, StyleSheet, Text, View } from "react-native";

const TYPE_THEME = {
  money: { color: "#39FF88" },
  knowledge: { color: "#3EC8FF" },
};

function formatAmount(value, type) {
  const formatted = value.toLocaleString("he-IL");
  return type === "money" ? `₪${formatted}` : formatted;
}

export default function DreamCard({ title, type, current, target }) {
  const theme = TYPE_THEME[type] ?? TYPE_THEME.money;
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <View style={[styles.card, { shadowColor: theme.color }]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
              backgroundColor: theme.color,
              shadowColor: theme.color,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.amount}>
          {formatAmount(current, type)} מתוך {formatAmount(target, type)}
        </Text>
        <Text style={[styles.percentage, { color: theme.color }]}>{percentage}%</Text>
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
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 14,
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
