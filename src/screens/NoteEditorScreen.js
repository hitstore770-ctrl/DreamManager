import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";

import { FLUID } from "../utils/motion";
import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { useNotes } from "../context/NotesContext";
import { useSettings } from "../context/SettingsContext";
import { hapticLight } from "../utils/haptics";
import { gregorianToHebrew } from "../utils/hebrewDate";
import { extractLinks, openLink } from "../utils/linkify";
import { autoSum, evalArithmetic, scanInlineMath } from "../utils/mathEval";
import { countWords, parseInline, wrapSelection } from "../utils/markdownLite";
import { NOTE_BG, extractTags, noteBg, textToChecklist, uid } from "../utils/notesStore";
import { NOTES_FONTS as FONTS, NOTES_SHADOW as SHADOW_SM, NOTES_SHADOW_LG as SHADOW, NOTES_THEME } from "../utils/notesTheme";
import { RADIUS, RADIUS_SM } from "../utils/theme";
import HebrewDateTools from "../components/notes/HebrewDateTools";

// ---------------------------------------------------------------------------
// Dual-mode note editor:
//  • Zen 🪶 (default): pure white page, just a title and a huge body input.
//  • Pro ✨: soft-grey "work mode" with a rich-text toolbar that slides up
//    and pins above the keyboard (KeyboardAvoidingView).
// The mode is remembered per note.
// ---------------------------------------------------------------------------

const ZEN_BG = "#FFFFFF";
const PRO_BG = "#F9FAFC";
const HIGHLIGHT_BG = "#FFF3B0";
const INK_RED = "#D32F2F";
const INK_BLUE = "#1565C0";

// Smart business templates — injected verbatim at the cursor position.
// Aligned with the current business focus: vending machines and imports.
const SMART_TEMPLATES = [
  {
    key: "restock",
    emoji: "🥤",
    label: "מילוי מכונת שתייה",
    text: "מילוי מכונה: מיקום: ___ | פחיות שהוכנסו: ___ | נגבה מהמכונה: ___",
  },
  {
    key: "import",
    emoji: "📦",
    label: "הזמנת ייבוא",
    text: "הזמנת ייבוא: מוצר: ___ | ספק: ___ | עלות $: ___ | הגעה משוערת: ___",
  },
  {
    key: "meeting",
    emoji: "📋",
    label: "סיכום פגישה / רעיון",
    text: "סיכום פגישה/רעיון: ",
  },
];

export default function NoteEditorScreen({ route, navigation }) {
  const { fontScale, haptic } = useSettings();
  const theme = NOTES_THEME; // 770JLM Modern Light — scoped to the Notes editor
  const insets = useSafeAreaInsets();
  const noteId = route.params?.noteId;

  const { notes, setNotes, loaded } = useNotes();
  const note = notes.find((n) => n.id === noteId);

  // Local draft for the fast-changing fields; committed on a 3s debounce.
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
  const [showTemplates, setShowTemplates] = useState(false);

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

  // Flush on unmount so nothing is lost — including tags, otherwise leaving
  // the editor before the 3s debounce fires drops the note's #tag pills.
  useEffect(() => {
    return () => {
      if (initedRef.current) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, title, body, tags: extractTags(`${title} ${body}`), updatedAt: Date.now() }
              : n
          )
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  const today = useMemo(() => gregorianToHebrew(new Date()), []);
  const counts = countWords(body);
  const links = useMemo(() => extractLinks(body), [body]);
  // Phone numbers / URLs must not leak their digits into the auto-sum.
  const sum = useMemo(() => {
    let src = body;
    for (const l of links) src = src.split(l.label).join(" ");
    return autoSum(src);
  }, [body, links]);
  const inlineMath = useMemo(() => scanInlineMath(body), [body]);
  const segments = useMemo(() => parseInline(body), [body]);
  const liveTags = useMemo(() => extractTags(`${title} ${body}`), [title, body]);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: ZEN_BG }} />;
  }
  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: ZEN_BG, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.textMuted, fontFamily: FONTS.medium }}>ההערה לא נמצאה</Text>
      </View>
    );
  }

  const pro = !!note.proMode;
  const readOnly = note.readOnly;
  const fs = (note.fontSize || 17) * fontScale;
  const lineHeight = Math.max(24, Math.round(fs * 1.55));
  // Note-level ink color + alignment (Pro tools; harmless in Zen).
  const inkColor = note.inkColor === "red" ? INK_RED : note.inkColor === "blue" ? INK_BLUE : theme.textPrimary;
  const bodyAlign = note.align || "auto";
  // Pastel tint applies to the Pro editor card only.
  const cardBg =
    note.bg && note.bg !== "white" ? noteBg(note.bg, false) : "#FFFFFF";
  const s = makeStyles(theme, fontScale);

  const toggleMode = () => {
    hapticLight();
    patchNote({ proMode: !pro });
  };

  // ---- Rich-text markers --------------------------------------------------
  const applyMarker = (marker) => {
    if (readOnly) return;
    haptic("light");
    const { text, caret } = wrapSelection(body, selection.start, selection.end, marker);
    setBody(text);
    setSelection({ start: caret, end: caret });
  };
  const bumpFont = (delta) => {
    patchNote({ fontSize: Math.max(12, Math.min(30, (note.fontSize || 17) + delta)) });
  };
  const toggleInk = (color) => {
    haptic("light");
    patchNote({ inkColor: note.inkColor === color ? null : color });
  };
  const setAlign = (align) => {
    haptic("light");
    patchNote({ align });
  };

  // ---- Inline math --------------------------------------------------------
  // Trailing "expr=" appends the result (e.g. "150*4=" → "150*4= 600").
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

  // ---- Cursor insertion (timestamp / template) ----------------------------
  const insertAtCursor = (str) => {
    if (readOnly) return;
    haptic("light");
    const pos = Math.min(selection.start ?? body.length, body.length);
    const next = `${body.slice(0, pos)}${str}${body.slice(pos)}`;
    setBody(next);
    const caret = pos + str.length;
    setSelection({ start: caret, end: caret });
  };
  const insertTimestamp = () => {
    const now = new Date();
    insertAtCursor(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} `);
  };
  // Inject a business template verbatim at the cursor, on its own line.
  const insertTemplate = (tpl) => {
    setShowTemplates(false);
    const needsBreak = body && !body.endsWith("\n");
    insertAtCursor(`${needsBreak ? "\n" : ""}${tpl.text}\n`);
  };

  // Auto-Sum block: total every number in the note and append it at the end.
  // Phone numbers / links are excluded so contact details never inflate the
  // total. Re-running replaces the previous סה״כ line instead of stacking.
  const appendSumBlock = () => {
    if (readOnly) return;
    haptic("light");
    const stripped = body.replace(/^\s*סה״כ:.*$/gm, "").trimEnd();
    const line = `סה״כ: ${sum.total}`;
    const next = stripped ? `${stripped}\n\n${line}` : line;
    setBody(next);
    setSelection({ start: next.length, end: next.length });
  };

  const noteAsText = () => {
    const content = note.isChecklist
      ? note.checklist.map((i) => `${i.done ? "✓" : "•"} ${i.text}`).join("\n")
      : body;
    return `📝 ${title || "הערה"}\n\n${content}`;
  };

  const shareNote = async () => {
    haptic("light");
    try {
      await Share.share({ message: noteAsText() });
    } catch {
      /* user cancelled */
    }
  };

  // One-click WhatsApp: hand the exact note text to WhatsApp's share URL, and
  // fall back to the system share sheet when WhatsApp isn't installed.
  const sendToWhatsApp = async () => {
    haptic("light");
    const url = `whatsapp://send?text=${encodeURIComponent(noteAsText())}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through to the share sheet */
    }
    shareNote();
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
  const checklistDone = note.isChecklist ? note.checklist.filter((i) => i.done).length : 0;
  const checklistPct = note.isChecklist && note.checklist.length
    ? Math.round((checklistDone / note.checklist.length) * 100)
    : 0;

  // A toolbar key. Pass `icon` for a vector glyph, `label` for the typographic
  // ones (B / I / U / A / Σ) where a letterform is the clearer control.
  const TBtn = ({ label, icon, on, active, labelColor }) => (
    <Bounce
      style={[s.tbtn, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
      onPress={on}
    >
      {icon ? (
        <Icon name={icon} size={18} color={active ? "#FFF" : labelColor || theme.accent} />
      ) : (
        <Text style={[s.tbtnText, { color: active ? "#FFF" : labelColor || theme.accent }]}>{label}</Text>
      )}
    </Bounce>
  );

  const checklistBlock = (
    <View style={[pro ? s.editorCard : s.zenChecklistWrap, pro && { backgroundColor: cardBg }]}>
      <View style={s.progressWrap}>
        <Text style={s.progressText}>{checklistDone}/{note.checklist?.length || 0} הושלמו</Text>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${checklistPct}%`, backgroundColor: theme.accent }]} />
        </View>
      </View>
      {(note.checklist || []).map((item) => (
        // Rows spring into their new position as items are added or ticked.
        <Animated.View key={item.id} layout={FLUID} style={s.checkRow}>
          <Bounce
            style={[s.checkbox, item.done && { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={() => toggleItem(item.id)}
            scaleTo={0.85}
          >
            {item.done && <Text style={s.checkMark}>✓</Text>}
          </Bounce>
          <TextInput
            style={[
              s.checkText,
              { color: item.done ? theme.textMuted : inkColor, fontSize: fs, lineHeight },
              item.done && { textDecorationLine: "line-through" },
            ]}
            value={item.text}
            onChangeText={(t) => editChecklistItem(item.id, t)}
            placeholder="פריט..."
            placeholderTextColor={theme.textMuted}
            editable={!readOnly}
            textAlign="auto"
          />
        </Animated.View>
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
  );

  return (
    <View style={{ flex: 1, backgroundColor: pro ? PRO_BG : ZEN_BG }}>
      {/* Header: back · mode toggle · pin/share/lock */}
      <View style={[s.header, { paddingTop: insets.top + 10 }, !pro && { backgroundColor: ZEN_BG }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.icon}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modePill, pro && s.modePillPro]}
          onPress={toggleMode}
          activeOpacity={0.75}
        >
          <Text style={[s.modePillText, pro && { color: "#FFF" }]}>{pro ? "Pro ✨" : "Zen 🪶"}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={s.headerActions}>
          <TouchableOpacity
            style={[s.iconBtn, note.pinned && { backgroundColor: theme.accent }]}
            onPress={() => { hapticLight(); patchNote({ pinned: !note.pinned }); }}
            activeOpacity={0.7}
          >
            <Text style={s.icon}>📌</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={shareNote} activeOpacity={0.7}>
            <Text style={s.icon}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, note.locked && { backgroundColor: theme.accent }]}
            onPress={() => { hapticLight(); patchNote({ locked: !note.locked }); }}
            activeOpacity={0.7}
          >
            <Text style={s.icon}>{note.locked ? "🔒" : "🔓"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: pro ? 16 : 22, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Title */}
            <TextInput
              style={[s.title, { color: theme.textPrimary }]}
              value={title}
              onChangeText={setTitle}
              placeholder="כותרת ההערה"
              placeholderTextColor={theme.textMuted}
              editable={!readOnly}
              textAlign="auto"
            />

            {/* Pro extras: tag pills + inline math suggestions */}
            {pro && liveTags.length > 0 && (
              <View style={s.tagPillRow}>
                {liveTags.map((t) => (
                  <View key={t} style={s.tagPill}>
                    <Text style={s.tagPillText}>#{t}</Text>
                  </View>
                ))}
              </View>
            )}
            {pro && inlineMath.length > 0 && !note.isChecklist && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {inlineMath.map((m, i) => (
                  <TouchableOpacity key={i} style={s.mathChip} onPress={() => applyInline(m)} activeOpacity={0.8}>
                    <Text style={s.mathChipText}>{m.expr} = {m.value}  ⊕</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Body */}
            {note.isChecklist ? (
              checklistBlock
            ) : pro && preview ? (
              <View style={[s.editorCard, { backgroundColor: cardBg, minHeight: 260 }]}>
                <Text style={{ fontSize: fs, color: inkColor, textAlign: bodyAlign === "auto" ? "right" : bodyAlign, lineHeight }}>
                  {segments.map((seg, i) => (
                    <Text
                      key={i}
                      style={[
                        seg.bold && { fontFamily: FONTS.bold },
                        seg.italic && { fontStyle: "italic" },
                        seg.underline && { textDecorationLine: "underline" },
                        seg.highlight && { backgroundColor: HIGHLIGHT_BG },
                      ]}
                    >
                      {seg.text}
                    </Text>
                  ))}
                </Text>
              </View>
            ) : pro ? (
              <View style={[s.editorCard, { backgroundColor: cardBg }]}>
                <TextInput
                  style={[s.bodyInput, { color: inkColor, fontSize: fs, lineHeight, textAlign: bodyAlign }]}
                  value={body}
                  onChangeText={onBodyChange}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  placeholder="מצב עבודה: **מודגש**, ==מרקר==, #תגית, תרגיל 50*4="
                  placeholderTextColor={theme.textMuted}
                  multiline
                  editable={!readOnly}
                  textAlignVertical="top"
                />
              </View>
            ) : (
              // Zen: nothing but text on a white page.
              <TextInput
                style={[s.zenBody, { color: inkColor, fontSize: fs, lineHeight, textAlign: bodyAlign }]}
                value={body}
                onChangeText={onBodyChange}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                placeholder="פשוט לכתוב..."
                placeholderTextColor={theme.textMuted}
                multiline
                editable={!readOnly}
                textAlignVertical="top"
              />
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Auto-detected links / phone numbers */}
        {links.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.linksRow}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 8, alignItems: "center" }}
          >
            {links.map((l) => (
              <TouchableOpacity key={l.label} style={s.linkChip} onPress={() => openLink(l)} activeOpacity={0.7}>
                <Text style={s.linkChipText}>
                  {l.type === "phone" ? "📞" : "🔗"} {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Pro toolbar — slides up, pinned above the keyboard */}
        {pro && (
          <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutDown.duration(160)}>
            <View style={s.toolbarCard}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.toolbar}
                keyboardShouldPersistTaps="always"
              >
                <TBtn label="B" on={() => applyMarker("**")} />
                <TBtn label="I" on={() => applyMarker("*")} />
                <TBtn label="U" on={() => applyMarker("__")} />
                <TBtn icon="edit-2" on={() => applyMarker("==")} />
                <TBtn label="A" labelColor={INK_RED} active={note.inkColor === "red"} on={() => toggleInk("red")} />
                <TBtn label="A" labelColor={INK_BLUE} active={note.inkColor === "blue"} on={() => toggleInk("blue")} />
                <View style={s.tsep} />
                <TBtn icon="align-right" active={bodyAlign === "right"} on={() => setAlign("right")} />
                <TBtn icon="align-center" active={bodyAlign === "center"} on={() => setAlign("center")} />
                <TBtn icon="align-left" active={bodyAlign === "left"} on={() => setAlign("left")} />
                <View style={s.tsep} />
                {!note.isChecklist ? (
                  <TBtn icon="check-square" on={convertToChecklist} />
                ) : (
                  <TBtn icon="type" active on={() => patchNote({ isChecklist: false })} />
                )}
                <TBtn icon="file-plus" on={() => setShowTemplates(true)} />
                <View style={s.tsep} />
                {/* Advanced pro tools: WhatsApp · lock · auto-sum block */}
                <TBtn icon="message-circle" on={sendToWhatsApp} />
                <TBtn
                  icon={note.locked ? "lock" : "unlock"}
                  active={note.locked}
                  on={() => { hapticLight(); patchNote({ locked: !note.locked }); }}
                />
                <TBtn label="Σ" on={appendSumBlock} />
                <View style={s.tsep} />
                <TBtn icon="percent" on={() => setShowCalc(true)} />
                <TBtn icon="calendar" on={() => setShowDates(true)} />
                <TBtn icon="clock" on={insertTimestamp} />
                <View style={s.tsep} />
                {NOTE_BG.filter((b) => ["yellow", "blue", "green", "pink"].includes(b.key)).map((b) => (
                  <TouchableOpacity
                    key={b.key}
                    style={[
                      s.bgDot,
                      { backgroundColor: b.color },
                      note.bg === b.key && { borderColor: theme.accent, borderWidth: 3 },
                    ]}
                    onPress={() => patchNote({ bg: note.bg === b.key ? "white" : b.key })}
                    activeOpacity={0.8}
                  />
                ))}
                <View style={s.tsep} />
                <TBtn label="A−" on={() => bumpFont(-1)} />
                <TBtn label="A+" on={() => bumpFont(1)} />
                <TBtn icon="eye" active={preview} on={() => setPreview((p) => !p)} />
                <TBtn icon={readOnly ? "eye-off" : "edit-3"} active={readOnly} on={() => patchNote({ readOnly: !readOnly })} />
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* Bottom status line: date · counters · autosave */}
        <View style={[s.bottomLine, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: pro ? PRO_BG : ZEN_BG }]}>
          <Text style={s.bottomText}>{savedAt ? "נשמר ✓" : "שמירה אוטומטית"}</Text>
          <Text style={s.bottomText}>
            {counts.words} מילים · {counts.chars} תווים{sum.count > 0 ? ` · Σ ${sum.total}` : ""}
          </Text>
          <Text style={s.bottomText} numberOfLines={1}>📅 {today.formatted}</Text>
        </View>
      </KeyboardAvoidingView>

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

      {/* Smart business templates — injected at the cursor */}
      <Modal visible={showTemplates} transparent animationType="fade" onRequestClose={() => setShowTemplates(false)}>
        <TouchableWithoutFeedback onPress={() => setShowTemplates(false)}>
          <View style={s.calcBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.calcCard}>
                <Text style={s.calcTitle}>🪄 תבניות עסקיות</Text>
                {SMART_TEMPLATES.map((tpl) => (
                  <TouchableOpacity key={tpl.key} style={s.tplRow} onPress={() => insertTemplate(tpl)} activeOpacity={0.8}>
                    <Text style={s.tplPlus}>＋</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tplLabel}>{tpl.label}</Text>
                      <Text style={s.tplPreview} numberOfLines={1}>{tpl.text}</Text>
                    </View>
                    <Text style={s.tplEmoji}>{tpl.emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.calcAction, { backgroundColor: theme.surfaceMuted, marginTop: 6 }]}
                  onPress={() => setShowTemplates(false)}
                >
                  <Text style={[s.calcActionText, { color: theme.textSecondary }]}>סגור</Text>
                </TouchableOpacity>
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

function makeStyles(t, fsScale) {
  // Kill the browser's default black focus ring on web — the design has no
  // harsh borders anywhere. No-op on native.
  const NO_OUTLINE = Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {};
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
    headerActions: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    icon: { fontSize: 20, color: t.textPrimary, fontFamily: FONTS.bold },

    modePill: {
      minHeight: 42,
      paddingHorizontal: 16,
      borderRadius: 21,
      backgroundColor: t.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#EEF1F6",
    },
    modePillPro: { backgroundColor: t.accent, borderColor: t.accent },
    modePillText: { fontFamily: FONTS.bold, fontSize: 14 * fsScale, color: t.textSecondary },

    title: { fontSize: 24 * fsScale, fontFamily: FONTS.semibold, marginBottom: 10, paddingVertical: 4, ...NO_OUTLINE },

    // Zen body: bare text on the white page, light weight, roomy line height.
    zenBody: { flex: 1, minHeight: 460, fontFamily: FONTS.light, paddingBottom: 20, ...NO_OUTLINE },
    zenChecklistWrap: { paddingVertical: 4 },

    // Pro editor: white card on the soft-grey work surface.
    editorCard: {
      backgroundColor: "#FFFFFF",
      padding: 20,
      borderRadius: RADIUS,
      minHeight: 300,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    bodyInput: { flex: 1, minHeight: 260, textAlignVertical: "top", fontFamily: FONTS.regular, ...NO_OUTLINE },

    tagPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    tagPill: { backgroundColor: t.accent + "18", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
    tagPillText: { color: t.accent, fontSize: 13 * fsScale, fontFamily: FONTS.bold },

    mathChip: { backgroundColor: t.accent + "18", borderRadius: 28, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8 },
    mathChipText: { color: t.accent, fontSize: 14 * fsScale, fontFamily: FONTS.bold },

    // Pro toolbar card (pinned above the keyboard by KeyboardAvoidingView).
    toolbarCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 25,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#EEF1F6",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
      marginHorizontal: 12,
      marginBottom: 8,
    },
    toolbar: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingHorizontal: 2 },
    tbtn: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: RADIUS_SM, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: "#EEF1F6", alignItems: "center", justifyContent: "center" },
    tbtnText: { fontSize: 17 * fsScale, fontFamily: FONTS.bold, textAlign: "center" },
    tsep: { width: 1, height: 26, backgroundColor: t.hairline, marginHorizontal: 4 },
    bgDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.hairline },

    linksRow: { flexGrow: 0, marginBottom: 6 },
    linkChip: {
      minHeight: 40,
      borderRadius: 28,
      backgroundColor: t.accent + "10",
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    linkChipText: { fontFamily: FONTS.semibold, fontSize: 12 * fsScale, color: t.accent },

    bottomLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: "#EEF1F6",
      gap: 8,
    },
    bottomText: { fontFamily: FONTS.regular, fontSize: 11 * fsScale, color: t.textMuted },

    progressWrap: { marginBottom: 14 },
    progressText: { color: t.textSecondary, fontSize: 13 * fsScale, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 6 },
    progressBg: { height: 10, borderRadius: 6, backgroundColor: t.surfaceMuted, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 6 },
    checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 10 },
    checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: t.textMuted, alignItems: "center", justifyContent: "center" },
    checkMark: { color: "#FFF", fontSize: 15, fontFamily: FONTS.bold },
    checkText: { flex: 1, fontFamily: FONTS.regular, paddingVertical: 2, ...NO_OUTLINE },
    checkActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
    smallAction: { paddingVertical: 6 },
    smallActionText: { fontSize: 13 * fsScale, fontFamily: FONTS.bold },

    calcBackdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    calcCard: { backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, ...SHADOW },
    calcTitle: { color: t.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
    tplRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surfaceAlt, borderRadius: RADIUS_SM, padding: 14, marginBottom: 8, minHeight: 56 },
    tplEmoji: { fontSize: 24 },
    tplLabel: { color: t.textPrimary, fontSize: 15 * fsScale, fontFamily: FONTS.bold, textAlign: "right" },
    tplPreview: { color: t.textMuted, fontSize: 12 * fsScale, fontFamily: FONTS.regular, textAlign: "right", marginTop: 2 },
    tplPlus: { color: t.accent, fontSize: 22, fontFamily: FONTS.bold },
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
