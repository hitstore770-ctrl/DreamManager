import * as Clipboard from "expo-clipboard";
import { useState } from "react";
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

import { BRUTAL_BORDER, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../../utils/theme";

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

export function ToolCopyButton({ text, label = "העתק", color = COLORS.accent, style }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("שגיאה בהעתקה");
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }, style]}
      onPress={copy}
      activeOpacity={0.85}
    >
 <Text style={styles.buttonText}>{copied ? "הועתק! ": `${label} `}</Text>
    </TouchableOpacity>
  );
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
 <Text style={sheetStyles.closeText}></Text>
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
 <Text style={styles.errorEmoji}></Text>
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    ...BRUTAL_BORDER,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  resultCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    ...BRUTAL_BORDER,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "85%",
    borderTopWidth: 3,
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
    borderRadius: 8,
    backgroundColor: COLORS.white,
    ...BRUTAL_BORDER,
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
