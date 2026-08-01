import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";

const ITEMS = [
  { key: "snippet", icon: "code", label: "Snippet" },
  { key: "table", icon: "grid", label: "Table" },
  { key: "drawing", icon: "edit-3", label: "Drawing" },
];

// One small sheet for the editor's three "insert something structured at
// the cursor" actions, instead of three more permanent icons crowding the
// header.
export default function InsertMenuSheet({ visible, onClose, onPick }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <Text style={s.title}>Insert</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                testID={`insert-${item.key}`}
                style={s.item}
                onPress={() => onPick(item.key)}
                activeOpacity={0.8}
              >
                <View style={s.iconWrap}>
                  <Feather name={item.icon} size={20} color={theme.accent} />
                </View>
                <Text style={s.itemLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
    title: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 16 },
    item: { flex: 1, alignItems: "center", gap: 8 },
    iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" },
    itemLabel: { fontSize: 12.5, color: t.text, fontWeight: "600" },
  });
