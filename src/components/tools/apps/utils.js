import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
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
} from "../kit";

// General-purpose utilities.

// ---------------------------------------------------------------------------
// A. טיימר פומודורו
// ---------------------------------------------------------------------------

const PRESETS = [
  { key: "focus", label: "פוקוס", minutes: 25 },
  { key: "short", label: "הפסקה", minutes: 5 },
  { key: "long", label: "הפסקה ארוכה", minutes: 15 },
];

function mmss(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function PomodoroTimer() {
  const [preset, setPreset] = useState("focus");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);

  const total = PRESETS.find((p) => p.key === preset).minutes * 60;

  // Count down off wall-clock time rather than by decrementing once per tick:
  // setInterval drifts, and a backgrounded tab throttles it badly. Storing the
  // deadline means the display is always right, however irregular the ticks.
  const deadline = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    if (deadline.current === null) deadline.current = Date.now() + left * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        deadline.current = null;
        setRounds((n) => n + 1);
        hapticSuccess();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, left]);

  const start = () => {
    if (left === 0) return;
    hapticLight();
    deadline.current = Date.now() + left * 1000;
    setRunning(true);
  };

  const pause = () => {
    hapticLight();
    deadline.current = null;
    setRunning(false);
  };

  const reset = () => {
    hapticWarning();
    deadline.current = null;
    setRunning(false);
    setLeft(total);
  };

  const pickPreset = (key) => {
    const next = PRESETS.find((p) => p.key === key);
    deadline.current = null;
    setRunning(false);
    setPreset(key);
    setLeft(next.minutes * 60);
  };

  const pct = total ? ((total - left) / total) * 100 : 0;
  const done = left === 0;

  return (
    <View style={{ gap: 14 }}>
      <Segment
        options={PRESETS.map((p) => ({ key: p.key, label: p.label }))}
        value={preset}
        onChange={pickPreset}
      />

      <View style={[t.clockCard, done && { backgroundColor: GREEN + "12" }]}>
        <Text style={[t.clock, done && { color: GREEN }, running && { color: BLUE }]}>{mmss(left)}</Text>
        <Text style={t.clockSub}>
          {done ? "הסבב הושלם" : running ? "רץ" : "מוכן"}
          {rounds > 0 ? ` · ${rounds} סבבים היום` : ""}
        </Text>
        <View style={t.track}>
          <View
            style={[t.fill, { width: `${pct}%`, backgroundColor: done ? GREEN : BLUE }]}
          />
        </View>
      </View>

      <View style={s.row}>
        {running ? (
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: GOLD }]} onPress={pause} activeOpacity={0.85}>
            <BtnLabel icon="pause" text="השהה" style={s.actionText} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.actionBtn, done && { backgroundColor: INK_MUTED }]}
            onPress={start}
            activeOpacity={0.85}
            disabled={done}
          >
            <BtnLabel icon="play" text={left === total ? "התחל" : "המשך"} style={s.actionText} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={reset} activeOpacity={0.85}>
          <BtnLabel icon="rotate-ccw" text="איפוס" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>
        הספירה מבוססת על שעון המכשיר ולא על מונה פנימי, כך שהזמן נשאר מדויק גם אם המסך כבה או שעברת
        לאפליקציה אחרת באמצע הסבב.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. מונה מילים ותווים
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
