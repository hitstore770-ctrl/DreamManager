import { useEffect, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { createSnippet, deleteSnippet, listSnippets } from "../db/snippetsRepo";
import SaveSnippetModal from "./SaveSnippetModal";
import BottomSheet from "./BottomSheet";

// The Snippet Library: reusable text/code blocks you can save from any note
// and inject back into the cursor position of any other note.
export default function SnippetPickerSheet({ visible, onClose, onInsert, saveText, hasSelection }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [snippets, setSnippets] = useState([]);
  const [showSave, setShowSave] = useState(false);

  const load = () => listSnippets(db).then(setSnippets);

  useEffect(() => {
    if (visible) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onDelete = async (id) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    await deleteSnippet(db, id);
  };

  const onSaveNew = async (name) => {
    await createSnippet(db, name, saveText || "");
    setShowSave(false);
    load();
  };

  const s = styles(theme);
  const canSave = !!(saveText && saveText.trim());

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={s.titleRow}>
          <AppText style={s.title}>Snippet Library</AppText>
          <TouchableOpacity testID="close-snippets" onPress={onClose} hitSlop={10}>
            <Feather name="x" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="save-current-as-snippet"
          style={s.saveRow}
          onPress={() => setShowSave(true)}
          activeOpacity={0.8}
          disabled={!canSave}
        >
          <Feather name="plus-circle" size={16} color={canSave ? theme.accent : theme.textMuted} />
          <AppText style={[s.saveRowText, { color: canSave ? theme.accent : theme.textMuted }]}>
            Save {hasSelection ? "selection" : "this note"} as a snippet
          </AppText>
        </TouchableOpacity>

        <FlatList
          data={snippets}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 340 }}
          renderItem={({ item }) => (
            <View style={s.row}>
              <TouchableOpacity testID="snippet-insert" style={{ flex: 1 }} onPress={() => onInsert(item)} activeOpacity={0.7}>
                <AppText style={s.rowTitle} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText style={s.rowPreview} numberOfLines={1}>
                  {item.body.replace(/\n/g, " ").slice(0, 60) || "Empty"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity testID="snippet-delete" onPress={() => onDelete(item.id)} hitSlop={8} style={{ padding: 6 }}>
                <Feather name="trash-2" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <AppText style={s.empty}>No snippets yet. Select text in a note and save it here to reuse later.</AppText>
          }
        />
      </BottomSheet>

      <SaveSnippetModal visible={showSave} onClose={() => setShowSave(false)} preview={saveText} onSave={onSaveNew} />
    </>
  );
}

const styles = (t) =>
  StyleSheet.create({
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 17, fontWeight: "700", color: t.text },
    saveRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, marginBottom: 6 },
    saveRowText: { fontSize: 14, fontWeight: "600" },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.border, gap: 8 },
    rowTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    rowPreview: { fontSize: 12.5, color: t.textMuted, marginTop: 2, fontFamily: "monospace" },
    empty: { color: t.textMuted, fontSize: 13.5, lineHeight: 20, textAlign: "center", paddingVertical: 20 },
  });
