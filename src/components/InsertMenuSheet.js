import { StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import BottomSheet from "./BottomSheet";

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
  const s = styles(theme);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText style={s.title}>Insert</AppText>
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
            <AppText style={s.itemLabel}>{item.label}</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = (t) =>
  StyleSheet.create({
    title: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 16 },
    item: { flex: 1, alignItems: "center", gap: 8 },
    iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" },
    itemLabel: { fontSize: 12.5, color: t.text, fontWeight: "600" },
  });
