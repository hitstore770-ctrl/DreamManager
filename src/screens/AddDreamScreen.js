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
import { DREAM_CATEGORIES } from "../utils/dreamCategories";
import { COLORS, FONTS } from "../utils/theme";

export default function AddDreamScreen({ navigation }) {
  const { addDream } = useDreams();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [categoryKey, setCategoryKey] = useState(null);
  const [targetValue, setTargetValue] = useState("");

  const handleSubmit = () => {
    const target = Number(targetValue);

    if (!title.trim()) {
      alert("נא להזין שם לחלום");
      return;
    }
    if (!categoryKey) {
      alert("נא לבחור קטגוריה");
      return;
    }
    if (!targetValue || Number.isNaN(target) || target <= 0) {
      alert("נא להזין יעד מספרי תקין");
      return;
    }

    addDream({ title: title.trim(), type: categoryKey, target });
    navigation.goBack();
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
          <Text style={styles.headerTitle}>חלום חדש</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>ביטול</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>שם החלום</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="לדוגמה: רחפן DJI חדש"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>קטגוריה</Text>
          <View style={styles.categoryGrid}>
            {DREAM_CATEGORIES.map((category) => {
              const selected = category.key === categoryKey;
              return (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.categoryButton,
                    selected && {
                      borderColor: category.color,
                      backgroundColor: "rgba(17, 24, 39, 0.03)",
                      shadowColor: category.color,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      elevation: 4,
                    },
                  ]}
                  onPress={() => setCategoryKey(category.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.categoryButtonText, selected && { color: category.color }]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>יעד מספרי</Text>
          <TextInput
            style={styles.input}
            value={targetValue}
            onChangeText={setTargetValue}
            placeholder="לדוגמה: 5000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            textAlign="right"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
          <Text style={styles.submitButtonText}>הוסף חלום</Text>
        </TouchableOpacity>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.medium,
    marginBottom: 10,
    textAlign: "right",
  },
  input: {
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryButton: {
    width: "48%",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 12,
  },
  categoryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  submitButton: {
    marginTop: 12,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
});
