import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import { hapticLight } from "../../../utils/haptics";
import { gregorianToHebrew, hebrewWeekday } from "../../../utils/hebrewDate";
import { computeZmanim, fmtTime, JERUSALEM } from "../../../utils/zmanim";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import {
  BLUE,
  CARD,
  Field,
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
        <CustomText style={s.hebDate}>{heb.formatted}</CustomText>
        <CustomText style={s.hebSub}>
          {hebrewWeekday(now)} · {now.toLocaleDateString("he-IL")} · {JERUSALEM.name}
        </CustomText>
      </View>

      {/* Next up */}
      <View style={s.nextCard}>
        <View style={s.nextBadge}><Icon name={next.icon} size={20} color={BLUE} /></View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <CustomText style={s.nextLabel}>
            הבא בתור: {next.label}
            {next.tomorrow ? " (מחר)" : ""}
          </CustomText>
          <CustomText style={s.nextTime}>
            {next.at} · {countdown}
          </CustomText>
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
            <CustomText style={[s.zTileTime, r.gold && { color: "#0E7490" }]}>{fmtTime(r.value)}</CustomText>
            <CustomText style={s.zTileLabel}>{r.label}</CustomText>
          </View>
        ))}
      </View>

      {/* Full routine */}
      <CustomText style={s.sectionLabel}>סדר היום</CustomText>
      {ROUTINE.map((r) => {
        const past = minutesOfDay(r.at) <= nowMinutes;
        const isNext = r.at === next.at && !next.tomorrow;
        return (
          <View key={r.at} style={[s.routineRow, isNext && { backgroundColor: BLUE + "10" }]}>
            <CustomText style={[s.routineTime, past && { color: INK_MUTED }, isNext && { color: BLUE }]}>{r.at}</CustomText>
            <Icon name={r.icon} size={16} color={isNext ? BLUE : past ? INK_MUTED : INK_SOFT} />
            <CustomText
              style={[
                s.routineLabel,
                past && { color: INK_MUTED, textDecorationLine: "line-through" },
                isNext && { color: BLUE, fontFamily: FONTS.bold },
              ]}
            >
              {r.label}
            </CustomText>
          </View>
        );
      })}
      <CustomText style={s.hint}>
        זמני היום מחושבים במכשיר לפי מיקום השמש בירושלים. סדר היום קבוע וניתן יהיה לערוך אותו בהמשך.
      </CustomText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. מדד נפח קלורי
// ---------------------------------------------------------------------------

// Calories per gram. The bands are the ones used in volumetrics: foods under
// 1.5 fill you up for few calories, foods over 4 are calorie-dense enough that
// portion size stops being intuitive.
const DENSITY_BANDS = [
  { max: 1.5, label: "נפח גבוה — משביע ליחסית מעט קלוריות", tone: "green" },
  { max: 4, label: "בינוני — שווה לשים לב לגודל המנה", tone: "gold" },
  { max: Infinity, label: "צפוף בקלוריות — מנה קטנה מגיעה רחוק", tone: "red" },
];

const FOOD_PRESETS = [
  { label: "לחם", grams: "100", kcal: "265" },
  { label: "אורז מבושל", grams: "100", kcal: "130" },
  { label: "שניצל", grams: "100", kcal: "290" },
  { label: "במבה", grams: "100", kcal: "550" },
  { label: "תפוח", grams: "100", kcal: "52" },
];

export function CalorieDensity() {
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");

  const r = useMemo(() => {
    const g = parseFloat(grams);
    const c = parseFloat(kcal);
    if (!Number.isFinite(g) || !Number.isFinite(c) || g <= 0) return { ready: false };
    const density = c / g;
    const band = DENSITY_BANDS.find((b) => density < b.max);
    return {
      ready: true,
      density: Math.round(density * 100) / 100,
      band,
      per100: Math.round(density * 100),
      // How much of this food 500 kcal buys — the number that actually tells
      // you whether a portion will fill you up.
      gramsFor500: Math.round(500 / density),
    };
  }, [grams, kcal]);

  useCalcHaptic(r.density);

  const tone = !r.ready ? INK_SOFT : r.band.tone === "green" ? GREEN : r.band.tone === "gold" ? GOLD : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="משקל המנה" value={grams} onChange={setGrams} placeholder="100" suffix="גרם" />
        <Field label="קלוריות" value={kcal} onChange={setKcal} placeholder="265" suffix="קק״ל" />
      </View>

      <View style={s.chipRow}>
        {FOOD_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={s.chip}
            onPress={() => { hapticLight(); setGrams(p.grams); setKcal(p.kcal); }}
            activeOpacity={0.8}
          >
            <CustomText style={s.chipText}>{p.label}</CustomText>
          </TouchableOpacity>
        ))}
      </View>

      {!r.ready ? (
        <CustomText style={s.hint}>הזן משקל בגרמים וכמות קלוריות — הערכים מופיעים על האריזה.</CustomText>
      ) : (
        <>
          <View style={[c.verdict, { backgroundColor: tone + "12" }]}>
            <CustomText testID="density-result" style={[c.verdictValue, { color: tone }]}>{r.density}</CustomText>
            <CustomText style={c.verdictUnit}>קלוריות לגרם</CustomText>
            <CustomText style={[c.verdictLabel, { color: tone }]}>{r.band.label}</CustomText>
          </View>

          <View style={c.scale}>
            {DENSITY_BANDS.map((b, i) => {
              const active = b === r.band;
              const bandTone = b.tone === "green" ? GREEN : b.tone === "gold" ? GOLD : RED;
              return (
                <View
                  key={i}
                  style={[
                    c.scaleSeg,
                    { backgroundColor: active ? bandTone : bandTone + "26" },
                    i === 0 && { borderTopStartRadius: 6, borderBottomStartRadius: 6 },
                    i === 2 && { borderTopEndRadius: 6, borderBottomEndRadius: 6 },
                  ]}
                />
              );
            })}
          </View>

          <View style={s.statRow}>
            <Stat label="ל-100 גרם" value={`${r.per100} קק״ל`} />
            <Stat label="כמה גרם ב-500 קק״ל" value={`${r.gramsFor500} ג׳`} color={tone} />
          </View>

          <CustomText style={s.hint}>
            הסולם: מתחת ל-1.5 נחשב נפח גבוה, 1.5 עד 4 בינוני, מעל 4 צפוף בקלוריות. זה מדד שובע ולא
            מדד בריאות — שמן זית צפוף מאוד ועדיין מזון טוב.
          </CustomText>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. מתכנן קצב למידה
// ---------------------------------------------------------------------------

const REST_OPTIONS = [
  { key: "0", label: "כל יום" },
  { key: "1", label: "בלי שבת" },
  { key: "2", label: "בלי שישי-שבת" },
];

export function StudyPace() {
  const [total, setTotal] = useState("");
  const [done, setDone] = useState("0");
  const [days, setDays] = useState("");
  const [rest, setRest] = useState("1");

  const r = useMemo(() => {
    const all = parseFloat(total);
    const finished = parseFloat(done) || 0;
    const daysLeft = parseFloat(days);
    if (!Number.isFinite(all) || !Number.isFinite(daysLeft) || all <= 0 || daysLeft <= 0) {
      return { ready: false };
    }
    const restPerWeek = parseInt(rest, 10) || 0;
    // Rest days are removed proportionally rather than by calendar, which is
    // close enough over any span longer than a week and needs no date maths.
    const studyDays = Math.max(1, Math.round(daysLeft * ((7 - restPerWeek) / 7)));
    const remaining = Math.max(0, all - finished);
    const perDay = remaining / studyDays;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      ready: true,
      remaining: round1(remaining),
      studyDays,
      perDay: round1(perDay),
      perDayCeil: Math.ceil(perDay),
      perWeek: round1(perDay * (7 - restPerWeek)),
      pct: Math.min(100, Math.round((finished / all) * 100)),
      finishedAlready: remaining === 0,
      heavy: perDay > all / 7,
    };
  }, [total, done, days, rest]);

  useCalcHaptic(r.perDay);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="pace-total" label="סה״כ לחומר" value={total} onChange={setTotal} placeholder="240" suffix="עמ׳" />
        <Field label="כבר נלמד" value={done} onChange={setDone} placeholder="0" suffix="עמ׳" />
        <Field testID="pace-days" label="ימים שנותרו" value={days} onChange={setDays} placeholder="30" suffix="ימים" />
      </View>

      <Segment options={REST_OPTIONS} value={rest} onChange={setRest} />

      {!r.ready ? (
        <CustomText style={s.hint}>הזן את היקף החומר ואת מספר הימים שנותרו עד המבחן.</CustomText>
      ) : r.finishedAlready ? (
        <View style={[s.banner, { backgroundColor: GREEN + "16" }]}>
          <CustomText style={[s.bannerText, { color: GREEN }]}>סיימת את כל החומר</CustomText>
          <CustomText style={[s.bannerSub, { color: GREEN }]}>נשארו {r.studyDays} ימי לימוד לחזרה ותרגול.</CustomText>
        </View>
      ) : (
        <>
          <View style={[c.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="pace-result" style={[c.verdictValue, { color: BLUE }]}>{r.perDayCeil}</CustomText>
            <CustomText style={c.verdictUnit}>ליום, {r.studyDays} ימי לימוד</CustomText>
          </View>

          <View>
            <View style={s.loadMetaRow}>
              <CustomText style={s.loadMeta}>{r.pct}%</CustomText>
              <CustomText style={s.loadMeta}>נותרו {r.remaining}</CustomText>
            </View>
            <View style={[s.loadTrack, { marginTop: 6 }]}>
              <View style={[s.loadFill, { width: `${r.pct}%`, backgroundColor: BLUE }]} />
            </View>
          </View>

          <View style={s.statRow}>
            <Stat label="מדויק ליום" value={r.perDay} />
            <Stat label="לשבוע" value={r.perWeek} color={GOLD} />
            <Stat label="ימי לימוד" value={r.studyDays} />
          </View>

          {r.heavy && (
            <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
              <CustomText style={[s.bannerText, { color: "#8A6D00" }]}>הקצב צפוף</CustomText>
              <CustomText style={[s.bannerSub, { color: "#8A6D00" }]}>
                בקצב הזה כל החומר נסגר בפחות משבוע. אם הזמן קצר, שווה לסמן מראש אילו נושאים אפשר
                ללמוד ברמת היכרות בלבד.
              </CustomText>
            </View>
          )}

          <CustomText style={s.hint}>
            ימי המנוחה מנוכים ביחס שבועי, לכן המספר מתאים לכל טווח ארוך משבוע. היעד היומי מעוגל
            כלפי מעלה — עדיף להקדים מלפגר.
          </CustomText>
        </>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  verdict: { borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 3 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 38 },
  verdictUnit: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT },
  verdictLabel: { fontFamily: FONTS.semibold, fontSize: 12.5, textAlign: "center", marginTop: 4, paddingHorizontal: 12 },

  scale: { flexDirection: "row", gap: 3, height: 10 },
  scaleSeg: { flex: 1 },
});
