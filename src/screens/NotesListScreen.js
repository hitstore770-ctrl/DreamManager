import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../theme/ThemeContext";
import { createNote, deleteNote, listNotes, setPinned } from "../db/notesRepo";
import { colorForRoot, tagRoot } from "../lib/tags";
import { noteColor } from "../lib/colors";
import { renderTemplate } from "../lib/templates";
import TemplatePickerSheet from "../components/TemplatePickerSheet";

function previewOf(body) {
  // Skip the first line — it's already shown as the card title — and
  // collapse everything else to one line so a truncated preview never ends
  // mid-blank-line looking broken.
  const rest = (body || "").split("\n").slice(1).join("\n");
  const stripped = rest
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 140) || "No additional text";
}

function fmtUpdated(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotesListScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const [notes, setNotes] = useState([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [regexMode, setRegexMode] = useState(false);
  const [regexError, setRegexError] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(queryInput), 200);
    return () => clearTimeout(debounceRef.current);
  }, [queryInput]);

  useEffect(() => {
    if (route.params?.tagFilter !== undefined) {
      setActiveTag(route.params.tagFilter || null);
      navigation.setParams({ tagFilter: undefined });
    }
  }, [route.params?.tagFilter]);

  // Plain search stays on the SQL LIKE fast path (indexed, queries only what
  // matches). Regex mode has to pull every candidate row back and test it in
  // JS -- SQLite has no built-in regex support here -- which is why it's an
  // opt-in rather than the default.
  const load = useCallback(async () => {
    if (regexMode) {
      const rows = await listNotes(db, { tagPath: activeTag });
      const q = query.trim();
      if (!q) {
        setRegexError(false);
        setNotes(rows);
        return;
      }
      try {
        const re = new RegExp(q, "i");
        setRegexError(false);
        setNotes(rows.filter((n) => re.test(n.title) || re.test(n.body)));
      } catch {
        setRegexError(true);
        setNotes(rows);
      }
      return;
    }
    setRegexError(false);
    const rows = await listNotes(db, { query, tagPath: activeTag });
    setNotes(rows);
  }, [db, query, activeTag, regexMode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNote = (id) => {
    navigation.navigate("Editor", { noteId: id });
  };

  const onNewNote = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const note = await createNote(db, "");
    navigation.navigate("Editor", { noteId: note.id });
  };

  const onUseTemplate = async (template) => {
    setShowTemplates(false);
    const note = await createNote(db, renderTemplate(template.body));
    navigation.navigate("Editor", { noteId: note.id });
  };

  const onTogglePin = async (note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await setPinned(db, note.id, !note.pinned);
    load();
  };

  const onDelete = async (id) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteNote(db, id);
  };

  const s = styles(theme);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Second Brain</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.headerActions}>
          <TouchableOpacity testID="open-compile" style={s.iconBtn} onPress={() => navigation.navigate("Compile")} activeOpacity={0.7}>
            <Feather name="layers" size={19} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="open-graph" style={s.iconBtn} onPress={() => navigation.navigate("Graph")} activeOpacity={0.7}>
            <Feather name="share-2" size={19} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="open-vault" style={s.iconBtn} onPress={() => navigation.navigate("Vault")} activeOpacity={0.7}>
            <Feather name="shield" size={19} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="open-tag-index" style={s.iconBtn} onPress={() => navigation.navigate("TagIndex")} activeOpacity={0.7}>
            <Feather name="hash" size={19} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="open-split" style={s.iconBtn} onPress={() => navigation.navigate("Split")} activeOpacity={0.7}>
            <Feather name="columns" size={19} color={theme.text} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={theme.textMuted} style={{ marginEnd: 8 }} />
          <TextInput
            style={s.searchInput}
            value={queryInput}
            onChangeText={setQueryInput}
            placeholder={regexMode ? "Regex pattern..." : "Search notes..."}
            placeholderTextColor={theme.textMuted}
          />
        </View>
        <TouchableOpacity
          testID="toggle-regex"
          style={[s.regexBtn, regexMode && { backgroundColor: theme.accent }, regexMode && regexError && { backgroundColor: theme.danger }]}
          onPress={() => setRegexMode((r) => !r)}
          activeOpacity={0.75}
        >
          <Text style={[s.regexBtnText, { color: regexMode ? theme.onAccent : theme.textSecondary }]}>.*</Text>
        </TouchableOpacity>
      </View>
      {regexMode && regexError && <Text style={s.regexError}>Invalid pattern — showing all notes.</Text>}

      {!!activeTag && (
        <View style={s.filterRow}>
          <Text style={s.filterText}>#{activeTag}</Text>
          <TouchableOpacity onPress={() => setActiveTag(null)} hitSlop={8}>
            <Feather name="x" size={15} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 96 }}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            theme={theme}
            styles={s}
            onOpen={() => openNote(item.id)}
            onTogglePin={() => onTogglePin(item)}
            onDelete={() => onDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>
            {query || activeTag ? "No notes match." : "No notes yet. Tap + to write one (hold + for templates)."}
          </Text>
        }
      />

      <TouchableOpacity
        testID="new-note-fab"
        style={[s.fab, { bottom: insets.bottom + 24 }]}
        onPress={onNewNote}
        onLongPress={() => setShowTemplates(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={theme.onAccent} />
      </TouchableOpacity>

      <TemplatePickerSheet visible={showTemplates} onClose={() => setShowTemplates(false)} onPick={onUseTemplate} />
    </View>
  );
}

function NoteCard({ note, theme, styles: s, onOpen, onTogglePin, onDelete }) {
  const bg = noteColor(note.color, theme.scheme === "dark");

  const renderRightActions = () => (
    <View style={s.deleteAction}>
      <Feather name="trash-2" size={18} color="#FFFFFF" />
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={onDelete} overshootRight={false} rightThreshold={44}>
      <Pressable testID="note-card" style={[s.card, { backgroundColor: bg }]} onPress={onOpen} onLongPress={onTogglePin}>
        <View style={s.cardTop}>
          {note.pinned && <Feather name="bookmark" size={13} color={theme.accent} style={{ marginEnd: 6 }} />}
          <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {note.title || "Untitled"}
          </Text>
        </View>
        <Text style={[s.cardPreview, { color: theme.textMuted }]} numberOfLines={2}>
          {previewOf(note.body)}
        </Text>
        <View style={s.cardFoot}>
          <Text style={s.cardMeta}>{fmtUpdated(note.updated_at)}</Text>
          {note.tags.slice(0, 3).map((t) => (
            <View key={t} style={[s.tagPill, { backgroundColor: colorForRoot(tagRoot(t)) + "22" }]}>
              <Text style={[s.tagPillText, { color: colorForRoot(tagRoot(t)) }]}>#{t}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
    title: { fontSize: 22, fontWeight: "700", color: t.text },
    headerActions: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 4 },
    searchWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: t.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, height: 42 },
    searchInput: { flex: 1, color: t.text, fontSize: 15 },
    regexBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    regexBtnText: { fontSize: 14, fontWeight: "700" },
    regexError: { color: t.danger, fontSize: 12, marginHorizontal: 18, marginTop: 4, marginBottom: 2 },
    filterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 18, marginTop: 8, marginBottom: 8 },
    filterText: { color: t.accent, fontWeight: "600", fontSize: 13 },
    card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
    cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: "600" },
    cardPreview: { fontSize: 13.5, lineHeight: 19 },
    cardFoot: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 },
    cardMeta: { fontSize: 11.5, color: t.textMuted, marginEnd: 4 },
    tagPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    tagPillText: { fontSize: 11, fontWeight: "700" },
    deleteAction: { backgroundColor: t.danger, justifyContent: "center", alignItems: "center", width: 64, borderRadius: 14, marginBottom: 10 },
    empty: { color: t.textMuted, textAlign: "center", marginTop: 60, fontSize: 14, paddingHorizontal: 30, lineHeight: 21 },
    fab: {
      position: "absolute",
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
  });
