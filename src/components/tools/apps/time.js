import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import {
  BLUE,
  BtnLabel,
  CARD,
  GOLD,
  GREEN,
  INK,
  INK_MUTED,
  INK_SOFT,
  RED,
  Segment,
  Stat,
  s,
  useCalcHaptic,
} from "../kit";
import CustomText from "../../../components/CustomText";

// Clocks and calendars: a timer, a zone converter and a date counter.

const PRESETS = [
  { key: "focus", label: "פוקוס", minutes: 25 },
  { key: "short", label: "הפסקה", minutes: 5 },
  { key: "long", label: "הפסקה ארוכה", minutes: 15 },
];

function mmss(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function PomodoroTimer() {
  const [preset, setPreset] = useState("focus");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);

  const total = PRESETS.find((p) => p.key === preset).minutes * 60;

  // Count down off wall-clock time rather than by decrementing once per tick:
  // setInterval drifts, and a backgrounded tab throttles it badly. Storing the
  // deadline means the display is always right, however irregular the ticks.
  const deadline = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    if (deadline.current === null) deadline.current = Date.now() + left * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        deadline.current = null;
        setRounds((n) => n + 1);
        hapticSuccess();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, left]);

  const start = () => {
    if (left === 0) return;
    hapticLight();
    deadline.current = Date.now() + left * 1000;
    setRunning(true);
  };

  const pause = () => {
    hapticLight();
    deadline.current = null;
    setRunning(false);
  };

  const reset = () => {
    hapticWarning();
    deadline.current = null;
    setRunning(false);
    setLeft(total);
  };

  const pickPreset = (key) => {
    const next = PRESETS.find((p) => p.key === key);
    deadline.current = null;
    setRunning(false);
    setPreset(key);
    setLeft(next.minutes * 60);
  };

  const pct = total ? ((total - left) / total) * 100 : 0;
  const done = left === 0;

  return (
    <View style={{ gap: 14 }}>
      <Segment
        options={PRESETS.map((p) => ({ key: p.key, label: p.label }))}
        value={preset}
        onChange={pickPreset}
      />

      <View style={[t.clockCard, done && { backgroundColor: GREEN + "12" }]}>
        <CustomText style={[t.clock, done && { color: GREEN }, running && { color: BLUE }]}>{mmss(left)}</CustomText>
        <CustomText style={t.clockSub}>
          {done ? "הסבב הושלם" : running ? "רץ" : "מוכן"}
          {rounds > 0 ? ` · ${rounds} סבבים היום` : ""}
        </CustomText>
        <View style={t.track}>
          <View
            style={[t.fill, { width: `${pct}%`, backgroundColor: done ? GREEN : BLUE }]}
          />
        </View>
      </View>

      <View style={s.row}>
        {running ? (
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: GOLD }]} onPress={pause} activeOpacity={0.85}>
            <BtnLabel icon="pause" text="השהה" style={s.actionText} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.actionBtn, done && { backgroundColor: INK_MUTED }]}
            onPress={start}
            activeOpacity={0.85}
            disabled={done}
          >
            <BtnLabel icon="play" text={left === total ? "התחל" : "המשך"} style={s.actionText} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={reset} activeOpacity={0.85}>
          <BtnLabel icon="rotate-ccw" text="איפוס" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <CustomText style={s.hint}>
        הספירה מבוססת על שעון המכשיר ולא על מונה פנימי, כך שהזמן נשאר מדויק גם אם המסך כבה או שעברת
        לאפליקציה אחרת באמצע הסבב.
      </CustomText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. מונה מילים ותווים
// ---------------------------------------------------------------------------

const ZONES = [
  { id: "Asia/Jerusalem", city: "ירושלים", icon: "home" },
  { id: "America/New_York", city: "ניו יורק", icon: "map-pin" },
  { id: "Europe/London", city: "לונדון", icon: "map-pin" },
  { id: "Europe/Berlin", city: "ברלין", icon: "map-pin" },
  { id: "Asia/Shanghai", city: "גואנגזו", icon: "package" },
  { id: "America/Los_Angeles", city: "לוס אנג׳לס", icon: "map-pin" },
];

function zoneParts(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
    const parts = fmt.formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return {
      ok: true,
      time: `${parts.hour}:${parts.minute}`,
      day: `${parts.weekday} ${parts.day}/${parts.month}`,
      abbr: parts.timeZoneName || "",
    };
  } catch {
    // No ICU data on this build — say so instead of printing a wrong time.
    return { ok: false };
  }
}

// Difference in whole minutes between a zone's wall clock and the device's.

function offsetMinutes(date, timeZone) {
  try {
    const asZone = new Date(date.toLocaleString("en-US", { timeZone }));
    const asLocal = new Date(date.toLocaleString("en-US"));
    return Math.round((asZone - asLocal) / 60000);
  } catch {
    return null;
  }
}

export function TimezoneConverter() {
  const [useNow, setUseNow] = useState(true);
  const [hh, setHh] = useState("");
  const [mm, setMm] = useState("");
  const [tick, setTick] = useState(0);

  // Only re-render on a clock tick while actually showing "now".
  useEffect(() => {
    if (!useNow) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [useNow]);

  const base = useMemo(() => {
    if (useNow) return new Date();
    const h = Math.min(23, Math.max(0, parseInt(hh, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(mm, 10) || 0));
    // The typed time is read as Israel local time, since that is where the
    // user is; everything else is derived from that instant.
    const now = new Date();
    const israelOffset = offsetMinutes(now, "Asia/Jerusalem") ?? 0;
    const utcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const deviceOffset = -now.getTimezoneOffset();
    return new Date(utcMs - (israelOffset - deviceOffset) * 60000 + now.getTimezoneOffset() * 60000);
  }, [useNow, hh, mm, tick]);

  const rows = useMemo(
    () => ZONES.map((z) => ({ ...z, ...zoneParts(base, z.id), offset: offsetMinutes(base, z.id) })),
    [base]
  );

  const israelOffset = rows[0]?.offset ?? 0;
  const supported = rows[0]?.ok;

  return (
    <View style={{ gap: 12 }}>
      <Segment
        options={[
          { key: "now", label: "עכשיו" },
          { key: "manual", label: "שעה ידנית" },
        ]}
        value={useNow ? "now" : "manual"}
        onChange={(v) => { hapticLight(); setUseNow(v === "now"); }}
      />

      {!useNow && (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <CustomText style={s.fieldLabel}>שעה (בישראל)</CustomText>
            <View style={s.fieldRow}>
              <TextInput
                testID="tz-hh"
                style={s.fieldInput}
                value={hh}
                onChangeText={setHh}
                placeholder="14"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                maxLength={2}
                textAlign="center"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <CustomText style={s.fieldLabel}>דקות</CustomText>
            <View style={s.fieldRow}>
              <TextInput
                testID="tz-mm"
                style={s.fieldInput}
                value={mm}
                onChangeText={setMm}
                placeholder="30"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                maxLength={2}
                textAlign="center"
              />
            </View>
          </View>
        </View>
      )}

      {!supported ? (
        <View style={[t.verdict, { backgroundColor: CARD }]}>
          <Icon name="alert-triangle" size={22} color={GOLD} />
          <CustomText style={t.verdictLabel}>
            הבילד הזה לא כולל נתוני אזורי זמן, ולכן אי אפשר להציג המרה אמינה.
          </CustomText>
        </View>
      ) : (
        rows.map((z) => {
          const diff = z.offset === null ? null : Math.round((z.offset - israelOffset) / 60);
          const home = z.id === "Asia/Jerusalem";
          return (
            <View key={z.id} style={[u.zoneRow, home && { backgroundColor: BLUE + "10" }]}>
              <View style={{ alignItems: "flex-start" }}>
                <CustomText testID={`tz-${z.id}`} style={[u.zoneTime, home && { color: BLUE }]}>{z.time}</CustomText>
                <CustomText style={u.zoneDay}>{z.day}</CustomText>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <CustomText style={u.zoneCity}>{z.city}</CustomText>
                <CustomText style={u.zoneMeta}>
                  {z.abbr}
                  {diff !== null && !home ? ` · ${diff > 0 ? "+" : ""}${diff} שעות מישראל` : ""}
                </CustomText>
              </View>
              <Icon name={z.icon} size={16} color={home ? BLUE : INK_MUTED} />
            </View>
          );
        })
      )}

      <CustomText style={s.hint}>
        ההמרה משתמשת באזורי זמן ולא בהיסטים קבועים, כך שהיא נכונה גם בשעון קיץ. הקיצור לצד כל עיר
        (IST/IDT, EST/EDT, GMT/BST) משתנה לפי התאריך.
      </CustomText>
    </View>
  );
}

const u = StyleSheet.create({
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 62,
  },
  zoneTime: { fontFamily: FONTS.bold, fontSize: 21, color: INK },
  zoneDay: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED },
  zoneCity: { fontFamily: FONTS.bold, fontSize: 14.5, color: INK, textAlign: "right" },
  zoneMeta: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "right", marginTop: 2 },
});

// ---------------------------------------------------------------------------
// F. וואטסאפ ללא שמירה
// ---------------------------------------------------------------------------

// wa.me wants digits only, in full international form with no plus sign. An
// Israeli number typed the local way (050-1234567) has to lose its leading
// zero and gain the country code, which is the step people get wrong.


const t = StyleSheet.create({
  clockCard: { backgroundColor: CARD, borderRadius: 24, paddingVertical: 26, paddingHorizontal: 18, alignItems: "center", gap: 8 },
  clock: { fontFamily: FONTS.bold, fontSize: 56, color: INK, letterSpacing: 1 },
  clockSub: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_MUTED },
  track: { alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: "#E3E8F0", overflow: "hidden", marginTop: 6 },
  fill: { height: "100%", borderRadius: 4 },
  area: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    minHeight: 120,
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    color: INK,
    lineHeight: 22,
  },
  verdict: { borderRadius: 24, paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 6 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 30, textAlign: "center" },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, textAlign: "center" },
});

// ---------------------------------------------------------------------------
// C. גיל בימים
// ---------------------------------------------------------------------------

const DAY = 86400000;

function parseDate(raw) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((raw || "").trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  // Reject 2025-02-31 and friends: Date rolls them into March instead of
  // failing, so the round trip has to be checked.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function AgeInDays() {
  const [birth, setBirth] = useState("");

  const r = useMemo(() => {
    const date = parseDate(birth);
    if (!date) return { ready: false, invalid: !!birth.trim() };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (start > today) return { ready: false, future: true };

    const days = Math.round((today - start) / DAY);
    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let daysPart = today.getDate() - start.getDate();
    if (daysPart < 0) {
      months -= 1;
      daysPart += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    const toBirthday = Math.round((next - today) / DAY);

    return {
      ready: true,
      days,
      years,
      months,
      daysPart,
      weeks: Math.floor(days / 7),
      hours: days * 24,
      toBirthday,
      born: start.toLocaleDateString("he-IL", { weekday: "long" }),
      nextRound: Math.ceil((days + 1) / 1000) * 1000,
    };
  }, [birth]);

  useCalcHaptic(r.days);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <CustomText style={s.fieldLabel}>תאריך לידה</CustomText>
        <View style={s.fieldRow}>
          <TextInput
            testID="age-date"
            style={s.fieldInput}
            value={birth}
            onChangeText={setBirth}
            placeholder="2005-03-14"
            placeholderTextColor={INK_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="center"
          />
        </View>
      </View>

      {r.invalid && <CustomText style={[s.hint, { color: RED }]}>תאריך לא תקין — הפורמט הוא YYYY-MM-DD.</CustomText>}
      {r.future && <CustomText style={[s.hint, { color: RED }]}>התאריך בעתיד.</CustomText>}

      {r.ready && (
        <>
          <View style={[t.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="age-days" style={[t.verdictValue, { color: BLUE }]}>{r.days}</CustomText>
            <CustomText style={t.verdictLabel}>ימים</CustomText>
          </View>

          <View style={s.statRow}>
            <Stat label="שנים" value={r.years} />
            <Stat label="חודשים" value={r.months} />
            <Stat label="ימים" value={r.daysPart} />
          </View>
          <View style={s.statRow}>
            <Stat label="שבועות" value={r.weeks} />
            <Stat label="שעות" value={r.hours} color={GOLD} />
          </View>

          <View style={[s.banner, { backgroundColor: CARD }]}>
            <CustomText style={[s.bannerText, { color: INK }]}>
              {r.toBirthday === 0 ? "יום הולדת היום" : `עוד ${r.toBirthday} ימים ליום ההולדת`}
            </CustomText>
            <CustomText style={[s.bannerSub, { color: INK_SOFT }]}>
              נולדת ביום {r.born} · היום ה-{r.nextRound} יגיע בעוד {r.nextRound - r.days} ימים.
            </CustomText>
          </View>
        </>
      )}

      <CustomText style={s.hint}>
        הספירה בימי לוח מלאים ולא בשעות, כך שהמעבר לשעון קיץ לא מזיז את התוצאה. תאריך שלא קיים —
        למשל 31 בפברואר — נדחה ולא מתגלגל לחודש הבא.
      </CustomText>
    </View>
  );
}
