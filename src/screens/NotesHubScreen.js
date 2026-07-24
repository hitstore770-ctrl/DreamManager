import { useMemo, useState } from "react";
import {
  I18nManager,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotes } from "../context/NotesContext";
import { useSettings } from "../context/SettingsContext";
import { gregorianToHebrew } from "../utils/hebrewDate";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { shekel, todayKey } from "../utils/posStore";
import { checklistToText, makeNote, noteBg } from "../utils/notesStore";
import { FONTS, RADIUS, RADIUS_SM, SHADOW, SHADOW_SM } from "../utils/theme";
import { usePersistentState } from "../utils/usePersistentState";

// ── The eight scaffolded tools (functional where cheap, informative preview
// where they need deeper wiring). Rendered in the "toolbox" sheet. ──
const TOOLBOX = [
  { key: "search", emoji: "🔎", label: "חיפוש מתקדם" },
  { key: "template", emoji: "🧩", label: "מחולל תבניות" },
  { key: "tags", emoji: "🏷️", label: "מערכת תיוג" },
  { key: "journal", emoji: "📔", label: "יומן יומי" },
  { key: "business", emoji: "💼", label: "שילוב עסקי" },
  { key: "reminders", emoji: "⏰", label: "תזכורות" },
  { key: "export", emoji: "📤", label: "ייצוא PDF/וואטסאפ" },
  { key: "security", emoji: "🛡️", label: "אבטחת הערה" },
];

const TEMPLATES = [
  {
    key: "print",
    label: "הזמנת הדפסה ומדבקות A5",
    body: "🖨️ הזמנת הדפסה ומדבקות A5\nשם הלקוח: \nכמות: \nסוג: \nסה״כ: ",
  },
  { key: "meeting", label: "סיכום פגישה", body: "📋 סיכום פגישה\nתאריך: \nמשתתפים: \n\nנושאים:\n• \n\nמשימות להמשך:\n• " },
  { key: "shopping", label: "רשימת קניות", body: "🛒 רשימת קניות\n• \n• \n• " },
  { key: "idea", label: "רעיון לעסק", body: "💡 רעיון\nהרעיון: \nקהל יעד: \nעלות משוערת: \nרווח פוטנציאלי: " },
  { key: "daily", label: "מטלות היום", body: "✅ המשימות שלי להיום\n• \n• \n• " },
];

export default function NotesHubScreen({ navigation }) {
  const { theme, fontScale, haptic } = useSettings();
  const insets = useSafeAreaInsets();

  const { notes, setNotes } = useNotes();
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [toolbox, setToolbox] = useState(false);
  const [panel, setPanel] = useState(null); // scaffold panel key
  const [actionNote, setActionNote] = useState(null); // per-note action sheet

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter((n) => {
      const hay = `${n.title} ${n.body} ${checklistToText(n.checklist)} ${(n.tags || []).join(" ")}`.toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchTag = !activeTag || (n.tags || []).includes(activeTag);
      return matchQ && matchTag;
    });
    // pinned first, then most recently updated
    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [notes, query, activeTag]);

  const openNote = (id) => {
    haptic("light");
    navigation.navigate("NoteEditor", { noteId: id });
  };
  const createNote = (overrides) => {
    const n = makeNote(overrides);
    setNotes((prev) => [n, ...prev]);
    navigation.navigate("NoteEditor", { noteId: n.id });
  };
  const patch = (id, fields) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)));
  const remove = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const runTool = (key) => {
    haptic("light");
    setToolbox(false);
    if (key === "search") {
      setPanel(null);
      return; // the search bar is always visible at top
    }
    if (key === "journal") {
      const heb = gregorianToHebrew(new Date());
      createNote({ title: `יומן · ${heb.formatted}`, body: "מה קרה היום?\n\nתודות:\n• \n\nמחר אני רוצה: " });
      return;
    }
    if (key === "business") {
      const today = todayKey();
      const todays = (sales || []).filter((x) => x.day === today && x.kind === "sale");
      const rev = todays.reduce((a, x) => a + (x.total || 0), 0);
      const prof = todays.reduce((a, x) => a + (x.profit || 0), 0);
      createNote({
        title: `סיכום עסקי · ${gregorianToHebrew(new Date()).formatted}`,
        body: `💼 סיכום המכירות היום\nעסקאות: ${todays.length}\nהכנסה: ${shekel(rev)}\nרווח: ${shekel(prof)}\n\nהערות:\n• `,
        tags: ["עסקי"],
      });
      return;
    }
    // template / tags / reminders / export / security → scaffold panels
    setPanel(key);
  };

  const exportAll = async () => {
    const text = filtered
      .map((n) => `📝 ${n.title || "ללא כותרת"}\n${n.isChecklist ? checklistToText(n.checklist) : n.body}`)
      .join("\n\n———\n\n");
    try {
      await Share.share({ message: text || "אין הערות לייצוא" });
    } catch {
      /* user cancelled */
    }
    setPanel(null);
  };

  const s = makeStyles(theme, fontScale);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>🗒️ פתקים</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setToolbox(true)} activeOpacity={0.7}>
          <Text style={s.icon}>🧰</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="🔎 חיפוש בכל ההערות..."
          placeholderTextColor={theme.textMuted}
          textAlign="right"
        />
      </View>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagRow}>
          <TouchableOpacity style={[s.tag, !activeTag && { backgroundColor: theme.accent }]} onPress={() => setActiveTag(null)}>
            <Text style={[s.tagText, { color: !activeTag ? "#FFF" : theme.textSecondary }]}>הכל</Text>
          </TouchableOpacity>
          {allTags.map((t) => (
            <TouchableOpacity key={t} style={[s.tag, activeTag === t && { backgroundColor: theme.accent }]} onPress={() => setActiveTag(t)}>
              <Text style={[s.tagText, { color: activeTag === t ? "#FFF" : theme.textSecondary }]}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Notes grid */}
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {filtered.map((n) => {
            const bg = noteBg(n.bg, theme.scheme === "dark");
            const preview = n.secured
              ? "🔒 הערה מוגנת"
              : n.isChecklist
                ? checklistToText(n.checklist).slice(0, 120)
                : (n.body || "").slice(0, 120);
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.note, { backgroundColor: bg }]}
                activeOpacity={0.85}
                onPress={() => (n.secured ? setActionNote(n) : openNote(n.id))}
                onLongPress={() => setActionNote(n)}
              >
                <View style={s.noteTop}>
                  {n.pinned && <Text style={s.pin}>📌</Text>}
                  <Text style={[s.noteTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    {n.title || "ללא כותרת"}
                  </Text>
                </View>
                <Text style={[s.notePreview, { color: theme.textSecondary }]} numberOfLines={4}>
                  {preview}
                </Text>
                <View style={s.noteFoot}>
                  {n.isChecklist && (
                    <Text style={s.noteBadge}>✅ {n.checklist.filter((i) => i.done).length}/{n.checklist.length}</Text>
                  )}
                  {(n.tags || []).slice(0, 1).map((t) => (
                    <Text key={t} style={[s.noteBadge, { color: theme.accent }]}>#{t}</Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {filtered.length === 0 && (
          <Text style={s.empty}>{query ? "לא נמצאו הערות" : "אין הערות עדיין. הקש על ＋ ליצירת הערה חדשה."}</Text>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 24 }, I18nManager.isRTL ? { left: 22 } : { right: 22 }]}
        activeOpacity={0.85}
        onPress={() => createNote({})}
      >
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Toolbox sheet */}
      <Sheet visible={toolbox} onClose={() => setToolbox(false)} theme={theme} title="🧰 ארגז הכלים של הפנקס">
        <View style={s.grid}>
          {TOOLBOX.map((t) => (
            <TouchableOpacity key={t.key} style={[s.toolCard, { backgroundColor: theme.surfaceAlt }]} onPress={() => runTool(t.key)} activeOpacity={0.85}>
              <Text style={s.toolEmoji}>{t.emoji}</Text>
              <Text style={[s.toolLabel, { color: theme.textPrimary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Sheet>

      {/* Per-note actions */}
      <Sheet visible={!!actionNote} onClose={() => setActionNote(null)} theme={theme} title={actionNote?.title || "הערה"}>
        {actionNote && (
          <View style={{ gap: 8 }}>
            <ActionRow theme={theme} label={actionNote.secured ? "🔓 בטל הגנה ופתח" : "✏️ פתח לעריכה"} onPress={() => { const id = actionNote.id; if (actionNote.secured) patch(id, { secured: false }); setActionNote(null); openNote(id); }} />
            <ActionRow theme={theme} label={actionNote.pinned ? "📍 בטל נעיצה" : "📌 נעץ למעלה"} onPress={() => { patch(actionNote.id, { pinned: !actionNote.pinned }); setActionNote(null); }} />
            <ActionRow theme={theme} label={actionNote.secured ? "🛡️ מוגן (הפעל/כבה)" : "🛡️ הגן על ההערה"} onPress={() => { patch(actionNote.id, { secured: !actionNote.secured }); setActionNote(null); }} />
            <ActionRow theme={theme} label="📤 שתף / ייצא" onPress={async () => { const n = actionNote; setActionNote(null); try { await Share.share({ message: `📝 ${n.title}\n${n.isChecklist ? checklistToText(n.checklist) : n.body}` }); } catch {} }} />
            <ActionRow theme={theme} danger label="🗑️ מחק" onPress={() => { remove(actionNote.id); setActionNote(null); }} />
          </View>
        )}
      </Sheet>

      {/* Scaffold panels for template / tags / reminders / export / security */}
      <Sheet visible={panel !== null} onClose={() => setPanel(null)} theme={theme} title={TOOLBOX.find((t) => t.key === panel)?.label || ""}>
        {panel === "template" && (
          <View style={{ gap: 8 }}>
            <Text style={s.panelHint}>בחר תבנית מוכנה — תיווצר הערה חדשה:</Text>
            {TEMPLATES.map((t) => (
              <ActionRow key={t.key} theme={theme} label={`🧩 ${t.label}`} onPress={() => { setPanel(null); createNote({ title: t.label, body: t.body }); }} />
            ))}
          </View>
        )}
        {panel === "tags" && (
          <View>
            <Text style={s.panelHint}>תיוגים קיימים ({allTags.length}). הקש כדי לסנן:</Text>
            <View style={[s.grid, { marginTop: 8 }]}>
              {allTags.map((t) => (
                <TouchableOpacity key={t} style={[s.tag, { margin: 4 }]} onPress={() => { setActiveTag(t); setPanel(null); }}>
                  <Text style={[s.tagText, { color: theme.textSecondary }]}>#{t}</Text>
                </TouchableOpacity>
              ))}
              {allTags.length === 0 && <Text style={s.panelHint}>אין תיוגים עדיין. הוסף תיוגים להערות דרך העורך (בגרסה הבאה) או צור סיכום עסקי המתייג אוטומטית.</Text>}
            </View>
          </View>
        )}
        {panel === "export" && (
          <View style={{ gap: 8 }}>
            <Text style={s.panelHint}>ייצוא {filtered.length} ההערות המוצגות:</Text>
            <ActionRow theme={theme} label="💬 שתף כטקסט / וואטסאפ" onPress={exportAll} />
            <ActionRow theme={theme} label="📄 ייצוא PDF (בקרוב)" muted onPress={() => {}} />
            <Text style={s.panelHint}>ייצוא PDF מלא ישולב עם expo-print בגרסה הבאה. שיתוף הטקסט פעיל לוואטסאפ ולכל אפליקציה.</Text>
          </View>
        )}
        {panel === "reminders" && (
          <View>
            <Text style={s.panelHint}>מנוע התזכורות (מתוכנן):</Text>
            {["⏰ תזכורת לפי שעה", "📅 תזכורת לפי תאריך עברי", "🔁 תזכורת חוזרת", "🔔 התראת דחיפה"].map((r) => (
              <View key={r} style={s.scaffoldRow}><Text style={s.scaffoldText}>{r}</Text><Text style={s.soon}>בקרוב</Text></View>
            ))}
          </View>
        )}
        {panel === "security" && (
          <View>
            <Text style={s.panelHint}>אבטחת הערות:</Text>
            <View style={s.scaffoldRow}><Text style={s.scaffoldText}>🛡️ הגנת הערה (טשטוש)</Text><Text style={[s.soon, { color: theme.success }]}>פעיל</Text></View>
            <View style={s.scaffoldRow}><Text style={s.scaffoldText}>🔢 נעילת PIN לפנקס</Text><Text style={s.soon}>דרך ההגדרות</Text></View>
            <Text style={s.panelHint}>סמן הערה כ״מוגנת״ (לחיצה ארוכה על הערה) כדי לטשטש אותה ברשימה. נעילת PIN גלובלית זמינה במסך ההגדרות.</Text>
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Sheet({ visible, onClose, theme, title, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, maxHeight: "80%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: theme.textPrimary, fontSize: 18, fontFamily: FONTS.bold, flex: 1, textAlign: "right" }}>{title}</Text>
                <TouchableOpacity onPress={onClose}><Text style={{ color: theme.textMuted, fontSize: 18, fontFamily: FONTS.bold, marginStart: 12 }}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function ActionRow({ theme, label, onPress, danger, muted }) {
  return (
    <TouchableOpacity
      style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, opacity: muted ? 0.5 : 1 }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={{ color: danger ? theme.danger : theme.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t, fs) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 12 },
    iconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    icon: { fontSize: 20, color: t.textPrimary, fontFamily: FONTS.bold },
    title: { color: t.textPrimary, fontSize: 19 * fs, fontFamily: FONTS.bold },
    searchWrap: { paddingHorizontal: 14, marginBottom: 10 },
    search: { backgroundColor: t.surface, borderRadius: RADIUS_SM, paddingVertical: 12, paddingHorizontal: 16, color: t.textPrimary, fontFamily: FONTS.regular, fontSize: 15, ...SHADOW_SM },
    tagRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
    tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: t.surface, ...SHADOW_SM },
    tagText: { fontSize: 13 * fs, fontFamily: FONTS.bold },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    note: { width: "46%", minHeight: 120, margin: "2%", borderRadius: RADIUS, padding: 14, ...SHADOW_SM },
    noteTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    pin: { fontSize: 13 },
    noteTitle: { flex: 1, fontSize: 15 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    notePreview: { fontSize: 13 * fs, fontFamily: FONTS.regular, textAlign: "right", lineHeight: 19 * fs },
    noteFoot: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
    noteBadge: { fontSize: 11 * fs, fontFamily: FONTS.bold, color: t.textMuted },
    empty: { color: t.textMuted, fontSize: 14 * fs, fontFamily: FONTS.regular, textAlign: "center", marginTop: 50, paddingHorizontal: 30, lineHeight: 22 },
    fab: { position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", ...SHADOW },
    fabIcon: { color: "#FFF", fontSize: 34, fontFamily: FONTS.bold, marginTop: -4 },
    toolCard: { width: "29.33%", margin: "2%", aspectRatio: 1, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", padding: 8 },
    toolEmoji: { fontSize: 28, marginBottom: 8 },
    toolLabel: { fontSize: 11.5 * fs, fontFamily: FONTS.bold, textAlign: "center" },
    panelHint: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 8, lineHeight: 20 },
    scaffoldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.hairline },
    scaffoldText: { color: t.textPrimary, fontSize: 14 * fs, fontFamily: FONTS.medium },
    soon: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.bold },
  });
}
