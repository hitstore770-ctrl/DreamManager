import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useDreams } from "../../context/DreamContext";
import { formatShekel } from "../../utils/format";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { BRUTAL_BORDER, BRUTAL_SHADOW, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../../utils/theme";

function formatClock(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function ShiftTracker() {
  const { dreams, updateDreamProgress } = useDreams();
  const [shifts, setShifts] = usePersistentState(STORAGE_KEYS.shifts, []);

  const [rate, setRate] = useState("40");
  const [title, setTitle] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [dreamId, setDreamId] = useState(null);

  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef(null);

  // Tick every second while the timer runs; always clean up on unmount.
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const elapsed = running && startTime ? now - startTime : 0;
  const hourlyRate = Number(rate) || 0;
  const liveWage = (elapsed / 3600000) * hourlyRate;

  const moneyGoals = dreams.filter((d) => d.type === "money");
  const linkedGoal = dreams.find((d) => d.id === dreamId);

  const startShift = () => {
    setStartTime(Date.now());
    setNow(Date.now());
    setRunning(true);
  };

  const stopShift = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const duration = Date.now() - (startTime ?? Date.now());
    const wage = (duration / 3600000) * hourlyRate;
    const shift = {
      id: Date.now().toString(),
      title: title.trim() || "משמרת",
      durationMs: duration,
      rate: hourlyRate,
      wage: Math.round(wage * 100) / 100,
      pickup: pickup.trim(),
      dropoff: dropoff.trim(),
      dreamId: dreamId || null,
      dreamTitle: linkedGoal?.title || null,
      date: new Date().toISOString(),
      appliedToGoal: false,
    };
    setShifts((prev) => [shift, ...prev]);
    setStartTime(null);
    setTitle("");
    setPickup("");
    setDropoff("");
  };

  const removeShift = (id) => setShifts((prev) => prev.filter((s) => s.id !== id));

  const applyToGoal = (shift) => {
    if (!shift.dreamId || shift.appliedToGoal || shift.wage <= 0) return;
    updateDreamProgress(shift.dreamId, Math.round(shift.wage));
    setShifts((prev) =>
      prev.map((s) => (s.id === shift.id ? { ...s, appliedToGoal: true } : s))
    );
    alert(`נוספו ${formatShekel(shift.wage)} להתקדמות הפרויקט`);
  };

  return (
    <View>
      {/* Massive live timer button */}
      <View style={styles.timerCard}>
        <Text style={styles.clock}>{formatClock(elapsed)}</Text>
        <Text style={styles.liveWage}>{formatShekel(liveWage)}</Text>
        <TouchableOpacity
          style={[styles.bigButton, running ? styles.bigButtonStop : styles.bigButtonStart]}
          onPress={running ? stopShift : startShift}
          activeOpacity={0.85}
        >
          <Text style={styles.bigButtonText}>
            {running ? "⏹  עצור משמרת" : "▶  התחל משמרת"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Setup fields */}
      <Text style={styles.label}>שכר לשעה (₪)</Text>
      <TextInput
        style={styles.input}
        value={rate}
        onChangeText={setRate}
        keyboardType="numeric"
        textAlign="right"
        placeholder="40"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.label}>כותרת / תפקיד</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="לדוגמה: משלוחים בבית״ר"
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />

      <Text style={styles.label}>מסלול משלוח</Text>
      <View style={styles.routeRow}>
        <View style={styles.routeField}>
          <TextInput
            style={styles.input}
            value={pickup}
            onChangeText={setPickup}
            placeholder="איסוף"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
        </View>
        <Text style={styles.routeArrow}>←</Text>
        <View style={styles.routeField}>
          <TextInput
            style={styles.input}
            value={dropoff}
            onChangeText={setDropoff}
            placeholder="מסירה"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
        </View>
      </View>

      {/* Link to an active goal */}
      <Text style={styles.label}>שייך לפרויקט</Text>
      {moneyGoals.length === 0 ? (
        <Text style={styles.hint}>אין פרויקטים כספיים פעילים לשיוך</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalScroll}>
          <TouchableOpacity
            style={[styles.goalChip, dreamId === null && styles.goalChipActive]}
            onPress={() => setDreamId(null)}
            activeOpacity={0.85}
          >
            <Text style={[styles.goalChipText, dreamId === null && styles.goalChipTextActive]}>
              ללא
            </Text>
          </TouchableOpacity>
          {moneyGoals.map((g) => {
            const selected = g.id === dreamId;
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.goalChip, selected && styles.goalChipActive]}
                onPress={() => setDreamId(g.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.goalChipText, selected && styles.goalChipTextActive]}>
                  {g.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Saved shifts */}
      {shifts.length > 0 && <Text style={styles.sectionTitle}>משמרות אחרונות</Text>}
      {shifts.map((s) => (
        <View key={s.id} style={styles.shiftRow}>
          <View style={styles.shiftHeader}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removeShift(s.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.shiftTitle}>{s.title}</Text>
            <Text style={styles.shiftWage}>{formatShekel(s.wage)}</Text>
          </View>
          <Text style={styles.shiftMeta}>
            ⏱ {formatClock(s.durationMs)} · {formatShekel(s.rate)}/שעה
          </Text>
          {(s.pickup || s.dropoff) && (
            <Text style={styles.shiftMeta}>
              🚚 {s.pickup || "—"} ← {s.dropoff || "—"}
            </Text>
          )}
          {s.dreamTitle && (
            <View style={styles.shiftGoalRow}>
              <Text style={styles.shiftGoal}>🎯 {s.dreamTitle}</Text>
              {s.wage > 0 && (
                <TouchableOpacity
                  style={[styles.applyButton, s.appliedToGoal && styles.applyButtonDone]}
                  onPress={() => applyToGoal(s)}
                  disabled={s.appliedToGoal}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.applyButtonText,
                      s.appliedToGoal && { color: "#FFFFFF" },
                    ]}
                  >
                    {s.appliedToGoal ? "נוסף ✓" : "➕ לפרויקט"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  timerCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  clock: {
    color: COLORS.textPrimary,
    fontSize: 46,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
  },
  liveWage: {
    color: COLORS.success,
    fontSize: 22,
    fontFamily: FONTS.bold,
    marginTop: 2,
    marginBottom: 16,
  },
  bigButton: {
    width: "100%",
    height: 68,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  bigButtonStart: {
    backgroundColor: COLORS.success,
  },
  bigButtonStop: {
    backgroundColor: COLORS.danger,
  },
  bigButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginBottom: 8,
    textAlign: "right",
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 14,
    ...BRUTAL_BORDER,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeField: {
    flex: 1,
  },
  routeArrow: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginBottom: 14,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginBottom: 14,
  },
  goalScroll: {
    marginBottom: 8,
  },
  goalChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginStart: 8,
    ...BRUTAL_BORDER,
  },
  goalChipActive: {
    backgroundColor: COLORS.navy,
  },
  goalChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  goalChipTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 14,
    marginBottom: 12,
  },
  shiftRow: {
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 10,
    ...BRUTAL_BORDER,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  shiftTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginHorizontal: 10,
  },
  shiftWage: {
    color: COLORS.success,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  shiftMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 6,
  },
  shiftGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  shiftGoal: {
    color: COLORS.navy,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  applyButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: COLORS.mustard,
    ...BRUTAL_BORDER,
  },
  applyButtonDone: {
    backgroundColor: COLORS.success,
  },
  applyButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.bold,
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
