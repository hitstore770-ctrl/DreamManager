import { useCallback, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RADIUS, useTheme } from "../theme/ThemeContext";
import { listUncheckedTasks, toggleTaskInNote } from "../db/notesRepo";
import { t } from "../i18n/strings";
import SwipeBack from "../navigation/SwipeBack";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";

// The Master Task Aggregator: every open "- [ ]" line across every note,
// in one flat list. Checking one off here writes straight back into that
// note's own markdown body -- this screen never owns the data, it's just
// a different lens on it.
export default function InboxScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState(null);

  const load = useCallback(async () => {
    setTasks(await listUncheckedTasks(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCheck = async (task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTasks((prev) => prev.filter((x) => !(x.noteId === task.noteId && x.lineIndex === task.lineIndex)));
    await toggleTaskInNote(db, task.noteId, task.lineIndex);
  };

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="inbox-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="check-square" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <AppText style={s.topTitle}>{t("inbox")}</AppText>
      </View>

      {tasks === null ? (
        <SkeletonList rows={5} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(x) => `${x.noteId}:${x.lineIndex}`}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID="inbox-task-row"
              style={s.row}
              onPress={() => navigation.navigate("Editor", { noteId: item.noteId })}
              activeOpacity={0.85}
            >
              <TouchableOpacity testID="inbox-task-check" style={s.checkbox} onPress={() => onCheck(item)} hitSlop={8} />
              <View style={{ flex: 1 }}>
                <AppText style={s.taskText} numberOfLines={2}>
                  {item.text || "(empty task)"}
                </AppText>
                <AppText style={s.noteTitle} numberOfLines={1}>
                  {item.noteTitle}
                </AppText>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="check-square" title={t("noTasksTitle")} subtitle={t("noTasksSubtitle")} />}
        />
      )}
    </SwipeBack>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 10,
      ...t.cardShadow,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: t.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    taskText: { fontSize: 14.5, color: t.text, lineHeight: 20 },
    noteTitle: { fontSize: 11.5, color: t.textMuted, marginTop: 4 },
  });
