import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";

import { useTheme } from "../theme/ThemeContext";
import BottomSheet from "./BottomSheet";

// "Save as Template": names the current note's raw text (variables and
// all -- {{CURRENT_DATE}} stays literal in storage, and only gets
// substituted the next time this template is instantiated).
export default function SaveTemplateModal({ visible, onClose, onSave }) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const s = styles(theme);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText style={s.title}>Save as Template</AppText>
      <AppTextInput
        testID="template-name-input"
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="Template name"
        placeholderTextColor={theme.textMuted}
        autoFocus
      />
      <AppText style={s.hint}>
        {"{{CURRENT_DATE}}"}, {"{{TIME}}"} and {"{{DATETIME}}"} will fill in with the real date/time each time you
        use this template.
      </AppText>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose} activeOpacity={0.8}>
          <AppText style={[s.btnText, { color: theme.textSecondary }]}>Cancel</AppText>
        </TouchableOpacity>
        <TouchableOpacity testID="template-save-submit" style={[s.btn, { backgroundColor: theme.accent }]} onPress={submit} activeOpacity={0.85}>
          <AppText style={[s.btnText, { color: theme.onAccent }]}>Save</AppText>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = (t) =>
  StyleSheet.create({
    title: { fontSize: 16, fontWeight: "700", color: t.text, marginBottom: 12 },
    input: { backgroundColor: t.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 46, color: t.text, fontSize: 15, marginBottom: 10 },
    hint: { fontSize: 12, color: t.textMuted, lineHeight: 17, marginBottom: 14 },
    btn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: t.surfaceAlt },
    btnText: { fontWeight: "700", fontSize: 14.5 },
  });
