import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { deleteTemplate, listTemplates } from "../db/templatesRepo";

// "Create from Template": lists every saved template and hands the raw
// (un-substituted) body back to the caller on pick -- variable rendering
// happens once, at the moment a new note is instantiated.
export default function TemplatePickerSheet({ visible, onClose, onPick }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState([]);

  const load = () => listTemplates(db).then(setTemplates);

  useEffect(() => {
    if (visible) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onDelete = async (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteTemplate(db, id);
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <Text style={s.title}>Create from Template</Text>
          <FlatList
            data={templates}
            keyExtractor={(t) => t.id}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <View style={s.row}>
                <TouchableOpacity testID="template-use" style={{ flex: 1 }} onPress={() => onPick(item)} activeOpacity={0.7}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.rowPreview} numberOfLines={1}>
                    {item.body.replace(/\n/g, " ").slice(0, 60) || "Empty"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity testID="template-delete" onPress={() => onDelete(item.id)} hitSlop={8} style={{ padding: 6 }}>
                  <Feather name="trash-2" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={s.empty}>
                No templates yet. Open a note and tap the template icon to save its structure as one.
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
    title: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, gap: 8 },
    rowTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    rowPreview: { fontSize: 12.5, color: t.textMuted, marginTop: 2 },
    empty: { color: t.textMuted, fontSize: 13.5, lineHeight: 20, textAlign: "center", paddingVertical: 20 },
  });
