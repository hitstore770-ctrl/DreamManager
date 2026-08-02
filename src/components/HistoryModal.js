import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import Slider from "@react-native-community/slider";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { listVersions, restoreVersion } from "../db/notesRepo";
import MarkdownView from "./MarkdownView";

// The Time Machine: a slider over every auto-saved snapshot of this note,
// oldest to "Current", with a live preview and a one-tap restore.
export default function HistoryModal({ visible, onClose, noteId, currentTitle, currentBody, onRestored }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [versions, setVersions] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    listVersions(db, noteId).then((rows) => {
      const points = [
        ...rows,
        { id: "current", title: currentTitle, body: currentBody, created_at: Date.now(), isCurrent: true },
      ];
      setVersions(points);
      setIndex(points.length - 1);
    });
  }, [visible, db, noteId, currentTitle, currentBody]);

  if (!visible) return null;

  const selected = versions[index];
  const s = styles(theme);

  const onRestore = async () => {
    if (!selected || selected.isCurrent) {
      onClose();
      return;
    }
    const updated = await restoreVersion(db, noteId, selected, currentTitle, currentBody);
    onRestored(updated);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <Feather name="clock" size={17} color={theme.accent} />
            <AppText style={s.title}>Time Machine</AppText>
            <TouchableOpacity testID="close-history" onPress={onClose} hitSlop={10} style={{ marginStart: "auto" }}>
              <Feather name="x" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {versions.length <= 1 ? (
            <AppText style={s.empty}>
              No earlier snapshots yet — a version is saved automatically every minute while you write.
            </AppText>
          ) : (
            <>
              <AppText style={s.meta}>
                {selected?.isCurrent ? "Current" : new Date(selected?.created_at).toLocaleString()}
                {"   ·   "}
                {index + 1} / {versions.length}
              </AppText>
              <Slider
                minimumValue={0}
                maximumValue={Math.max(0, versions.length - 1)}
                step={1}
                value={index}
                onValueChange={setIndex}
                minimumTrackTintColor={theme.accent}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.accent}
                style={{ marginVertical: 8 }}
              />
              <ScrollView style={s.preview}>
                <MarkdownView body={selected?.body || ""} theme={theme} />
              </ScrollView>
              <TouchableOpacity
                testID="restore-version"
                style={[s.restoreBtn, selected?.isCurrent && { opacity: 0.4 }]}
                onPress={onRestore}
                disabled={selected?.isCurrent}
                activeOpacity={0.85}
              >
                <Feather name="rotate-ccw" size={16} color={theme.onAccent} />
                <AppText style={s.restoreText}>Restore to this version</AppText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
    card: { backgroundColor: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, maxHeight: "80%" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    title: { fontSize: 17, fontWeight: "700", color: t.text },
    meta: { fontSize: 12.5, color: t.textMuted, marginBottom: 4 },
    preview: { backgroundColor: t.surfaceAlt, borderRadius: 12, padding: 14, marginVertical: 10, maxHeight: 260 },
    empty: { color: t.textMuted, fontSize: 14, lineHeight: 21, paddingVertical: 16 },
    restoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.accent, borderRadius: 12, height: 48 },
    restoreText: { color: t.onAccent, fontWeight: "700", fontSize: 14.5 },
  });
