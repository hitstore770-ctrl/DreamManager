import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import QRCode from "react-native-qrcode-svg";

import Icon from "../../Icon";
import Slider from "../Slider";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { CARD_SHADOW } from "../../../utils/ui";
import { hapticLight, hapticSuccess, hapticWarning } from "../../../utils/haptics";
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
} from "../kit";

// Developer tools.

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
        <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הועתק" : "העתק את הסגנון"} style={s.actionText} />
      </TouchableOpacity>
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
              JSON תקין · {result.type} · {result.keys} מפתחות · {result.size} תווים
            </Text>
          </View>
          <View style={s.row}>
            <TouchableOpacity style={s.actionBtn} onPress={format} activeOpacity={0.85}>
              <BtnLabel icon="align-left" text="עצב מחדש" style={s.actionText} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={copy} activeOpacity={0.85}>
              <BtnLabel icon="copy" text="העתק" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
            </TouchableOpacity>
          </View>
        </>
      )}
      {result.state === "invalid" && (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>JSON לא תקין</Text>
          <Text style={[s.bannerSub, { color: RED }]}>{result.error}</Text>
        </View>
      )}
      {result.state === "empty" && <Text style={s.hint}>הדבק טקסט JSON כדי לבדוק ולעצב אותו.</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// מחולל QR — a real, scannable code via react-native-qrcode-svg
// ---------------------------------------------------------------------------

// Error-correction level trades capacity for damage tolerance. L holds the
// most data; H still scans with about 30% of the code obscured, which is what
// you want on a sticker stuck to a machine.
const QR_LEVELS = [
  { key: "L", label: "L · 7%" },
  { key: "M", label: "M · 15%" },
  { key: "Q", label: "Q · 25%" },
  { key: "H", label: "H · 30%" },
];

const QR_PRESETS = [
  { label: "אתר", value: "https://770jlm.co.il" },
  { label: "וואטסאפ", value: "https://wa.me/972500000000" },
  { label: "וויפי", value: "WIFI:T:WPA;S:NETWORK;P:PASSWORD;;" },
  { label: "טלפון", value: "tel:+972500000000" },
];

export function QrGenerator() {
  const [text, setText] = useState("https://770jlm.co.il");
  const [level, setLevel] = useState("M");
  const [copied, setCopied] = useState(false);

  const value = text.trim();

  const copy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    hapticSuccess();
    setCopied(true);
  };

  const share = async () => {
    if (!value) return;
    hapticLight();
    try {
      await Share.share({ message: value });
    } catch {
      /* the user dismissed the sheet */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={qr.stage}>
        {value ? (
          <View testID="qr-canvas" style={qr.quiet}>
            <QRCode
              value={value}
              size={196}
              color={INK}
              backgroundColor={WHITE}
              ecl={level}
            />
          </View>
        ) : (
          <View style={[qr.quiet, qr.empty]}>
            <Icon name="grid" size={34} color={INK_MUTED} />
            <Text style={qr.emptyText}>הזן טקסט או כתובת</Text>
          </View>
        )}
      </View>

      <View>
        <Text style={s.fieldLabel}>תוכן הקוד</Text>
        <TextInput
          testID="qr-input"
          style={qr.input}
          value={text}
          onChangeText={(v) => { setText(v); setCopied(false); }}
          placeholder="https://example.com"
          placeholderTextColor={INK_MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          textAlign="left"
          textAlignVertical="top"
        />
      </View>

      <View style={s.chipRow}>
        {QR_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={s.chip}
            onPress={() => { hapticLight(); setText(preset.value); setCopied(false); }}
            activeOpacity={0.8}
          >
            <Text style={s.chipText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>רמת תיקון שגיאות</Text>
      <Segment options={QR_LEVELS} value={level} onChange={(v) => { hapticLight(); setLevel(v); }} />

      <View style={s.row}>
        <TouchableOpacity
          style={[s.actionBtn, copied && { backgroundColor: GREEN }]}
          onPress={copy}
          activeOpacity={0.85}
        >
          <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הועתק" : "העתק תוכן"} style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={share} activeOpacity={0.85}>
          <BtnLabel icon="share-2" text="שתף" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="תווים" value={value.length} color={BLUE} />
        <Stat label="רמת תיקון" value={level} />
      </View>

      <Text style={s.hint}>
        הקוד אמיתי וניתן לסריקה. רמה גבוהה יותר שורדת יותר נזק והתלכלכות אבל דורשת יותר מודולים, לכן
        לקוד שמודבק על מכונה עדיף H ולקישור ארוך עדיף L.
      </Text>
    </View>
  );
}

const qr = StyleSheet.create({
  stage: { alignItems: "center", paddingVertical: 4 },
  // A quiet zone of at least four modules is part of the spec — without the
  // white margin many scanners simply will not lock on.
  quiet: { backgroundColor: WHITE, padding: 18, borderRadius: 24, ...CARD_SHADOW },
  empty: { width: 232, height: 232, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: CARD },
  emptyText: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_MUTED },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
    fontFamily: "monospace",
    fontSize: 13,
    color: INK,
    lineHeight: 20,
    ...NO_OUTLINE,
  },
});
// ---------------------------------------------------------------------------
// D. מחולל UUID
// ---------------------------------------------------------------------------

const HEX = "0123456789abcdef";

// RFC 4122 version 4: 122 random bits, with the version nibble pinned to 4 and
// the variant bits to 10xx. crypto.getRandomValues where the platform has it,
// Math.random only as a fallback — the ids are for local records, not secrets,
// but there is no reason to weaken them where a CSPRNG is sitting right there.
function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function uuidV4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push(HEX[b[i] >> 4], HEX[b[i] & 0x0f]);
  }
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function UuidGenerator() {
  const [ids, setIds] = useState(() => [uuidV4()]);
  const [upper, setUpper] = useState(false);
  const [braces, setBraces] = useState(false);
  const [copied, setCopied] = useState(null);

  const shape = (id) => {
    const cased = upper ? id.toUpperCase() : id;
    return braces ? `{${cased}}` : cased;
  };

  const generate = (count) => {
    hapticSuccess();
    setIds(Array.from({ length: count }, uuidV4));
    setCopied(null);
  };

  const copy = async (value, key) => {
    await Clipboard.setStringAsync(value);
    hapticLight();
    setCopied(key);
  };

  return (
    <View style={{ gap: 12 }}>
      {ids.map((id, i) => (
        <TouchableOpacity
          key={id}
          style={d.idRow}
          onPress={() => copy(shape(id), id)}
          activeOpacity={0.8}
        >
          <Icon name={copied === id ? "check" : "copy"} size={16} color={copied === id ? GREEN : INK_MUTED} />
          <Text style={d.idText} selectable numberOfLines={1}>{shape(id)}</Text>
          {ids.length > 1 && <Text style={d.idIndex}>{i + 1}</Text>}
        </TouchableOpacity>
      ))}

      <View style={s.row}>
        <TouchableOpacity style={s.actionBtn} onPress={() => generate(1)} activeOpacity={0.85}>
          <BtnLabel icon="refresh-cw" text="מזהה חדש" style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={() => generate(10)} activeOpacity={0.85}>
          <BtnLabel icon="layers" text="10 בבת אחת" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.bigBtn, { backgroundColor: CARD }, copied === "all" && { backgroundColor: GREEN }]}
        onPress={() => copy(ids.map(shape).join("\n"), "all")}
        activeOpacity={0.85}
      >
        <BtnLabel
          icon={copied === "all" ? "check" : "copy"}
          text={copied === "all" ? "הכול הועתק" : `העתק הכול (${ids.length})`}
          color={copied === "all" ? WHITE : INK_SOFT}
          style={[s.bigBtnText, copied !== "all" && { color: INK_SOFT }]}
        />
      </TouchableOpacity>

      <TouchableOpacity style={s.checkRow} onPress={() => { hapticLight(); setUpper((v) => !v); }} activeOpacity={0.75}>
        <View style={[s.checkbox, upper && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {upper && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>אותיות גדולות</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.checkRow} onPress={() => { hapticLight(); setBraces((v) => !v); }} activeOpacity={0.75}>
        <View style={[s.checkbox, braces && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {braces && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>עטוף בסוגריים מסולסלים</Text>
      </TouchableOpacity>

      <Text style={s.hint}>
        UUID v4 לפי RFC 4122 — 122 ביט אקראיים. נוצר מ-crypto.getRandomValues כשהוא זמין, אחרת מ-Math.random.
        לחיצה על מזהה מעתיקה אותו.
      </Text>
    </View>
  );
}

const d = StyleSheet.create({
  idRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 12, minHeight: 52 },
  idText: { flex: 1, fontFamily: "monospace", fontSize: 12.5, color: INK, textAlign: "left" },
  idIndex: { fontFamily: FONTS.bold, fontSize: 11, color: INK_MUTED },

  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nameOut: { fontFamily: "monospace", fontSize: 13, color: BLUE },
});

// ---------------------------------------------------------------------------
// G. בודק Regex
// ---------------------------------------------------------------------------

const REGEX_FLAGS = [
  { key: "g", label: "g" },
  { key: "i", label: "i" },
  { key: "m", label: "m" },
];

const REGEX_SAMPLES = [
  { label: "אימייל", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+" },
  { label: "טלפון", pattern: "0\\d{1,2}-?\\d{7}" },
  { label: "מספר", pattern: "\\d+(\\.\\d+)?" },
  { label: "ת.ז.", pattern: "\\d{9}" },
];

export function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState({ g: true, i: false, m: false });
  const [subject, setSubject] = useState("");

  const flagString = Object.keys(flags).filter((f) => flags[f]).join("");

  const r = useMemo(() => {
    if (!pattern) return { state: "empty" };
    let re;
    try {
      re = new RegExp(pattern, flagString);
    } catch (e) {
      // An incomplete pattern is the normal state while typing, so this is a
      // message, not an error condition.
      return { state: "invalid", error: e.message };
    }
    if (!subject) return { state: "ready", re };

    const matches = [];
    if (flags.g) {
      let guard = 0;
      let m;
      // A zero-length match never advances lastIndex on its own; without this
      // nudge the loop spins forever on a pattern like "a*".
      while ((m = re.exec(subject)) !== null && guard < 500) {
        matches.push({ text: m[0], index: m.index, groups: m.slice(1) });
        if (m[0] === "") re.lastIndex += 1;
        guard += 1;
      }
    } else {
      const m = re.exec(subject);
      if (m) matches.push({ text: m[0], index: m.index, groups: m.slice(1) });
    }

    // Split the subject into plain and matched runs for highlighting.
    const segments = [];
    let cursor = 0;
    matches.forEach((m) => {
      if (m.index > cursor) segments.push({ text: subject.slice(cursor, m.index), hit: false });
      if (m.text) segments.push({ text: m.text, hit: true });
      cursor = m.index + m.text.length;
    });
    if (cursor < subject.length) segments.push({ text: subject.slice(cursor), hit: false });

    return { state: "done", matches, segments };
  }, [pattern, flagString, subject, flags.g]);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>תבנית</Text>
        <View style={s.fieldRow}>
          <Text style={rx.slash}>/{flagString}</Text>
          <TextInput
            testID="regex-pattern"
            style={[s.fieldInput, { fontFamily: "monospace", fontSize: 14 }]}
            value={pattern}
            onChangeText={setPattern}
            placeholder="\d+"
            placeholderTextColor={INK_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="left"
          />
          <Text style={rx.slash}>/</Text>
        </View>
      </View>

      <View style={s.chipRow}>
        {REGEX_FLAGS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, flags[f.key] && { backgroundColor: BLUE, borderColor: BLUE }]}
            onPress={() => { hapticLight(); setFlags((prev) => ({ ...prev, [f.key]: !prev[f.key] })); }}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, flags[f.key] && { color: WHITE }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        {REGEX_SAMPLES.map((sample) => (
          <TouchableOpacity
            key={sample.label}
            style={s.chip}
            onPress={() => { hapticLight(); setPattern(sample.pattern); }}
            activeOpacity={0.8}
          >
            <Text style={s.chipText}>{sample.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text style={s.fieldLabel}>טקסט לבדיקה</Text>
        <TextInput
          testID="regex-subject"
          style={rx.area}
          value={subject}
          onChangeText={setSubject}
          placeholder="הדבק כאן את הטקסט שרוצים לבדוק"
          placeholderTextColor={INK_MUTED}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="left"
          textAlignVertical="top"
        />
      </View>

      {r.state === "invalid" && (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>התבנית לא תקינה</Text>
          <Text style={[s.bannerSub, { color: RED }]}>{r.error}</Text>
        </View>
      )}

      {r.state === "done" && (
        <>
          <View
            style={[
              s.banner,
              { backgroundColor: (r.matches.length ? GREEN : GOLD) + "16" },
            ]}
          >
            <Text
              testID="regex-verdict"
              style={[s.bannerText, { color: r.matches.length ? GREEN : "#8A6D00" }]}
            >
              {r.matches.length ? `${r.matches.length} התאמות` : "אין התאמה"}
            </Text>
          </View>

          <View style={rx.highlight}>
            <Text style={rx.highlightText}>
              {r.segments.map((seg, i) => (
                <Text key={i} style={seg.hit ? rx.hit : undefined}>{seg.text}</Text>
              ))}
            </Text>
          </View>

          {r.matches.slice(0, 8).map((m, i) => (
            <View key={i} style={s.routineRow}>
              <Text style={s.routineTime}>{m.index}</Text>
              <Text style={[s.routineLabel, { flex: 1, fontFamily: "monospace", textAlign: "left" }]}>
                {m.text || "(ריק)"}
                {m.groups.length ? `   groups: ${m.groups.map((x) => (x === undefined ? "—" : x)).join(", ")}` : ""}
              </Text>
            </View>
          ))}
        </>
      )}

      <Text style={s.hint}>
        התבנית נבנית מחדש בכל הקלדה, ותבנית לא גמורה פשוט מדווחת כלא תקינה במקום להפיל את הכלי.
        התאמות באורך אפס מקודמות ידנית, אחרת לולאת החיפוש הייתה נתקעת.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// H. ממיר Base64
// ---------------------------------------------------------------------------

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Hand-rolled rather than btoa/atob: those are not guaranteed on Hermes, and
// they are byte-oriented anyway — passing them Hebrew throws. Encoding the
// UTF-8 bytes is what makes עברית survive a round trip.
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    let code = str.codePointAt(i);
    if (code > 0xffff) i += 1;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return out;
}

function bytesToUtf8(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let code;
    let size;
    if (b < 0x80) { code = b; size = 1; }
    else if (b >= 0xf0) { code = b & 7; size = 4; }
    else if (b >= 0xe0) { code = b & 15; size = 3; }
    else { code = b & 31; size = 2; }
    for (let k = 1; k < size; k += 1) code = (code << 6) | (bytes[i + k] & 63);
    out += String.fromCodePoint(code);
    i += size;
  }
  return out;
}

function b64Encode(text) {
  const bytes = utf8Bytes(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 3) << 4) | ((b || 0) >> 4)];
    out += b === undefined ? "=" : B64_CHARS[((b & 15) << 2) | ((c || 0) >> 6)];
    out += c === undefined ? "=" : B64_CHARS[c & 63];
  }
  return out;
}

function b64Decode(text) {
  const clean = text.replace(/[\s]/g, "").replace(/=+$/, "");
  if (/[^A-Za-z0-9+/]/.test(clean)) throw new Error("תווים שאינם Base64");
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => B64_CHARS.indexOf(clean[i + k]));
    bytes.push((chunk[0] << 2) | (chunk[1] >> 4));
    if (chunk[2] >= 0) bytes.push(((chunk[1] & 15) << 4) | (chunk[2] >> 2));
    if (chunk[3] >= 0) bytes.push(((chunk[2] & 3) << 6) | chunk[3]);
  }
  return bytesToUtf8(bytes);
}

export function Base64Tool() {
  const [mode, setMode] = useState("encode");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const r = useMemo(() => {
    if (!input) return { ok: true, out: "" };
    try {
      return { ok: true, out: mode === "encode" ? b64Encode(input) : b64Decode(input) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [input, mode]);

  const copy = async () => {
    if (!r.ok || !r.out) return;
    await Clipboard.setStringAsync(r.out);
    hapticSuccess();
    setCopied(true);
  };

  const swap = () => {
    hapticLight();
    if (r.ok && r.out) setInput(r.out);
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setCopied(false);
  };

  return (
    <View style={{ gap: 12 }}>
      <Segment
        options={[
          { key: "encode", label: "קידוד" },
          { key: "decode", label: "פענוח" },
        ]}
        value={mode}
        onChange={(v) => { hapticLight(); setMode(v); setCopied(false); }}
      />

      <View>
        <Text style={s.fieldLabel}>{mode === "encode" ? "טקסט" : "Base64"}</Text>
        <TextInput
          testID="b64-input"
          style={rx.area}
          value={input}
          onChangeText={(v) => { setInput(v); setCopied(false); }}
          placeholder={mode === "encode" ? "שלום עולם" : "16nXnNeV150g16LXldec150="}
          placeholderTextColor={INK_MUTED}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={mode === "encode" ? "right" : "left"}
          textAlignVertical="top"
        />
      </View>

      {!r.ok ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>אי אפשר לפענח</Text>
          <Text style={[s.bannerSub, { color: RED }]}>{r.error}</Text>
        </View>
      ) : (
        !!r.out && (
          <View style={s.snippetBox}>
            <Text testID="b64-output" style={[s.snippetText, { textAlign: mode === "encode" ? "left" : "right" }]}>
              {r.out}
            </Text>
          </View>
        )
      )}

      <View style={s.row}>
        <TouchableOpacity
          style={[s.actionBtn, copied && { backgroundColor: GREEN }]}
          onPress={copy}
          activeOpacity={0.85}
        >
          <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הועתק" : "העתק"} style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={swap} activeOpacity={0.85}>
          <BtnLabel icon="repeat" text="הפוך כיוון" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="תווי קלט" value={input.length} />
        <Stat label="תווי פלט" value={r.ok ? r.out.length : 0} color={BLUE} />
      </View>

      <Text style={s.hint}>
        הקידוד עובר דרך בייטים של UTF-8, ולכן עברית וניקוד שורדים הלוך ושוב. פונקציות btoa ו-atob של
        הדפדפן היו נכשלות כאן — הן יודעות לטפל רק בבייטים בטווח Latin-1.
      </Text>
    </View>
  );
}

const rx = StyleSheet.create({
  slash: { fontFamily: FONTS.bold, fontSize: 15, color: INK_MUTED },
  area: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    fontFamily: "monospace",
    fontSize: 13,
    color: INK,
    lineHeight: 20,
    ...NO_OUTLINE,
  },
  highlight: { backgroundColor: CARD, borderRadius: 14, padding: 14 },
  highlightText: { fontFamily: "monospace", fontSize: 13, color: INK, lineHeight: 21, textAlign: "left" },
  hit: { backgroundColor: GOLD + "44", color: "#0E7490", fontFamily: FONTS.bold },
});
