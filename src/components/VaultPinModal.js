import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { RADIUS, useTheme } from "../theme/ThemeContext";
import { getVerifier, setVerifier } from "../db/vaultRepo";
import { decryptText, deriveVaultKey, VAULT_VERIFIER_PLAINTEXT } from "../lib/crypto";

// Reusable PIN gate: on first use (no verifier row yet) it asks the user to
// set a PIN; every time after, it asks for the existing one. Either path
// ends by handing the derived AES key to `onUnlocked` -- the key never
// leaves memory here.
export default function VaultPinModal({ visible, onClose, onUnlocked }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [mode, setMode] = useState(null); // "checking" | "set" | "enter"
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPin("");
    setConfirmPin("");
    setError("");
    setMode("checking");
    getVerifier(db).then((row) => setMode(row ? "enter" : "set"));
  }, [visible, db]);

  const submit = async () => {
    if (busy) return;
    if (pin.trim().length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "set") {
        if (pin !== confirmPin) {
          setError("PINs don't match.");
          setBusy(false);
          return;
        }
        const key = await deriveVaultKey(pin);
        await setVerifier(db, key);
        onUnlocked(key);
      } else {
        const key = await deriveVaultKey(pin);
        const row = await getVerifier(db);
        const text = row ? await decryptText(row.cipher, row.iv, row.mac, key) : null;
        if (text !== VAULT_VERIFIER_PLAINTEXT) {
          setError("Incorrect PIN.");
          setBusy(false);
          return;
        }
        onUnlocked(key);
      }
    } finally {
      setBusy(false);
    }
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.titleRow}>
            <Feather name="shield" size={18} color={theme.accent} />
            <AppText style={s.title}>{mode === "set" ? "Set a Vault PIN" : "Enter Vault PIN"}</AppText>
          </View>
          {mode === "checking" ? (
            <AppText style={s.hint}>Loading…</AppText>
          ) : (
            <>
              <AppText style={s.hint}>
                {mode === "set"
                  ? "This PIN encrypts every note you put in the Vault. There is no recovery if you forget it."
                  : "Notes stay encrypted until the correct PIN is entered."}
              </AppText>
              <AppTextInput
                testID="vault-pin-input"
                style={s.input}
                value={pin}
                onChangeText={setPin}
                placeholder="PIN"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                keyboardType="number-pad"
                autoFocus
              />
              {mode === "set" && (
                <AppTextInput
                  testID="vault-confirm-input"
                  style={s.input}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder="Confirm PIN"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  keyboardType="number-pad"
                />
              )}
              {!!error && <AppText style={s.error}>{error}</AppText>}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose} activeOpacity={0.8}>
                  <AppText style={[s.btnText, { color: theme.textSecondary }]}>Cancel</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="vault-submit"
                  style={[s.btn, { backgroundColor: theme.accent }]}
                  onPress={submit}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <AppText style={[s.btnText, { color: theme.onAccent }]}>{busy ? "…" : mode === "set" ? "Create" : "Unlock"}</AppText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.overlay, alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 340, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 20, ...t.cardShadow },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    title: { fontSize: 16, fontWeight: "700", color: t.text },
    hint: { fontSize: 12.5, color: t.textMuted, lineHeight: 18, marginBottom: 14 },
    input: {
      backgroundColor: t.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 46,
      color: t.text,
      fontSize: 16,
      letterSpacing: 2,
      marginBottom: 10,
    },
    error: { color: t.danger, fontSize: 12.5, marginBottom: 6 },
    btn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: t.surfaceAlt },
    btnText: { fontWeight: "700", fontSize: 14.5 },
  });
