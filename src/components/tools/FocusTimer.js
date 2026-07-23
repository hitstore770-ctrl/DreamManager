import { useAudioPlayer } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";

import { useDreams } from "../../context/DreamContext";
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

// A public-domain looping ambience used for the optional lo-fi / white-noise
// background. Playback is best-effort — if the device is offline it simply
// stays silent (wrapped in try/catch below).
const WHITE_NOISE = {
  uri: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
};

const WORK_PRESETS = [15, 25, 50];
const BREAK_PRESETS = [5, 10, 15];
const SEGMENTS = 16;
const PING_EVERY = 15 * 60; // seconds — subtle vibration wake-up ping
const DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const DEFAULT_SETTINGS = {
  workMin: 25,
  breakMin: 5,
  dnd: false,
  strict: false,
  whiteNoise: false,
  ping: false,
};

function mmss(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function FocusTimer() {
  const { dreams } = useDreams();
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.focusSettings, DEFAULT_SETTINGS);
  const [log, setLog] = usePersistentState(STORAGE_KEYS.focusLog, []);
  const player = useAudioPlayer(WHITE_NOISE);

  const [phase, setPhase] = useState("work"); // 'work' | 'break'
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.workMin * 60);
  const [runSeconds, setRunSeconds] = useState(0);
  const [dreamId, setDreamId] = useState(null);
  const [failed, setFailed] = useState(false);
  const [manualMin, setManualMin] = useState("");
  const [touched, setTouched] = useState(false); // user has manually set remaining

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runningRef = useRef(running);
  runningRef.current = running;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const workSec = (Number(settings.workMin) || 25) * 60;
  const breakSec = (Number(settings.breakMin) || 5) * 60;
  const phaseDuration = phase === "work" ? workSec : breakSec;

  const linkedGoal = dreams.find((d) => d.id === dreamId);

  const setSetting = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const notify = (title, msg) => {
    if (!settingsRef.current.dnd) Alert.alert(title, msg);
  };

  // Keep the idle work-phase clock in sync when the user changes work length.
  useEffect(() => {
    if (!running && phase === "work" && !touched) setRemaining(workSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workSec]);

  // ---- Tick --------------------------------------------------------------
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
      setRunSeconds((s) => {
        const ns = s + 1;
        if (settingsRef.current.ping && ns % PING_EVERY === 0) Vibration.vibrate(500);
        return ns;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  // ---- Phase transition on reaching zero ---------------------------------
  useEffect(() => {
    if (!running || remaining > 0) return;
    if (phase === "work") {
      logSession(Number(settings.workMin) || 25, "pomodoro");
      Vibration.vibrate(600);
      notify("סיימת פוקוס! 🎉", "כל הכבוד — זמן הפסקה קצרה");
      setPhase("break");
      setRemaining(breakSec);
      setTouched(false);
    } else {
      Vibration.vibrate(400);
      notify("חזרה לעבודה 💪", "ההפסקה נגמרה");
      setPhase("work");
      setRemaining(workSec);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running]);

  // ---- White noise -------------------------------------------------------
  useEffect(() => {
    try {
      player.loop = true;
      if (settings.whiteNoise && running) player.play();
      else player.pause();
    } catch {
      // offline / unsupported — stay silent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.whiteNoise, running]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Strict mode: fail if the app is backgrounded while running --------
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (
        settingsRef.current.strict &&
        runningRef.current &&
        (state === "background" || state === "inactive")
      ) {
        setRunning(false);
        setFailed(true);
        setRemaining(phaseRef.current === "work" ? workSec : breakSec);
        setRunSeconds(0);
        setTouched(false);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workSec, breakSec]);

  // ---- Persist a completed session --------------------------------------
  const logSession = (minutes, source) => {
    if (!minutes || minutes <= 0) return;
    setLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: dayKey(new Date()),
        minutes,
        source,
        dreamId: dreamId || null,
        dreamTitle: linkedGoal?.title || null,
        ts: Date.now(),
      },
      ...prev,
    ]);
  };

  // ---- Controls ----------------------------------------------------------
  const toggleRun = () => {
    setFailed(false);
    setRunning((r) => !r);
  };

  const reset = () => {
    setRunning(false);
    setFailed(false);
    setPhase("work");
    setRemaining(workSec);
    setRunSeconds(0);
    setTouched(false);
  };

  const addManual = () => {
    const m = parseInt(manualMin, 10);
    if (!m || m <= 0) {
      Alert.alert("ערך לא תקין", "הזן מספר דקות לתיקון");
      return;
    }
    logSession(m, "manual");
    setManualMin("");
    Alert.alert("נוסף ✓", `${m} דקות פוקוס נוספו להיום`);
  };

  // ---- Derived stats -----------------------------------------------------
  const week = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const mins = log.filter((l) => l.date === key).reduce((s, l) => s + l.minutes, 0);
      days.push({ key, label: DAY_LABELS[d.getDay()], mins });
    }
    return days;
  }, [log]);

  const maxMins = Math.max(1, ...week.map((d) => d.mins));
  const totalHours = useMemo(
    () => log.reduce((s, l) => s + l.minutes, 0) / 60,
    [log]
  );

  const streak = useMemo(() => {
    const set = new Set(log.map((l) => l.date));
    let count = 0;
    const d = new Date();
    if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (set.has(dayKey(d))) {
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [log]);

  const progress = 1 - remaining / Math.max(1, phaseDuration);
  const filledSegments = Math.round(progress * SEGMENTS);

  const TOGGLES = [
    { key: "dnd", label: "🔕 נא לא להפריע", on: settings.dnd },
    { key: "strict", label: "🔒 מצב קפדני", on: settings.strict },
    { key: "whiteNoise", label: "🎧 רעש לבן / לו-פיי", on: settings.whiteNoise },
    { key: "ping", label: "📳 פינג כל 15 דק׳", on: settings.ping },
  ];

  return (
    <View>
      {/* Streak + total */}
      <View style={styles.statRow}>
        <View style={[styles.statCell, { backgroundColor: COLORS.mustard }]}>
          <Text style={styles.statValue}>🔥 {streak}</Text>
          <Text style={styles.statLabel}>ימי רצף</Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: COLORS.navy }]}>
          <Text style={[styles.statValue, { color: "#FFFFFF" }]}>
            {totalHours.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: "#FFFFFF" }]}>שעות פוקוס</Text>
        </View>
      </View>

      {/* Timer */}
      <View style={[styles.timerCard, phase === "break" && styles.timerCardBreak]}>
        <Text style={styles.phaseText}>
          {phase === "work" ? "🎯 זמן פוקוס" : "☕ הפסקה"}
        </Text>
        <Text style={styles.clock}>{mmss(remaining)}</Text>

        {/* Blocky brutalist progress bar */}
        <View style={styles.segments}>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                i < filledSegments && (phase === "work" ? styles.segWork : styles.segBreak),
              ]}
            />
          ))}
        </View>

        {failed && <Text style={styles.failText}>❌ המצב הקפדני עצר את הטיימר</Text>}

        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.bigBtn, running ? styles.bigStop : styles.bigStart]}
            onPress={toggleRun}
            activeOpacity={0.85}
          >
            <Text style={styles.bigBtnText}>{running ? "⏸  השהה" : "▶  התחל"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.85}>
            <Text style={styles.resetBtnText}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Durations */}
      <Text style={styles.label}>אורך פוקוס (דק׳)</Text>
      <View style={styles.chipRow}>
        {WORK_PRESETS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, settings.workMin === m && styles.chipActive]}
            onPress={() => {
              setSetting("workMin", m);
              if (!running && phase === "work") {
                setRemaining(m * 60);
                setTouched(false);
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, settings.workMin === m && styles.chipTextActive]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>אורך הפסקה (דק׳)</Text>
      <View style={styles.chipRow}>
        {BREAK_PRESETS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, settings.breakMin === m && styles.chipActive]}
            onPress={() => setSetting("breakMin", m)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, settings.breakMin === m && styles.chipTextActive]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toggles */}
      <Text style={styles.label}>מצבים</Text>
      {TOGGLES.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.toggleRow, t.on && styles.toggleRowOn]}
          onPress={() => setSetting(t.key, !t.on)}
          activeOpacity={0.85}
        >
          <View style={[styles.toggleKnob, t.on && styles.toggleKnobOn]}>
            <Text style={styles.toggleKnobText}>{t.on ? "✓" : ""}</Text>
          </View>
          <Text style={styles.toggleLabel}>{t.label}</Text>
        </TouchableOpacity>
      ))}

      {/* Link to goal */}
      <Text style={styles.label}>שייך לפרויקט</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalScroll}>
        <TouchableOpacity
          style={[styles.chip, dreamId === null && styles.chipActive]}
          onPress={() => setDreamId(null)}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, dreamId === null && styles.chipTextActive]}>ללא</Text>
        </TouchableOpacity>
        {dreams.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.chip, dreamId === g.id && styles.chipActive]}
            onPress={() => setDreamId(g.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, dreamId === g.id && styles.chipTextActive]}>
              {g.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Weekly chart */}
      <Text style={styles.label}>שבוע אחרון (דקות פוקוס)</Text>
      <View style={styles.chart}>
        {week.map((d) => (
          <View key={d.key} style={styles.chartCol}>
            <Text style={styles.chartValue}>{d.mins > 0 ? d.mins : ""}</Text>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  { height: `${Math.round((d.mins / maxMins) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{d.label}</Text>
          </View>
        ))}
      </View>

      {/* Manual correction */}
      <Text style={styles.label}>שכחת לעצור? הוסף דקות ידנית</Text>
      <View style={styles.manualRow}>
        <TextInput
          style={[styles.input, styles.manualInput]}
          value={manualMin}
          onChangeText={setManualMin}
          keyboardType="numeric"
          placeholder="דקות"
          placeholderTextColor={COLORS.textMuted}
          textAlign="center"
        />
        <TouchableOpacity style={styles.manualBtn} onPress={addManual} activeOpacity={0.85}>
          <Text style={styles.manualBtnText}>＋ הוסף</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCell: {
    flex: 1,
    padding: 12,
    borderRadius: RADIUS,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  statValue: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold },
  statLabel: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.medium, marginTop: 2 },
  timerCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  timerCardBreak: { backgroundColor: "#FFF7DE" },
  phaseText: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.bold },
  clock: {
    color: COLORS.textPrimary,
    fontSize: 60,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
    marginVertical: 6,
  },
  segments: {
    flexDirection: "row",
    width: "100%",
    height: 24,
    marginVertical: 12,
    ...BRUTAL_BORDER,
    backgroundColor: COLORS.white,
  },
  segment: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  segWork: { backgroundColor: COLORS.navy },
  segBreak: { backgroundColor: COLORS.mustard },
  failText: { color: COLORS.danger, fontSize: 14, fontFamily: FONTS.bold, marginBottom: 8 },
  controlRow: { flexDirection: "row", width: "100%", gap: 12, marginTop: 6 },
  bigBtn: {
    flex: 1,
    height: 62,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  bigStart: { backgroundColor: COLORS.success },
  bigStop: { backgroundColor: COLORS.danger },
  bigBtnText: { color: "#FFFFFF", fontSize: 20, fontFamily: FONTS.bold },
  resetBtn: {
    width: 62,
    height: 62,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  resetBtnText: { color: COLORS.textPrimary, fontSize: 26, fontFamily: FONTS.bold },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 8,
    marginTop: 6,
    textAlign: "right",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginStart: 8,
    marginBottom: 8,
    ...BRUTAL_BORDER,
  },
  chipActive: { backgroundColor: COLORS.navy },
  chipText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  chipTextActive: { color: "#FFFFFF" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 12,
    marginBottom: 8,
    ...BRUTAL_BORDER,
  },
  toggleRowOn: { backgroundColor: "#E8F5EC" },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 12,
    ...BRUTAL_BORDER,
  },
  toggleKnobOn: { backgroundColor: COLORS.success },
  toggleKnobText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  toggleLabel: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right" },
  goalScroll: { marginBottom: 10 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 130,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 10,
    marginBottom: 14,
    ...BRUTAL_BORDER,
  },
  chartCol: { flex: 1, alignItems: "center" },
  chartValue: { color: COLORS.textSecondary, fontSize: 10, fontFamily: FONTS.bold, marginBottom: 2 },
  chartBarTrack: {
    width: "60%",
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartBarFill: { width: "100%", backgroundColor: COLORS.navy },
  chartLabel: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold, marginTop: 4 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    ...BRUTAL_BORDER,
  },
  manualRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  manualInput: { flex: 1 },
  manualBtn: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  manualBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
});
