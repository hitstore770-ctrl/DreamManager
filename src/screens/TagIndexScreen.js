import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import { listTagsWithCounts } from "../db/notesRepo";
import { buildTagTree } from "../lib/tags";

// Nested tags rendered as virtual folders: root tags carry the automatic
// color, children nest underneath in the same hue. Tapping any node filters
// the notes list to that tag (and everything nested under it).
export default function TagIndexScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [tree, setTree] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    const rows = await listTagsWithCounts(db);
    setTree(buildTagTree(rows));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = (path) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const selectTag = (path) => navigation.navigate("NotesList", { tagFilter: path });

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="tag-index-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="hash" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <Text style={s.topTitle}>Tags</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        {tree.length === 0 && (
          <Text style={s.empty}>No tags yet. Type #tag or #project/subtag in a note.</Text>
        )}
        {tree.map((node) => (
          <TagBranch
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            onSelect={selectTag}
            theme={theme}
          />
        ))}
      </ScrollView>
    </SwipeBack>
  );
}

function TagBranch({ node, depth, expanded, onToggle, onSelect, theme }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const s = styles(theme);

  return (
    <View>
      <TouchableOpacity
        testID="tag-row"
        style={[s.row, { marginStart: depth * 18 }]}
        onPress={() => onSelect(node.path)}
        activeOpacity={0.75}
      >
        {hasChildren ? (
          <TouchableOpacity testID="tag-expand" onPress={() => onToggle(node.path)} hitSlop={8} style={s.chevronBtn}>
            <Feather name={isOpen ? "chevron-down" : "chevron-right"} size={15} color={theme.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={s.chevronBtn} />
        )}
        <View style={[s.dot, { backgroundColor: node.color }]} />
        <Text style={s.rowText} numberOfLines={1}>
          {node.name}
        </Text>
        {node.count > 0 && <Text style={s.count}>{node.count}</Text>}
      </TouchableOpacity>
      {hasChildren &&
        isOpen &&
        node.children.map((child) => (
          <TagBranch
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            theme={theme}
          />
        ))}
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 },
    chevronBtn: { width: 20, alignItems: "center", justifyContent: "center" },
    dot: { width: 10, height: 10, borderRadius: 5 },
    rowText: { flex: 1, fontSize: 15, color: t.text, fontWeight: "600" },
    count: { fontSize: 12, color: t.textMuted, fontWeight: "600" },
    empty: { color: t.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 40 },
  });
