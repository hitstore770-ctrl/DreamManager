import { useAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
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

const ALARM_SOUND = { uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" };
const DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function pad(n) {
  return String(n).padStart(2, "0");
}
function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
function clockMs(ms) {
  const cs = Math.floor((ms % 1000) / 10);
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}.${pad(cs)}`;
}
function zoneTime(now, tz) {
  try {
    return now.toLocaleTimeString("he-IL", { timeZone: tz, hour12: false });
  } catch {
    return now.toLocaleTimeString("he-IL", { hour12: false });
  }
}

const TABS = [
  { key: "clock", label: "שעון" },
  { key: "timer", label: "טיימר" },
  { key: "alarm", label: "התראה" },
  { key: "stopwatch", label: "סטופר" },
];

export default function ClockHub() {
  const [tab, setTab] = useState("clock");
  return (
    <View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "clock" && <ClockTab />}
      {tab === "timer" && (
        <View>
          <CountdownTimer name="טיימר 1" />
          <CountdownTimer name="טיימר 2" />
        </View>
      )}
      {tab === "alarm" && <AlarmTab />}
      {tab === "stopwatch" && <StopwatchTab />}
    </View>
  );
}

// ---- Clock ---------------------------------------------------------------
function ClockTab() {
  const [now, setNow] = useState(new Date());
  const [full, setFull] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const bg = dark ? "#000000" : COLORS.white;
  const fg = dark ? "#FFFFFF" : COLORS.textPrimary;

  return (
    <View>
      <View style={[styles.bigClock, { backgroundColor: bg }, full && styles.bigClockFull]}>
        <Text style={[styles.bigClockText, { color: fg }, full && styles.bigClockTextFull]}>
          {now.toLocaleTimeString("he-IL", { hour12: false })}
        </Text>
        <Text style={[styles.bigClockDate, { color: dark ? "#BBB" : COLORS.textSecondary }]}>
          {now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
      </View>

      <View style={styles.clockCtrlRow}>
        <TouchableOpacity style={[styles.clockCtrl, full && styles.clockCtrlOn]} onPress={() => setFull((v) => !v)} activeOpacity={0.85}>
          <Text style={styles.clockCtrlText}>{full ? "צא ממסך מלא" : "🔳 מסך מלא"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.clockCtrl, dark && styles.clockCtrlOn]} onPress={() => setDark((v) => !v)} activeOpacity={0.85}>
          <Text style={styles.clockCtrlText}>{dark ? "☀️ בהיר" : "🌙 כהה"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.worldTitle}>שעונים בעולם</Text>
      {[
        { label: "מקומי (ישראל)", tz: "Asia/Jerusalem" },
        { label: "ניו יורק", tz: "America/New_York" },
        { label: "לונדון", tz: "Europe/London" },
      ].map((z) => (
        <View key={z.tz} style={styles.worldRow}>
          <Text style={styles.worldTime}>{zoneTime(now, z.tz)}</Text>
          <Text style={styles.worldLabel}>{z.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- Countdown timer (used x2) ------------------------------------------
function CountdownTimer({ name }) {
  const [mins, setMins] = useState("10");
  const [total, setTotal] = useState(600);
  const [endAt, setEndAt] = useState(null);
  const [running, setRunning] = useState(false);
  const [loop, setLoop] = useState(false);
  const [now, setNow] = useState(Date.now());
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);

  const remainingMs = endAt ? endAt - now : total * 1000;
  const overtime = remainingMs < 0;

  // Handle reaching zero: fire + optionally loop.
  const firedRef = useRef(false);
  useEffect(() => {
    if (running && endAt && remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      Vibration.vibrate([0, 400, 200, 400]);
      if (loop) {
        setEndAt(Date.now() + total * 1000);
        setTimeout(() => {
          firedRef.current = false;
        }, 1000);
      }
    }
    if (remainingMs > 0) firedRef.current = false;
  }, [remainingMs, running, endAt, loop, total]);

  // Shrink animation
  useEffect(() => {
    const frac = endAt ? Math.max(0, Math.min(1, remainingMs / (total * 1000))) : 1;
    Animated.timing(anim, { toValue: frac, duration: 200, useNativeDriver: false }).start();
  }, [remainingMs, endAt, total, anim]);

  const applyPreset = (m) => {
    setMins(String(m));
    setTotal(m * 60);
    setEndAt(null);
    setRunning(false);
  };

  const start = () => {
    const secs = (parseInt(mins, 10) || 0) * 60;
    if (secs <= 0) return;
    setTotal(secs);
    setEndAt(Date.now() + secs * 1000);
    setNow(Date.now());
    firedRef.current = false;
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const resetTimer = () => {
    setRunning(false);
    setEndAt(null);
  };

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const displayMs = Math.abs(remainingMs);

  return (
    <View style={styles.timerCard}>
      <View style={styles.timerHead}>
        <View style={styles.loopWrap}>
          <TouchableOpacity
            style={[styles.loopBtn, loop && styles.loopOn]}
            onPress={() => setLoop((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.loopText, loop && { color: "#FFF" }]}>🔁</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timerName}>{name}</Text>
      </View>

      <Text style={[styles.timerClock, overtime && styles.timerOvertime]}>
        {overtime ? "+" : ""}
        {clock(displayMs)}
      </Text>
      {overtime && <Text style={styles.overtimeLabel}>זמן נוסף</Text>}

      <View style={styles.shrinkTrack}>
        <Animated.View style={[styles.shrinkFill, { width }, overtime && { backgroundColor: COLORS.danger }]} />
      </View>

      <View style={styles.presetRow}>
        {[5, 15, 25].map((m) => (
          <TouchableOpacity key={m} style={styles.presetBtn} onPress={() => applyPreset(m)} activeOpacity={0.85}>
            <Text style={styles.presetBtnText}>{m}׳</Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={styles.minInput}
          value={mins}
          onChangeText={setMins}
          keyboardType="numeric"
          textAlign="center"
        />
      </View>

      <View style={styles.timerBtnRow}>
        <TouchableOpacity
          style={[styles.timerBtn, running ? styles.timerPause : styles.timerStart]}
          onPress={running ? pause : start}
          activeOpacity={0.85}
        >
          <Text style={styles.timerBtnText}>{running ? "⏸ השהה" : "▶ התחל"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timerReset} onPress={resetTimer} activeOpacity={0.85}>
          <Text style={styles.timerResetText}>↺</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- Alarm ---------------------------------------------------------------
function AlarmTab() {
  const [alarms, setAlarms] = usePersistentState(STORAGE_KEYS.alarms, []);
  const [time, setTime] = useState("07:00");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [mathDismiss, setMathDismiss] = useState(false);

  const [ringing, setRinging] = useState(null); // alarm object
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [answer, setAnswer] = useState("");
  const mathRef = useRef({ a: 0, b: 0 });
  const lastMinuteRef = useRef("");
  const player = useAudioPlayer(ALARM_SOUND);

  // Foreground alarm check each second.
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const key = `${d.toDateString()} ${hhmm}`;
      if (key === lastMinuteRef.current) return;
      if (ringing) return;
      const hit = alarms.find(
        (a) => a.enabled && a.time === hhmm && a.days.includes(d.getDay())
      );
      if (hit) {
        lastMinuteRef.current = key;
        trigger(hit);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarms, ringing]);

  const trigger = (alarm) => {
    setRinging(alarm);
    setSnoozeCount(0);
    mathRef.current = { a: 3 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 8) };
    setAnswer("");
    Vibration.vibrate([0, 600, 300, 600, 300, 600], true);
    try {
      player.loop = true;
      player.play();
    } catch {
      // offline — vibration still fires
    }
  };

  const stopRinging = () => {
    Vibration.cancel();
    try {
      player.pause();
    } catch {
      // ignore
    }
    setRinging(null);
  };

  const dismiss = () => {
    if (ringing?.mathDismiss) {
      const correct = mathRef.current.a + mathRef.current.b;
      if (parseInt(answer, 10) !== correct) {
        Alert.alert("תשובה שגויה", "פתור את התרגיל כדי לכבות");
        return;
      }
    }
    stopRinging();
  };

  const snooze = () => {
    if (snoozeCount >= 3) {
      Alert.alert("נגמרו הנודניקים", "חובה לקום! (הגעת ל-3 פעמים)");
      return;
    }
    setSnoozeCount((c) => c + 1);
    stopRinging();
    // re-arm 1 minute later for the same alarm
    const target = ringing;
    setTimeout(() => {
      lastMinuteRef.current = "";
      if (target) trigger(target);
    }, 60000);
  };

  const toggleDay = (d) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const addAlarm = () => {
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      Alert.alert("שעה לא תקינה", "פורמט: 07:30");
      return;
    }
    setAlarms((prev) => [
      { id: uid(), time, label: label.trim() || "התראה", days: [...days], mathDismiss, enabled: true },
      ...prev,
    ]);
    setLabel("");
  };

  const toggleAlarm = (id) =>
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  const removeAlarm = (id) => setAlarms((prev) => prev.filter((a) => a.id !== id));

  if (ringing) {
    return (
      <View style={styles.ringCard}>
        <Text style={styles.ringEmoji}>⏰</Text>
        <Text style={styles.ringLabel}>{ringing.label}</Text>
        <Text style={styles.ringTime}>{ringing.time}</Text>
        {ringing.mathDismiss && (
          <View style={styles.mathBox}>
            <Text style={styles.mathQ}>
              כמה זה {mathRef.current.a} + {mathRef.current.b}?
            </Text>
            <TextInput
              style={styles.mathInput}
              value={answer}
              onChangeText={setAnswer}
              keyboardType="numeric"
              textAlign="center"
              placeholder="תשובה"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        )}
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} activeOpacity={0.85}>
          <Text style={styles.dismissText}>🔕 כבה</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.snoozeBtn} onPress={snooze} activeOpacity={0.85}>
          <Text style={styles.snoozeText}>😴 נודניק ({3 - snoozeCount} נותרו)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.alarmForm}>
        <TextInput style={styles.alarmTime} value={time} onChangeText={setTime} textAlign="center" placeholder="07:00" placeholderTextColor={COLORS.textMuted} />
        <TextInput
          style={styles.alarmLabel}
          value={label}
          onChangeText={setLabel}
          placeholder="תווית (למשל: להתעורר)"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
      </View>
      <View style={styles.daysRow}>
        {DAYS.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayChip, days.includes(i) && styles.dayChipOn]}
            onPress={() => toggleDay(i)}
            activeOpacity={0.85}
          >
            <Text style={[styles.dayText, days.includes(i) && styles.dayTextOn]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.mathToggle} onPress={() => setMathDismiss((v) => !v)} activeOpacity={0.85}>
        <View style={[styles.mathCheck, mathDismiss && styles.mathCheckOn]}>
          <Text style={styles.checkMark}>{mathDismiss ? "✓" : ""}</Text>
        </View>
        <Text style={styles.mathToggleText}>כיבוי בעזרת תרגיל חשבון</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addAlarmBtn} onPress={addAlarm} activeOpacity={0.85}>
        <Text style={styles.addAlarmText}>＋ הוסף התראה</Text>
      </TouchableOpacity>

      {alarms.length === 0 ? (
        <Text style={styles.empty}>אין התראות</Text>
      ) : (
        alarms.map((a) => (
          <View key={a.id} style={styles.alarmRow}>
            <TouchableOpacity style={styles.alarmDelete} onPress={() => removeAlarm(a.id)}>
              <Text style={styles.alarmDeleteText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.alarmSwitch, a.enabled && styles.alarmSwitchOn]}
              onPress={() => toggleAlarm(a.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.alarmSwitchText}>{a.enabled ? "פעיל" : "כבוי"}</Text>
            </TouchableOpacity>
            <View style={styles.alarmInfo}>
              <Text style={styles.alarmRowTime}>{a.time}</Text>
              <Text style={styles.alarmRowLabel}>
                {a.label}
                {a.mathDismiss ? "  🧮" : ""}
              </Text>
              <Text style={styles.alarmRowDays}>{a.days.map((d) => DAYS[d]).join(" ")}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ---- Stopwatch -----------------------------------------------------------
function StopwatchTab() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(0);
  const startRef = useRef(0);
  const [laps, setLaps] = useState([]);

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30);
    return () => clearInterval(t);
  }, [running]);

  const current = running ? Date.now() - startRef.current : elapsed;

  const startPause = () => {
    if (running) {
      setElapsed(Date.now() - startRef.current);
      setRunning(false);
    } else {
      startRef.current = Date.now() - elapsed;
      setNow(Date.now());
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  };
  const lap = () => {
    const prevTotal = laps.length ? laps[0].total : 0;
    const split = current - prevTotal;
    Vibration.vibrate(40);
    setLaps((prev) => [{ id: uid(), total: current, split, n: prev.length + 1 }, ...prev]);
  };

  const avg = laps.length ? laps.reduce((s, l) => s + l.split, 0) / laps.length : 0;
  const fastest = laps.length ? Math.min(...laps.map((l) => l.split)) : 0;
  const slowest = laps.length ? Math.max(...laps.map((l) => l.split)) : 0;

  const exportLaps = async () => {
    if (laps.length === 0) return;
    const text =
      `סטופר — זמן כולל ${clockMs(current)}\n` +
      [...laps].reverse().map((l) => `הקפה ${l.n}: ${clockMs(l.split)} (מצטבר ${clockMs(l.total)})`).join("\n") +
      `\nממוצע הקפה: ${clockMs(avg)}`;
    try {
      await Share.share({ message: text });
    } catch {
      Alert.alert("ייצוא", text);
    }
  };

  return (
    <View>
      <View style={styles.swCard}>
        <Text style={styles.swClock}>{clockMs(current)}</Text>
        {laps.length > 0 && (
          <Text style={styles.swAvg}>ממוצע הקפה: {clockMs(avg)}</Text>
        )}
      </View>
      <View style={styles.swBtnRow}>
        <TouchableOpacity
          style={[styles.swBtn, running ? styles.swPause : styles.swStart]}
          onPress={startPause}
          activeOpacity={0.85}
        >
          <Text style={styles.swBtnText}>{running ? "⏸ השהה" : "▶ הפעל"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swBtn, styles.swLap]}
          onPress={running ? lap : reset}
          activeOpacity={0.85}
        >
          <Text style={[styles.swBtnText, { color: COLORS.textPrimary }]}>
            {running ? "⚑ הקפה" : "↺ איפוס"}
          </Text>
        </TouchableOpacity>
      </View>

      {laps.length > 0 && (
        <TouchableOpacity style={styles.exportBtn} onPress={exportLaps} activeOpacity={0.85}>
          <Text style={styles.exportText}>↗ ייצוא הקפות לטקסט</Text>
        </TouchableOpacity>
      )}

      {laps.map((l) => {
        const rel = l.split === fastest ? "fast" : l.split === slowest ? "slow" : "mid";
        return (
          <View key={l.id} style={styles.lapRow}>
            <Text
              style={[
                styles.lapIndicator,
                rel === "fast" && { color: COLORS.success },
                rel === "slow" && { color: COLORS.danger },
              ]}
            >
              {rel === "fast" ? "▲ הכי מהיר" : rel === "slow" ? "▼ הכי איטי" : "—"}
            </Text>
            <Text style={styles.lapSplit}>{clockMs(l.split)}</Text>
            <Text style={styles.lapNum}>הקפה {l.n}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: "row", gap: 6, marginBottom: 16 },
  tab: { flex: 1, height: 44, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  tabActive: { backgroundColor: COLORS.navy },
  tabText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  tabTextActive: { color: "#FFFFFF" },
  // Clock
  bigClock: { borderRadius: RADIUS, paddingVertical: 30, alignItems: "center", marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  bigClockFull: { paddingVertical: 70 },
  bigClockText: { fontSize: 52, fontFamily: FONTS.bold, letterSpacing: 2 },
  bigClockTextFull: { fontSize: 68 },
  bigClockDate: { fontSize: 15, fontFamily: FONTS.medium, marginTop: 8 },
  clockCtrlRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  clockCtrl: { flex: 1, height: 46, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  clockCtrlOn: { backgroundColor: COLORS.mustard },
  clockCtrlText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  worldTitle: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
  worldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 10, ...BRUTAL_BORDER },
  worldTime: { color: COLORS.navy, fontSize: 20, fontFamily: FONTS.bold },
  worldLabel: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold },
  // Timer
  timerCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 16, marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  timerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timerName: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  loopWrap: {},
  loopBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  loopOn: { backgroundColor: COLORS.navy },
  loopText: { fontSize: 16, color: COLORS.textPrimary },
  timerClock: { color: COLORS.textPrimary, fontSize: 44, fontFamily: FONTS.bold, textAlign: "center", marginTop: 8 },
  timerOvertime: { color: COLORS.danger },
  overtimeLabel: { color: COLORS.danger, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  shrinkTrack: { height: 16, backgroundColor: COLORS.background, borderRadius: RADIUS, overflow: "hidden", marginVertical: 12, ...BRUTAL_BORDER },
  shrinkFill: { height: "100%", backgroundColor: COLORS.navy },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  presetBtn: { flex: 1, height: 42, borderRadius: RADIUS, backgroundColor: COLORS.mustard, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  presetBtnText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  minInput: { width: 64, height: 42, backgroundColor: COLORS.background, borderRadius: RADIUS, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  timerBtnRow: { flexDirection: "row", gap: 10 },
  timerBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  timerStart: { backgroundColor: COLORS.success },
  timerPause: { backgroundColor: COLORS.danger },
  timerBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  timerReset: { width: 50, height: 50, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  timerResetText: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold },
  // Alarm
  alarmForm: { flexDirection: "row", gap: 10, marginBottom: 12 },
  alarmTime: { width: 90, backgroundColor: COLORS.white, borderRadius: RADIUS, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  alarmLabel: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS, paddingHorizontal: 14, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.regular, ...BRUTAL_BORDER },
  daysRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  dayChip: { width: 38, height: 38, borderRadius: 8, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  dayChipOn: { backgroundColor: COLORS.navy },
  dayText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  dayTextOn: { color: "#FFFFFF" },
  mathToggle: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 },
  mathCheck: { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginEnd: 10, ...BRUTAL_BORDER },
  mathCheckOn: { backgroundColor: COLORS.navy },
  mathToggleText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  checkMark: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  addAlarmBtn: { height: 50, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", marginBottom: 16, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  addAlarmText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 14 },
  alarmRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 10, ...BRUTAL_BORDER },
  alarmDelete: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  alarmDeleteText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  alarmSwitch: { paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginHorizontal: 10, ...BRUTAL_BORDER },
  alarmSwitchOn: { backgroundColor: COLORS.success },
  alarmSwitchText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold },
  alarmInfo: { flex: 1, alignItems: "flex-end" },
  alarmRowTime: { color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold },
  alarmRowLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.medium },
  alarmRowDays: { color: COLORS.navy, fontSize: 12, fontFamily: FONTS.bold, marginTop: 2 },
  // Ringing
  ringCard: { backgroundColor: COLORS.mustard, borderRadius: RADIUS, padding: 24, alignItems: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  ringEmoji: { fontSize: 50 },
  ringLabel: { color: COLORS.textPrimary, fontSize: 24, fontFamily: FONTS.bold, marginTop: 8 },
  ringTime: { color: COLORS.textPrimary, fontSize: 40, fontFamily: FONTS.bold, marginVertical: 6 },
  mathBox: { width: "100%", alignItems: "center", marginVertical: 10 },
  mathQ: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, marginBottom: 8 },
  mathInput: { width: 120, backgroundColor: COLORS.white, borderRadius: RADIUS, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  dismissBtn: { width: "100%", height: 56, borderRadius: RADIUS, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", marginTop: 10, ...BRUTAL_BORDER },
  dismissText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  snoozeBtn: { width: "100%", height: 50, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginTop: 10, ...BRUTAL_BORDER },
  snoozeText: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold },
  // Stopwatch
  swCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 24, alignItems: "center", marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  swClock: { color: COLORS.textPrimary, fontSize: 46, fontFamily: FONTS.bold, letterSpacing: 1 },
  swAvg: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold, marginTop: 6 },
  swBtnRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  swBtn: { flex: 1, height: 56, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  swStart: { backgroundColor: COLORS.success },
  swPause: { backgroundColor: COLORS.danger },
  swLap: { backgroundColor: COLORS.mustard },
  swBtnText: { color: "#FFFFFF", fontSize: 17, fontFamily: FONTS.bold },
  exportBtn: { height: 44, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", marginBottom: 12, ...BRUTAL_BORDER },
  exportText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  lapRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 8, ...BRUTAL_BORDER },
  lapIndicator: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.textMuted, width: 90 },
  lapSplit: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold },
  lapNum: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold },
});
