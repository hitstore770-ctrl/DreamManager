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
import { BRUTAL_BORDER, BRUTAL_SHADOW, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../utils/theme";

export default function AddDreamScreen({ navigation }) {
  const { addDream } = useDreams();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [categoryKey, setCategoryKey] = useState(null);
  const [targetValue, setTargetValue] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = () => {
    const target = Number(targetValue);

    if (!title.trim()) {
      alert("נא להזין שם לפרויקט");
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

    addDream({
      title: title.trim(),
      type: categoryKey,
      target,
      cost: Number(cost) || 0,
      price: Number(price) || 0,
    });
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
          <Text style={styles.headerTitle}>פרויקט חדש</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>ביטול</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>שם הפרויקט</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="לדוגמה: מכונת שתייה נוספת"
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
                      backgroundColor: category.color,
                    },
                  ]}
                  onPress={() => setCategoryKey(category.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selected && { color: "#FFFFFF" },
                    ]}
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

        <View style={styles.pricingRow}>
          <View style={styles.pricingField}>
            <Text style={styles.label}>עלות (₪)</Text>
            <TextInput
              style={styles.input}
              value={cost}
              onChangeText={setCost}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
          <View style={styles.pricingField}>
            <Text style={styles.label}>מחיר מכירה (₪)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
 <Text style={styles.submitButtonText}>הוסף פרויקט </Text>
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
    fontSize: 24,
    fontFamily: FONTS.bold,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  field: {
    marginBottom: 22,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginBottom: 10,
    textAlign: "right",
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    ...BRUTAL_BORDER,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryButton: {
    width: "48%",
    paddingVertical: 16,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    marginBottom: 12,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  categoryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  pricingRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  pricingField: {
    flex: 1,
  },
  submitButton: {
    marginTop: 12,
    height: 58,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
});
