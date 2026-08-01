import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import EditorPane from "../components/EditorPane";
import { listNotes } from "../db/notesRepo";

const WIDE_BREAKPOINT = 700;

// Two fully independent EditorPane instances — each one owns its own load,
// autosave and version-snapshot hooks, so editing/scrolling one never
// touches the other's state. Side-by-side on wide screens, stacked on
// mobile.
export default function SplitWorkspaceScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [paneA, setPaneA] = useState(null);
  const [paneB, setPaneB] = useState(null);
  const [pickerFor, setPickerFor] = useState(null); // "A" | "B" | null

  const s = styles(theme);

  const assignFromPicker = (noteId) => {
    if (pickerFor === "A") setPaneA(noteId);
    else if (pickerFor === "B") setPaneB(noteId);
    setPickerFor(null);
  };

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="split-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="columns" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <Text style={s.topTitle}>Split Workspace</Text>
      </View>

      <View style={[s.body, { flexDirection: isWide ? "row" : "column" }]}>
        <Pane
          testID="pane-a"
          noteId={paneA}
          onPick={() => setPickerFor("A")}
          isWide={isWide}
          theme={theme}
        />
        <View style={isWide ? s.dividerV : s.dividerH} />
        <Pane
          testID="pane-b"
          noteId={paneB}
          onPick={() => setPickerFor("B")}
          isWide={isWide}
          theme={theme}
        />
      </View>

      <NotePickerSheet visible={!!pickerFor} onClose={() => setPickerFor(null)} onPick={assignFromPicker} />
    </SwipeBack>
  );
}

function Pane({ testID, noteId, onPick, theme }) {
  const s = styles(theme);
  if (!noteId) {
    return (
      <View style={[s.pane, s.paneEmpty]}>
        <Feather name="file-plus" size={26} color={theme.textMuted} />
        <TouchableOpacity testID={testID} style={s.pickBtn} onPress={onPick} activeOpacity={0.8}>
          <Text style={s.pickBtnText}>Choose a note</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={s.pane}>
      <EditorPane
        noteId={noteId}
        headerExtra={
          <TouchableOpacity style={s.switchBtn} onPress={onPick} hitSlop={6}>
            <Feather name="repeat" size={15} color={theme.textMuted} />
            <Text style={s.switchBtnText}>Switch</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

function NotePickerSheet({ visible, onClose, onPick }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState([]);
  const s = styles(theme);

  useEffect(() => {
    if (!visible) return;
    listNotes(db, { query }).then(setNotes);
  }, [visible, db, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <Text style={s.sheetTitle}>Choose a note</Text>
          <TextInput
            style={s.sheetSearch}
            value={query}
            onChangeText={setQuery}
            placeholder="Search..."
            placeholderTextColor={theme.textMuted}
          />
          <FlatList
            data={notes}
            keyExtractor={(n) => n.id}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <TouchableOpacity testID="picker-row" style={s.sheetRow} onPress={() => onPick(item.id)} activeOpacity={0.7}>
                <Text style={s.sheetRowText} numberOfLines={1}>
                  {item.title || "Untitled"}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>No notes found.</Text>}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    body: { flex: 1 },
    pane: { flex: 1 },
    paneEmpty: { alignItems: "center", justifyContent: "center", gap: 14 },
    pickBtn: { backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
    pickBtnText: { color: t.onAccent, fontWeight: "700", fontSize: 13.5 },
    switchBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 30, borderRadius: 8, backgroundColor: t.surfaceAlt },
    switchBtnText: { fontSize: 12, color: t.textMuted, fontWeight: "600" },
    dividerV: { width: 1, backgroundColor: t.border },
    dividerH: { height: 1, backgroundColor: t.border },
    backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
    sheetTitle: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 12 },
    sheetSearch: { backgroundColor: t.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, height: 42, color: t.text, marginBottom: 8 },
    sheetRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    sheetRowText: { color: t.text, fontSize: 15 },
    empty: { color: t.textMuted, textAlign: "center", paddingVertical: 20 },
  });
