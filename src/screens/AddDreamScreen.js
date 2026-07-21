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
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
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
                      shadowColor: category.color,
                      shadowOpacity: 0.8,
                      shadowRadius: 12,
                      elevation: 8,
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
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
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
    backgroundColor: "#0B1026",
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
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  cancelText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 15,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "right",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 16,
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  submitButton: {
    marginTop: 12,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(91, 140, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(91, 140, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B8CFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 12,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
