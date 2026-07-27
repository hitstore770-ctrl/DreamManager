import { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import {
  BtnLabel,
  CARD,
  GOLD,
  GREEN,
  INK_MUTED,
  INK_SOFT,
  RED,
  Segment,
  s,
  BLUE,
  INK,
  WHITE,
} from "../kit";

// Colour and scaffolding tools: things that produce a value you paste into a
// stylesheet, rather than things that parse or transform input.

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

// ---------------------------------------------------------------------------
// I. ניגודיות צבעים
// ---------------------------------------------------------------------------

// WCAG relative luminance: each channel is linearised before weighting,
// because sRGB values are gamma-encoded and averaging them raw overstates how
// bright a colour actually looks.
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const chan = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

const CONTRAST_PAIRS = [
  { label: "770 סגול", fg: "#FFFFFF", bg: "#7C3AED" },
  { label: "כרטיס", fg: "#111827", bg: "#FFFFFF" },
  { label: "משני", fg: "#6B7280", bg: "#F4F6F9" },
  { label: "אזהרה", fg: "#FFFFFF", bg: "#F59E0B" },
];

export function ContrastChecker() {
  const [fgRaw, setFgRaw] = useState("#6B7280");
  const [bgRaw, setBgRaw] = useState("#F4F6F9");

  const fg = normalizeHex(fgRaw);
  const bg = normalizeHex(bgRaw);
  const valid = !!fg && !!bg;

  const r = useMemo(() => {
    if (!valid) return null;
    const ratio = contrastRatio(fg, bg);
    const round2 = Math.round(ratio * 100) / 100;
    return {
      ratio: round2,
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3,
      aaaNormal: ratio >= 7,
    };
  }, [fg, bg, valid]);

  const tone = !r ? INK_SOFT : r.aaaNormal ? GREEN : r.aaNormal ? GREEN : r.aaLarge ? GOLD : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={[ct.stage, { backgroundColor: valid ? bg : CARD }]}>
        <Text style={[ct.stageTitle, { color: valid ? fg : INK_MUTED }]}>כותרת לדוגמה</Text>
        <Text style={[ct.stageBody, { color: valid ? fg : INK_MUTED }]}>
          טקסט רגיל בגודל 14 — כך ייראה המשפט על הרקע הזה במסך אמיתי.
        </Text>
        <Text style={[ct.stageSmall, { color: valid ? fg : INK_MUTED }]}>הערת שוליים קטנה</Text>
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>צבע טקסט</Text>
          <View style={[s.fieldRow, !fg && fgRaw ? { borderWidth: 1, borderColor: RED } : null]}>
            <View style={[g.swatch, { backgroundColor: fg || "transparent" }]} />
            <TextInput
              testID="contrast-fg"
              style={[s.fieldInput, { fontSize: 15 }]}
              value={fgRaw}
              onChangeText={setFgRaw}
              placeholder="#111827"
              placeholderTextColor={INK_MUTED}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="left"
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>צבע רקע</Text>
          <View style={[s.fieldRow, !bg && bgRaw ? { borderWidth: 1, borderColor: RED } : null]}>
            <View style={[g.swatch, { backgroundColor: bg || "transparent" }]} />
            <TextInput
              testID="contrast-bg"
              style={[s.fieldInput, { fontSize: 15 }]}
              value={bgRaw}
              onChangeText={setBgRaw}
              placeholder="#FFFFFF"
              placeholderTextColor={INK_MUTED}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="left"
            />
          </View>
        </View>
      </View>

      {!valid ? (
        <Text style={[s.hint, { color: RED }]}>קוד צבע לא תקין — נדרש HEX בן 3 או 6 תווים.</Text>
      ) : (
        <>
          <View style={[ct.verdict, { backgroundColor: tone + "12" }]}>
            <Text testID="contrast-ratio" style={[ct.ratio, { color: tone }]}>{r.ratio}:1</Text>
            <Text style={ct.verdictLabel}>
              {r.aaaNormal
                ? "מצוין — עובר AAA"
                : r.aaNormal
                  ? "תקין — עובר AA"
                  : r.aaLarge
                    ? "גבולי — מתאים לכותרות גדולות בלבד"
                    : "לא קריא מספיק"}
            </Text>
          </View>

          {[
            { label: "AA טקסט רגיל", need: "4.5:1", pass: r.aaNormal },
            { label: "AA טקסט גדול", need: "3:1", pass: r.aaLarge },
            { label: "AAA טקסט רגיל", need: "7:1", pass: r.aaaNormal },
          ].map((row) => (
            <View key={row.label} style={s.routineRow}>
              <Icon name={row.pass ? "check-circle" : "x-circle"} size={17} color={row.pass ? GREEN : RED} />
              <Text style={[s.routineLabel, { flex: 1 }]}>{row.label}</Text>
              <Text style={s.routineTime}>{row.need}</Text>
            </View>
          ))}

          <View style={s.chipRow}>
            {CONTRAST_PAIRS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={s.chip}
                onPress={() => { hapticLight(); setFgRaw(p.fg); setBgRaw(p.bg); }}
                activeOpacity={0.8}
              >
                <Text style={s.chipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={s.hint}>
        היחס מחושב לפי WCAG 2.1 — הערוצים מיושרים לגמא לפני השקלול, כי ערכי sRGB אינם ליניאריים.
        "טקסט גדול" הוא 18pt ומעלה, או 14pt מודגש.
      </Text>
    </View>
  );
}

const ct = StyleSheet.create({
  stage: { borderRadius: 24, padding: 20, gap: 8, minHeight: 130, justifyContent: "center" },
  stageTitle: { fontFamily: FONTS.bold, fontSize: 20, textAlign: "right" },
  stageBody: { fontFamily: FONTS.regular, fontSize: 14, textAlign: "right", lineHeight: 21 },
  stageSmall: { fontFamily: FONTS.regular, fontSize: 11, textAlign: "right" },
  verdict: { borderRadius: 24, paddingVertical: 18, alignItems: "center", gap: 4 },
  ratio: { fontFamily: FONTS.bold, fontSize: 34 },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT, textAlign: "center", paddingHorizontal: 16 },
});

// ---------------------------------------------------------------------------
// D. ממיר RGB ל-HEX
// ---------------------------------------------------------------------------

function clampChannel(raw) {
  const n = parseInt((raw || "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(255, Math.max(0, n));
}

function toHex(n) {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

// HSL is what design tools show, so deriving it here saves a round trip.
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, sat: 0, l: Math.round(l * 100) };
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), sat: Math.round(sat * 100), l: Math.round(l * 100) };
}

const RGB_PRESETS = [
  { label: "וויולט", r: "124", g: "58", b: "237" },
  { label: "ציאן", r: "6", g: "182", b: "212" },
  { label: "קורל", r: "255", g: "78", b: "80" },
  { label: "דיו", r: "17", g: "24", b: "39" },
];

export function RgbToHex() {
  const [r, setR] = useState("124");
  const [g, setG] = useState("58");
  const [b, setB] = useState("237");
  const [copied, setCopied] = useState(false);

  const R = clampChannel(r);
  const G = clampChannel(g);
  const B = clampChannel(b);
  const valid = R !== null && G !== null && B !== null;

  const hex = valid ? `#${toHex(R)}${toHex(G)}${toHex(B)}` : null;
  const hsl = valid ? rgbToHsl(R, G, B) : null;

  const copy = async () => {
    if (!hex) return;
    await Clipboard.setStringAsync(hex);
    hapticSuccess();
    setCopied(true);
  };

  const setAll = (preset) => {
    hapticLight();
    setR(preset.r);
    setG(preset.g);
    setB(preset.b);
    setCopied(false);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[rgb.preview, { backgroundColor: hex || CARD }]}>
        {valid ? (
          <Text
            testID="rgb-hex"
            style={[rgb.previewText, { color: (R * 299 + G * 587 + B * 114) / 1000 > 140 ? "#111827" : "#FFFFFF" }]}
          >
            {hex}
          </Text>
        ) : (
          <Text style={[rgb.previewText, { color: INK_MUTED }]}>ערכים לא תקינים</Text>
        )}
      </View>

      <View style={s.row}>
        {[
          { label: "R", value: r, set: setR, testID: "rgb-r" },
          { label: "G", value: g, set: setG, testID: "rgb-g" },
          { label: "B", value: b, set: setB, testID: "rgb-b" },
        ].map((ch) => (
          <View key={ch.label} style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{ch.label}</Text>
            <View style={s.fieldRow}>
              <TextInput
                testID={ch.testID}
                style={s.fieldInput}
                value={ch.value}
                onChangeText={(v) => { ch.set(v); setCopied(false); }}
                placeholder="0"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                maxLength={3}
                textAlign="center"
              />
            </View>
          </View>
        ))}
      </View>

      <View style={s.chipRow}>
        {RGB_PRESETS.map((p) => (
          <TouchableOpacity key={p.label} style={s.chip} onPress={() => setAll(p)} activeOpacity={0.8}>
            <View style={[rgb.dot, { backgroundColor: `rgb(${p.r}, ${p.g}, ${p.b})` }]} />
            <Text style={s.chipText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {valid && (
        <View style={s.statRow}>
          <Text style={rgb.row}>rgb({R}, {G}, {B})</Text>
        </View>
      )}
      {valid && (
        <View style={s.statRow}>
          <Text style={rgb.row}>hsl({hsl.h}, {hsl.sat}%, {hsl.l}%)</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.bigBtn, copied && { backgroundColor: GREEN }]}
        onPress={copy}
        activeOpacity={0.85}
        disabled={!valid}
      >
        <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הועתק" : "העתק HEX"} style={s.bigBtnText} />
      </TouchableOpacity>

      <Text style={s.hint}>
        כל ערוץ מוגבל ל-0 עד 255 — מספר גדול יותר פשוט נחתך, כי אין לו ייצוג בבייט אחד. צבע הטקסט על
        הריבוע נבחר אוטומטית לפי בהירות הרקע כדי שיישאר קריא.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// E. מידות אייקונים
// ---------------------------------------------------------------------------

const ICON_SPECS = [
  {
    store: "מקור לייצוא",
    icon: "image",
    rows: [
      { size: "1024 × 1024", use: "קובץ המקור — מכאן נגזרות כל השאר", note: "PNG, ללא שקיפות" },
    ],
  },
  {
    store: "App Store · iOS",
    icon: "smartphone",
    rows: [
      { size: "1024 × 1024", use: "אייקון החנות", note: "חובה, ללא שקיפות וללא פינות מעוגלות" },
      { size: "180 × 180", use: "אייקון אפליקציה — iPhone @3x", note: "60pt" },
      { size: "120 × 120", use: "אייקון אפליקציה — iPhone @2x", note: "60pt" },
      { size: "167 × 167", use: "iPad Pro", note: "83.5pt @2x" },
      { size: "152 × 152", use: "iPad", note: "76pt @2x" },
    ],
  },
  {
    store: "Google Play · Android",
    icon: "play",
    rows: [
      { size: "512 × 512", use: "אייקון החנות", note: "PNG 32-bit עם ערוץ אלפא" },
      { size: "432 × 432", use: "אייקון אדפטיבי — שכבה", note: "התוכן בתוך 264px מרכזיים" },
      { size: "192 × 192", use: "xxxhdpi", note: "" },
      { size: "144 × 144", use: "xxhdpi", note: "" },
      { size: "96 × 96", use: "xhdpi", note: "" },
    ],
  },
  {
    store: "Expo · app.json",
    icon: "layers",
    rows: [
      { size: "1024 × 1024", use: "icon", note: "משמש לשתי הפלטפורמות" },
      { size: "1024 × 1024", use: "android.adaptiveIcon.foregroundImage", note: "שוליים בטוחים" },
      { size: "1284 × 2778", use: "splash", note: "או תמונה מרכזית על רקע אחיד" },
    ],
  },
];

export function IconSizeGuide() {
  const [copied, setCopied] = useState(null);

  const copySize = async (size) => {
    const digits = size.replace(/[^0-9]/g, " ").trim().split(/\s+/)[0];
    await Clipboard.setStringAsync(digits);
    hapticLight();
    setCopied(size);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.banner, { backgroundColor: BLUE + "12" }]}>
        <Text style={[s.bannerText, { color: BLUE }]}>עצבו פעם אחת ב-1024 ורדו משם</Text>
        <Text style={[s.bannerSub, { color: INK_SOFT }]}>
          הקטנה שומרת על חדות, הגדלה לא. שמרו את המקור כווקטור אם אפשר.
        </Text>
      </View>

      {ICON_SPECS.map((group) => (
        <View key={group.store} style={{ gap: 8 }}>
          <View style={ic.head}>
            <Icon name={group.icon} size={16} color={BLUE} />
            <Text style={ic.headText}>{group.store}</Text>
          </View>
          {group.rows.map((row) => (
            <TouchableOpacity
              key={`${group.store}-${row.size}-${row.use}`}
              style={ic.row}
              onPress={() => copySize(row.size)}
              activeOpacity={0.8}
            >
              <Icon name={copied === row.size ? "check" : "copy"} size={14} color={copied === row.size ? GREEN : INK_MUTED} />
              <View style={{ flex: 1 }}>
                <Text style={ic.use}>{row.use}</Text>
                {!!row.note && <Text style={ic.note}>{row.note}</Text>}
              </View>
              <Text style={ic.size}>{row.size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <Text style={s.hint}>
        אפל דוחה אייקון עם שקיפות או עם פינות מעוגלות שנצרבו לתמונה — המערכת מעגלת בעצמה. גוגל דווקא
        מצפה לאלפא, ובאייקון אדפטיבי חותכת את השוליים, ולכן הלוגו צריך להישאר במרכז.
      </Text>
    </View>
  );
}

const rgb = StyleSheet.create({
  preview: { height: 120, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  previewText: { fontFamily: FONTS.bold, fontSize: 26, letterSpacing: 1 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  row: { flex: 1, fontFamily: "monospace", fontSize: 13, color: INK_SOFT, textAlign: "center" },
});

const ic = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  headText: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  use: { fontFamily: FONTS.semibold, fontSize: 13, color: INK, textAlign: "right" },
  note: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  size: { fontFamily: "monospace", fontSize: 12.5, color: BLUE },
});
