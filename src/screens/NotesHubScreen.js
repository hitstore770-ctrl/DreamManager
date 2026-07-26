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
import { ScrollView, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";


import Icon from "../components/Icon";
import { SCREEN_IN } from "../utils/motion";
import PinLock from "../components/PinLock";
import { useNotes } from "../context/NotesContext";
import { useSettings } from "../context/SettingsContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";

// Default note-lock PIN (hardcoded for now, per Sprint 2 spec).
const LOCK_PIN = "1234";
import { gregorianToHebrew } from "../utils/hebrewDate";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { shekel, todayKey } from "../utils/posStore";
import { checklistToText, makeNote, noteBg } from "../utils/notesStore";
import { NOTES_FONTS as FONTS, NOTES_SHADOW as SHADOW_SM, NOTES_SHADOW_LG as SHADOW, NOTES_THEME } from "../utils/notesTheme";
import { RADIUS, RADIUS_SM } from "../utils/theme";
import { usePersistentState } from "../utils/usePersistentState";

// Hub surface: white cards on soft grey, per the Phase 2 spec.
const BLUE_TITLE = "#003366";
const GOLD_HDR = "#D4AF37";
const HUB_BG = "#F0F2F5";

// Rough reading-time estimate at ~200 words/min (min 1 minute).
function readTime(note) {
  const text = note.isChecklist ? checklistToText(note.checklist) : note.body || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

// Compact "last updated" stamp: time today, date otherwise.
function fmtUpdated(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : `${d.getDate()}.${d.getMonth() + 1}`;
}

// Stable per-tag pill color derived from the tag text.
const TAG_COLORS = ["#3E7BD6", "#1E9E58", "#B05AC4", "#D4952C", "#E8635A"];
function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

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
    key: "restock",
    label: "סבב מילוי מכונות",
    body: "🥤 סבב מילוי מכונות\nמיקום: \nפחיות שהוכנסו: \nנגבה מהמכונה: \nתקלות: ",
  },
  { key: "meeting", label: "סיכום פגישה", body: "📋 סיכום פגישה\nתאריך: \nמשתתפים: \n\nנושאים:\n• \n\nמשימות להמשך:\n• " },
  { key: "shopping", label: "רשימת קניות", body: "🛒 רשימת קניות\n• \n• \n• " },
  { key: "idea", label: "רעיון לעסק", body: "💡 רעיון\nהרעיון: \nקהל יעד: \nעלות משוערת: \nרווח פוטנציאלי: " },
  { key: "daily", label: "מטלות היום", body: "✅ המשימות שלי להיום\n• \n• \n• " },
];

export default function NotesHubScreen({ navigation }) {
  const { fontScale, haptic, compactMode: compact } = useSettings();
  const theme = NOTES_THEME; // 770JLM Modern Light — scoped to the Notes Hub
  const insets = useSafeAreaInsets();

  const { notes, setNotes } = useNotes();
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [toolbox, setToolbox] = useState(false);
  const [panel, setPanel] = useState(null); // scaffold panel key
  const [actionNote, setActionNote] = useState(null); // per-note action sheet
  const [pinNote, setPinNote] = useState(null); // locked note awaiting PIN

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

  // Two-column masonry: distribute cards into the currently shorter column
  // (estimated by preview length), preserving the pinned-first order.
  const columns = useMemo(() => {
    const left = [];
    const right = [];
    let hl = 0;
    let hr = 0;
    filtered.forEach((n, i) => {
      const textLen = n.locked
        ? 20
        : (n.isChecklist ? checklistToText(n.checklist) : n.body || "").length;
      const est = 92 + Math.min(70, textLen / 2) + ((n.tags || []).length ? 26 : 0);
      const item = { note: n, index: i };
      if (hl <= hr) {
        left.push(item);
        hl += est;
      } else {
        right.push(item);
        hr += est;
      }
    });
    return [left, right];
  }, [filtered]);

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
  const togglePin = (n) => {
    hapticLight(); // light vibration when pinned
    patch(n.id, { pinned: !n.pinned });
  };
  const deleteNote = (id) => {
    hapticSuccess(); // success vibration on delete
    remove(id);
  };

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

  // Daily Journal generator — one tap creates a dated work-journal note with a
  // ready-made timeline layout.
  const generateJournal = () => {
    haptic("light");
    const dateStr = new Date().toLocaleDateString("he-IL");
    const title = `יומן עבודה - ${dateStr}`;
    const body = [
      `📔 ${title}`,
      "",
      "🕘 09:00 — ",
      "🕚 11:00 — ",
      "🕐 13:00 — ",
      "🕒 15:00 — ",
      "🕔 17:00 — ",
      "",
      "📝 סיכום היום:",
      "",
    ].join("\n");
    createNote({ title, body, tags: ["יומן"] });
  };

  const s = makeStyles(theme, fontScale);

  return (
    <Animated.View entering={SCREEN_IN} style={{ flex: 1, backgroundColor: HUB_BG }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.titleRow}>
          <Icon name="edit-3" size={20} color={BLUE_TITLE} />
          <Text style={s.title}>פתקים</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.journalBtn} onPress={generateJournal} activeOpacity={0.8}>
            <Icon name="book" size={15} color={GOLD_HDR} />
            <Text style={s.journalText}>יומן עבודה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => setToolbox(true)} activeOpacity={0.7}>
            <Icon name="grid" size={19} color={BLUE_TITLE} />
          </TouchableOpacity>
        </View>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tagRowScroll}
          contentContainerStyle={s.tagRow}
        >
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

      {/* Notes — two-column masonry of white cards on soft grey */}
      <ScrollView contentContainerStyle={{ padding: compact ? 6 : 12, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Newest/pinned note must read top-right; native RTL flips `row`
            already, web (isRTL false) needs the explicit reverse. */}
        <View style={[s.masonry, !I18nManager.isRTL && { flexDirection: "row-reverse" }]}>
          {columns.map((col, ci) => (
            <View key={ci} style={{ flex: 1, gap: 10 }}>
              {col.map(({ note: n, index }) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  index={index}
                  theme={theme}
                  styles={s}
                  onOpen={() => (n.locked ? setPinNote(n) : openNote(n.id))}
                  onLong={() => setActionNote(n)}
                  onDelete={() => deleteNote(n.id)}
                />
              ))}
            </View>
          ))}
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
            <ActionRow theme={theme} label="✏️ פתח לעריכה" onPress={() => { const n = actionNote; setActionNote(null); n.locked ? setPinNote(n) : openNote(n.id); }} />
            <ActionRow theme={theme} label={actionNote.pinned ? "📍 בטל נעיצה" : "📌 נעץ למעלה"} onPress={() => { togglePin(actionNote); setActionNote(null); }} />
            <ActionRow theme={theme} label={actionNote.locked ? "🔓 בטל נעילה" : "🔒 נעל הערה"} onPress={() => { patch(actionNote.id, { locked: !actionNote.locked }); setActionNote(null); }} />
            <ActionRow theme={theme} label="📤 שתף / ייצא" onPress={async () => { const n = actionNote; setActionNote(null); try { await Share.share({ message: `📝 ${n.title}\n${n.isChecklist ? checklistToText(n.checklist) : n.body}` }); } catch {} }} />
            <ActionRow theme={theme} danger label="🗑️ מחק" onPress={() => { deleteNote(actionNote.id); setActionNote(null); }} />
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
            <View style={s.scaffoldRow}><Text style={s.scaffoldText}>🔒 נעילת הערה + קוד</Text><Text style={[s.soon, { color: theme.success }]}>פעיל</Text></View>
            <View style={s.scaffoldRow}><Text style={s.scaffoldText}>🔢 נעילת PIN לפנקס</Text><Text style={s.soon}>דרך ההגדרות</Text></View>
            <Text style={s.panelHint}>נעל הערה מתוך העורך (אייקון המנעול) או בלחיצה ארוכה. הערה נעולה מוצגת מטושטשת ודורשת קוד ({LOCK_PIN}) לפתיחה.</Text>
          </View>
        )}
      </Sheet>

      {/* PIN gate for opening a locked note */}
      {pinNote && (
        <PinLock
          mode="unlock"
          expected={LOCK_PIN}
          themeOverride={NOTES_THEME}
          onSuccess={() => { const id = pinNote.id; setPinNote(null); openNote(id); }}
          onCancel={() => setPinNote(null)}
        />
      )}
    </Animated.View>
  );
}

// A white masonry note card (pastel-tinted when the note chose a color).
// Swipe left reveals a red trash action; entrance fades in with a light
// stagger so navigating back from the editor feels seamless.
function NoteCard({ note, index, theme, styles, onOpen, onLong, onDelete }) {
  const bg = noteBg(note.bg, theme.scheme === "dark");
  const preview = note.locked
    ? "🔒 הערה נעולה  ***"
    : note.isChecklist
      ? checklistToText(note.checklist).slice(0, 140)
      : (note.body || "").slice(0, 140) || "הערה ריקה";
  const mins = readTime(note);

  const renderRightActions = () => (
    <View style={styles.deleteAction}>
      <Text style={styles.deleteIcon}>🗑️</Text>
      <Text style={styles.deleteLabel}>מחק</Text>
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 320)).duration(240)}>
      <Swipeable
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => onDelete()}
        overshootRight={false}
        friction={2}
        rightThreshold={44}
      >
        <TouchableOpacity
          style={[styles.card, { backgroundColor: bg }]}
          activeOpacity={0.85}
          onPress={onOpen}
          onLongPress={onLong}
        >
          <View style={styles.cardTop}>
            {note.pinned && <Text style={styles.pin}>📌</Text>}
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {note.title || "ללא כותרת"}
            </Text>
          </View>
          <Text style={[styles.cardPreview, { color: theme.textSecondary }]} numberOfLines={2}>
            {preview}
          </Text>
          {(note.tags || []).length > 0 && (
            <View style={styles.cardTags}>
              {(note.tags || []).slice(0, 3).map((t) => (
                <View key={t} style={[styles.tagPill, { backgroundColor: tagColor(t) + "1C" }]}>
                  <Text style={[styles.tagPillText, { color: tagColor(t) }]}>#{t}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.cardFoot}>
            <Text style={styles.readTime}>🕐 {fmtUpdated(note.updatedAt)}</Text>
            <Text style={styles.readTime}>⏱️ {mins} דק׳</Text>
            {note.isChecklist && (
              <Text style={styles.badge}>✅ {note.checklist.filter((i) => i.done).length}/{note.checklist.length}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
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
    titleRow: {
      flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    icon: { fontSize: 20, color: t.textPrimary, fontFamily: FONTS.medium },
    journalBtn: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 7, height: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.gold, ...SHADOW_SM },
    journalText: { color: t.gold, fontSize: 13 * fs, fontFamily: FONTS.semibold },
    title: { color: t.textPrimary, fontSize: 20 * fs, fontFamily: FONTS.bold },
    searchWrap: { paddingHorizontal: 14, marginBottom: 12 },
    search: { backgroundColor: t.surface, borderRadius: RADIUS, paddingVertical: 13, paddingHorizontal: 18, color: t.textPrimary, fontFamily: FONTS.regular, fontSize: 15, borderWidth: 1, borderColor: t.hairline, ...SHADOW_SM },
    // flexGrow:0 + centered items — without them the horizontal ScrollView
    // stretches the filter chips into full-height bars.
    tagRowScroll: { flexGrow: 0, marginBottom: 8 },
    tagRow: { paddingHorizontal: 14, gap: 8, alignItems: "center" },
    tag: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, alignItems: "center", justifyContent: "center" },
    tagText: { fontSize: 13 * fs, fontFamily: FONTS.semibold },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    masonry: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    // White masonry cards on the soft-grey hub background.
    card: { backgroundColor: "#FFFFFF", borderRadius: RADIUS, padding: 14, borderWidth: 1, borderColor: t.hairline, ...SHADOW_SM },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
    pin: { fontSize: 13 },
    cardTitle: { flex: 1, fontSize: 15 * fs, fontFamily: FONTS.semibold, textAlign: "right" },
    cardPreview: { fontSize: 13 * fs, fontFamily: FONTS.light, textAlign: "right", lineHeight: 20 * fs },
    cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
    tagPill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3 },
    tagPillText: { fontSize: 11 * fs, fontFamily: FONTS.bold },
    cardFoot: { flexDirection: "row", gap: 8, marginTop: 9, flexWrap: "wrap", alignItems: "center" },
    readTime: { fontSize: 11 * fs, fontFamily: FONTS.regular, color: t.textMuted },
    badge: { fontSize: 11 * fs, fontFamily: FONTS.semibold, color: t.textMuted },
    deleteAction: {
      backgroundColor: t.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 72,
      borderRadius: RADIUS,
    },
    deleteIcon: { fontSize: 22 },
    deleteLabel: { color: "#FFF", fontFamily: FONTS.bold, fontSize: 12, marginTop: 2 },
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
