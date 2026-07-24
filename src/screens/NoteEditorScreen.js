import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotes } from "../context/NotesContext";
import { useSettings } from "../context/SettingsContext";
import { hapticLight } from "../utils/haptics";
import { gregorianToHebrew, hebrewWeekday } from "../utils/hebrewDate";
import { autoSum, evalArithmetic, scanInlineMath } from "../utils/mathEval";
import { countWords, parseInline, wrapSelection } from "../utils/markdownLite";
import { NOTE_BG, extractTags, noteBg, textToChecklist, uid } from "../utils/notesStore";
import { FONTS, RADIUS, RADIUS_SM, SHADOW, SHADOW_SM } from "../utils/theme";
import HebrewDateTools from "../components/notes/HebrewDateTools";

export default function NoteEditorScreen({ route, navigation }) {
  const { theme, fontScale, haptic } = useSettings();
  const insets = useSafeAreaInsets();
  const noteId = route.params?.noteId;

  const { notes, setNotes, loaded } = useNotes();
  const note = notes.find((n) => n.id === noteId);

  // Local draft for the fast-changing fields; committed to storage on a 3s debounce.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const initedRef = useRef(false);
  const saveTimer = useRef(null);

  // Panels
  const [showCalc, setShowCalc] = useState(false);
  const [showDates, setShowDates] = useState(false);

  // Floating calculator state
  const [calcExpr, setCalcExpr] = useState("");
  const [calcHistory, setCalcHistory] = useState([]);

  // Hydrate local draft once the note is available.
  useEffect(() => {
    if (loaded && note && !initedRef.current) {
      setTitle(note.title || "");
      setBody(note.body || "");
      initedRef.current = true;
    }
  }, [loaded, note]);

  // Merge a patch into this note in the shared array.
  const patchNote = (fields) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, ...fields, updatedAt: Date.now() } : n))
    );
  };

  // Debounced auto-save (every 3s) for title/body.
  useEffect(() => {
    if (!initedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patchNote({ title, body, tags: extractTags(`${title} ${body}`) });
      setSavedAt(Date.now());
    }, 3000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [title, body]);

  // Flush on unmount so nothing is lost.
  useEffect(() => {
    return () => {
      if (initedRef.current) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, title, body, updatedAt: Date.now() } : n))
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  const today = useMemo(() => gregorianToHebrew(new Date()), []);
  const counts = countWords(body);
  const sum = useMemo(() => autoSum(body), [body]);
  const inlineMath = useMemo(() => scanInlineMath(body), [body]);
  const segments = useMemo(() => parseInline(body), [body]);
  const liveTags = useMemo(() => extractTags(`${title} ${body}`), [title, body]);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }
  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.textMuted, fontFamily: FONTS.medium }}>ההערה לא נמצאה</Text>
      </View>
    );
  }

  const readOnly = note.readOnly;
  const bg = noteBg(note.bg, theme.scheme === "dark");
  const s = makeStyles(theme, fontScale);

  // ---- Rich-text toolbar --------------------------------------------------
  const applyMarker = (marker) => {
    if (readOnly) return;
    haptic("light");
    const { text, caret } = wrapSelection(body, selection.start, selection.end, marker);
    setBody(text);
    setSelection({ start: caret, end: caret });
  };
  const bumpFont = (delta) => {
    patchNote({ fontSize: Math.max(12, Math.min(30, (note.fontSize || 16) + delta)) });
  };

  // ---- Inline math --------------------------------------------------------
  // As the user finishes typing a trailing "expr=", append the result inline
  // (e.g. "150*4=" → "150*4= 600"). Only fires on growth so deleting is safe.
  const onBodyChange = (text) => {
    if (text.length > body.length) {
      const m = text.match(/([\d.]+(?:\s*[+\-*/%]\s*[\d.]+)+)\s*=\s*$/);
      if (m) {
        const val = evalArithmetic(m[1]);
        if (val !== null) {
          setBody(text + " " + val);
          return;
        }
      }
    }
    setBody(text);
  };
  const applyInline = (item) => {
    haptic("light");
    const next = body.slice(0, item.end) + ` ${item.value}` + body.slice(item.end);
    setBody(next);
  };

  // ---- Floating calculator ------------------------------------------------
  const calcValue = evalArithmetic(calcExpr);
  const calcEquals = () => {
    if (calcValue === null) return;
    haptic("light");
    setCalcHistory((h) => [{ id: uid(), line: `${calcExpr} = ${calcValue}` }, ...h].slice(0, 20));
    setCalcExpr(String(calcValue));
  };
  const insertTape = () => {
    if (!calcHistory.length) return;
    haptic("light");
    const tape = "\n— סרט חישוב —\n" + calcHistory.map((c) => c.line).reverse().join("\n") + "\n";
    setBody((b) => b + tape);
    setShowCalc(false);
  };

  // ---- Checklist ----------------------------------------------------------
  const convertToChecklist = () => {
    haptic("light");
    const items = textToChecklist(body || note.title);
    patchNote({ isChecklist: true, checklist: items });
  };
  const toggleItem = (id) => {
    haptic("light");
    patchNote({
      checklist: note.checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    });
  };
  const addChecklistItem = () => {
    patchNote({ checklist: [...note.checklist, { id: uid(), text: "", done: false }] });
  };
  const editChecklistItem = (id, text) => {
    patchNote({ checklist: note.checklist.map((i) => (i.id === id ? { ...i, text } : i)) });
  };
  const clearCompleted = () => {
    haptic("light");
    const active = note.checklist.filter((i) => !i.done);
    const done = note.checklist.filter((i) => i.done);
    patchNote({ checklist: [...active, ...done] });
  };
  const checklistDone = note.checklist.filter((i) => i.done).length;
  const checklistPct = note.checklist.length ? Math.round((checklistDone / note.checklist.length) * 100) : 0;

  const TBtn = ({ label, on, active, wide }) => (
    <TouchableOpacity
      style={[s.tbtn, wide && { paddingHorizontal: 12 }, active && { backgroundColor: theme.accent }]}
      onPress={on}
      activeOpacity={0.7}
    >
      <Text style={[s.tbtnText, { color: active ? "#FFF" : theme.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.icon}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerDate}>📅 {today.formatted}</Text>
          <Text style={s.headerSub}>
            {hebrewWeekday(new Date())} · {savedAt ? "נשמר ✓" : "נשמר אוטומטית"}
          </Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => patchNote({ pinned: !note.pinned })} activeOpacity={0.7}>
          <Text style={s.icon}>{note.pinned ? "📌" : "📍"}</Text>
        </TouchableOpacity>
      </View>

      {/* Formatting toolbar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbar}>
        <TBtn label="B" on={() => applyMarker("**")} />
        <TBtn label="I" on={() => applyMarker("*")} />
        <TBtn label="U" on={() => applyMarker("__")} />
        <View style={s.tsep} />
        <TBtn label="A−" on={() => bumpFont(-1)} />
        <TBtn label="A+" on={() => bumpFont(1)} />
        <View style={s.tsep} />
        <TBtn label={preview ? "✏️ עריכה" : "👁️ תצוגה"} on={() => setPreview((p) => !p)} active={preview} wide />
        <TBtn label={readOnly ? "🔒 נעול" : "🔓 פתוח"} on={() => patchNote({ readOnly: !readOnly })} active={readOnly} wide />
      </ScrollView>

      {/* Background color picker — four soft pastels */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bgRow}>
        {NOTE_BG.filter((b) => ["yellow", "blue", "green", "pink"].includes(b.key)).map((b) => (
          <TouchableOpacity
            key={b.key}
            style={[
              s.bgDot,
              { backgroundColor: theme.scheme === "dark" ? b.dark : b.color },
              note.bg === b.key && { borderColor: theme.accent, borderWidth: 3 },
            ]}
            onPress={() => patchNote({ bg: note.bg === b.key ? "white" : b.key })}
            activeOpacity={0.8}
          />
        ))}
        <View style={s.tsep} />
        <TBtn label="🧮 מחשבון" on={() => setShowCalc(true)} wide />
        <TBtn label="📆 תאריך עברי" on={() => setShowDates(true)} wide />
        {!note.isChecklist ? (
          <TBtn label="✅ לצ׳קליסט" on={convertToChecklist} wide />
        ) : (
          <TBtn label="📝 לטקסט" on={() => patchNote({ isChecklist: false })} wide />
        )}
      </ScrollView>

      {/* Dynamic #tag pills */}
      {liveTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagPillRow}>
          {liveTags.map((t) => (
            <View key={t} style={s.tagPill}>
              <Text style={s.tagPillText}>#{t}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Title — auto aligns RTL for Hebrew, LTR for English */}
        <TextInput
          style={[s.title, { color: theme.textPrimary }]}
          value={title}
          onChangeText={setTitle}
          placeholder="כותרת ההערה"
          placeholderTextColor={theme.textMuted}
          editable={!readOnly}
          textAlign="auto"
        />

        {/* Inline math suggestions */}
        {inlineMath.length > 0 && !note.isChecklist && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {inlineMath.map((m, i) => (
              <TouchableOpacity key={i} style={s.mathChip} onPress={() => applyInline(m)} activeOpacity={0.8}>
                <Text style={s.mathChipText}>{m.expr} = {m.value}  ⊕</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Body: checklist / preview / editor */}
        {note.isChecklist ? (
          <View style={[s.paper, { backgroundColor: bg }]}>
            <View style={s.progressWrap}>
              <Text style={s.progressText}>{checklistDone}/{note.checklist.length} הושלמו</Text>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${checklistPct}%`, backgroundColor: theme.accent }]} />
              </View>
            </View>
            {note.checklist.map((item) => (
              <View key={item.id} style={s.checkRow}>
                <TouchableOpacity style={[s.checkbox, item.done && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => toggleItem(item.id)}>
                  {item.done && <Text style={s.checkMark}>✓</Text>}
                </TouchableOpacity>
                <TextInput
                  style={[
                    s.checkText,
                    { color: item.done ? theme.textMuted : theme.textPrimary, fontSize: (note.fontSize || 16) * fontScale },
                    item.done && { textDecorationLine: "line-through" },
                  ]}
                  value={item.text}
                  onChangeText={(t) => editChecklistItem(item.id, t)}
                  placeholder="פריט..."
                  placeholderTextColor={theme.textMuted}
                  editable={!readOnly}
                  textAlign="auto"
                />
              </View>
            ))}
            {!readOnly && (
              <View style={s.checkActions}>
                <TouchableOpacity style={s.smallAction} onPress={addChecklistItem}>
                  <Text style={[s.smallActionText, { color: theme.accent }]}>＋ פריט</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.smallAction} onPress={clearCompleted}>
                  <Text style={[s.smallActionText, { color: theme.textSecondary }]}>הורד שהושלמו לתחתית</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : preview ? (
          <View style={[s.paper, { backgroundColor: bg, minHeight: 240 }]}>
            <Text style={{ fontSize: (note.fontSize || 16) * fontScale, color: theme.textPrimary, textAlign: "right", lineHeight: (note.fontSize || 16) * fontScale * 1.6 }}>
              {segments.map((seg, i) => (
                <Text
                  key={i}
                  style={[
                    seg.bold && { fontFamily: FONTS.bold },
                    seg.italic && { fontStyle: "italic" },
                    seg.underline && { textDecorationLine: "underline" },
                  ]}
                >
                  {seg.text}
                </Text>
              ))}
            </Text>
          </View>
        ) : (
          <TextInput
            style={[s.paper, s.bodyInput, { backgroundColor: bg, color: theme.textPrimary, fontSize: (note.fontSize || 16) * fontScale, lineHeight: (note.fontSize || 16) * fontScale * 1.6 }]}
            value={body}
            onChangeText={onBodyChange}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="התחל לכתוב... אפשר **מודגש**, *נטוי*, __קו תחתון__, #תגית ותרגיל כמו 50*4="
            placeholderTextColor={theme.textMuted}
            multiline
            editable={!readOnly}
            textAlign="auto"
            textAlignVertical="top"
          />
        )}

        {/* Counters */}
        <View style={s.footer}>
          <Text style={s.footerText}>{counts.words} מילים · {counts.chars} תווים</Text>
        </View>

        {note.hebrewDate && (
          <View style={s.linkedDate}>
            <Text style={s.linkedDateText}>🔗 מקושר לתאריך: {note.hebrewDate.formatted}</Text>
          </View>
        )}
      </ScrollView>
      </TouchableWithoutFeedback>

      {/* Floating "Pin to Top" toggle */}
      <TouchableOpacity
        style={[s.floatPin, { backgroundColor: note.pinned ? theme.accent : theme.surface, bottom: (insets.bottom || 0) + 74 }]}
        onPress={() => {
          hapticLight();
          patchNote({ pinned: !note.pinned });
        }}
        activeOpacity={0.85}
      >
        <Text style={[s.floatPinIcon, { color: note.pinned ? "#FFF" : theme.textSecondary }]}>📌</Text>
      </TouchableOpacity>

      {/* Sticky auto-sum bar */}
      <View style={[s.sumBar, { paddingBottom: (insets.bottom || 0) + 10, borderTopColor: theme.hairline, backgroundColor: theme.surface }]}>
        <Text style={[s.sumLabel, { color: theme.textMuted }]}>
          {sum.count > 0 ? `${sum.count} מספרים בהערה` : "אין מספרים בהערה"}
        </Text>
        <Text style={[s.sumTotal, { color: theme.accent }]}>Σ סה״כ: {sum.total}</Text>
      </View>

      {/* Floating calculator */}
      <Modal visible={showCalc} transparent animationType="fade" onRequestClose={() => setShowCalc(false)}>
        <TouchableWithoutFeedback onPress={() => setShowCalc(false)}>
          <View style={s.calcBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.calcCard}>
                <Text style={s.calcTitle}>🧮 מחשבון מרחף</Text>
                <View style={s.calcDisplay}>
                  <Text style={s.calcExpr}>{calcExpr || "0"}</Text>
                  <Text style={s.calcResult}>{calcValue !== null ? `= ${calcValue}` : ""}</Text>
                </View>
                <View style={s.calcGrid}>
                  {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "(", ")", "C", "=", "+"].map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[
                        s.calcKey,
                        ["/", "*", "-", "+"].includes(k) && { backgroundColor: theme.accent + "22" },
                        k === "=" && { backgroundColor: theme.accent },
                        k === "C" && { backgroundColor: theme.danger + "22" },
                      ]}
                      onPress={() => {
                        haptic("light");
                        if (k === "C") setCalcExpr("");
                        else if (k === "=") calcEquals();
                        else setCalcExpr((e) => e + k);
                      }}
                    >
                      <Text style={[s.calcKeyText, { color: k === "=" ? "#FFF" : theme.textPrimary }]}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {calcHistory.length > 0 && (
                  <View style={s.tapeBox}>
                    {calcHistory.slice(0, 3).map((c) => (
                      <Text key={c.id} style={s.tapeLine}>{c.line}</Text>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={[s.calcAction, { backgroundColor: theme.surfaceMuted }]} onPress={() => setShowCalc(false)}>
                    <Text style={[s.calcActionText, { color: theme.textSecondary }]}>סגור</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.calcAction, { backgroundColor: theme.accent }]} onPress={insertTape}>
                    <Text style={[s.calcActionText, { color: "#FFF" }]}>הדבק סרט חישוב</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Hebrew date tools */}
      <Modal visible={showDates} transparent animationType="slide" onRequestClose={() => setShowDates(false)}>
        <TouchableWithoutFeedback onPress={() => setShowDates(false)}>
          <View style={s.calcBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[s.calcCard, { maxHeight: "88%" }]}>
                <HebrewDateTools
                  onLink={(hebrewDate) => {
                    patchNote({ hebrewDate });
                    setShowDates(false);
                  }}
                  onClose={() => setShowDates(false)}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function makeStyles(t, fs) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.hairline },
    iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    icon: { fontSize: 22, color: t.textPrimary, fontFamily: FONTS.bold },
    headerDate: { color: t.textPrimary, fontSize: 15 * fs, fontFamily: FONTS.bold },
    headerSub: { color: t.textMuted, fontSize: 11 * fs, fontFamily: FONTS.regular, marginTop: 1 },

    toolbar: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
    tbtn: { minWidth: 40, height: 38, paddingHorizontal: 8, borderRadius: RADIUS_SM, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    tbtnText: { fontSize: 15 * fs, fontFamily: FONTS.bold },
    tsep: { width: 1, height: 26, backgroundColor: t.hairline, marginHorizontal: 4 },

    bgRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8, alignItems: "center" },
    bgDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.hairline },

    tagPillRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: "center" },
    tagPill: { backgroundColor: t.accent + "18", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginEnd: 6 },
    tagPillText: { color: t.accent, fontSize: 13 * fs, fontFamily: FONTS.bold },

    floatPin: { position: "absolute", left: 20, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", ...SHADOW },
    floatPinIcon: { fontSize: 22 },

    sumBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
    sumLabel: { fontSize: 13 * fs, fontFamily: FONTS.medium },
    sumTotal: { fontSize: 16 * fs, fontFamily: FONTS.bold },

    title: { fontSize: 22 * fs, fontFamily: FONTS.bold, marginBottom: 12, paddingVertical: 4 },
    paper: { borderRadius: RADIUS, padding: 16, ...SHADOW_SM },
    bodyInput: { minHeight: 260, textAlignVertical: "top", fontFamily: FONTS.regular },

    mathChip: { backgroundColor: t.accent + "18", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8 },
    mathChipText: { color: t.accent, fontSize: 14 * fs, fontFamily: FONTS.bold },

    progressWrap: { marginBottom: 14 },
    progressText: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 6 },
    progressBg: { height: 10, borderRadius: 6, backgroundColor: t.surfaceMuted, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 6 },
    checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 10 },
    checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: t.textMuted, alignItems: "center", justifyContent: "center" },
    checkMark: { color: "#FFF", fontSize: 15, fontFamily: FONTS.bold },
    checkText: { flex: 1, fontFamily: FONTS.regular, paddingVertical: 2 },
    checkActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
    smallAction: { paddingVertical: 6 },
    smallActionText: { fontSize: 13 * fs, fontFamily: FONTS.bold },

    footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 6 },
    footerText: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.medium },
    linkedDate: { marginTop: 12, backgroundColor: t.accent + "14", borderRadius: RADIUS_SM, padding: 12 },
    linkedDateText: { color: t.accent, fontSize: 13 * fs, fontFamily: FONTS.bold, textAlign: "right" },

    calcBackdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    calcCard: { backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, ...SHADOW },
    calcTitle: { color: t.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
    calcDisplay: { backgroundColor: t.surfaceAlt, borderRadius: RADIUS_SM, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: t.hairline },
    calcExpr: { color: t.textPrimary, fontSize: 24, fontFamily: FONTS.bold, textAlign: "left" },
    calcResult: { color: t.accent, fontSize: 16, fontFamily: FONTS.medium, textAlign: "left", marginTop: 4 },
    calcGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    calcKey: { width: "22%", aspectRatio: 1.5, borderRadius: RADIUS_SM, backgroundColor: t.surfaceMuted, alignItems: "center", justifyContent: "center" },
    calcKeyText: { fontSize: 20, fontFamily: FONTS.bold },
    tapeBox: { marginTop: 12, backgroundColor: t.surfaceAlt, borderRadius: RADIUS_SM, padding: 10 },
    tapeLine: { color: t.textSecondary, fontSize: 13, fontFamily: FONTS.regular, textAlign: "left" },
    calcAction: { flex: 1, height: 48, borderRadius: RADIUS_SM, alignItems: "center", justifyContent: "center" },
    calcActionText: { fontSize: 15, fontFamily: FONTS.bold },
  });
}
