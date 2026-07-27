import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import Icon from "../../Icon";
import { gregorianToHebrew, hebrewWeekday } from "../../../utils/hebrewDate";
import { computeZmanim, fmtTime, JERUSALEM } from "../../../utils/zmanim";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { INK_SOFT, INK_MUTED, BLUE, GOLD, s } from "../kit";

// Boarding-school day tools.

// ---------------------------------------------------------------------------
// E. זמני היום ושגרה
// ---------------------------------------------------------------------------
// Daily boarding-school schedule used for the "next up" countdown.
const ROUTINE = [
  { at: "07:15", label: "שחרית", icon: "sunrise" },
  { at: "08:30", label: "ארוחת בוקר", icon: "coffee" },
  { at: "09:15", label: "סדר א׳", icon: "book-open" },
  { at: "12:30", label: "ארוחת צהריים", icon: "restaurant-outline" },
  { at: "13:30", label: "מנוחה", icon: "bed-outline" },
  { at: "15:00", label: "סדר ב׳", icon: "book" },
  { at: "18:00", label: "מנחה", icon: "sunset" },
  { at: "19:00", label: "ארוחת ערב", icon: "restaurant-outline" },
  { at: "20:00", label: "סדר ערב", icon: "book" },
  { at: "22:30", label: "כיבוי אורות", icon: "moon" },
];

function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function ZmanimRoutine() {
  // Tick every 30s so the countdown stays live while the sheet is open.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const z = useMemo(() => computeZmanim(now, JERUSALEM), [now]);
  const heb = useMemo(() => gregorianToHebrew(now), [now]);

  // Current local time in Jerusalem, in minutes, so the countdown is right
  // even when the device sits in another timezone.
  const nowMinutes = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: JERUSALEM.tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const [h, m] = parts.split(":").map(Number);
      return h * 60 + m;
    } catch {
      return now.getHours() * 60 + now.getMinutes();
    }
  }, [now]);

  const next = useMemo(() => {
    const upcoming = ROUTINE.find((r) => minutesOfDay(r.at) > nowMinutes);
    if (upcoming) {
      return { ...upcoming, inMinutes: minutesOfDay(upcoming.at) - nowMinutes, tomorrow: false };
    }
    const first = ROUTINE[0];
    return { ...first, inMinutes: 24 * 60 - nowMinutes + minutesOfDay(first.at), tomorrow: true };
  }, [nowMinutes]);

  const countdown =
    next.inMinutes >= 60
      ? `בעוד ${Math.floor(next.inMinutes / 60)} שע׳ ${next.inMinutes % 60} דק׳`
      : `בעוד ${next.inMinutes} דק׳`;

  return (
    <View style={{ gap: 12 }}>
      {/* Hebrew date hero */}
      <View style={s.hebCard}>
        <Text style={s.hebDate}>{heb.formatted}</Text>
        <Text style={s.hebSub}>
          {hebrewWeekday(now)} · {now.toLocaleDateString("he-IL")} · {JERUSALEM.name}
        </Text>
      </View>

      {/* Next up */}
      <View style={s.nextCard}>
        <View style={s.nextBadge}><Icon name={next.icon} size={20} color={BLUE} /></View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={s.nextLabel}>
            הבא בתור: {next.label}
            {next.tomorrow ? " (מחר)" : ""}
          </Text>
          <Text style={s.nextTime}>
            {next.at} · {countdown}
          </Text>
        </View>
      </View>

      {/* Key day times */}
      <View style={s.zGrid}>
        {[
          { label: "זריחה", value: z.sunrise, icon: "sunrise" },
          { label: "חצות", value: z.midday, icon: "sun" },
          { label: "שקיעה", value: z.sunset, icon: "sunset", gold: true },
          { label: "צאת הכוכבים", value: z.nightfall, icon: "moon" },
        ].map((r) => (
          <View key={r.label} style={[s.zTile, r.gold && { backgroundColor: GOLD + "16" }]}>
            <Icon name={r.icon} size={18} color={r.gold ? "#0E7490" : BLUE} />
            <Text style={[s.zTileTime, r.gold && { color: "#0E7490" }]}>{fmtTime(r.value)}</Text>
            <Text style={s.zTileLabel}>{r.label}</Text>
          </View>
        ))}
      </View>

      {/* Full routine */}
      <Text style={s.sectionLabel}>סדר היום</Text>
      {ROUTINE.map((r) => {
        const past = minutesOfDay(r.at) <= nowMinutes;
        const isNext = r.at === next.at && !next.tomorrow;
        return (
          <View key={r.at} style={[s.routineRow, isNext && { backgroundColor: BLUE + "10" }]}>
            <Text style={[s.routineTime, past && { color: INK_MUTED }, isNext && { color: BLUE }]}>{r.at}</Text>
            <Icon name={r.icon} size={16} color={isNext ? BLUE : past ? INK_MUTED : INK_SOFT} />
            <Text
              style={[
                s.routineLabel,
                past && { color: INK_MUTED, textDecorationLine: "line-through" },
                isNext && { color: BLUE, fontFamily: FONTS.bold },
              ]}
            >
              {r.label}
            </Text>
          </View>
        );
      })}
      <Text style={s.hint}>
        זמני היום מחושבים במכשיר לפי מיקום השמש בירושלים. סדר היום קבוע וניתן יהיה לערוך אותו בהמשך.
      </Text>
    </View>
  );
}
