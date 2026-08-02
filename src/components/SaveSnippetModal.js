import { useState } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";

import { useTheme } from "../theme/ThemeContext";

// Names a reusable chunk of text (usually the current selection) before it's
// saved to the Snippet Library.
export default function SaveSnippetModal({ visible, onClose, preview, onSave }) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const s = styles(theme);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <AppText style={s.title}>Save Snippet</AppText>
          {!!preview && (
            <AppText style={s.preview} numberOfLines={3}>
              {preview}
            </AppText>
          )}
          <AppTextInput
            testID="snippet-name-input"
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Snippet name"
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose} activeOpacity={0.8}>
              <AppText style={[s.btnText, { color: theme.textSecondary }]}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity testID="snippet-save-submit" style={[s.btn, { backgroundColor: theme.accent }]} onPress={submit} activeOpacity={0.85}>
              <AppText style={[s.btnText, { color: theme.onAccent }]}>Save</AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.overlay, alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 340, backgroundColor: t.surface, borderRadius: 18, padding: 20 },
    title: { fontSize: 16, fontWeight: "700", color: t.text, marginBottom: 10 },
    preview: {
      fontSize: 12,
      fontFamily: "monospace",
      color: t.textMuted,
      backgroundColor: t.surfaceAlt,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    input: { backgroundColor: t.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 46, color: t.text, fontSize: 15, marginBottom: 14 },
    btn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: t.surfaceAlt },
    btnText: { fontWeight: "700", fontSize: 14.5 },
  });
