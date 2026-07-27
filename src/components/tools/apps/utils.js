import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import Slider from "../Slider";
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
  NO_OUTLINE,
  RED,
  Segment,
  Stat,
  WHITE,
  s,
  Field,
  Chips,
  useCalcHaptic,
} from "../kit";

// General-purpose utilities.

// ---------------------------------------------------------------------------
// A. טיימר פומודורו
// ---------------------------------------------------------------------------

export function TextAnalyzer() {
  const [text, setText] = useState("");

  const r = useMemo(() => {
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, "").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.trim() ? (text.match(/[.!?׃]+(\s|$)/g) || []).length || 1 : 0;
    const paragraphs = text.trim() ? text.split(/\n{2,}/).filter((p) => p.trim()).length : 0;
    const lines = text ? text.split("\n").length : 0;
    // ~200 words a minute is the usual silent-reading figure for prose.
    const readSeconds = Math.round((words / 200) * 60);
    return { chars, charsNoSpace, words, sentences, paragraphs, lines, readSeconds };
  }, [text]);

  const readLabel =
    r.readSeconds === 0
      ? "—"
      : r.readSeconds < 60
        ? `${r.readSeconds} שנ׳`
        : `${Math.round(r.readSeconds / 60)} דק׳`;

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        style={t.area}
        value={text}
        onChangeText={setText}
        placeholder="הדבק או הקלד טקסט — הספירה מתעדכנת תוך כדי כתיבה"
        placeholderTextColor={INK_MUTED}
        multiline
        textAlign="right"
        textAlignVertical="top"
      />

      <View style={s.statRow}>
        <Stat label="מילים" value={r.words} color={BLUE} big />
        <Stat label="תווים" value={r.chars} />
        <Stat label="ללא רווחים" value={r.charsNoSpace} />
      </View>
      <View style={s.statRow}>
        <Stat label="משפטים" value={r.sentences} />
        <Stat label="פסקאות" value={r.paragraphs} />
        <Stat label="שורות" value={r.lines} />
        <Stat label="זמן קריאה" value={readLabel} color={GOLD} />
      </View>

      {!!text && (
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: CARD }]}
          onPress={() => { hapticWarning(); setText(""); }}
          activeOpacity={0.85}
        >
          <BtnLabel icon="x" text="נקה" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. פערי אחוזים
// ---------------------------------------------------------------------------

export function PercentDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const r = useMemo(() => {
    const from = parseFloat(a);
    const to = parseFloat(b);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return { ready: false };
    const delta = to - from;
    const round2 = (n) => Math.round(n * 100) / 100;
    // Percentage change is undefined against a zero base — say so rather than
    // rendering Infinity.
    const change = from === 0 ? null : (delta / Math.abs(from)) * 100;
    // The symmetric measure, which is what "percentage difference" means in
    // statistics: the gap over the mean of the two values.
    const mean = (Math.abs(from) + Math.abs(to)) / 2;
    const symmetric = mean === 0 ? null : (Math.abs(delta) / mean) * 100;
    return {
      ready: true,
      delta: round2(delta),
      change: change === null ? null : round2(change),
      symmetric: symmetric === null ? null : round2(symmetric),
      ratio: from === 0 ? null : round2(to / from),
      up: delta > 0,
      flat: delta === 0,
    };
  }, [a, b]);

  const tone = r.flat ? INK_SOFT : r.up ? GREEN : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>ערך א׳ (לפני)</Text>
          <View style={s.fieldRow}>
            <TextInput
              testID="pct-a"
              style={s.fieldInput}
              value={a}
              onChangeText={setA}
              placeholder="100"
              placeholderTextColor={INK_MUTED}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>ערך ב׳ (אחרי)</Text>
          <View style={s.fieldRow}>
            <TextInput
              testID="pct-b"
              style={s.fieldInput}
              value={b}
              onChangeText={setB}
              placeholder="125"
              placeholderTextColor={INK_MUTED}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>
      </View>

      {!r.ready ? (
        <Text style={s.hint}>הזן שני ערכים כדי לראות את הפער באחוזים.</Text>
      ) : (
        <>
          <View style={[t.verdict, { backgroundColor: tone + "12" }]}>
            <Icon
              name={r.flat ? "minus" : r.up ? "trending-up" : "trending-down"}
              size={22}
              color={tone}
            />
            <Text testID="pct-result" style={[t.verdictValue, { color: tone }]}>
              {r.change === null ? "—" : `${r.change > 0 ? "+" : ""}${r.change}%`}
            </Text>
            <Text style={t.verdictLabel}>
              {r.flat ? "אין שינוי" : r.up ? "עלייה מערך א׳ לערך ב׳" : "ירידה מערך א׳ לערך ב׳"}
            </Text>
          </View>

          <View style={s.statRow}>
            <Stat label="הפרש מוחלט" value={r.delta} color={tone} />
            <Stat label="פער סימטרי" value={r.symmetric === null ? "—" : `${r.symmetric}%`} />
            <Stat label="יחס ב׳/א׳" value={r.ratio === null ? "—" : `×${r.ratio}`} />
          </View>

          {r.change === null && (
            <Text style={s.hint}>
              אחוז שינוי לא מוגדר כשערך א׳ הוא 0 — אין בסיס להשוות אליו. הפער הסימטרי כן מחושב.
            </Text>
          )}
          <Text style={s.hint}>
            אחוז השינוי מחושב מול ערך א׳. הפער הסימטרי מחלק את ההפרש בממוצע השניים — מדד שלא משתנה אם
            מחליפים בין א׳ ל-ב׳, ולכן מתאים להשוואת שני מחירים ללא כיוון.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// D. בוחר אקראי
// ---------------------------------------------------------------------------

export function DecisionPicker() {
  const [raw, setRaw] = useState("");
  const [winner, setWinner] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState([]);
  const timers = useRef([]);

  const options = useMemo(
    () => raw.split(/[,\n]/).map((o) => o.trim()).filter(Boolean),
    [raw]
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pick = () => {
    if (options.length < 2) {
      hapticWarning();
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpinning(true);

    // Cycle through candidates before settling, so the pick reads as a draw
    // rather than a value appearing out of nowhere.
    const steps = 12;
    for (let i = 0; i < steps; i += 1) {
      timers.current.push(
        setTimeout(() => {
          setWinner(options[Math.floor(Math.random() * options.length)]);
          hapticLight();
        }, i * 70)
      );
    }
    timers.current.push(
      setTimeout(() => {
        const chosen = options[Math.floor(Math.random() * options.length)];
        setWinner(chosen);
        setHistory((h) => [chosen, ...h].slice(0, 5));
        setSpinning(false);
        hapticSuccess();
      }, steps * 70 + 120)
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>אפשרויות — מופרדות בפסיק או בשורה חדשה</Text>
        <TextInput
          style={t.area}
          value={raw}
          onChangeText={setRaw}
          placeholder="פיצה, שווארמה, פלאפל"
          placeholderTextColor={INK_MUTED}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      {options.length > 0 && (
        <View style={s.chipRow}>
          {options.map((o, i) => {
            const isWinner = winner === o;
            return (
              <View
                key={`${o}-${i}`}
                style={[
                  s.chip,
                  isWinner && { backgroundColor: BLUE, borderColor: BLUE },
                ]}
              >
                <Text style={[s.chipText, isWinner && { color: WHITE }]}>{o}</Text>
              </View>
            );
          })}
        </View>
      )}

      {winner && (
        <View style={[t.verdict, { backgroundColor: BLUE + "12" }]}>
          <Icon name={spinning ? "shuffle" : "check-circle"} size={22} color={BLUE} />
          <Text style={[t.verdictValue, { color: BLUE }]} numberOfLines={2}>{winner}</Text>
          <Text style={t.verdictLabel}>{spinning ? "מגריל..." : "זו ההחלטה"}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.bigBtn, options.length < 2 && { backgroundColor: INK_MUTED }]}
        onPress={pick}
        activeOpacity={0.85}
        disabled={options.length < 2 || spinning}
      >
        <BtnLabel
          icon="shuffle"
          text={options.length < 2 ? "הזן לפחות שתי אפשרויות" : "הגרל"}
          style={s.bigBtnText}
        />
      </TouchableOpacity>

      {history.length > 0 && (
        <>
          <Text style={s.sectionLabel}>הגרלות אחרונות</Text>
          {history.map((h, i) => (
            <View key={`${h}-${i}`} style={s.routineRow}>
              <Text style={s.routineTime}>{i + 1}</Text>
              <Text style={s.routineLabel}>{h}</Text>
            </View>
          ))}
        </>
      )}

      <Text style={s.hint}>
        הבחירה אחידה — לכל אפשרות אותו סיכוי בכל הגרלה, ללא זיכרון של הגרלות קודמות.
      </Text>
    </View>
  );
}

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
    ...NO_OUTLINE,
  },

  verdict: { borderRadius: 24, paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 6 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 30, textAlign: "center" },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, textAlign: "center" },
});

// ---------------------------------------------------------------------------
// E. ממיר שעות עולמי
// ---------------------------------------------------------------------------

// IANA zone ids, not fixed offsets. "EST" and "GMT" are only correct for part
// of the year — New York is on EDT from March to November and London on BST —
// so the zone is stored and the live abbreviation is read back from the
// platform rather than hardcoded.

function toWaNumber(raw, countryCode) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  if (digits.startsWith("0")) return countryCode + digits.slice(1);
  return countryCode + digits;
}

const COUNTRIES = [
  { key: "972", label: "ישראל +972" },
  { key: "1", label: "ארה״ב +1" },
  { key: "44", label: "בריטניה +44" },
];

export function WhatsAppDirect() {
  const [raw, setRaw] = useState("");
  const [country, setCountry] = useState("972");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const number = toWaNumber(raw, country);
  const url = number
    ? `https://wa.me/${number}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}`
    : null;

  const openChat = async () => {
    if (!url) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    setFailed(false);
    try {
      await Linking.openURL(url);
    } catch {
      setFailed(true);
    }
  };

  const copyLink = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    hapticLight();
  };

  return (
    <View style={{ gap: 12 }}>
      <Segment options={COUNTRIES} value={country} onChange={(v) => { hapticLight(); setCountry(v); }} />

      <View>
        <Text style={s.fieldLabel}>מספר טלפון</Text>
        <View style={s.fieldRow}>
          <TextInput
            testID="wa-number"
            style={s.fieldInput}
            value={raw}
            onChangeText={(v) => { setRaw(v); setFailed(false); }}
            placeholder="050-1234567"
            placeholderTextColor={INK_MUTED}
            keyboardType="phone-pad"
            textAlign="center"
          />
        </View>
      </View>

      <View>
        <Text style={s.fieldLabel}>הודעה פותחת (לא חובה)</Text>
        <TextInput
          testID="wa-message"
          style={t.area}
          value={message}
          onChangeText={setMessage}
          placeholder="היי, אפשר לקבל פרטים?"
          placeholderTextColor={INK_MUTED}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      {number ? (
        <View style={[s.banner, { backgroundColor: CARD }]}>
          <Text testID="wa-resolved" style={[s.bannerText, { color: INK, textAlign: "left" }]}>+{number}</Text>
          <Text style={[s.bannerSub, { color: INK_MUTED, textAlign: "left" }]}>{url}</Text>
        </View>
      ) : (
        !!raw && <Text style={[s.hint, { color: RED }]}>המספר לא תקין — נדרשות ספרות בלבד.</Text>
      )}

      <TouchableOpacity
        style={[s.bigBtn, { backgroundColor: number ? "#25D366" : INK_MUTED }]}
        onPress={openChat}
        activeOpacity={0.85}
        disabled={!number}
      >
        <BtnLabel icon="message-circle" text="פתח צ׳אט בוואטסאפ" style={s.bigBtnText} />
      </TouchableOpacity>

      <TouchableOpacity style={[s.bigBtn, { backgroundColor: CARD }]} onPress={copyLink} activeOpacity={0.85}>
        <BtnLabel icon="copy" text="העתק את הקישור" color={INK_SOFT} style={[s.bigBtnText, { color: INK_SOFT }]} />
      </TouchableOpacity>

      {failed && (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>לא הצלחנו לפתוח את וואטסאפ</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            ייתכן שהאפליקציה לא מותקנת. אפשר להעתיק את הקישור ולפתוח אותו בדפדפן.
          </Text>
        </View>
      )}

      <Text style={s.hint}>
        הקישור נפתח ישירות בשיחה בלי להוסיף את המספר לאנשי הקשר. אפס מוביל מוחלף בקידומת המדינה — 
        050-1234567 הופך ל-972501234567.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// G. ממיר נפח דיגיטלי
// ---------------------------------------------------------------------------

// Binary units. Storage vendors sell in powers of ten (a "1TB" drive is 10^12
// bytes) while operating systems report powers of two, which is the whole
// reason a new drive looks smaller than the box promised.

const SIZE_UNITS = [
  { key: "KB", label: "KB", pow: 1 },
  { key: "MB", label: "MB", pow: 2 },
  { key: "GB", label: "GB", pow: 3 },
  { key: "TB", label: "TB", pow: 4 },
];

export function StorageConverter() {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("GB");
  const [to, setTo] = useState("MB");

  const r = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n)) return { ready: false };
    const f = SIZE_UNITS.find((u) => u.key === from);
    const tUnit = SIZE_UNITS.find((u) => u.key === to);
    const bytes = n * 1024 ** f.pow;
    const converted = bytes / 1024 ** tUnit.pow;
    const decimalBytes = n * 1000 ** f.pow;
    const trim = (x) =>
      Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000);
    return {
      ready: true,
      converted: trim(converted),
      bytes,
      all: SIZE_UNITS.map((u) => ({ key: u.key, value: trim(bytes / 1024 ** u.pow) })),
      // How much smaller the same number looks once the OS counts in binary.
      decimalGap: Math.round((1 - bytes / decimalBytes) * 1000) / 10,
    };
  }, [amount, from, to]);

  useCalcHaptic(r.ready ? parseFloat(r.converted) : 0);

  const swap = () => {
    hapticLight();
    setFrom(to);
    setTo(from);
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>כמות</Text>
        <View style={s.fieldRow}>
          <TextInput
            testID="storage-amount"
            style={s.fieldInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="1.5"
            placeholderTextColor={INK_MUTED}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
      </View>

      <Text style={s.fieldLabel}>מיחידה</Text>
      <Segment options={SIZE_UNITS} value={from} onChange={(v) => { hapticLight(); setFrom(v); }} />
      <Text style={s.fieldLabel}>ליחידה</Text>
      <Segment options={SIZE_UNITS} value={to} onChange={(v) => { hapticLight(); setTo(v); }} />

      <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={swap} activeOpacity={0.85}>
        <BtnLabel icon="repeat" text="החלף כיוון" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
      </TouchableOpacity>

      {!r.ready ? (
        <Text style={s.hint}>הזן כמות כדי להמיר.</Text>
      ) : (
        <>
          <View style={[t.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="storage-result" style={[t.verdictValue, { color: BLUE }]}>{r.converted}</Text>
            <Text style={t.verdictLabel}>{to}</Text>
          </View>

          {r.all.map((u) => (
            <View key={u.key} style={s.routineRow}>
              <Text style={[s.routineTime, u.key === to && { color: BLUE }]}>{u.value}</Text>
              <Text style={[s.routineLabel, { flex: 1 }]}>{u.key}</Text>
            </View>
          ))}

          <Text style={s.hint}>
            ההמרה בינארית (1024). יצרני הדיסקים סופרים באלפים, ולכן כונן שנמכר כ-1TB מוצג במערכת
            ההפעלה כ-{r.decimalGap}% פחות — זה ההסבר לפער ולא תקלה.
          </Text>
        </>
      )}
    </View>
  );
}


// ---------------------------------------------------------------------------
// F. מחולל סיסמאות
// ---------------------------------------------------------------------------

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
// l, I, 1, O and 0 are left out on purpose: a password you cannot read back
// off a screen is a password you will type wrong.
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

// crypto.getRandomValues where available. Math.random is seeded from the clock
// and is not safe for anything you would call a password.
function secureIndex(max) {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    // Reject the tail of the range, otherwise the modulo skews the first few
    // characters of the alphabet toward being more likely.
    const limit = Math.floor(0xffffffff / max) * max;
    let v;
    do {
      c.getRandomValues(buf);
      [v] = buf;
    } while (v >= limit);
    return v % max;
  }
  return Math.floor(Math.random() * max);
}

export function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const alphabet =
    LOWER + (useUpper ? UPPER : "") + (useDigits ? DIGITS : "") + (useSymbols ? SYMBOLS : "");

  const roll = () => {
    let out = "";
    for (let i = 0; i < length; i += 1) out += alphabet[secureIndex(alphabet.length)];
    setPassword(out);
    setCopied(false);
  };

  // Regenerate whenever the recipe changes, so what is shown always matches
  // the settings above it.
  useEffect(roll, [length, useDigits, useSymbols, useUpper]);

  const copy = async () => {
    if (!password) return;
    await Clipboard.setStringAsync(password);
    hapticSuccess();
    setCopied(true);
  };

  // Entropy in bits: length x log2(alphabet). Under 60 is weak; over 100 is
  // beyond anything worth brute-forcing.
  const bits = Math.round(length * (Math.log(alphabet.length) / Math.log(2)));
  const strength = bits >= 100 ? "חזקה מאוד" : bits >= 75 ? "חזקה" : bits >= 60 ? "סבירה" : "חלשה";
  const tone = bits >= 75 ? GREEN : bits >= 60 ? GOLD : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={pw.box}>
        <Text testID="pw-value" style={pw.value} selectable>{password}</Text>
      </View>

      <View style={s.statRow}>
        <Stat label="אורך" value={length} color={BLUE} />
        <Stat label="ביטים של אנטרופיה" value={bits} color={tone} />
        <Stat label="חוזק" value={strength} color={tone} />
      </View>

      <Slider label="אורך הסיסמה" value={length} min={8} max={32} step={1} onChange={setLength} />

      {[
        { label: "אותיות גדולות", on: useUpper, set: setUseUpper },
        { label: "ספרות", on: useDigits, set: setUseDigits },
        { label: "תווים מיוחדים", on: useSymbols, set: setUseSymbols },
      ].map((opt) => (
        <TouchableOpacity
          key={opt.label}
          style={s.checkRow}
          onPress={() => { hapticLight(); opt.set((v) => !v); }}
          activeOpacity={0.75}
        >
          <View style={[s.checkbox, opt.on && { backgroundColor: BLUE, borderColor: BLUE }]}>
            {opt.on && <Icon name="check" size={13} color={WHITE} />}
          </View>
          <Text style={s.checkLabel}>{opt.label}</Text>
        </TouchableOpacity>
      ))}

      <View style={s.row}>
        <TouchableOpacity style={s.actionBtn} onPress={() => { hapticSuccess(); roll(); }} activeOpacity={0.85}>
          <BtnLabel icon="refresh-cw" text="סיסמה חדשה" style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, copied ? { backgroundColor: GREEN } : { backgroundColor: CARD }]}
          onPress={copy}
          activeOpacity={0.85}
        >
          <BtnLabel
            icon={copied ? "check" : "copy"}
            text={copied ? "הועתק" : "העתק"}
            color={copied ? WHITE : INK_SOFT}
            style={[s.actionText, !copied && { color: INK_SOFT }]}
          />
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>
        התווים נבחרים מ-crypto.getRandomValues ולא מ-Math.random, שנגזר משעון המערכת. תווים שקל
        להתבלבל ביניהם — l, I, 1, O, 0 — הוצאו מהמאגר כדי שאפשר יהיה להקליד את הסיסמה מהמסך.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// G. מערבל אותיות
// ---------------------------------------------------------------------------

// Fisher-Yates. The naive sort(() => Math.random() - 0.5) is not a uniform
// shuffle and leaves letters near where they started.
function shuffle(chars) {
  const a = [...chars];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keeping the first and last letter is the classic readable scramble: the word
// stays recognisable while the middle is jumbled.
function scrambleWord(word, keepEnds) {
  if (word.length < (keepEnds ? 4 : 2)) return word;
  if (!keepEnds) return shuffle([...word]).join("");
  const middle = shuffle([...word.slice(1, -1)]).join("");
  return word[0] + middle + word[word.length - 1];
}

export function WordScrambler() {
  const [text, setText] = useState("");
  const [keepEnds, setKeepEnds] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const out = useMemo(() => {
    void nonce;
    return text.replace(/\S+/g, (word) => scrambleWord(word, keepEnds));
  }, [text, keepEnds, nonce]);

  const copy = async () => {
    if (!out) return;
    await Clipboard.setStringAsync(out);
    hapticSuccess();
    setCopied(true);
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>טקסט</Text>
        <TextInput
          testID="scramble-input"
          style={t.area}
          value={text}
          onChangeText={(v) => { setText(v); setCopied(false); }}
          placeholder="כתוב כאן משפט והאותיות יתערבבו"
          placeholderTextColor={INK_MUTED}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={s.checkRow}
        onPress={() => { hapticLight(); setKeepEnds((v) => !v); setCopied(false); }}
        activeOpacity={0.75}
      >
        <View style={[s.checkbox, keepEnds && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {keepEnds && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>שמור על האות הראשונה והאחרונה</Text>
      </TouchableOpacity>

      {!!out && (
        <View style={[t.verdict, { backgroundColor: CARD, paddingHorizontal: 16 }]}>
          <Text testID="scramble-output" style={sc.output}>{out}</Text>
        </View>
      )}

      <View style={s.row}>
        <TouchableOpacity
          style={[s.actionBtn, !text.trim() && { backgroundColor: INK_MUTED }]}
          onPress={() => { hapticLight(); setNonce((n) => n + 1); setCopied(false); }}
          activeOpacity={0.85}
          disabled={!text.trim()}
        >
          <BtnLabel icon="shuffle" text="ערבב שוב" style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, copied ? { backgroundColor: GREEN } : { backgroundColor: CARD }]}
          onPress={copy}
          activeOpacity={0.85}
        >
          <BtnLabel
            icon={copied ? "check" : "copy"}
            text={copied ? "הועתק" : "העתק"}
            color={copied ? WHITE : INK_SOFT}
            style={[s.actionText, !copied && { color: INK_SOFT }]}
          />
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>
        הערבוב הוא Fisher-Yates. מיון עם השוואה אקראית נראה דומה אבל אינו אחיד ומשאיר אותיות קרוב
        למקום המקורי. עם שמירת הקצוות המילה נשארת קריאה למרות הבלגן באמצע.
      </Text>
    </View>
  );
}

const pw = StyleSheet.create({
  box: {
    backgroundColor: "#0E1729",
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 92,
  },
  value: { fontFamily: "monospace", fontSize: 18, color: "#D7E3F4", textAlign: "center", letterSpacing: 1 },
});

const sc = StyleSheet.create({
  output: { fontFamily: FONTS.medium, fontSize: 15, color: INK, textAlign: "right", lineHeight: 24 },
});
