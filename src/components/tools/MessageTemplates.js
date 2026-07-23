import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const CATEGORIES = [
  { key: "clients", label: "לקוחות", color: "#1B3A6B" },
  { key: "suppliers", label: "ספקים", color: "#1E9E58" },
  { key: "friends", label: "חברים", color: "#F4B400" },
];

const SEED = [
  {
    id: "s1",
    title: "אישור הזמנה",
    category: "clients",
    body: "היי [שם], ההזמנה שלך התקבלה! הסכום לתשלום: [מחיר]₪. נעדכן כשהיא בדרך 🚚",
    uses: 0,
  },
  {
    id: "s2",
    title: "בקשת הצעת מחיר",
    category: "suppliers",
    body: "שלום, אשמח להצעת מחיר עבור [פריט] בכמות [כמות]. תודה!",
    uses: 0,
  },
];

function placeholdersOf(text) {
  const matches = text.match(/\[[^\]]+\]/g) || [];
  return [...new Set(matches)];
}

function catOf(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

const EMPTY = { title: "", category: "clients", body: "" };

export default function MessageTemplates() {
  const [snippets, setSnippets] = usePersistentState(STORAGE_KEYS.snippets, SEED);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortUsed, setSortUsed] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState(""); // editable text for the expanded card

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = snippets.filter((s) => {
      if (filter !== "all" && s.category !== filter) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q);
    });
    arr = [...arr];
    if (sortUsed) arr.sort((a, b) => (b.uses || 0) - (a.uses || 0));
    return arr;
  }, [snippets, filter, search, sortUsed]);

  const bump = (id) =>
    setSnippets((prev) => prev.map((s) => (s.id === id ? { ...s, uses: (s.uses || 0) + 1 } : s)));

  const expand = (s) => {
    if (expandedId === s.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s.id);
    setDraft(s.body);
  };

  const copyText = async (s) => {
    const text = expandedId === s.id ? draft : s.body;
    await Clipboard.setStringAsync(text);
    bump(s.id);
    Alert.alert("הועתק ✓", "ההודעה מוכנה להדבקה");
  };

  const sendWhatsapp = (s) => {
    const text = expandedId === s.id ? draft : s.body;
    bump(s.id);
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() =>
        Alert.alert("שגיאה", "לא ניתן לפתוח וואטסאפ")
      )
    );
  };

  const removeSnippet = (id) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({ title: s.title, category: s.category, body: s.body });
    setEditId(s.id);
    setShowForm(true);
  };

  const saveForm = () => {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert("חסר תוכן", "נא למלא כותרת ותוכן");
      return;
    }
    if (editId) {
      setSnippets((prev) =>
        prev.map((s) => (s.id === editId ? { ...s, ...form, title: form.title.trim(), body: form.body.trim() } : s))
      );
    } else {
      setSnippets((prev) => [
        { id: Date.now().toString(), ...form, title: form.title.trim(), body: form.body.trim(), uses: 0 },
        ...prev,
      ]);
    }
    setShowForm(false);
  };

  const exportAll = async () => {
    if (snippets.length === 0) {
      Alert.alert("ריק", "אין הודעות לייצוא");
      return;
    }
    const text = snippets
      .map((s) => `【${s.title}】(${catOf(s.category).label})\n${s.body}`)
      .join("\n\n———\n\n");
    try {
      await Share.share({ message: text, title: "ייצוא הודעות" });
    } catch {
      await Clipboard.setStringAsync(text);
      Alert.alert("הועתק ✓", "כל ההודעות הועתקו ללוח");
    }
  };

  return (
    <View>
      {/* Search */}
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="🔍 חיפוש הודעה..."
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />

      {/* Filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === "all" && styles.filterActive]}
          onPress={() => setFilter("all")}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>הכל</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.filterChip, filter === c.key && { backgroundColor: c.color }]}
            onPress={() => setFilter(c.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterText, filter === c.key && styles.filterTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, sortUsed && styles.toolBtnOn]}
          onPress={() => setSortUsed((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.toolBtnText}>{sortUsed ? "✓ לפי שימוש" : "↕ מיין לפי שימוש"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={exportAll} activeOpacity={0.85}>
          <Text style={styles.toolBtnText}>↗ ייצוא הכל</Text>
        </TouchableOpacity>
      </View>

      {/* Cards */}
      {list.length === 0 ? (
        <Text style={styles.empty}>אין הודעות. הוסף אחת עם הכפתור למטה.</Text>
      ) : (
        list.map((s) => {
          const cat = catOf(s.category);
          const expanded = expandedId === s.id;
          const phs = placeholdersOf(expanded ? draft : s.body);
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                {(s.uses || 0) > 0 && <Text style={styles.uses}>×{s.uses}</Text>}
              </View>

              {expanded ? (
                <TextInput
                  style={styles.editBody}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  textAlign="right"
                />
              ) : (
                <Text style={styles.preview} numberOfLines={3}>
                  {s.body}
                </Text>
              )}

              {phs.length > 0 && (
                <View style={styles.phRow}>
                  {phs.map((p) => (
                    <Text key={p} style={styles.phChip}>
                      {p}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actCopy]}
                  onPress={() => copyText(s)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actText}>📋 העתק</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actWa]}
                  onPress={() => sendWhatsapp(s)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actText}>💬 שלח</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actEdit]}
                  onPress={() => expand(s)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.actText, { color: COLORS.textPrimary }]}>
                    {expanded ? "✓ סגור" : "✎ מלא"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actMore]}
                  onPress={() => openEdit(s)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.actText, { color: COLORS.textPrimary }]}>⚙</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actBtn, styles.actDel]}
                  onPress={() => removeSnippet(s.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.9}>
        <Text style={styles.fabText}>＋ הודעה חדשה</Text>
      </TouchableOpacity>

      {/* Add / edit form */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editId ? "עריכת הודעה" : "הודעה חדשה"}</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="כותרת"
              placeholderTextColor={COLORS.textMuted}
              textAlign="right"
            />
            <View style={styles.filterRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.filterChip, form.category === c.key && { backgroundColor: c.color }]}
                  onPress={() => setForm((f) => ({ ...f, category: c.key }))}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.filterText, form.category === c.key && styles.filterTextActive]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={form.body}
              onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
              placeholder="תוכן ההודעה. השתמש ב-[שם] או [מחיר] לשדות מהירים"
              placeholderTextColor={COLORS.textMuted}
              textAlign="right"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setShowForm(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.textPrimary }]}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSave]}
                onPress={saveForm}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginStart: 8,
    marginBottom: 8,
    ...BRUTAL_BORDER,
  },
  filterActive: { backgroundColor: COLORS.navy },
  filterText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  filterTextActive: { color: "#FFFFFF" },
  toolbar: { flexDirection: "row", gap: 8, marginBottom: 12 },
  toolBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  toolBtnOn: { backgroundColor: COLORS.mustard },
  toolBtnText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 18 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 14,
    marginBottom: 12,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  catDot: { width: 16, height: 16, borderRadius: 4, ...BRUTAL_BORDER },
  cardTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right", marginHorizontal: 10 },
  uses: { color: COLORS.navy, fontSize: 13, fontFamily: FONTS.bold },
  preview: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.regular, textAlign: "right", lineHeight: 20 },
  editBody: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    padding: 10,
    minHeight: 90,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlignVertical: "top",
    ...BRUTAL_BORDER,
  },
  phRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  phChip: {
    backgroundColor: COLORS.mustard,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.bold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginStart: 6,
    marginBottom: 6,
    ...BRUTAL_BORDER,
  },
  cardActions: { flexDirection: "row", gap: 6, marginTop: 12 },
  actBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  actCopy: { backgroundColor: COLORS.navy },
  actWa: { backgroundColor: COLORS.success },
  actEdit: { backgroundColor: COLORS.mustard },
  actMore: { backgroundColor: COLORS.white, flex: 0.5 },
  actDel: { backgroundColor: COLORS.danger, flex: 0.5 },
  actText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  fab: {
    height: 60,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  fabText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  modalOverlay: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(17,24,39,0.4)" },
  modalCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    padding: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 14 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  bodyInput: { minHeight: 110, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  modalCancel: { backgroundColor: COLORS.white },
  modalSave: { backgroundColor: COLORS.success },
  modalBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
});
