import { useEffect, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { deleteTemplate, listTemplates } from "../db/templatesRepo";
import BottomSheet from "./BottomSheet";
import EmptyState from "./EmptyState";

// "Create from Template": lists every saved template and hands the raw
// (un-substituted) body back to the caller on pick -- variable rendering
// happens once, at the moment a new note is instantiated.
export default function TemplatePickerSheet({ visible, onClose, onPick }) {
  const theme = useTheme();
  const db = useSQLiteContext();
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
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.titleRow}>
        <AppText style={s.title}>Create from Template</AppText>
        <TouchableOpacity testID="close-templates" onPress={onClose} hitSlop={10}>
          <Feather name="x" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={templates}
        keyExtractor={(t) => t.id}
        style={{ maxHeight: 380 }}
        renderItem={({ item }) => (
          <View style={s.row}>
            <TouchableOpacity testID="template-use" style={{ flex: 1 }} onPress={() => onPick(item)} activeOpacity={0.7}>
              <AppText style={s.rowTitle} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText style={s.rowPreview} numberOfLines={1}>
                {item.body.replace(/\n/g, " ").slice(0, 60) || "Empty"}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity testID="template-delete" onPress={() => onDelete(item.id)} hitSlop={8} style={{ padding: 6 }}>
              <Feather name="trash-2" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon="layout" title="No templates yet" subtitle="Open a note and tap the template icon to save its structure as one." />
        }
      />
    </BottomSheet>
  );
}

const styles = (t) =>
  StyleSheet.create({
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 17, fontWeight: "700", color: t.text },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, gap: 8 },
    rowTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    rowPreview: { fontSize: 12.5, color: t.textMuted, marginTop: 2 },
  });
