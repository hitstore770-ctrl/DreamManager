import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../theme/ThemeContext";
import { getNote } from "../db/notesRepo";
import { useDebouncedAutosave } from "../hooks/useDebouncedAutosave";
import { useAutoVersion } from "../hooks/useAutoVersion";
import { extractTags, colorForRoot, tagRoot } from "../lib/tags";
import { countWords, toggleChecklistLine } from "../lib/markdown";
import MarkdownView from "./MarkdownView";
import HistoryModal from "./HistoryModal";

// A single, self-contained note editor: its own load, its own autosave, its
// own 60s version snapshots. Two of these mounted side by side (Split mode)
// never share state — each instance owns its hooks independently.
export default function EditorPane({ noteId, onBack, headerExtra }) {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [note, setNote] = useState(null);
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    getNote(db, noteId).then((n) => {
      if (!alive) return;
      setNote(n);
      setBody(n?.body || "");
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db, noteId]);

  const { savedAt, bodyRef } = useDebouncedAutosave(db, noteId, body, ready);
  useAutoVersion(db, noteId, bodyRef, ready);

  const tags = extractTags(body);
  const counts = countWords(body);
  const s = styles(theme);

  const onToggleChecklist = (lineIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBody((b) => toggleChecklistLine(b, lineIndex));
  };

  const onRestored = (restored) => {
    setNote(restored);
    setBody(restored.body);
    setShowHistory(false);
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={s.header}>
        {onBack && (
          <TouchableOpacity testID="editor-back" style={s.iconBtn} onPress={onBack} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={theme.text} />
          </TouchableOpacity>
        )}
        {headerExtra}
        <View style={{ flex: 1 }} />
        <TouchableOpacity testID="open-history" style={s.iconBtn} onPress={() => setShowHistory(true)} hitSlop={4}>
          <Feather name="clock" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="toggle-preview"
          style={[s.iconBtn, preview && { backgroundColor: theme.accent }]}
          onPress={() => setPreview((p) => !p)}
          hitSlop={4}
        >
          <Feather name="eye" size={18} color={preview ? theme.onAccent : theme.text} />
        </TouchableOpacity>
      </View>

      {tags.length > 0 && (
        <View style={s.tagRow}>
          {tags.map((t) => (
            <View key={t} style={[s.tagPill, { backgroundColor: colorForRoot(tagRoot(t)) + "22" }]}>
              <Text style={[s.tagPillText, { color: colorForRoot(tagRoot(t)) }]}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {preview ? (
            <MarkdownView body={body} theme={theme} onToggleChecklist={onToggleChecklist} />
          ) : (
            <TextInput
              testID="editor-input"
              style={s.input}
              value={body}
              onChangeText={setBody}
              placeholder="Start writing... use #tags, **bold**, - [ ] checklists, > quotes, ``` code```"
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.footer}>
        <Text style={s.footerText}>{savedAt ? "Saved" : "Autosaving…"}</Text>
        <Text style={s.footerText}>
          {counts.words} words · {counts.chars} chars
        </Text>
      </View>

      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        noteId={noteId}
        currentTitle={note?.title}
        currentBody={body}
        onRestored={onRestored}
      />
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 18, marginBottom: 4 },
    tagPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    tagPillText: { fontSize: 11.5, fontWeight: "700" },
    input: { flex: 1, minHeight: 260, fontSize: 16.5, lineHeight: 25, color: t.text },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    footerText: { fontSize: 11.5, color: t.textMuted },
  });
