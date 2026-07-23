import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

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

const PRESETS = [
  { emoji: "☀️", title: "בוקר טוב", time: "07:00" },
  { emoji: "🏋️", title: "אימון", time: "08:00" },
  { emoji: "💼", title: "עבודה", time: "09:00" },
  { emoji: "🍽️", title: "צהריים", time: "13:00" },
  { emoji: "📚", title: "לימוד", time: "17:00" },
  { emoji: "🌙", title: "סיכום יום", time: "21:00" },
];

// Subtract minutes from an "HH:MM" string; returns "HH:MM" or null.
function minusMinutes(time, minutes) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || "");
  if (!m) return null;
  let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) - minutes;
  total = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function RoutineBuilder() {
  const [steps, setSteps] = usePersistentState(STORAGE_KEYS.routine, []);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [prep, setPrep] = useState("");
  const [transit, setTransit] = useState("");
  const [conditional, setConditional] = useState(false);
  const [condition, setCondition] = useState("");

  const [studyMode, setStudyMode] = useState(false);
  const [autoDnd, setAutoDnd] = useState(false);

  const active = useMemo(() => steps.filter((s) => !s.skipped), [steps]);
  const doneCount = active.filter((s) => s.done).length;
  const progress = active.length ? doneCount / active.length : 0;
  const nextStep = active.find((s) => !s.done) || null;

  const addStep = (preset) => {
    const t = preset ? preset.time : time.trim();
    const ttl = preset ? preset.title : title.trim();
    if (!ttl) {
      alert("נא להזין שם לשלב");
      return;
    }
    setSteps((prev) => [
      ...prev,
      {
        id: uid(),
        time: t,
        title: ttl,
        prepMin: parseInt(prep, 10) || 0,
        transitMin: parseInt(transit, 10) || 0,
        conditional: preset ? false : conditional,
        condition: preset ? "" : condition.trim(),
        done: false,
        skipped: false,
        rating: 0,
      },
    ]);
    if (!preset) {
      setTime("");
      setTitle("");
      setPrep("");
      setTransit("");
      setConditional(false);
      setCondition("");
    }
  };

  const patch = (id, fields) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));

  const removeStep = (id) => setSteps((prev) => prev.filter((s) => s.id !== id));

  const move = (id, dir) =>
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const j = idx + dir;
      if (idx === -1 || j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });

  const cloneTomorrow = () => {
    if (steps.length === 0) return;
    setSteps((prev) => prev.map((s) => ({ ...s, done: false, rating: 0, skipped: false })));
    alert("השגרה שוכפלה למחר — כל השלבים אופסו ומוכנים ליום חדש");
  };

  const sortByTime = () =>
    setSteps((prev) =>
      [...prev].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
    );

  const renderStep = (step, index) => {
    const leave =
      step.time && (step.prepMin || step.transitMin)
        ? minusMinutes(step.time, step.prepMin + step.transitMin)
        : null;
    return (
      <View
        key={step.id}
        style={[
          styles.stepRow,
          step.done && styles.stepDone,
          step.skipped && styles.stepSkipped,
        ]}
      >
        <View style={styles.stepHeader}>
          <View style={styles.reorderCol}>
            <TouchableOpacity onPress={() => move(step.id, -1)} style={styles.reorderBtn}>
              <Text style={styles.reorderText}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => move(step.id, 1)} style={styles.reorderBtn}>
              <Text style={styles.reorderText}>▼</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.checkbox, step.done && styles.checkboxOn]}
            onPress={() => patch(step.id, { done: !step.done })}
            activeOpacity={0.8}
          >
            <Text style={styles.checkboxMark}>{step.done ? "✓" : ""}</Text>
          </TouchableOpacity>

          <View style={styles.stepBody}>
            <Text style={[styles.stepTitle, step.done && styles.stepTitleDone]}>{step.title}</Text>
            <View style={styles.badgeRow}>
              {step.time ? <Text style={styles.timeBadge}>🕐 {step.time}</Text> : null}
              {step.prepMin > 0 && <Text style={styles.prepBadge}>🔔 הכנה {step.prepMin}׳</Text>}
              {step.transitMin > 0 && <Text style={styles.transitBadge}>🚗 דרך {step.transitMin}׳</Text>}
            </View>
            {leave && <Text style={styles.leaveText}>לצאת ב-{leave}</Text>}
            {step.conditional && (
              <TouchableOpacity
                style={[styles.condPill, step.skipped && styles.condPillSkipped]}
                onPress={() => patch(step.id, { skipped: !step.skipped })}
                activeOpacity={0.85}
              >
                <Text style={styles.condText}>
                  {step.skipped ? "⏭ דולג" : `❓ ${step.condition || "מותנה"} — הקש לדילוג`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
        </View>

        {/* Star rating (shown once done) */}
        {step.done && (
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => patch(step.id, { rating: n })}>
                <Text style={[styles.star, n <= step.rating && styles.starOn]}>★</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.stepDelete} onPress={() => removeStep(step.id)}>
              <Text style={styles.stepDeleteText}>מחק</Text>
            </TouchableOpacity>
          </View>
        )}
        {!step.done && (
          <TouchableOpacity style={styles.stepDeleteRow} onPress={() => removeStep(step.id)}>
            <Text style={styles.stepDeleteText}>✕ הסר</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ---- Study Mode: focus on just the next block --------------------------
  if (studyMode) {
    return (
      <View>
        <TouchableOpacity style={styles.studyToggleOn} onPress={() => setStudyMode(false)} activeOpacity={0.85}>
          <Text style={styles.studyToggleText}>✕ צא ממצב מיקוד</Text>
        </TouchableOpacity>
        {autoDnd && <Text style={styles.dndNote}>🔕 מצב נא לא להפריע פעיל</Text>}
        <View style={styles.studyCard}>
          {nextStep ? (
            <>
              <Text style={styles.studyLabel}>המשימה הבאה</Text>
              <Text style={styles.studyTitle}>{nextStep.title}</Text>
              {nextStep.time ? <Text style={styles.studyTime}>🕐 {nextStep.time}</Text> : null}
              <TouchableOpacity
                style={styles.studyDone}
                onPress={() => patch(nextStep.id, { done: true })}
                activeOpacity={0.85}
              >
                <Text style={styles.studyDoneText}>✓ סיימתי</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.studyTitle}>🎉 סיימת את כל השגרה!</Text>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {doneCount}/{active.length} הושלמו
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Top controls */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.topBtn, styles.topStudy]}
          onPress={() => setStudyMode(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.topBtnText}>🎯 מיקוד</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topBtn, autoDnd ? styles.topDndOn : styles.topDnd]}
          onPress={() => setAutoDnd((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={[styles.topBtnText, { color: COLORS.textPrimary }]}>
            {autoDnd ? "🔕 DND פעיל" : "🔔 DND כבוי"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topBtn, styles.topClone]} onPress={cloneTomorrow} activeOpacity={0.85}>
          <Text style={styles.topBtnText}>📅 למחר</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      {active.length > 0 && (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {doneCount}/{active.length} הושלמו היום
          </Text>
        </>
      )}

      {/* Preset time blocks */}
      <Text style={styles.label}>בלוקים מוכנים (הקש להוספה)</Text>
      <View style={styles.presetGrid}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.title}
            style={styles.presetChip}
            onPress={() => addStep(p)}
            activeOpacity={0.85}
          >
            <Text style={styles.presetText}>
              {p.emoji} {p.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add form */}
      <Text style={styles.label}>הוסף בלוק מותאם</Text>
      <View style={styles.formRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={time}
          onChangeText={setTime}
          placeholder="07:00"
          placeholderTextColor={COLORS.textMuted}
          textAlign="center"
        />
        <TextInput
          style={[styles.input, styles.flexInput]}
          value={title}
          onChangeText={setTitle}
          placeholder="שם הבלוק"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
      </View>
      <View style={styles.formRow}>
        <View style={styles.miniCol}>
          <Text style={styles.miniLabel}>הכנה (דק׳)</Text>
          <TextInput
            style={styles.input}
            value={prep}
            onChangeText={setPrep}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
        <View style={styles.miniCol}>
          <Text style={styles.miniLabel}>זמן דרך (דק׳)</Text>
          <TextInput
            style={styles.input}
            value={transit}
            onChangeText={setTransit}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.condToggle}
        onPress={() => setConditional((v) => !v)}
        activeOpacity={0.85}
      >
        <View style={[styles.condCheck, conditional && styles.condCheckOn]}>
          <Text style={styles.checkboxMark}>{conditional ? "✓" : ""}</Text>
        </View>
        <Text style={styles.condToggleText}>בלוק מותנה (אפשר לדלג עליו)</Text>
      </TouchableOpacity>
      {conditional && (
        <TextInput
          style={styles.input}
          value={condition}
          onChangeText={setCondition}
          placeholder="התנאי, למשל: רק אם לא יורד גשם"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => addStep(null)} activeOpacity={0.85}>
        <Text style={styles.addBtnText}>＋ הוסף לשגרה</Text>
      </TouchableOpacity>

      {/* Steps */}
      {steps.length === 0 ? (
        <Text style={styles.empty}>עדיין לא נבנתה שגרה. הוסף בלוק ראשון.</Text>
      ) : (
        <>
          <View style={styles.listHeader}>
            <TouchableOpacity onPress={sortByTime} activeOpacity={0.8}>
              <Text style={styles.sortText}>↕ מיין לפי שעה</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>השגרה שלי</Text>
          </View>
          {steps.map((step, i) => renderStep(step, i))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  topBtn: { flex: 1, height: 44, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  topStudy: { backgroundColor: COLORS.navy },
  topDnd: { backgroundColor: COLORS.white },
  topDndOn: { backgroundColor: COLORS.mustard },
  topClone: { backgroundColor: COLORS.success },
  topBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  progressTrack: {
    height: 18,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    overflow: "hidden",
    marginBottom: 6,
    ...BRUTAL_BORDER,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.success },
  progressText: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 14 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 8 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  presetChip: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginStart: 8,
    marginBottom: 8,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  presetText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  formRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 10,
    ...BRUTAL_BORDER,
  },
  timeInput: { width: 90 },
  flexInput: { flex: 1 },
  miniCol: { flex: 1 },
  miniLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 },
  condToggle: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginVertical: 6 },
  condCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 10,
    ...BRUTAL_BORDER,
  },
  condCheckOn: { backgroundColor: COLORS.navy },
  condToggleText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  addBtn: {
    height: 52,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  addBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 14 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sortText: { color: COLORS.navy, fontSize: 13, fontFamily: FONTS.bold },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right" },
  stepRow: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 12,
    marginBottom: 10,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  stepDone: { backgroundColor: "#EEF6EF" },
  stepSkipped: { opacity: 0.6 },
  stepHeader: { flexDirection: "row", alignItems: "center" },
  reorderCol: { justifyContent: "center", marginEnd: 6 },
  reorderBtn: { paddingVertical: 1, paddingHorizontal: 3 },
  reorderText: { color: COLORS.navy, fontSize: 13, fontFamily: FONTS.bold },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  checkboxOn: { backgroundColor: COLORS.success },
  checkboxMark: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  stepBody: { flex: 1, marginHorizontal: 10 },
  stepTitle: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  stepTitleDone: { color: COLORS.textMuted, textDecorationLine: "line-through" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 6 },
  timeBadge: { color: COLORS.navy, fontSize: 12, fontFamily: FONTS.bold, marginStart: 8 },
  prepBadge: { color: COLORS.danger, fontSize: 12, fontFamily: FONTS.bold, marginStart: 8 },
  transitBadge: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.bold, marginStart: 8 },
  leaveText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.medium, textAlign: "right", marginTop: 4 },
  condPill: {
    backgroundColor: COLORS.mustard,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: "flex-end",
    ...BRUTAL_BORDER,
  },
  condPillSkipped: { backgroundColor: COLORS.textMuted },
  condText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  indexText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  starsRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 10, gap: 4 },
  star: { color: "#D9D9D9", fontSize: 24, fontFamily: FONTS.bold },
  starOn: { color: COLORS.mustard },
  stepDelete: { marginStart: 14 },
  stepDeleteRow: { alignItems: "flex-start", marginTop: 8 },
  stepDeleteText: { color: COLORS.danger, fontSize: 12, fontFamily: FONTS.bold },
  // Study mode
  studyToggleOn: {
    height: 46,
    borderRadius: RADIUS,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...BRUTAL_BORDER,
  },
  studyToggleText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  dndNote: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center", marginBottom: 12 },
  studyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 30,
    alignItems: "center",
    marginBottom: 16,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  studyLabel: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.medium, marginBottom: 10 },
  studyTitle: { color: COLORS.textPrimary, fontSize: 26, fontFamily: FONTS.bold, textAlign: "center" },
  studyTime: { color: COLORS.navy, fontSize: 16, fontFamily: FONTS.bold, marginTop: 10 },
  studyDone: {
    marginTop: 20,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS,
    paddingHorizontal: 40,
    paddingVertical: 16,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  studyDoneText: { color: "#FFFFFF", fontSize: 20, fontFamily: FONTS.bold },
});
