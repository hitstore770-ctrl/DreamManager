import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";

// Shared building blocks so every tool looks the same and stays tiny.

export function ToolField({ label, value, onChangeText, placeholder, keyboardType = "numeric" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        textAlign="right"
      />
    </View>
  );
}

export function ToolButton({ label, onPress, color = COLORS.accent, style }) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ToolResult({ label, value, highlight = false }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, highlight && styles.resultValueHighlight]}>{value}</Text>
    </View>
  );
}

export function ToolResultCard({ children }) {
  return <View style={styles.resultCard}>{children}</View>;
}

export function ToolLoading({ label = "טוען..." }) {
  return (
    <View style={styles.centerBox}>
      <ActivityIndicator color={COLORS.accent} />
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

export function ToolError({ message, onRetry }) {
  return (
    <View style={styles.centerBox}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.medium,
    marginBottom: 8,
    textAlign: "right",
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
    fontFamily: FONTS.regular,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  resultCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(79, 107, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(79, 107, 255, 0.18)",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  resultLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  resultValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  resultValueHighlight: {
    color: COLORS.accent,
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  centerBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginTop: 12,
  },
  errorEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
});
