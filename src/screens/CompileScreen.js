import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutAnimation, Platform, ScrollView, StyleSheet, TouchableOpacity, UIManager, View } from "react-native";
import AppText from "../components/AppText";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import { listNotes } from "../db/notesRepo";
import { compileNotes } from "../lib/compile";
import MarkdownView from "../components/MarkdownView";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROW_HEIGHT = 58;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Pick notes, drag to reorder, merge into one document with an
// auto-generated Table of Contents, export as .md/.txt. Reordering uses the
// same gesture-handler runOnJS technique as the Kanban board's drag-and-drop.
export default function CompileScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const [notes, setNotes] = useState([]);
  const [order, setOrder] = useState([]); // selected note ids, in compile order
  const [compiled, setCompiled] = useState(null);
  const [exporting, setExporting] = useState(false);
  const orderRef = useRef(order);
  orderRef.current = order;

  const load = useCallback(() => {
    listNotes(db, {}).then(setNotes);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleSelect = (id) => {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reorder = (id, targetIndex) => {
    const current = orderRef.current;
    const currentIndex = current.indexOf(id);
    if (currentIndex === -1 || currentIndex === targetIndex) return;
    const next = [...current];
    next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, id);
    orderRef.current = next;
    if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOrder(next);
  };

  const orderedNotes = order.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  const onCompile = () => {
    setCompiled(compileNotes(orderedNotes));
  };

  const onExport = async (ext) => {
    if (!compiled) return;
    setExporting(true);
    try {
      const filename = `compiled-notes-${Date.now()}.${ext}`;
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(compiled.mergedBody);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: ext === "md" ? "text/markdown" : "text/plain",
          dialogTitle: filename,
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const s = styles(theme);

  if (compiled) {
    return (
      <SwipeBack onDismiss={() => setCompiled(null)} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
        <View style={s.topBar}>
          <TouchableOpacity testID="compile-preview-back" style={s.iconBtn} onPress={() => setCompiled(null)} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={theme.text} />
          </TouchableOpacity>
          <AppText style={s.title}>Master Document</AppText>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 100 }}>
          <MarkdownView body={compiled.mergedBody} theme={theme} />
        </ScrollView>
        <View style={[s.exportBar, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity testID="export-md" style={[s.exportBtn, { backgroundColor: theme.accent }]} onPress={() => onExport("md")} disabled={exporting}>
            <Feather name="download" size={15} color={theme.onAccent} />
            <AppText style={[s.exportBtnText, { color: theme.onAccent }]}>{exporting ? "Exporting…" : "Export .md"}</AppText>
          </TouchableOpacity>
          <TouchableOpacity testID="export-txt" style={[s.exportBtn, s.exportBtnGhost]} onPress={() => onExport("txt")} disabled={exporting}>
            <Feather name="download" size={15} color={theme.text} />
            <AppText style={s.exportBtnText}>Export .txt</AppText>
          </TouchableOpacity>
        </View>
      </SwipeBack>
    );
  }

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="compile-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="layers" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <AppText style={s.title}>Compile Project</AppText>
      </View>

      {order.length > 0 && (
        <View style={s.orderSection}>
          <AppText style={s.sectionLabel}>Order (drag to rearrange)</AppText>
          {orderedNotes.map((note, index) => (
            <DraggableRow
              key={note.id}
              note={note}
              index={index}
              count={order.length}
              theme={theme}
              onReorder={reorder}
              onRemove={() => toggleSelect(note.id)}
            />
          ))}
        </View>
      )}

      <AppText style={s.sectionLabel}>All notes</AppText>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}>
        {notes.map((note) => {
          const selected = order.includes(note.id);
          return (
            <TouchableOpacity
              key={note.id}
              testID="compile-note-row"
              style={s.pickRow}
              onPress={() => toggleSelect(note.id)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                {selected && <Feather name="check" size={12} color={theme.onAccent} />}
              </View>
              <AppText style={s.pickRowText} numberOfLines={1}>
                {note.title || "Untitled"}
              </AppText>
            </TouchableOpacity>
          );
        })}
        {notes.length === 0 && <AppText style={s.empty}>No notes to compile yet.</AppText>}
      </ScrollView>

      <TouchableOpacity
        testID="run-compile"
        style={[s.compileBtn, { bottom: insets.bottom + 20, opacity: order.length ? 1 : 0.4 }]}
        onPress={onCompile}
        disabled={!order.length}
        activeOpacity={0.85}
      >
        <Feather name="git-merge" size={17} color={theme.onAccent} />
        <AppText style={s.compileBtnText}>Compile {order.length || ""}</AppText>
      </TouchableOpacity>
    </SwipeBack>
  );
}

function DraggableRow({ note, index, count, theme, onReorder, onRemove }) {
  const [dragging, setDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const baseIndexRef = useRef(index);
  const s = styles(theme);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      baseIndexRef.current = index;
      setDragging(true);
    })
    .onUpdate((e) => {
      setOffsetY(e.translationY);
      const target = clamp(baseIndexRef.current + Math.round(e.translationY / ROW_HEIGHT), 0, count - 1);
      onReorder(note.id, target);
    })
    .onEnd(() => {
      setDragging(false);
      setOffsetY(0);
    });

  return (
    <View style={[s.dragRow, { height: ROW_HEIGHT }, dragging && { transform: [{ translateY: offsetY }], zIndex: 10, elevation: 6 }]}>
      <GestureDetector gesture={pan}>
        <View testID="drag-handle" style={s.dragHandle} hitSlop={6}>
          <Feather name="menu" size={16} color={theme.textMuted} />
        </View>
      </GestureDetector>
      <AppText style={s.dragRowText} numberOfLines={1}>
        {note.title || "Untitled"}
      </AppText>
      <TouchableOpacity testID="deselect-note" onPress={onRemove} hitSlop={8}>
        <Feather name="x" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    title: { fontSize: 17, fontWeight: "700", color: t.text },
    sectionLabel: { fontSize: 11.5, fontWeight: "700", color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
    orderSection: { paddingHorizontal: 16 },
    dragRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      marginBottom: 6,
      ...t.cardShadow,
    },
    dragHandle: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
    dragRowText: { flex: 1, fontSize: 14, color: t.text, fontWeight: "600" },
    pickRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: t.border, alignItems: "center", justifyContent: "center" },
    pickRowText: { flex: 1, fontSize: 14.5, color: t.text },
    empty: { color: t.textMuted, textAlign: "center", marginTop: 40, fontSize: 14 },
    compileBtn: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: t.accent,
      borderRadius: 26,
      paddingHorizontal: 22,
      height: 50,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    compileBtnText: { color: t.onAccent, fontWeight: "700", fontSize: 14.5 },
    exportBar: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border },
    exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: 12 },
    exportBtnGhost: { backgroundColor: t.surfaceAlt },
    exportBtnText: { fontWeight: "700", fontSize: 13.5, color: t.text },
  });
