import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Slider from "./Slider";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { gregorianToHebrew, hebrewWeekday } from "../../utils/hebrewDate";
import { shekel } from "../../utils/posStore";
import { computeZmanim, fmtTime, JERUSALEM } from "../../utils/zmanim";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// The fully-built utilities behind the Tools hub. Each is self-contained and
// renders inside the hub's bottom sheet.

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";
const GREEN = "#1E9E58";
const RED = "#E14848";

function Field({ label, value, onChange, placeholder, suffix, numeric = true }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        {!!suffix && <Text style={s.fieldSuffix}>{suffix}</Text>}
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={numeric ? "numeric" : "default"}
          placeholder={placeholder}
          placeholderTextColor={INK_MUTED}
          textAlign="center"
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color = INK, big }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, big && { fontSize: 25 }, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[s.segmentBtn, value === o.key && s.segmentOn]}
          onPress={() => { hapticLight(); onChange(o.key); }}
          activeOpacity={0.75}
        >
          <Text style={[s.segmentText, value === o.key && { color: WHITE }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// A. מחשבון החזר השקעה למכונת שתייה
// ---------------------------------------------------------------------------
export function VendingRoi() {
  const [price, setPrice] = useState("4500");
  const [cansPerDay, setCansPerDay] = useState("18");
  const [profitPerCan, setProfitPerCan] = useState("2.5");
  const [monthlyCosts, setMonthlyCosts] = useState("120");

  const r = useMemo(() => {
    const machine = parseFloat(price) || 0;
    const cans = parseFloat(cansPerDay) || 0;
    const per = parseFloat(profitPerCan) || 0;
    const fixed = parseFloat(monthlyCosts) || 0;

    const grossDaily = cans * per;
    const netDaily = grossDaily - fixed / 30.4; // spread電/location fees over a month
    if (machine <= 0 || netDaily <= 0) {
      return { impossible: true, netDaily, grossDaily };
    }
    const days = Math.ceil(machine / netDaily);
    return {
      impossible: false,
      grossDaily: Math.round(grossDaily * 100) / 100,
      netDaily: Math.round(netDaily * 100) / 100,
      days,
      months: Math.round((days / 30.4) * 10) / 10,
      monthlyNet: Math.round(netDaily * 30.4),
      yearOne: Math.round(netDaily * 365 - machine),
    };
  }, [price, cansPerDay, profitPerCan, monthlyCosts]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="מחיר המכונה" value={price} onChange={setPrice} placeholder="4500" suffix="₪" />
        <Field label="פחיות ביום" value={cansPerDay} onChange={setCansPerDay} placeholder="18" suffix="יח׳" />
      </View>
      <View style={s.row}>
        <Field label="רווח לפחית" value={profitPerCan} onChange={setProfitPerCan} placeholder="2.5" suffix="₪" />
        <Field label="עלויות חודשיות" value={monthlyCosts} onChange={setMonthlyCosts} placeholder="120" suffix="₪" />
      </View>

      {r.impossible ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>אין החזר השקעה בנתונים האלה</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            הרווח היומי ({shekel(Math.round(r.netDaily * 100) / 100)}) לא מכסה את העלויות הקבועות.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="ימים להחזר" value={r.days} color={BLUE} big />
            <Stat label="חודשים" value={r.months} />
            <Stat label="רווח נקי לחודש" value={shekel(r.monthlyNet)} color={GREEN} />
          </View>
          <View style={s.statRow}>
            <Stat label="רווח יומי ברוטו" value={shekel(r.grossDaily)} />
            <Stat label="רווח יומי נטו" value={shekel(r.netDaily)} color={GREEN} />
            <Stat
              label="רווח בשנה הראשונה"
              value={shekel(r.yearOne)}
              color={r.yearOne >= 0 ? GREEN : RED}
            />
          </View>
          <Text style={s.hint}>
            העלויות החודשיות (חשמל, דמי מיקום) מחולקות ל-30.4 ימים ומופחתות מהרווח היומי, כך שההחזר משקף
            רווח נטו אמיתי.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. מחשבון גודל וידאו (CapCut / עריכה)
// ---------------------------------------------------------------------------
// Practical H.264 bitrates (Mbps) by resolution at 30 fps, in line with what
// editors like CapCut export.
const RES_BITRATE = {
  "720p": { label: "720p", mbps: 5 },
  "1080p": { label: "1080p", mbps: 10 },
  "1440p": { label: "2K", mbps: 20 },
  "4k": { label: "4K", mbps: 45 },
};

export function VideoSizeEstimator() {
  const [minutes, setMinutes] = useState("3");
  const [res, setRes] = useState("1080p");
  const [fps, setFps] = useState("30");
  const [codec, setCodec] = useState("h264");

  const r = useMemo(() => {
    const mins = parseFloat(minutes) || 0;
    const f = parseFloat(fps) || 30;
    const base = RES_BITRATE[res].mbps;
    // Frame rate scales bitrate sub-linearly; 60 fps costs ~1.5x, not 2x.
    const fpsFactor = 1 + (f - 30) / 30 * 0.5;
    // H.265 delivers similar quality at roughly 60% the bitrate.
    const codecFactor = codec === "h265" ? 0.6 : 1;
    const mbps = Math.max(0.5, base * fpsFactor * codecFactor);
    const seconds = mins * 60;
    const megabytes = (mbps * seconds) / 8;
    return {
      mbps: Math.round(mbps * 10) / 10,
      mb: Math.round(megabytes),
      gb: Math.round((megabytes / 1024) * 100) / 100,
      perMinute: Math.round((mbps * 60) / 8),
    };
  }, [minutes, res, fps, codec]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="אורך הסרטון" value={minutes} onChange={setMinutes} placeholder="3" suffix="דק׳" />
        <Field label="קצב פריימים" value={fps} onChange={setFps} placeholder="30" suffix="fps" />
      </View>

      <Text style={s.fieldLabel}>רזולוציה</Text>
      <Segment
        options={Object.entries(RES_BITRATE).map(([key, v]) => ({ key, label: v.label }))}
        value={res}
        onChange={setRes}
      />

      <Text style={s.fieldLabel}>קודק</Text>
      <Segment
        options={[
          { key: "h264", label: "H.264" },
          { key: "h265", label: "H.265 / HEVC" },
        ]}
        value={codec}
        onChange={setCodec}
      />

      <View style={s.statRow}>
        <Stat label="גודל משוער" value={r.mb >= 1024 ? `${r.gb} GB` : `${r.mb} MB`} color={BLUE} big />
        <Stat label="קצב סיביות" value={`${r.mbps} Mbps`} />
        <Stat label="לכל דקה" value={`${r.perMinute} MB`} />
      </View>
      <Text style={s.hint}>
        הערכה לייצוא H.264/H.265 סטנדרטי. 60 fps מוסיף ~50% ולא כפול, ו-H.265 חוסך כ-40% באותה איכות.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. מחולל עיצוב React Native
// ---------------------------------------------------------------------------
export function RnUiGenerator() {
  const [radius, setRadius] = useState(16);
  const [opacity, setOpacity] = useState(0.05);
  const [elevation, setElevation] = useState(2);
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () =>
      JSON.stringify(
        {
          backgroundColor: "#FFFFFF",
          borderRadius: radius,
          padding: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: Math.max(1, Math.round(elevation / 2)) },
          shadowOpacity: opacity,
          shadowRadius: Math.max(1, elevation + 1),
          elevation,
        },
        null,
        2
      ),
    [radius, opacity, elevation]
  );

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    hapticSuccess();
    try {
      await Clipboard.setStringAsync(snippet);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Live preview */}
      <View style={s.previewStage}>
        <View
          style={{
            backgroundColor: WHITE,
            borderRadius: radius,
            paddingVertical: 22,
            paddingHorizontal: 18,
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: Math.max(1, Math.round(elevation / 2)) },
            shadowOpacity: opacity,
            shadowRadius: Math.max(1, elevation + 1),
            elevation,
          }}
        >
          <Text style={s.previewTitle}>כרטיס לדוגמה</Text>
          <Text style={s.previewSub}>770JLM Light Modern</Text>
        </View>
      </View>

      <Slider label="borderRadius" value={radius} min={0} max={40} step={1} onChange={setRadius} />
      <Slider
        label="shadowOpacity"
        value={opacity}
        min={0}
        max={0.4}
        step={0.01}
        onChange={setOpacity}
        format={(v) => v.toFixed(2)}
      />
      <Slider label="elevation" value={elevation} min={0} max={12} step={1} onChange={setElevation} />

      <View style={s.snippetBox}>
        <Text style={s.snippetText}>{snippet}</Text>
      </View>
      <TouchableOpacity style={[s.actionBtn, copied && { backgroundColor: GREEN }]} onPress={copy} activeOpacity={0.85}>
        <Text style={s.actionText}>{copied ? "✓ הועתק" : "📋 העתק את הסגנון"}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// D. מחשבון ייבוא אליאקספרס
// ---------------------------------------------------------------------------
export function AliImportCalc() {
  const [cost, setCost] = useState("6.5");
  const [shipping, setShipping] = useState("2");
  const [margin, setMargin] = useState("60");
  const [rate, setRate] = useState("3.7");
  const [vat, setVat] = useState(true);

  const r = useMemo(() => {
    const usd = (parseFloat(cost) || 0) + (parseFloat(shipping) || 0);
    const fx = parseFloat(rate) || 0;
    const m = parseFloat(margin) || 0;
    const landedIls = usd * fx;
    const sellBeforeVat = landedIls * (1 + m / 100);
    const sell = vat ? sellBeforeVat * 1.18 : sellBeforeVat;
    const profit = sellBeforeVat - landedIls;
    const rounded = sell > 0 ? Math.ceil(sell / 5) * 5 : 0;
    return {
      landedIls: Math.round(landedIls * 100) / 100,
      sell: Math.round(sell * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      rounded,
      marginOfPrice: sell > 0 ? Math.round((profit / sell) * 100) : 0,
      ready: usd > 0 && fx > 0,
    };
  }, [cost, shipping, margin, rate, vat]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="עלות המוצר" value={cost} onChange={setCost} placeholder="6.5" suffix="$" />
        <Field label="משלוח" value={shipping} onChange={setShipping} placeholder="2" suffix="$" />
      </View>
      <View style={s.row}>
        <Field label="אחוז רווח רצוי" value={margin} onChange={setMargin} placeholder="60" suffix="%" />
        <Field label="שער דולר" value={rate} onChange={setRate} placeholder="3.7" suffix="₪" />
      </View>

      <TouchableOpacity style={s.checkRow} onPress={() => { hapticLight(); setVat((v) => !v); }} activeOpacity={0.75}>
        <View style={[s.checkbox, vat && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {vat && <Text style={s.checkMark}>✓</Text>}
        </View>
        <Text style={s.checkLabel}>הוסף מע״מ 18% למחיר המכירה</Text>
      </TouchableOpacity>

      {r.ready ? (
        <>
          <View style={s.statRow}>
            <Stat label="מחיר מכירה" value={shekel(r.sell)} color={BLUE} big />
            <Stat label="רווח נקי" value={shekel(r.profit)} color={r.marginOfPrice >= 30 ? GREEN : GOLD} />
          </View>
          <View style={s.statRow}>
            <Stat label="עלות נחיתה בשקלים" value={shekel(r.landedIls)} />
            <Stat label="רווח מהמחיר" value={`${r.marginOfPrice}%`} />
          </View>
          <Text style={[s.hint, { color: INK_SOFT }]}>💡 מחיר מדף מומלץ (עיגול ל-5): {shekel(r.rounded)}</Text>
          <Text style={s.hint}>
            הרווח מחושב לפני מע״מ — המע״מ נגבה מהלקוח ומועבר למדינה, ולכן אינו חלק מהרווח.
          </Text>
        </>
      ) : (
        <Text style={s.hint}>הזן עלות מוצר ושער דולר כדי לחשב.</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// E. זמני היום ושגרה
// ---------------------------------------------------------------------------
// Daily boarding-school schedule used for the "next up" countdown.
const ROUTINE = [
  { at: "07:15", label: "שחרית", emoji: "🌅" },
  { at: "08:30", label: "ארוחת בוקר", emoji: "🍞" },
  { at: "09:15", label: "סדר א׳", emoji: "📖" },
  { at: "12:30", label: "ארוחת צהריים", emoji: "🍽️" },
  { at: "13:30", label: "מנוחה", emoji: "😴" },
  { at: "15:00", label: "סדר ב׳", emoji: "📚" },
  { at: "18:00", label: "מנחה", emoji: "🕊️" },
  { at: "19:00", label: "ארוחת ערב", emoji: "🥗" },
  { at: "20:00", label: "סדר ערב", emoji: "🕯️" },
  { at: "22:30", label: "כיבוי אורות", emoji: "🌙" },
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
          {hebrewWeekday(now)} · {now.toLocaleDateString("he-IL")} · 📍 {JERUSALEM.name}
        </Text>
      </View>

      {/* Next up */}
      <View style={s.nextCard}>
        <Text style={s.nextEmoji}>{next.emoji}</Text>
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
          { label: "זריחה", value: z.sunrise, emoji: "🌄" },
          { label: "חצות", value: z.midday, emoji: "☀️" },
          { label: "שקיעה", value: z.sunset, emoji: "🌇", gold: true },
          { label: "צאת הכוכבים", value: z.nightfall, emoji: "🌃" },
        ].map((r) => (
          <View key={r.label} style={[s.zTile, r.gold && { backgroundColor: GOLD + "16" }]}>
            <Text style={{ fontSize: 17 }}>{r.emoji}</Text>
            <Text style={[s.zTileTime, r.gold && { color: "#8A6D14" }]}>{fmtTime(r.value)}</Text>
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
            <Text
              style={[
                s.routineLabel,
                past && { color: INK_MUTED, textDecorationLine: "line-through" },
                isNext && { color: BLUE, fontFamily: FONTS.bold },
              ]}
            >
              {r.emoji} {r.label}
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

// ---------------------------------------------------------------------------
// בודק JSON
// ---------------------------------------------------------------------------
export function JsonValidator() {
  const [raw, setRaw] = useState('{"לקוח":"דוד","הזמנה":{"פחיות":24,"מחיר":60}}');

  const result = useMemo(() => {
    const text = raw.trim();
    if (!text) return { state: "empty" };
    try {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      let keys = 0;
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          keys += Object.keys(v).length;
          Object.values(v).forEach(walk);
        }
      };
      walk(parsed);
      return {
        state: "valid",
        pretty,
        keys,
        type: Array.isArray(parsed) ? "מערך" : parsed && typeof parsed === "object" ? "אובייקט" : typeof parsed,
        size: text.length,
      };
    } catch (e) {
      const m = /position (\d+)/.exec(e.message);
      let where = "";
      if (m) {
        const line = raw.slice(0, Number(m[1])).split("\n").length;
        where = ` (שורה ${line})`;
      }
      return { state: "invalid", error: e.message + where };
    }
  }, [raw]);

  const format = () => {
    if (result.state !== "valid") {
      hapticWarning();
      return;
    }
    hapticSuccess();
    setRaw(result.pretty);
  };

  const copy = async () => {
    hapticLight();
    try {
      await Clipboard.setStringAsync(result.state === "valid" ? result.pretty : raw);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        style={s.codeInput}
        value={raw}
        onChangeText={setRaw}
        placeholder='הדבק JSON כאן... {"key": "value"}'
        placeholderTextColor={INK_MUTED}
        multiline
        textAlign="left"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {result.state === "valid" && (
        <>
          <View style={[s.banner, { backgroundColor: GREEN + "16" }]}>
            <Text style={[s.bannerText, { color: GREEN }]}>
              ✓ JSON תקין · {result.type} · {result.keys} מפתחות · {result.size} תווים
            </Text>
          </View>
          <View style={s.row}>
            <TouchableOpacity style={s.actionBtn} onPress={format} activeOpacity={0.85}>
              <Text style={s.actionText}>✨ עצב מחדש</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={copy} activeOpacity={0.85}>
              <Text style={[s.actionText, { color: INK_SOFT }]}>📋 העתק</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      {result.state === "invalid" && (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>✕ JSON לא תקין</Text>
          <Text style={[s.bannerSub, { color: RED }]}>{result.error}</Text>
        </View>
      )}
      {result.state === "empty" && <Text style={s.hint}>הדבק טקסט JSON כדי לבדוק ולעצב אותו.</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// מחולל ברקודים/QR — deterministic preview, explicitly not scannable
// ---------------------------------------------------------------------------
const QR_SIZE = 25;

function buildMatrix(text) {
  const grid = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));
  const finder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = edge || core;
      }
    }
  };
  finder(0, 0);
  finder(0, QR_SIZE - 7);
  finder(QR_SIZE - 7, 0);
  for (let i = 8; i < QR_SIZE - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const reserved = (r, c) =>
    (r < 8 && c < 8) || (r < 8 && c >= QR_SIZE - 8) || (r >= QR_SIZE - 8 && c < 8) || r === 6 || c === 6;
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (reserved(r, c)) continue;
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      grid[r][c] = (h & 1) === 1;
    }
  }
  return grid;
}

export function QrGenerator() {
  const [text, setText] = useState("https://770jlm.co.il");
  const matrix = useMemo(() => buildMatrix(text || " "), [text]);

  const copy = async () => {
    hapticLight();
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        style={s.qrInput}
        value={text}
        onChangeText={setText}
        placeholder="טקסט / קישור / מספר טלפון"
        placeholderTextColor={INK_MUTED}
        textAlign="right"
        autoCapitalize="none"
      />
      <View style={s.qrWrap}>
        <View style={s.qrGrid}>
          {matrix.map((row, r) => (
            <View key={r} style={{ flexDirection: "row" }}>
              {row.map((on, c) => (
                <View key={c} style={[s.qrCell, on && { backgroundColor: INK }]} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
        <Text style={[s.bannerText, { color: "#8A6D14" }]}>תצוגה מקדימה — הקוד אינו סָריק</Text>
        <Text style={[s.bannerSub, { color: "#8A6D14" }]}>
          קוד QR אמיתי דורש ספריית קידוד ייעודית שלא מותקנת כדי לא לסכן את הבילד. בינתיים אפשר להעתיק את
          הטקסט ולהפיק ממנו קוד בכל שירות.
        </Text>
      </View>
      <TouchableOpacity style={s.actionBtn} onPress={copy} activeOpacity={0.85}>
        <Text style={s.actionText}>📋 העתק את הטקסט</Text>
      </TouchableOpacity>
    </View>
  );
}

// Map tool id → mini-app component.
export const MINI_APPS = {
  "vending-roi": VendingRoi,
  "video-size": VideoSizeEstimator,
  "rn-ui-gen": RnUiGenerator,
  "ali-import": AliImportCalc,
  "zmanim-routine": ZmanimRoutine,
  "json-validator": JsonValidator,
  "qr-gen": QrGenerator,
};

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "right", lineHeight: 18 },

  fieldLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_SOFT, textAlign: "right", marginBottom: 5 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    minHeight: 52,
  },
  fieldSuffix: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_MUTED },
  fieldInput: { flex: 1, fontFamily: FONTS.bold, fontSize: 18, color: INK, minHeight: 52 },

  statRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" },
  statValue: { fontFamily: FONTS.bold, fontSize: 17 },
  statLabel: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED, marginTop: 3, textAlign: "center" },

  segment: { flexDirection: "row", backgroundColor: CARD, borderRadius: 14, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: BLUE },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#C9CFD6", alignItems: "center", justifyContent: "center" },
  checkMark: { color: WHITE, fontFamily: FONTS.bold, fontSize: 14 },
  checkLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT, textAlign: "right" },

  previewStage: { backgroundColor: "#EDF0F4", borderRadius: 18, padding: 22, marginBottom: 6 },
  previewTitle: { fontFamily: FONTS.bold, fontSize: 16, color: INK },
  previewSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 3 },
  snippetBox: { backgroundColor: "#0E1729", borderRadius: 14, padding: 12, marginTop: 4 },
  snippetText: { fontFamily: "monospace", fontSize: 11, color: "#D7E3F4", textAlign: "left", lineHeight: 17 },

  codeInput: {
    minHeight: 150,
    backgroundColor: "#0E1729",
    borderRadius: 14,
    padding: 12,
    fontFamily: "monospace",
    fontSize: 12,
    color: "#D7E3F4",
    textAlignVertical: "top",
  },
  banner: { borderRadius: 14, padding: 12 },
  bannerText: { fontFamily: FONTS.bold, fontSize: 13, textAlign: "right" },
  bannerSub: { fontFamily: FONTS.regular, fontSize: 11, textAlign: "right", marginTop: 4, lineHeight: 17 },
  actionBtn: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONTS.bold, fontSize: 14, color: WHITE },

  hebCard: { backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: "center" },
  hebDate: { fontFamily: FONTS.bold, fontSize: 20, color: INK, textAlign: "center" },
  hebSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 4, textAlign: "center" },

  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: BLUE + "0E",
    borderRadius: 16,
    padding: 14,
    minHeight: 66,
  },
  nextEmoji: { fontSize: 26 },
  nextLabel: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },
  nextTime: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, marginTop: 2 },

  zGrid: { flexDirection: "row", gap: 8 },
  zTile: { flex: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 2 },
  zTileTime: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
  zTileLabel: { fontFamily: FONTS.regular, fontSize: 10, color: INK_MUTED },

  sectionLabel: { fontFamily: FONTS.bold, fontSize: 14, color: INK, textAlign: "right", marginTop: 4 },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  routineTime: { fontFamily: FONTS.bold, fontSize: 13, color: INK },
  routineLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },

  qrInput: {
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
  },
  qrWrap: { alignItems: "center", paddingVertical: 8 },
  qrGrid: { backgroundColor: WHITE, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E7EAEE" },
  qrCell: { width: 8, height: 8, backgroundColor: "transparent" },
});
