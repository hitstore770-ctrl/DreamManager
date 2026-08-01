import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import VaultPinModal from "../components/VaultPinModal";
import { useVault } from "../vault/VaultContext";
import { createVaultNote, deleteVaultNote, listVaultNotes } from "../db/vaultRepo";
import { decryptText } from "../lib/crypto";

// A locked category of notes: nothing here renders until the PIN is
// entered, and everything shown afterwards was decrypted in memory, this
// render pass only -- nothing decrypted is ever written back to disk.
export default function VaultScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const vault = useVault();

  const [rows, setRows] = useState([]);
  const [decrypted, setDecrypted] = useState({});
  const [pinVisible, setPinVisible] = useState(!vault.unlocked);

  useEffect(() => {
    setPinVisible(!vault.unlocked);
  }, [vault.unlocked]);

  const load = useCallback(async () => {
    if (!vault.unlocked) return;
    const list = await listVaultNotes(db);
    setRows(list);
    const pairs = await Promise.all(list.map(async (n) => [n.id, await decryptText(n.body, n.iv, n.mac, vault.key)]));
    setDecrypted(Object.fromEntries(pairs));
  }, [db, vault.key, vault.unlocked]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNote = (id) => navigation.navigate("Editor", { noteId: id });

  const onNewVaultNote = async () => {
    const id = await createVaultNote(db, vault.key);
    navigation.navigate("Editor", { noteId: id });
  };

  const onDelete = async (id) => {
    setRows((prev) => prev.filter((n) => n.id !== id));
    await deleteVaultNote(db, id);
  };

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="vault-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="shield" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <Text style={s.topTitle}>Vault</Text>
        <View style={{ flex: 1 }} />
        {vault.unlocked && (
          <TouchableOpacity
            testID="vault-lock"
            style={s.iconBtn}
            onPress={() => {
              vault.lock();
              navigation.goBack();
            }}
            hitSlop={8}
          >
            <Feather name="lock" size={18} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {vault.unlocked && (
        <>
          <FlatList
            data={rows}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 96 }}
            renderItem={({ item }) => (
              <VaultCard
                note={item}
                plain={decrypted[item.id]}
                theme={theme}
                styles={s}
                onOpen={() => openNote(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            )}
            ListEmptyComponent={<Text style={s.empty}>No notes in the Vault yet. Tap + to add one.</Text>}
          />
          <TouchableOpacity
            testID="new-vault-note"
            style={[s.fab, { bottom: insets.bottom + 24 }]}
            onPress={onNewVaultNote}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={26} color={theme.onAccent} />
          </TouchableOpacity>
        </>
      )}

      <VaultPinModal
        visible={pinVisible}
        onClose={() => {
          setPinVisible(false);
          if (!vault.unlocked) navigation.goBack();
        }}
        onUnlocked={(key) => {
          vault.unlock(key);
          setPinVisible(false);
        }}
      />
    </SwipeBack>
  );
}

function VaultCard({ plain, theme, styles: s, onOpen, onDelete }) {
  const renderRightActions = () => (
    <View style={s.deleteAction}>
      <Feather name="trash-2" size={18} color="#FFFFFF" />
    </View>
  );
  const lines = (plain || "").split("\n").filter((l) => l.trim());
  const title = (lines[0] || "").replace(/^#{1,6}\s*/, "") || "Empty note";
  const preview = lines.slice(1).join(" · ").slice(0, 100);

  return (
    <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={onDelete} overshootRight={false} rightThreshold={44}>
      <Pressable testID="vault-note-card" style={s.card} onPress={onOpen}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!preview && (
          <Text style={s.cardPreview} numberOfLines={2}>
            {preview}
          </Text>
        )}
      </Pressable>
    </Swipeable>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
    cardTitle: { fontSize: 15.5, fontWeight: "700", color: t.text, marginBottom: 4 },
    cardPreview: { fontSize: 13, color: t.textMuted, lineHeight: 18 },
    deleteAction: { backgroundColor: t.danger, justifyContent: "center", alignItems: "center", width: 64, borderRadius: 14, marginBottom: 10 },
    empty: { color: t.textMuted, textAlign: "center", marginTop: 60, fontSize: 14, paddingHorizontal: 30, lineHeight: 21 },
    fab: {
      position: "absolute",
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
  });
