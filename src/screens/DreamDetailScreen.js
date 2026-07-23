import { useState } from "react";
import {
  Image,
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
import * as ImagePicker from "expo-image-picker";

import { useDreams } from "../context/DreamContext";
import { getCategory } from "../utils/dreamCategories";
import { formatAmount, formatDateTime } from "../utils/format";
import { exportDreamToPDF } from "../utils/pdfExport";
import { COLORS, FONTS } from "../utils/theme";

export default function DreamDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { dreams, updateDreamProgress, addTask, toggleTask, addNote, setDreamImage } =
    useDreams();
  const insets = useSafeAreaInsets();
  const [addedValue, setAddedValue] = useState("");
  const [taskText, setTaskText] = useState("");
  const [noteText, setNoteText] = useState("");

  const dream = dreams.find((item) => item.id === id);

  if (!dream) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundText}>החלום לא נמצא</Text>
      </View>
    );
  }

  const category = getCategory(dream.type);
  const percentage =
    dream.target > 0 ? Math.min(100, Math.round((dream.current / dream.target) * 100)) : 0;
  const remaining = Math.max(0, dream.target - dream.current);

  const handleAddProgress = () => {
    const value = Number(addedValue);
    if (!addedValue || Number.isNaN(value) || value <= 0) {
      alert("נא להזין ערך תקין");
      return;
    }
    updateDreamProgress(dream.id, value);
    setAddedValue("");
  };

  const handleAddTask = () => {
    if (!taskText.trim()) return;
    addTask(dream.id, taskText.trim());
    setTaskText("");
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(dream.id, noteText.trim());
    setNoteText("");
  };

  const handleExport = async () => {
    try {
      await exportDreamToPDF(dream);
    } catch (error) {
      alert("אירעה שגיאה בייצוא הקובץ");
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("נדרשת הרשאה לגלריה כדי לבחור תמונת השראה");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setDreamImage(dream.id, result.assets[0].uri);
    }
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
          <Text style={styles.headerTitle}>פרטי החלום</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>חזרה</Text>
          </TouchableOpacity>
        </View>

        {dream.imageUri ? (
          <View style={styles.visionBoard}>
            <Image source={{ uri: dream.imageUri }} style={styles.visionImage} />
            <TouchableOpacity
              style={styles.visionEditButton}
              onPress={handlePickImage}
              activeOpacity={0.85}
            >
              <Text style={styles.visionEditIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.visionAddButton}
            onPress={handlePickImage}
            activeOpacity={0.85}
          >
            <Text style={styles.visionAddButtonText}>הוסף תמונת השראה 📷</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.exportButton} onPress={handleExport} activeOpacity={0.85}>
          <Text style={styles.exportButtonText}>🖨️ ייצא למחברת A5</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{dream.title}</Text>
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
                { width: `${percentage}%`, backgroundColor: category.color },
              ]}
            />
          </View>
          <Text style={[styles.percentageText, { color: category.color }]}>
            {percentage}% הושלם
          </Text>

          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>יעד</Text>
              <Text style={styles.breakdownValue}>{formatAmount(dream.target, dream.type)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>התקדמות נוכחית</Text>
              <Text style={styles.breakdownValue}>{formatAmount(dream.current, dream.type)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>מה נשאר כדי להגשים את החלום</Text>
              <Text style={[styles.remainingValue, { color: category.color }]}>
                {formatAmount(remaining, dream.type)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.updateTitle}>עדכן התקדמות</Text>
          <TextInput
            style={styles.input}
            value={addedValue}
            onChangeText={setAddedValue}
            placeholder="הזן ערך להוספה"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: category.color }]}
            onPress={handleAddProgress}
            activeOpacity={0.85}
          >
            <Text style={styles.updateButtonText}>הוסף התקדמות</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.updateTitle}>משימות</Text>

          {dream.tasks.length === 0 ? (
            <Text style={styles.emptyText}>אין משימות עדיין</Text>
          ) : (
            dream.tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskRow}
                onPress={() => toggleTask(dream.id, task.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: category.color },
                    task.isCompleted && { backgroundColor: category.color },
                  ]}
                />
                <Text style={[styles.taskText, task.isCompleted && styles.taskTextCompleted]}>
                  {task.text}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={taskText}
              onChangeText={setTaskText}
              placeholder="הוסף משימה חדשה"
              placeholderTextColor={COLORS.textMuted}
              textAlign="right"
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: category.color }]}
              onPress={handleAddTask}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.updateTitle}>פתקים</Text>

          {dream.notes.length === 0 ? (
            <Text style={styles.emptyText}>אין פתקים עדיין</Text>
          ) : (
            dream.notes.map((note) => (
              <View key={note.id} style={styles.noteItem}>
                <Text style={styles.noteText}>{note.text}</Text>
                <Text style={styles.noteDate}>{formatDateTime(note.date)}</Text>
              </View>
            ))
          )}

          <TextInput
            style={[styles.input, styles.noteInput]}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="כתוב פתק חדש..."
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
            multiline
          />
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: category.color }]}
            onPress={handleAddNote}
            activeOpacity={0.85}
          >
            <Text style={styles.updateButtonText}>הוסף פתק</Text>
          </TouchableOpacity>
        </View>
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
  notFoundText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginTop: 100,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  exportButton: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  exportButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  visionAddButton: {
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: 16,
  },
  visionAddButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  visionBoard: {
    marginBottom: 16,
    borderRadius: 20,
    position: "relative",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  visionImage: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visionEditButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  visionEditIcon: {
    fontSize: 16,
  },
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 19,
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
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  percentageText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 8,
  },
  breakdown: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  breakdownValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  remainingRow: {
    marginBottom: 0,
  },
  remainingLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  remainingValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  updateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginBottom: 14,
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
    marginBottom: 14,
  },
  updateButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginBottom: 14,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginEnd: 12,
  },
  taskText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    textAlign: "right",
  },
  taskTextCompleted: {
    color: COLORS.textMuted,
    textDecorationLine: "line-through",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginEnd: 10,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginTop: -2,
  },
  noteItem: {
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  noteText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "right",
    lineHeight: 20,
  },
  noteDate: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 6,
  },
  noteInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
});
