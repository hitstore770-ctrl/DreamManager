import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

// Reusable bottom-sheet modal shared by every tools hub screen.
export function ToolSheet({ visible, title, onClose, children }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sheetStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={sheetStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={sheetStyles.header}>
            <Text style={sheetStyles.title}>{title}</Text>
            <TouchableOpacity
              style={sheetStyles.close}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={sheetStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(17, 24, 39, 0.05)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 12,
  },
  closeText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
});
