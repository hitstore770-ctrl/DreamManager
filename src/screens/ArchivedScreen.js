import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../components/AppText";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RADIUS, useTheme } from "../theme/ThemeContext";
import { ARCHIVE_COLOR, noteColor } from "../lib/colors";
import { extractLeadingEmoji } from "../lib/emoji";
import { deleteNote, listArchivedNotes, setArchived } from "../db/notesRepo";
import SwipeBack from "../navigation/SwipeBack";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";

function fmtUpdated(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// A holding area for archived notes -- swipe-to-archive on the main list is
// a soft delete, so this is where the note actually goes to be restored or
// (if the user is sure) permanently removed.
export default function ArchivedScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [notes, setNotes] = useState(null); // null = still loading

  const load = useCallback(async () => {
    setNotes(await listArchivedNotes(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => navigation.goBack();

  const onRestore = async (id) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await setArchived(db, id, false);
  };

  const onDeleteForever = async (id) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteNote(db, id);
  };

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={goBack} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.header}>
        <TouchableOpacity testID="archived-back" style={s.iconBtn} onPress={goBack} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <AppText style={s.title}>Archived</AppText>
        <View style={{ width: 36 }} />
      </View>

      {notes === null ? (
        <SkeletonList rows={3} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <ArchivedCard
              note={item}
              theme={theme}
              styles={s}
              onOpen={() => navigation.navigate("Editor", { noteId: item.id })}
              onRestore={() => onRestore(item.id)}
              onDeleteForever={() => onDeleteForever(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="archive" title="Nothing archived" subtitle="Swipe a note right on the main list to send it here." />
          }
        />
      )}
    </SwipeBack>
  );
}

function ArchivedCard({ note, theme, styles: s, onOpen, onRestore, onDeleteForever }) {
  const bg = noteColor(note.color, theme.scheme === "dark");
  const leading = extractLeadingEmoji(note.title);
  const displayTitle = (leading ? leading.rest : note.title) || "Untitled";

  const renderRightActions = () => (
    <View style={s.deleteAction}>
      <Feather name="trash-2" size={18} color="#FFFFFF" />
    </View>
  );

  const renderLeftActions = () => (
    <View style={s.restoreAction}>
      <Feather name="rotate-ccw" size={18} color="#FFFFFF" />
    </View>
  );

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => (direction === "left" ? onRestore() : onDeleteForever())}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={44}
      rightThreshold={44}
    >
      <Pressable testID="archived-card" style={[s.card, { backgroundColor: bg }]} onPress={onOpen}>
        <View style={s.cardTop}>
          {!!leading && (
            <View style={s.emojiBadge}>
              <AppText style={s.emojiBadgeText}>{leading.emoji}</AppText>
            </View>
          )}
          <AppText style={s.cardTitle} numberOfLines={1}>
            {displayTitle}
          </AppText>
        </View>
        <AppText style={s.cardMeta}>Archived · {fmtUpdated(note.updated_at)}</AppText>
      </Pressable>
    </Swipeable>
  );
}

const styles = (t) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
    iconBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    title: { fontSize: 18, fontWeight: "700", color: t.text },
    card: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...t.cardShadow },
    cardTop: { flexDirection: "row", alignItems: "center" },
    emojiBadge: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: t.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginEnd: 8,
    },
    emojiBadgeText: { fontSize: 14, lineHeight: 17 },
    cardTitle: { fontSize: 15.5, fontWeight: "600", color: t.text },
    cardMeta: { fontSize: 11.5, color: t.textMuted, marginTop: 4 },
    deleteAction: { backgroundColor: t.danger, justifyContent: "center", alignItems: "center", width: 64, borderRadius: RADIUS.lg, marginBottom: 12 },
    restoreAction: { backgroundColor: ARCHIVE_COLOR, justifyContent: "center", alignItems: "center", width: 64, borderRadius: RADIUS.lg, marginBottom: 12 },
  });
