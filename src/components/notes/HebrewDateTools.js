import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useSettings } from "../../context/SettingsContext";
import {
  gregorianToHebrew,
  hebrewMonthName,
  hebrewMonthsInYear,
  hebrewToGregorian,
  hebrewWeekday,
  numberToHebrew,
} from "../../utils/hebrewDate";
import { FONTS, RADIUS_SM } from "../../utils/theme";

// The Hebrew Calendar Pro panel: live Hebrew date, a two-way date converter, a
// "link this note to a Hebrew date" action, plus scaffolded Zmanim and
// Parashat Hashavua cards (both need location/weekly data wired later).
export default function HebrewDateTools({ onLink, onClose }) {
  const { theme, fontScale } = useSettings();
  const today = gregorianToHebrew(new Date());

  // Gregorian → Hebrew converter (defaults to today)
  const now = new Date();
  const [g, setG] = useState({
    d: String(now.getDate()),
    m: String(now.getMonth() + 1),
    y: String(now.getFullYear()),
  });
  const gDate = new Date(Number(g.y), Number(g.m) - 1, Number(g.d));
  const gValid = !Number.isNaN(gDate.getTime()) && Number(g.d) >= 1 && Number(g.m) >= 1 && Number(g.m) <= 12;
  const gToHeb = gValid ? gregorianToHebrew(gDate) : null;

  // Hebrew → Gregorian converter
  const [h, setH] = useState({ d: String(today.day), m: today.month, y: String(today.year) });
  const hYear = Number(h.y);
  const monthsAvail = hYear ? hebrewMonthsInYear(hYear) : 12;
  const hValid = Number(h.d) >= 1 && Number(h.d) <= 30 && h.m >= 1 && h.m <= monthsAvail && hYear > 0;
  const hToGreg = hValid ? hebrewToGregorian(hYear, h.m, Number(h.d)) : null;

  const s = makeStyles(theme, fontScale);

  const monthOptions = [];
  for (let i = 1; i <= monthsAvail; i += 1) monthOptions.push(i);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <Text style={s.title}>📆 לוח עברי</Text>
        <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
      </View>

      {/* Today */}
      <View style={[s.card, { backgroundColor: theme.accent }]}>
        <Text style={s.todayLabel}>התאריך העברי היום</Text>
        <Text style={s.todayBig}>{today.formatted}</Text>
        <Text style={s.todaySub}>{hebrewWeekday(new Date())} · {gDate.toLocaleDateString("he-IL")}</Text>
      </View>

      {/* Gregorian → Hebrew */}
      <Text style={s.section}>המרה: לועזי ← עברי</Text>
      <View style={s.card2}>
        <View style={s.inputRow}>
          <Field label="יום" value={g.d} onChange={(v) => setG((p) => ({ ...p, d: v }))} theme={theme} />
          <Field label="חודש" value={g.m} onChange={(v) => setG((p) => ({ ...p, m: v }))} theme={theme} />
          <Field label="שנה" value={g.y} onChange={(v) => setG((p) => ({ ...p, y: v }))} theme={theme} wide />
        </View>
        <Text style={s.result}>{gToHeb ? gToHeb.formatted : "תאריך לא תקין"}</Text>
        {gToHeb && (
          <TouchableOpacity style={[s.linkBtn, { backgroundColor: theme.accent }]} onPress={() => onLink({ iso: gDate.toISOString(), formatted: gToHeb.formatted })}>
            <Text style={s.linkText}>🔗 קשר הערה לתאריך זה</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hebrew → Gregorian */}
      <Text style={s.section}>המרה: עברי ← לועזי</Text>
      <View style={s.card2}>
        <View style={s.inputRow}>
          <Field label="יום" value={h.d} onChange={(v) => setH((p) => ({ ...p, d: v }))} theme={theme} />
          <Field label="שנה" value={h.y} onChange={(v) => setH((p) => ({ ...p, y: v }))} theme={theme} wide />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {monthOptions.map((mo) => (
            <TouchableOpacity
              key={mo}
              style={[s.monthChip, h.m === mo && { backgroundColor: theme.accent }]}
              onPress={() => setH((p) => ({ ...p, m: mo }))}
            >
              <Text style={[s.monthChipText, { color: h.m === mo ? "#FFF" : theme.textSecondary }]}>
                {hYear ? hebrewMonthName(mo, hYear) : mo}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={s.result}>
          {hToGreg ? `${numberToHebrew(Number(h.d))} ${hebrewMonthName(h.m, hYear)} → ${hToGreg.toLocaleDateString("he-IL")}` : "תאריך לא תקין"}
        </Text>
      </View>

      {/* Scaffolds */}
      <Text style={s.section}>זמני היום (בקרוב)</Text>
      <View style={s.card2}>
        {["🌅 זריחה", "🕛 חצות היום", "🌇 שקיעה", "✡️ צאת הכוכבים"].map((z) => (
          <View key={z} style={s.zmanRow}>
            <Text style={s.zmanValue}>--:--</Text>
            <Text style={s.zmanName}>{z}</Text>
          </View>
        ))}
        <Text style={s.hint}>יחושב לפי המיקום שלך בגרסה הבאה.</Text>
      </View>

      <Text style={s.section}>פרשת השבוע (בקרוב)</Text>
      <View style={s.card2}>
        <Text style={s.parashaName}>📖 הפרשה תוצג כאן</Text>
        <Text style={s.hint}>שילוב לוח הפרשות השבועי מתוכנן לגרסה הבאה.</Text>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChange, theme, wide }) {
  return (
    <View style={{ flex: wide ? 1.4 : 1 }}>
      <Text style={{ color: theme.textMuted, fontSize: 12, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: theme.surfaceAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, color: theme.textPrimary, fontFamily: FONTS.bold, fontSize: 16, textAlign: "center", borderWidth: 1, borderColor: theme.hairline }}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        keyboardType="numeric"
      />
    </View>
  );
}

function makeStyles(t, fs) {
  return StyleSheet.create({
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { color: t.textPrimary, fontSize: 18 * fs, fontFamily: FONTS.bold },
    close: { color: t.textMuted, fontSize: 18, fontFamily: FONTS.bold },
    card: { borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 8 },
    todayLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 * fs, fontFamily: FONTS.medium },
    todayBig: { color: "#FFF", fontSize: 24 * fs, fontFamily: FONTS.bold, marginVertical: 4, textAlign: "center" },
    todaySub: { color: "rgba(255,255,255,0.85)", fontSize: 12 * fs, fontFamily: FONTS.regular },
    section: { color: t.textSecondary, fontSize: 14 * fs, fontFamily: FONTS.bold, textAlign: "right", marginTop: 18, marginBottom: 8 },
    card2: { backgroundColor: t.surfaceAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.hairline },
    inputRow: { flexDirection: "row", gap: 10 },
    result: { color: t.accent, fontSize: 16 * fs, fontFamily: FONTS.bold, textAlign: "center", marginTop: 12 },
    linkBtn: { marginTop: 12, borderRadius: RADIUS_SM, paddingVertical: 12, alignItems: "center" },
    linkText: { color: "#FFF", fontSize: 14 * fs, fontFamily: FONTS.bold },
    monthChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: t.surfaceMuted, marginEnd: 6 },
    monthChipText: { fontSize: 13 * fs, fontFamily: FONTS.bold },
    zmanRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.hairline },
    zmanValue: { color: t.textMuted, fontSize: 14 * fs, fontFamily: FONTS.bold },
    zmanName: { color: t.textPrimary, fontSize: 14 * fs, fontFamily: FONTS.medium },
    parashaName: { color: t.textPrimary, fontSize: 15 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    hint: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.regular, textAlign: "right", marginTop: 8 },
  });
}
