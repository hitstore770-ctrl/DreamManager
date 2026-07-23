import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// Heuristic breakdown: turn one goal into five ordered sub-tasks with rough
// time estimates. No network / LLM needed — deterministic phase templates.
function breakDown(goal) {
  const g = goal.trim();
  return [
    { id: uid(), title: `לתכנן ולהגדיר: ${g}`, min: 15, done: false },
    { id: uid(), title: `לאסוף חומרים / מידע ל${g}`, min: 20, done: false },
    { id: uid(), title: `להתחיל בעבודה על ${g}`, min: 30, done: false },
    { id: uid(), title: `להתקדם בחלק המרכזי של ${g}`, min: 45, done: false },
    { id: uid(), title: `לבדוק, לשפר ולסיים את ${g}`, min: 20, done: false },
  ];
}

function splitFurther(task) {
  const base = task.title;
  const per = Math.max(5, Math.round(task.min / 3));
  return [
    { id: uid(), title: `${base} — שלב א׳`, min: per, done: false },
    { id: uid(), title: `${base} — שלב ב׳`, min: per, done: false },
    { id: uid(), title: `${base} — שלב ג׳`, min: task.min - 2 * per, done: false },
  ];
}

export default function TaskSplitter() {
  const [state, setState] = usePersistentState(STORAGE_KEYS.splitterCurrent, {
    goal: "",
    tasks: [],
  });
  const [templates, setTemplates] = usePersistentState(STORAGE_KEYS.splitterTemplates, []);
  const [goalInput, setGoalInput] = useState("");

  const tasks = state.tasks || [];
  const doneCount = tasks.filter((t) => t.done).length;
  const totalMin = tasks.reduce((s, t) => s + (t.min || 0), 0);
  const progress = tasks.length ? doneCount / tasks.length : 0;

  const generate = () => {
    if (!goalInput.trim()) {
      Alert.alert("חסר יעד", "כתוב יעד כדי לפרק אותו");
      return;
    }
    setState({ goal: goalInput.trim(), tasks: breakDown(goalInput) });
    setGoalInput("");
  };

  const toggle = (id) =>
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));

  const remove = (id) =>
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));

  const move = (index, dir) =>
    setState((s) => {
      const arr = [...s.tasks];
      const j = index + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return { ...s, tasks: arr };
    });

  const setMin = (id, min) =>
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, min: parseInt(min, 10) || 0 } : t)),
    }));

  const wand = (id) =>
    setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx === -1) return s;
      const pieces = splitFurther(s.tasks[idx]);
      const arr = [...s.tasks];
      arr.splice(idx, 1, ...pieces);
      return { ...s, tasks: arr };
    });

  const saveTemplate = () => {
    if (tasks.length === 0) return;
    setTemplates((prev) => [
      { id: uid(), goal: state.goal, tasks: tasks.map((t) => ({ ...t, done: false })) },
      ...prev,
    ]);
    Alert.alert("נשמר ✓", "התבנית נשמרה");
  };

  const loadTemplate = (tpl) =>
    setState({ goal: tpl.goal, tasks: tpl.tasks.map((t) => ({ ...t, id: uid(), done: false })) });

  const removeTemplate = (id) => setTemplates((prev) => prev.filter((t) => t.id !== id));

  const exportToRoutine = async () => {
    if (tasks.length === 0) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.routine);
      const existing = raw ? JSON.parse(raw) : [];
      const steps = tasks.map((t) => ({
        id: uid(),
        time: `${t.min} דק׳`,
        title: t.title,
        rating: 0,
        done: false,
      }));
      await AsyncStorage.setItem(STORAGE_KEYS.routine, JSON.stringify([...existing, ...steps]));
      Alert.alert("יוצא ✓", 'המשימות נוספו ל"סדר יום"');
    } catch {
      Alert.alert("שגיאה", "הייצוא נכשל");
    }
  };

  return (
    <View>
      {/* Goal input */}
      <Text style={styles.label}>מה היעד שצריך לפרק?</Text>
      <TextInput
        style={styles.input}
        value={goalInput}
        onChangeText={setGoalInput}
        placeholder="לדוגמה: להקים חנות אונליין"
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />
      <TouchableOpacity style={styles.generateBtn} onPress={generate} activeOpacity={0.85}>
        <Text style={styles.generateText}>⚡ פרק ל-5 משימות</Text>
      </TouchableOpacity>

      {tasks.length > 0 && (
        <>
          {/* Progress */}
          <View style={styles.progressHead}>
            <Text style={styles.progressText}>
              {doneCount}/{tasks.length} · {totalMin} דק׳
            </Text>
            <Text style={styles.goalTitle} numberOfLines={1}>
              {state.goal}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          {tasks.map((t, i) => (
            <SubTaskRow
              key={t.id}
              task={t}
              index={i}
              last={i === tasks.length - 1}
              onToggle={() => toggle(t.id)}
              onRemove={() => remove(t.id)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onWand={() => wand(t.id)}
              onMin={(v) => setMin(t.id, v)}
            />
          ))}

          <View style={styles.footerActions}>
            <TouchableOpacity style={[styles.footBtn, styles.footRoutine]} onPress={exportToRoutine} activeOpacity={0.85}>
              <Text style={styles.footText}>➡ לסדר יום</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footBtn, styles.footSave]} onPress={saveTemplate} activeOpacity={0.85}>
              <Text style={[styles.footText, { color: COLORS.textPrimary }]}>💾 תבנית</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Saved templates */}
      {templates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>תבניות שמורות</Text>
          {templates.map((tpl) => (
            <View key={tpl.id} style={styles.tplRow}>
              <TouchableOpacity style={styles.tplDelete} onPress={() => removeTemplate(tpl.id)}>
                <Text style={styles.tplDeleteText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tplMain} onPress={() => loadTemplate(tpl)} activeOpacity={0.85}>
                <Text style={styles.tplCount}>{tpl.tasks.length} משימות</Text>
                <Text style={styles.tplTitle} numberOfLines={1}>
                  {tpl.goal}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function SubTaskRow({ task, index, last, onToggle, onRemove, onUp, onDown, onWand, onMin }) {
  const anim = useRef(new Animated.Value(task.done ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: task.done ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [task.done, anim]);

  const strikeWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.taskRow, task.done && styles.taskRowDone]}>
      <View style={styles.reorderCol}>
        <TouchableOpacity onPress={onUp} disabled={index === 0} style={styles.reorderBtn}>
          <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDown} disabled={last} style={styles.reorderBtn}>
          <Text style={[styles.reorderText, last && styles.reorderDisabled]}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.taskBody}>
        <View style={styles.titleWrap}>
          <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
          {/* heavy black strike-through that sweeps across on check */}
          <Animated.View style={[styles.strike, { width: strikeWidth }]} pointerEvents="none" />
        </View>
        <View style={styles.taskMeta}>
          <View style={styles.minBox}>
            <TextInput
              style={styles.minInput}
              value={String(task.min)}
              onChangeText={onMin}
              keyboardType="numeric"
              textAlign="center"
            />
            <Text style={styles.minLabel}>דק׳</Text>
          </View>
          <TouchableOpacity style={styles.wandBtn} onPress={onWand} activeOpacity={0.85}>
            <Text style={styles.wandText}>🪄 פצל</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.check, task.done && styles.checkDone]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={styles.checkMark}>{task.done ? "✓" : ""}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.taskDelete} onPress={onRemove}>
        <Text style={styles.taskDeleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 8 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  generateBtn: {
    height: 56,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  generateText: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progressText: { color: COLORS.navy, fontSize: 14, fontFamily: FONTS.bold },
  goalTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right", marginStart: 10 },
  progressTrack: {
    height: 18,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    overflow: "hidden",
    marginBottom: 16,
    ...BRUTAL_BORDER,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.success },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 10,
    marginBottom: 10,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  taskRowDone: { backgroundColor: "#EEF6EF" },
  reorderCol: { justifyContent: "center", marginEnd: 6 },
  reorderBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  reorderText: { color: COLORS.navy, fontSize: 14, fontFamily: FONTS.bold },
  reorderDisabled: { color: "#CCC" },
  taskBody: { flex: 1 },
  titleWrap: { justifyContent: "center" },
  taskTitle: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right" },
  taskTitleDone: { color: COLORS.textMuted },
  strike: { position: "absolute", right: 0, height: 3, backgroundColor: "#000" },
  taskMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 8, gap: 8 },
  minBox: { flexDirection: "row", alignItems: "center" },
  minInput: {
    width: 46,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingVertical: 4,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    ...BRUTAL_BORDER,
  },
  minLabel: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.medium, marginStart: 4 },
  wandBtn: {
    backgroundColor: COLORS.mustard,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...BRUTAL_BORDER,
  },
  wandText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold },
  check: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 8,
    ...BRUTAL_BORDER,
  },
  checkDone: { backgroundColor: COLORS.success },
  checkMark: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  taskDelete: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 6,
    ...BRUTAL_BORDER,
  },
  taskDeleteText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  footerActions: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 4 },
  footBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  footRoutine: { backgroundColor: COLORS.navy },
  footSave: { backgroundColor: COLORS.white },
  footText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right", marginTop: 18, marginBottom: 12 },
  tplRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 12,
    marginBottom: 10,
    ...BRUTAL_BORDER,
  },
  tplDelete: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  tplDeleteText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  tplMain: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginStart: 10 },
  tplCount: { color: COLORS.navy, fontSize: 12, fontFamily: FONTS.bold },
  tplTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginStart: 10 },
});
