import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { useSettings } from "../../context/SettingsContext";
import {
  gregorianToHebrew,
  hebrewMonthName,
  hebrewMonthsInYear,
  hebrewToGregorian,
  hebrewWeekday,
  numberToHebrew,
} from "../../utils/hebrewDate";
import Icon from "../Icon";
import { NOTES_FONTS as FONTS, NOTES_THEME } from "../../utils/notesTheme";
import { computeZmanim, fmtTime, JERUSALEM } from "../../utils/zmanim";
import { RADIUS_SM } from "../../utils/theme";
import CustomText from "../../components/CustomText";

// The Hebrew Calendar Pro panel: live Hebrew date, a two-way date converter, a
// "link this note to a Hebrew date" action, and today's zmanim computed on the
// device from the sun's position over Jerusalem.
export default function HebrewDateTools({ onLink, onClose }) {
  const { fontScale } = useSettings();
  const theme = NOTES_THEME;
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

  const zmanim = computeZmanim();

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <View style={s.titleRow}><Icon name="calendar" size={17} color={theme.accent} /><CustomText style={s.title}>לוח עברי</CustomText></View>
        <TouchableOpacity onPress={onClose}><Icon name="x" size={17} color={theme.textMuted} /></TouchableOpacity>
      </View>

      {/* Today */}
      <View style={s.card}>
        <CustomText style={s.todayLabel}>התאריך העברי היום</CustomText>
        <CustomText style={s.todayBig}>{today.formatted}</CustomText>
        <CustomText style={s.todaySub}>{hebrewWeekday(new Date())} · {gDate.toLocaleDateString("he-IL")}</CustomText>
      </View>

      {/* Gregorian → Hebrew */}
      <CustomText style={s.section}>המרה: לועזי ← עברי</CustomText>
      <View style={s.card2}>
        <View style={s.inputRow}>
          <Field label="יום" value={g.d} onChange={(v) => setG((p) => ({ ...p, d: v }))} theme={theme} />
          <Field label="חודש" value={g.m} onChange={(v) => setG((p) => ({ ...p, m: v }))} theme={theme} />
          <Field label="שנה" value={g.y} onChange={(v) => setG((p) => ({ ...p, y: v }))} theme={theme} wide />
        </View>
        <CustomText style={s.result}>{gToHeb ? gToHeb.formatted : "תאריך לא תקין"}</CustomText>
        {gToHeb && (
          <TouchableOpacity style={[s.linkBtn, { backgroundColor: theme.accent }]} onPress={() => onLink({ iso: gDate.toISOString(), formatted: gToHeb.formatted })}>
            <View style={s.titleRow}><Icon name="link-2" size={14} color="#FFFFFF" /><CustomText style={s.linkText}>קשר הערה לתאריך זה</CustomText></View>
          </TouchableOpacity>
        )}
      </View>

      {/* Hebrew → Gregorian */}
      <CustomText style={s.section}>המרה: עברי ← לועזי</CustomText>
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
              <CustomText style={[s.monthChipText, { color: h.m === mo ? "#FFF" : theme.textSecondary }]}>
                {hYear ? hebrewMonthName(mo, hYear) : mo}
              </CustomText>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <CustomText style={s.result}>
          {hToGreg ? `${numberToHebrew(Number(h.d))} ${hebrewMonthName(h.m, hYear)} → ${hToGreg.toLocaleDateString("he-IL")}` : "תאריך לא תקין"}
        </CustomText>
      </View>

      {/* Scaffolds */}
      <CustomText style={s.section}>זמני היום</CustomText>
      <View style={s.card2}>
        {[
          { icon: "sunrise", name: "עלות השחר", value: zmanim.dawn },
          { icon: "sun", name: "זריחה", value: zmanim.sunrise },
          { icon: "book-open", name: "סוף זמן קריאת שמע", value: zmanim.shemaEnd },
          { icon: "clock", name: "חצות היום", value: zmanim.midday },
          { icon: "sunset", name: "שקיעה", value: zmanim.sunset },
          { icon: "moon", name: "צאת הכוכבים", value: zmanim.nightfall },
        ].map((z) => (
          <View key={z.name} style={s.zmanRow}>
            <CustomText style={s.zmanValue}>{z.value ? fmtTime(z.value) : "--:--"}</CustomText>
            <View style={s.titleRow}>
              <Icon name={z.icon} size={14} color={theme.textMuted} />
              <CustomText style={s.zmanName}>{z.name}</CustomText>
            </View>
          </View>
        ))}
        <CustomText style={s.hint}>מחושב במכשיר לפי מיקום השמש ב{JERUSALEM.name}.</CustomText>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChange, theme, wide }) {
  return (
    <View style={{ flex: wide ? 1.4 : 1 }}>
      <CustomText style={{ color: theme.textMuted, fontSize: 12, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 }}>{label}</CustomText>
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
    titleRow: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 7 },
    close: { color: t.textMuted, fontSize: 18, fontFamily: FONTS.bold },
    card: { borderRadius: 28, padding: 18, alignItems: "center", marginBottom: 8, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.hairline },
    todayLabel: { color: t.textMuted, fontSize: 13 * fs, fontFamily: FONTS.regular },
    todayBig: { color: t.accent, fontSize: 24 * fs, fontFamily: FONTS.bold, marginVertical: 4, textAlign: "center" },
    todaySub: { color: t.textSecondary, fontSize: 12 * fs, fontFamily: FONTS.regular },
    section: { color: t.textSecondary, fontSize: 14 * fs, fontFamily: FONTS.bold, textAlign: "right", marginTop: 18, marginBottom: 8 },
    card2: { backgroundColor: t.surfaceAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.hairline },
    inputRow: { flexDirection: "row", gap: 10 },
    result: { color: t.accent, fontSize: 16 * fs, fontFamily: FONTS.bold, textAlign: "center", marginTop: 12 },
    linkBtn: { marginTop: 12, borderRadius: RADIUS_SM, paddingVertical: 12, alignItems: "center" },
    linkText: { color: "#FFF", fontSize: 14 * fs, fontFamily: FONTS.bold },
    monthChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 28, backgroundColor: t.surfaceMuted, marginEnd: 6 },
    monthChipText: { fontSize: 13 * fs, fontFamily: FONTS.bold },
    zmanRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.hairline },
    zmanValue: { color: t.textMuted, fontSize: 14 * fs, fontFamily: FONTS.bold },
    zmanName: { color: t.textPrimary, fontSize: 14 * fs, fontFamily: FONTS.medium },
    hint: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.regular, textAlign: "right", marginTop: 8 },
  });
}
