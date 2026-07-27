import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import Slider from "../Slider";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
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
  Field,
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
        <Text style={[s.bannerText, { color: "#0E7490" }]}>תצוגה מקדימה — הקוד אינו סָריק</Text>
        <Text style={[s.bannerSub, { color: "#0E7490" }]}>
          קוד QR אמיתי דורש ספריית קידוד ייעודית שלא מותקנת כדי לא לסכן את הבילד. בינתיים אפשר להעתיק את
          הטקסט ולהפיק ממנו קוד בכל שירות.
        </Text>
      </View>
      <TouchableOpacity style={s.actionBtn} onPress={copy} activeOpacity={0.85}>
        <BtnLabel icon="copy" text="העתק את הטקסט" style={s.actionText} />
      </TouchableOpacity>
    </View>
  );
}

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
// E. מחולל מעברי צבע
// ---------------------------------------------------------------------------

const GRADIENT_PRESETS = [
  { label: "וויולט", from: "#7C3AED", to: "#06B6D4" },
  { label: "שקיעה", from: "#FF4E50", to: "#F9D423" },
  { label: "ים", from: "#0EA5E9", to: "#10B981" },
  { label: "לילה", from: "#111827", to: "#4B5563" },
  { label: "ורוד", from: "#EC4899", to: "#8B5CF6" },
  { label: "זהב", from: "#F59E0B", to: "#EF4444" },
];

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// "#abc" and "abc" both mean #aabbcc; anything else is not a colour.
function normalizeHex(raw) {
  const m = HEX_RE.exec((raw || "").trim());
  if (!m) return null;
  const body = m[1];
  const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
  return `#${full.toUpperCase()}`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Interpolate in plain sRGB. Perceptual spaces would be smoother, but this is
// what LinearGradient itself does, so the preview matches the exported code.
function mixHex(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ch = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${ch(a.r, b.r)}, ${ch(a.g, b.g)}, ${ch(a.b, b.b)})`;
}

const BANDS = 24;
const DIRECTIONS = [
  { key: "vertical", label: "אנכי" },
  { key: "horizontal", label: "אופקי" },
];

export function GradientGenerator() {
  const [fromRaw, setFromRaw] = useState("#7C3AED");
  const [toRaw, setToRaw] = useState("#06B6D4");
  const [direction, setDirection] = useState("vertical");
  const [copied, setCopied] = useState(false);

  const from = normalizeHex(fromRaw);
  const to = normalizeHex(toRaw);
  const valid = !!from && !!to;

  const snippet = useMemo(() => {
    if (!valid) return "";
    const coords =
      direction === "horizontal"
        ? "      start={{ x: 0, y: 0.5 }}\n      end={{ x: 1, y: 0.5 }}\n"
        : "      start={{ x: 0.5, y: 0 }}\n      end={{ x: 0.5, y: 1 }}\n";
    return (
      `import { LinearGradient } from "expo-linear-gradient";\n\n` +
      `<LinearGradient\n` +
      `      colors={["${from}", "${to}"]}\n` +
      coords +
      `      style={{ flex: 1, borderRadius: 24 }}\n` +
      `/>`
    );
  }, [from, to, direction, valid]);

  const copy = async () => {
    if (!valid) {
      hapticWarning();
      return;
    }
    await Clipboard.setStringAsync(snippet);
    hapticSuccess();
    setCopied(true);
  };

  const pickPreset = (p) => {
    hapticLight();
    setFromRaw(p.from);
    setToRaw(p.to);
    setCopied(false);
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Preview. expo-linear-gradient is not installed — adding a native
          module for a preview is not worth the build risk — so the gradient is
          drawn as a stack of interpolated bands. At 24 steps the banding is
          invisible at this size, and the exported snippet is the real thing. */}
      <View style={[g.preview, direction === "horizontal" && { flexDirection: "row" }]}>
        {valid
          ? Array.from({ length: BANDS }, (_, i) => (
              <View
                key={i}
                style={{ flex: 1, backgroundColor: mixHex(from, to, i / (BANDS - 1)) }}
              />
            ))
          : <View style={g.previewEmpty}><Icon name="droplet" size={26} color={INK_MUTED} /></View>}
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>צבע התחלה</Text>
          <View style={[s.fieldRow, !from && fromRaw ? { borderWidth: 1, borderColor: RED } : null]}>
            <View style={[g.swatch, { backgroundColor: from || "transparent" }]} />
            <TextInput
              testID="grad-from"
              style={[s.fieldInput, { fontSize: 15 }]}
              value={fromRaw}
              onChangeText={(v) => { setFromRaw(v); setCopied(false); }}
              placeholder="#7C3AED"
              placeholderTextColor={INK_MUTED}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="left"
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>צבע סיום</Text>
          <View style={[s.fieldRow, !to && toRaw ? { borderWidth: 1, borderColor: RED } : null]}>
            <View style={[g.swatch, { backgroundColor: to || "transparent" }]} />
            <TextInput
              testID="grad-to"
              style={[s.fieldInput, { fontSize: 15 }]}
              value={toRaw}
              onChangeText={(v) => { setToRaw(v); setCopied(false); }}
              placeholder="#06B6D4"
              placeholderTextColor={INK_MUTED}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="left"
            />
          </View>
        </View>
      </View>

      {!valid && <Text style={[s.hint, { color: RED }]}>קוד צבע לא תקין — נדרש HEX בן 3 או 6 תווים.</Text>}

      <Segment options={DIRECTIONS} value={direction} onChange={(v) => { hapticLight(); setDirection(v); setCopied(false); }} />

      <Text style={s.sectionLabel}>פריסטים</Text>
      <View style={s.chipRow}>
        {GRADIENT_PRESETS.map((p) => (
          <TouchableOpacity key={p.label} style={g.presetChip} onPress={() => pickPreset(p)} activeOpacity={0.8}>
            <View style={[g.presetDot, { backgroundColor: p.from }]} />
            <View style={[g.presetDot, { backgroundColor: p.to, marginStart: -7 }]} />
            <Text style={s.chipText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {valid && (
        <View style={s.snippetBox}>
          <Text testID="grad-snippet" style={s.snippetText}>{snippet}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.bigBtn, copied && { backgroundColor: GREEN }]}
        onPress={copy}
        activeOpacity={0.85}
      >
        <BtnLabel
          icon={copied ? "check" : "copy"}
          text={copied ? "הקוד הועתק" : "העתק קוד LinearGradient"}
          style={s.bigBtnText}
        />
      </TouchableOpacity>

      <Text style={s.hint}>
        הקוד משתמש ב-expo-linear-gradient, שאינו מותקן בפרויקט הזה. להרצה בקוד שלך: npx expo install
        expo-linear-gradient.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// F. מחולל תבנית קומפוננטה
// ---------------------------------------------------------------------------

// Anything the user types becomes a legal component name: strip separators,
// upper-case each word, and guarantee a leading letter — a component whose
// name starts with a digit is a syntax error, and one starting lower-case is
// treated by JSX as an HTML tag.
function toPascalCase(raw) {
  const words = (raw || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const joined = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return /^[0-9]/.test(joined) ? `Component${joined}` : joined;
}

const BOILERPLATE_KINDS = [
  { key: "basic", label: "בסיסי" },
  { key: "state", label: "עם state" },
  { key: "list", label: "רשימה" },
];

export function RnBoilerplate() {
  const [raw, setRaw] = useState("");
  const [kind, setKind] = useState("basic");
  const [copied, setCopied] = useState(false);

  const name = toPascalCase(raw) || "MyComponent";

  const code = useMemo(() => {
    const lower = name[0].toLowerCase() + name.slice(1);
    if (kind === "state") {
      return `import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ${name}({ title = "${name}" }) {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setCount((c) => c + 1)}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>{count}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
`;
    }
    if (kind === "list") {
      return `import { FlatList, StyleSheet, Text, View } from "react-native";

export default function ${name}({ data = [] }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>אין פריטים</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowText}>{item.title}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },
  rowText: { fontSize: 15, color: "#111827", textAlign: "right" },
  empty: { fontSize: 14, color: "#6B7280", textAlign: "center", paddingVertical: 24 },
});
`;
    }
    return `import { StyleSheet, Text, View } from "react-native";

export default function ${name}({ title = "${name}" }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
});
`;
  }, [name, kind]);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    hapticSuccess();
    setCopied(true);
  };

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>שם הקומפוננטה</Text>
        <View style={s.fieldRow}>
          <TextInput
            testID="boilerplate-name"
            style={[s.fieldInput, { fontSize: 16 }]}
            value={raw}
            onChangeText={(v) => { setRaw(v); setCopied(false); }}
            placeholder="my product card"
            placeholderTextColor={INK_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="left"
          />
        </View>
      </View>

      <View style={d.nameRow}>
        <Text testID="boilerplate-resolved" style={d.nameOut}>{name}.js</Text>
        <Text style={s.fieldLabel}>ייווצר כ-</Text>
      </View>

      <Segment options={BOILERPLATE_KINDS} value={kind} onChange={(v) => { hapticLight(); setKind(v); setCopied(false); }} />

      <View style={s.snippetBox}>
        <Text style={s.snippetText}>{code}</Text>
      </View>

      <TouchableOpacity
        style={[s.bigBtn, copied && { backgroundColor: GREEN }]}
        onPress={copy}
        activeOpacity={0.85}
      >
        <BtnLabel
          icon={copied ? "check" : "copy"}
          text={copied ? "הקוד הועתק" : "העתק את הקומפוננטה"}
          style={s.bigBtnText}
        />
      </TouchableOpacity>

      <Text style={s.hint}>
        השם מומר אוטומטית ל-PascalCase. שם שמתחיל בספרה מקבל קידומת, כי JSX מתייחס לתג באות קטנה
        כאלמנט HTML ולא כקומפוננטה.
      </Text>
    </View>
  );
}

const g = StyleSheet.create({
  preview: { height: 150, borderRadius: 24, overflow: "hidden" },
  previewEmpty: { flex: 1, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  swatch: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: "#DDE2EC" },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: CARD,
  },
  presetDot: { width: 15, height: 15, borderRadius: 8 },
});
