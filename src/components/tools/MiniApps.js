import { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { shekel } from "../../utils/posStore";
import { computeZmanim, fmtDate, fmtTime, JERUSALEM } from "../../utils/zmanim";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// The five fully-built utilities behind the Tools hub. Each is a self-contained
// mini-app rendered inside the hub's sheet.

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";
const GREEN = "#1E9E58";
const RED = "#E14848";

function Field({ label, value, onChange, placeholder, suffix }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        {!!suffix && <Text style={s.fieldSuffix}>{suffix}</Text>}
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
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
      <Text style={[s.statValue, big && { fontSize: 26 }, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// A. מחשבון שוליים A5 — how many stickers fit on an A5 sheet
// ---------------------------------------------------------------------------
const A5_W = 148;
const A5_H = 210;

export function A5MarginCalc() {
  const [w, setW] = useState("50");
  const [h, setH] = useState("30");
  const [margin, setMargin] = useState("5");
  const [gap, setGap] = useState("2");

  const r = useMemo(() => {
    const sw = parseFloat(w) || 0;
    const sh = parseFloat(h) || 0;
    const m = parseFloat(margin) || 0;
    const g = parseFloat(gap) || 0;
    if (sw <= 0 || sh <= 0) return null;

    const usableW = A5_W - m * 2;
    const usableH = A5_H - m * 2;

    // Try both orientations and keep whichever yields more stickers.
    const fit = (cw, ch) => {
      const cols = Math.floor((usableW + g) / (cw + g));
      const rows = Math.floor((usableH + g) / (ch + g));
      return { cols: Math.max(0, cols), rows: Math.max(0, rows), total: Math.max(0, cols) * Math.max(0, rows) };
    };
    const normal = { ...fit(sw, sh), rotated: false, cw: sw, ch: sh };
    const rotated = { ...fit(sh, sw), rotated: true, cw: sh, ch: sw };
    const best = rotated.total > normal.total ? rotated : normal;

    const usedW = best.cols ? best.cols * best.cw + (best.cols - 1) * g : 0;
    const usedH = best.rows ? best.rows * best.ch + (best.rows - 1) * g : 0;
    const sheetArea = A5_W * A5_H;
    const stickerArea = best.total * sw * sh;
    const waste = Math.max(0, Math.round((1 - stickerArea / sheetArea) * 100));
    // Leftover margins after packing, split evenly — the real print margins.
    const marginX = Math.round(((A5_W - usedW) / 2) * 10) / 10;
    const marginY = Math.round(((A5_H - usedH) / 2) * 10) / 10;
    return { ...best, waste, marginX, marginY };
  }, [w, h, margin, gap]);

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.hint}>גיליון A5 סטנדרטי: {A5_W}×{A5_H} מ״מ</Text>
      <View style={s.row}>
        <Field label="רוחב מדבקה" value={w} onChange={setW} placeholder="50" suffix="מ״מ" />
        <Field label="גובה מדבקה" value={h} onChange={setH} placeholder="30" suffix="מ״מ" />
      </View>
      <View style={s.row}>
        <Field label="שוליים" value={margin} onChange={setMargin} placeholder="5" suffix="מ״מ" />
        <Field label="רווח בין מדבקות" value={gap} onChange={setGap} placeholder="2" suffix="מ״מ" />
      </View>

      {r && r.total > 0 ? (
        <>
          <View style={s.statRow}>
            <Stat label="מדבקות בגיליון" value={r.total} color={BLUE} big />
            <Stat label="פריסה" value={`${r.cols}×${r.rows}`} />
            <Stat label="בזבוז נייר" value={`${r.waste}%`} color={r.waste > 40 ? RED : GREEN} />
          </View>
          {r.rotated && (
            <Text style={[s.hint, { color: GOLD }]}>💡 מומלץ לסובב את המדבקה ב-90° — כך נכנסות יותר</Text>
          )}
          <Text style={s.hint}>
            שוליים בפועל: {r.marginX} מ״מ בצדדים · {r.marginY} מ״מ למעלה/למטה
          </Text>

          {/* Visual layout preview. The sheet is drawn at 148×210 px so one
              millimetre maps to exactly one pixel — percentage sizes would
              collapse to zero inside an auto-height row. */}
          <View style={s.sheetPreview}>
            <View style={[s.sheet, { gap: parseFloat(gap) || 0 }]}>
              {Array.from({ length: r.rows }).map((_, row) => (
                <View key={row} style={[s.sheetRow, { gap: parseFloat(gap) || 0 }]}>
                  {Array.from({ length: r.cols }).map((__, col) => (
                    <View key={col} style={[s.sheetCell, { width: r.cw, height: r.ch }]} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <Text style={[s.hint, { color: RED }]}>המדבקה גדולה מדי לגיליון A5 בשוליים האלה</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. מחשבון טווח קורקינט
// ---------------------------------------------------------------------------
export function ScooterRange() {
  const [battery, setBattery] = useState("80");
  const [payload, setPayload] = useState("75");
  const [fullRange, setFullRange] = useState("35");
  const [terrain, setTerrain] = useState("flat"); // flat | hilly

  const r = useMemo(() => {
    const pct = Math.max(0, Math.min(100, parseFloat(battery) || 0));
    const kg = parseFloat(payload) || 0;
    const base = parseFloat(fullRange) || 0;

    // Rated range assumes a ~75 kg rider; every extra 10 kg costs roughly 6%.
    const weightFactor = Math.max(0.55, 1 - Math.max(0, kg - 75) * 0.006);
    const terrainFactor = terrain === "hilly" ? 0.75 : 1;
    // Below ~15% most controllers throttle output, so the last stretch is
    // shorter than a linear reading suggests.
    const usablePct = pct > 15 ? pct : pct * 0.8;

    const km = base * (usablePct / 100) * weightFactor * terrainFactor;
    return {
      km: Math.max(0, Math.round(km * 10) / 10),
      weightLoss: Math.round((1 - weightFactor) * 100),
      reserve: Math.round(base * 0.1 * 10) / 10,
      low: pct <= 20,
    };
  }, [battery, payload, fullRange, terrain]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="סוללה כעת" value={battery} onChange={setBattery} placeholder="80" suffix="%" />
        <Field label="משקל רוכב+מטען" value={payload} onChange={setPayload} placeholder="75" suffix="ק״ג" />
      </View>
      <Field label="טווח מלא לפי היצרן" value={fullRange} onChange={setFullRange} placeholder="35" suffix="ק״מ" />

      <View style={s.segment}>
        {[
          { key: "flat", label: "מישורי 🛣️" },
          { key: "hilly", label: "עולה/גבעות ⛰️" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.segmentBtn, terrain === t.key && s.segmentOn]}
            onPress={() => { hapticLight(); setTerrain(t.key); }}
            activeOpacity={0.75}
          >
            <Text style={[s.segmentText, terrain === t.key && { color: WHITE }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.statRow}>
        <Stat label="טווח משוער" value={`${r.km} ק״מ`} color={r.low ? RED : GREEN} big />
        <Stat label="אובדן ממשקל" value={`${r.weightLoss}%`} color={r.weightLoss > 10 ? GOLD : INK} />
      </View>
      {r.low && <Text style={[s.hint, { color: RED }]}>⚠️ סוללה נמוכה — מומלץ לטעון לפני יציאה למשלוח</Text>}
      <Text style={s.hint}>
        השאר רזרבה של ~{r.reserve} ק״מ לחזרה. החישוב מניח טווח יצרן ל-75 ק״ג ומפחית ~6% לכל 10 ק״ג מעבר.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. בודק JSON
// ---------------------------------------------------------------------------
export function JsonValidator() {
  const [raw, setRaw] = useState('{"לקוח":"דוד","הזמנה":{"מדבקות":100,"מחיר":120}}');

  const result = useMemo(() => {
    const text = raw.trim();
    if (!text) return { state: "empty" };
    try {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      const count = (obj) => {
        let keys = 0;
        const walk = (v) => {
          if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === "object") {
            keys += Object.keys(v).length;
            Object.values(v).forEach(walk);
          }
        };
        walk(obj);
        return keys;
      };
      return {
        state: "valid",
        pretty,
        keys: count(parsed),
        type: Array.isArray(parsed) ? "מערך" : typeof parsed === "object" && parsed ? "אובייקט" : typeof parsed,
        size: new Blob ? text.length : text.length,
      };
    } catch (e) {
      // Pull the character offset out of the engine message to point at the
      // failing line, which is the part that actually helps.
      const m = /position (\d+)/.exec(e.message);
      let where = "";
      if (m) {
        const pos = Number(m[1]);
        const line = raw.slice(0, pos).split("\n").length;
        where = ` (שורה ${line})`;
      }
      return { state: "invalid", error: e.message + where };
    }
  }, [raw]);

  const format = async () => {
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
// D. שעון זמני היום
// ---------------------------------------------------------------------------
export function ZmanimCard() {
  const z = useMemo(() => computeZmanim(new Date(), JERUSALEM), []);
  const rows = [
    { label: "עלות השחר", value: z.dawn, emoji: "🌌" },
    { label: "נץ החמה (זריחה)", value: z.sunrise, emoji: "🌄" },
    { label: "סוף זמן ק״ש", value: z.shemaEnd, emoji: "📖" },
    { label: "סוף זמן תפילה", value: z.tefillaEnd, emoji: "🙏" },
    { label: "חצות היום", value: z.midday, emoji: "☀️" },
    { label: "מנחה גדולה", value: z.minchaGedola, emoji: "🕊️" },
    { label: "פלג המנחה", value: z.plag, emoji: "🌤️" },
    { label: "הדלקת נרות", value: z.candles, emoji: "🕯️", gold: true },
    { label: "שקיעה", value: z.sunset, emoji: "🌇", gold: true },
    { label: "צאת הכוכבים", value: z.nightfall, emoji: "🌃" },
  ];

  return (
    <View style={{ gap: 10 }}>
      <View style={s.zHead}>
        <Text style={s.zPlace}>📍 {z.place.name}</Text>
        <Text style={s.zDate}>{fmtDate(z.date)}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={[s.zRow, r.gold && { backgroundColor: GOLD + "14" }]}>
          <Text style={[s.zTime, r.gold && { color: "#8A6D14" }]}>{fmtTime(r.value)}</Text>
          <Text style={s.zLabel}>{r.emoji} {r.label}</Text>
        </View>
      ))}
      <Text style={s.hint}>
        שעה זמנית: {z.temporalHourMinutes} דקות · אורך היום: {Math.floor((z.dayLengthMinutes || 0) / 60)} שעות{" "}
        {(z.dayLengthMinutes || 0) % 60} דקות
      </Text>
      <Text style={s.hint}>
        החישוב מתבצע במכשיר לפי מיקום השמש בירושלים. הדלקת נרות לפי מנהג ירושלים (40 דק׳ לפני השקיעה).
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// E. מחולל ברקודים/QR
// ---------------------------------------------------------------------------
// A deterministic module matrix with real QR finder patterns. It is NOT a
// scannable code — encoding that needs Reed-Solomon and a QR library, which we
// deliberately don't bundle. Labeled as a preview so nobody tries to scan it.
const QR_SIZE = 25;

function buildMatrix(text) {
  const grid = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));

  // Three 7×7 finder patterns (top-left, top-right, bottom-left).
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

  // Timing lines.
  for (let i = 8; i < QR_SIZE - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Data area filled from a rolling hash of the text.
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
  "a5-margins": A5MarginCalc,
  "scooter-range": ScooterRange,
  "json-validator": JsonValidator,
  zmanim: ZmanimCard,
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
  stat: { flex: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  statValue: { fontFamily: FONTS.bold, fontSize: 18 },
  statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2, textAlign: "center" },

  segment: { flexDirection: "row", backgroundColor: CARD, borderRadius: 14, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: BLUE },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },

  sheetPreview: { alignItems: "center", marginTop: 4 },
  sheet: {
    width: A5_W,
    height: A5_H,
    backgroundColor: WHITE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DFE3E8",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetRow: { flexDirection: "row", justifyContent: "center" },
  sheetCell: { backgroundColor: BLUE + "40", borderRadius: 2 },

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

  zHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  zPlace: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
  zDate: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED },
  zRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  zLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  zTime: { fontFamily: FONTS.bold, fontSize: 15, color: INK },

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
