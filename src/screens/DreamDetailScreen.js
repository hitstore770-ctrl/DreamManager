import { useState } from "react";
import {
  I18nManager,
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
import { formatAmount, formatDateTime, formatShekel } from "../utils/format";
import { exportDreamToPDF } from "../utils/pdfExport";
import { BRUTAL_BORDER, BRUTAL_SHADOW, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../utils/theme";

export default function DreamDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const {
    dreams,
    updateDreamProgress,
    setDreamPricing,
    addMilestone,
    removeMilestone,
    addTask,
    toggleTask,
    addNote,
    setDreamImage,
  } = useDreams();
  const insets = useSafeAreaInsets();
  const [addedValue, setAddedValue] = useState("");
  const [taskText, setTaskText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [costInput, setCostInput] = useState(null);
  const [priceInput, setPriceInput] = useState(null);
  const [msTitle, setMsTitle] = useState("");
  const [msTarget, setMsTarget] = useState("");
  const [msCoins, setMsCoins] = useState("");

  const dream = dreams.find((item) => item.id === id);

  if (!dream) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundText}>הפרויקט לא נמצא</Text>
      </View>
    );
  }

  const category = getCategory(dream.type);
  const percentage =
    dream.target > 0 ? Math.min(100, Math.round((dream.current / dream.target) * 100)) : 0;
  const remaining = Math.max(0, dream.target - dream.current);
  const cost = costInput ?? String(dream.cost ?? 0);
  const price = priceInput ?? String(dream.price ?? 0);
  const profit = (Number(price) || 0) - (Number(cost) || 0);
  const milestones = dream.milestones ?? [];

  const handleAddProgress = () => {
    const value = Number(addedValue);
    if (!addedValue || Number.isNaN(value) || value <= 0) {
      alert("נא להזין ערך תקין");
      return;
    }
    updateDreamProgress(dream.id, value);
    setAddedValue("");
  };

  const handleSavePricing = () => {
    setDreamPricing(dream.id, { cost: Number(cost) || 0, price: Number(price) || 0 });
    setCostInput(null);
    setPriceInput(null);
    alert("התמחור נשמר ✓");
  };

  const handleAddMilestone = () => {
    const target = Number(msTarget);
    const coins = Number(msCoins);
    if (!msTitle.trim()) {
      alert("נא להזין שם לאבן דרך");
      return;
    }
    if (Number.isNaN(target) || target <= 0) {
      alert("נא להזין יעד מספרי לאבן הדרך");
      return;
    }
    addMilestone(dream.id, {
      title: msTitle.trim(),
      target,
      coins: Number.isNaN(coins) ? 0 : coins,
    });
    setMsTitle("");
    setMsTarget("");
    setMsCoins("");
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
          <Text style={styles.headerTitle}>פרטי הפרויקט</Text>
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
            <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
              <Text style={styles.categoryBadgeText}>{category.label}</Text>
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
          <Text style={styles.percentageText}>{percentage}% הושלם</Text>

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
              <Text style={styles.remainingLabel}>כמה נשאר לסגור</Text>
              <Text style={styles.remainingValue}>{formatAmount(remaining, dream.type)}</Text>
            </View>
          </View>
        </View>

        {/* Timeline / Gantt of milestones along the road to the target. */}
        <View style={styles.card}>
          <Text style={styles.updateTitle}>ציר זמן ואבני דרך</Text>
          <Timeline dream={dream} milestones={milestones} category={category} />
        </View>

        {/* Internal cost / pricing calculator. */}
        <View style={styles.card}>
          <Text style={styles.updateTitle}>תמחור ורווחיות</Text>
          <View style={styles.pricingRow}>
            <View style={styles.pricingField}>
              <Text style={styles.miniLabel}>עלות (₪)</Text>
              <TextInput
                style={styles.miniInput}
                value={cost}
                onChangeText={setCostInput}
                keyboardType="numeric"
                textAlign="right"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={styles.pricingField}>
              <Text style={styles.miniLabel}>מחיר מכירה (₪)</Text>
              <TextInput
                style={styles.miniInput}
                value={price}
                onChangeText={setPriceInput}
                keyboardType="numeric"
                textAlign="right"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
          <View
            style={[
              styles.profitBanner,
              { backgroundColor: profit >= 0 ? COLORS.success : COLORS.danger },
            ]}
          >
            <Text style={styles.profitLabel}>רווח נקי</Text>
            <Text style={styles.profitValue}>{formatShekel(profit)}</Text>
          </View>
          <TouchableOpacity
            style={styles.savePricingButton}
            onPress={handleSavePricing}
            activeOpacity={0.85}
          >
            <Text style={styles.savePricingText}>שמור תמחור</Text>
          </TouchableOpacity>
        </View>

        {/* Milestones that auto-release coins when reached. */}
        <View style={styles.card}>
          <Text style={styles.updateTitle}>אבני דרך (משחררות מטבעות)</Text>

          {milestones.length === 0 ? (
            <Text style={styles.emptyText}>אין אבני דרך עדיין</Text>
          ) : (
            milestones.map((m) => (
              <View key={m.id} style={styles.milestoneRow}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeMilestone(dream.id, m.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneTitle}>{m.title}</Text>
                  <Text style={styles.milestoneMeta}>
                    יעד: {formatAmount(m.target, dream.type)} · 🪙 {m.coins}
                  </Text>
                </View>
                <View
                  style={[
                    styles.milestonePill,
                    { backgroundColor: m.released ? COLORS.success : COLORS.mustard },
                  ]}
                >
                  <Text
                    style={[
                      styles.milestonePillText,
                      { color: m.released ? "#FFFFFF" : COLORS.textPrimary },
                    ]}
                  >
                    {m.released ? "שוחרר ✓" : "ממתין"}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.milestoneForm}>
            <TextInput
              style={styles.miniInput}
              value={msTitle}
              onChangeText={setMsTitle}
              placeholder="שם אבן הדרך"
              placeholderTextColor={COLORS.textMuted}
              textAlign="right"
            />
            <View style={styles.pricingRow}>
              <View style={styles.pricingField}>
                <TextInput
                  style={styles.miniInput}
                  value={msTarget}
                  onChangeText={setMsTarget}
                  placeholder="יעד מספרי"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>
              <View style={styles.pricingField}>
                <TextInput
                  style={styles.miniInput}
                  value={msCoins}
                  onChangeText={setMsCoins}
                  placeholder="מטבעות 🪙"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.addMilestoneButton}
              onPress={handleAddMilestone}
              activeOpacity={0.85}
            >
              <Text style={styles.addMilestoneText}>הוסף אבן דרך</Text>
            </TouchableOpacity>
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
          <Text style={styles.updateTitle}>משימות (חלוקה למנות)</Text>

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
                    task.isCompleted && { backgroundColor: category.color },
                  ]}
                >
                  {task.isCompleted && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
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
              placeholder="הוסף מנת עבודה חדשה"
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

// A compact horizontal timeline: the current progress fills the bar, and each
// milestone sits at its proportional position, filled once reached.
function Timeline({ dream, milestones, category }) {
  const pct = (value) =>
    dream.target > 0 ? Math.min(100, Math.max(0, (value / dream.target) * 100)) : 0;
  const currentPct = pct(dream.current);
  const edge = I18nManager.isRTL ? "right" : "left";

  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View
          style={[
            styles.timelineFill,
            { width: `${currentPct}%`, backgroundColor: category.color, [edge]: 0 },
          ]}
        />
        {milestones.map((m) => (
          <View
            key={m.id}
            style={[
              styles.timelineDot,
              {
                [edge]: `${pct(m.target)}%`,
                backgroundColor: m.released ? COLORS.success : COLORS.white,
                marginStart: -8,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.timelineLegend}>
        <Text style={styles.timelineLegendText}>התחלה</Text>
        <Text style={styles.timelineLegendText}>{formatAmount(dream.target, dream.type)}</Text>
      </View>
      {milestones.length === 0 && (
        <Text style={styles.timelineHint}>הוסף אבני דרך כדי לראות אותן על הציר</Text>
      )}
    </View>
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
    fontSize: 24,
    fontFamily: FONTS.bold,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  exportButton: {
    paddingVertical: 13,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    marginBottom: 16,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  exportButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  visionAddButton: {
    paddingVertical: 22,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: 16,
    ...BRUTAL_BORDER,
  },
  visionAddButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  visionBoard: {
    marginBottom: 16,
    borderRadius: RADIUS,
    position: "relative",
    ...BRUTAL_SHADOW,
  },
  visionImage: {
    width: "100%",
    height: 200,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
  },
  visionEditButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    ...BRUTAL_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  visionEditIcon: {
    fontSize: 16,
  },
  card: {
    padding: 18,
    borderRadius: RADIUS,
    backgroundColor: COLORS.card,
    marginBottom: 16,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginEnd: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    ...BRUTAL_BORDER,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: "#FFFFFF",
  },
  progressTrack: {
    height: 16,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    overflow: "hidden",
    ...BRUTAL_BORDER,
  },
  progressFill: {
    height: "100%",
  },
  percentageText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 8,
    color: COLORS.textPrimary,
  },
  breakdown: {
    marginTop: 18,
    borderTopWidth: 2,
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
    fontFamily: FONTS.bold,
  },
  remainingRow: {
    marginBottom: 0,
  },
  remainingLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  remainingValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.navy,
  },
  updateTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginBottom: 14,
  },
  // Timeline
  timelineWrap: {
    marginTop: 4,
  },
  timelineTrack: {
    height: 18,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    position: "relative",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  timelineFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  timelineDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    ...BRUTAL_BORDER,
  },
  timelineLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timelineLegendText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  timelineHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginTop: 10,
  },
  // Pricing
  pricingRow: {
    flexDirection: "row",
    gap: 12,
  },
  pricingField: {
    flex: 1,
  },
  miniLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    marginBottom: 6,
    textAlign: "right",
  },
  miniInput: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  profitBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS,
    marginTop: 4,
    marginBottom: 14,
    ...BRUTAL_BORDER,
  },
  profitLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  profitValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  savePricingButton: {
    height: 48,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  savePricingText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  // Milestones
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: RADIUS,
    backgroundColor: COLORS.background,
    marginBottom: 10,
    ...BRUTAL_BORDER,
  },
  milestoneInfo: {
    flex: 1,
    marginStart: 12,
  },
  milestoneTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  milestoneMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 3,
  },
  milestonePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginStart: 10,
    ...BRUTAL_BORDER,
  },
  milestonePillText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  milestoneForm: {
    marginTop: 6,
  },
  addMilestoneButton: {
    height: 46,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  addMilestoneText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.regular,
    marginBottom: 14,
    ...BRUTAL_BORDER,
  },
  updateButton: {
    height: 52,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
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
    width: 24,
    height: 24,
    borderRadius: 6,
    marginEnd: 12,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    backgroundColor: COLORS.white,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold,
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginEnd: 10,
    ...BRUTAL_BORDER,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginTop: -2,
  },
  noteItem: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    padding: 12,
    marginBottom: 10,
    ...BRUTAL_BORDER,
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
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  deleteButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
