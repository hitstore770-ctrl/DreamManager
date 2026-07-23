import { useMemo } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { shekel, uid } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const INIT = { cash: "", customPct: "15", customName: "חיסכון לשדרוג ציוד", locked: [] };

export default function TithesSavings() {
  const [state, setState] = usePersistentState(STORAGE_KEYS.posSavings, INIT);
  const cash = Number(state.cash) || 0;
  const customPct = Number(state.customPct) || 0;

  const lockedTotal = useMemo(
    () => (state.locked || []).reduce((s, l) => s + l.amount, 0),
    [state.locked]
  );
  const available = cash - lockedTotal;
  const maaser = cash * 0.1;
  const customAmount = cash * (customPct / 100);

  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));

  const lock = (name, amount) => {
    if (amount <= 0) {
      Alert.alert("אין סכום", "הזן קודם סכום מזומן");
      return;
    }
    setState((s) => ({ ...s, locked: [{ id: uid(), name, amount }, ...(s.locked || [])] }));
  };

  const unlock = (id) =>
    setState((s) => ({ ...s, locked: (s.locked || []).filter((l) => l.id !== id) }));

  return (
    <View>
      {/* Available vs locked dashboard */}
      <View style={styles.dashboard}>
        <Text style={styles.dashLabel}>מזומן זמין (אחרי נעילות)</Text>
        <Text style={[styles.dashValue, available < 0 && { color: COLORS.mustard }]}>
          {shekel(available)}
        </Text>
        <Text style={styles.dashSub}>נעול בצד: {shekel(lockedTotal)}</Text>
      </View>

      <Text style={styles.label}>סה״כ מזומן שנכנס</Text>
      <TextInput
        style={styles.input}
        value={state.cash}
        onChangeText={(v) => set("cash", v)}
        keyboardType="numeric"
        textAlign="center"
        placeholder="₪ 0"
        placeholderTextColor={COLORS.textMuted}
      />

      {/* Maaser 10% */}
      <View style={styles.calcCard}>
        <View style={styles.calcHead}>
          <Text style={styles.calcAmount}>{shekel(maaser)}</Text>
          <Text style={styles.calcTitle}>מעשר (10%)</Text>
        </View>
        <TouchableOpacity style={[styles.lockBtn, styles.lockNavy]} onPress={() => lock("מעשר", maaser)} activeOpacity={0.85}>
          <Text style={styles.lockBtnText}>🔒 נעל מעשר</Text>
        </TouchableOpacity>
      </View>

      {/* Custom savings % */}
      <View style={styles.calcCard}>
        <TextInput
          style={styles.customName}
          value={state.customName}
          onChangeText={(v) => set("customName", v)}
          textAlign="right"
          placeholder="שם החיסכון"
          placeholderTextColor={COLORS.textMuted}
        />
        <View style={styles.pctRow}>
          <View style={styles.pctBox}>
            <TextInput
              style={styles.pctInput}
              value={state.customPct}
              onChangeText={(v) => set("customPct", v)}
              keyboardType="numeric"
              textAlign="center"
            />
            <Text style={styles.pctSign}>%</Text>
          </View>
          <Text style={styles.calcAmount}>{shekel(customAmount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.lockBtn, styles.lockMustard]}
          onPress={() => lock(state.customName || "חיסכון", customAmount)}
          activeOpacity={0.85}
        >
          <Text style={[styles.lockBtnText, { color: COLORS.textPrimary }]}>🔒 נעל חיסכון</Text>
        </TouchableOpacity>
      </View>

      {/* Locked funds list */}
      {(state.locked || []).length > 0 && <Text style={styles.label}>כספים נעולים</Text>}
      {(state.locked || []).map((l) => (
        <View key={l.id} style={styles.lockedRow}>
          <TouchableOpacity style={styles.unlockBtn} onPress={() => unlock(l.id)} activeOpacity={0.85}>
            <Text style={styles.unlockText}>🔓 שחרר</Text>
          </TouchableOpacity>
          <Text style={styles.lockedAmount}>{shekel(l.amount)}</Text>
          <Text style={styles.lockedName}>{l.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { backgroundColor: COLORS.navy, borderRadius: RADIUS, padding: 18, alignItems: "center", marginBottom: 16, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  dashLabel: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.medium },
  dashValue: { color: "#FFFFFF", fontSize: 30, fontFamily: FONTS.bold, marginTop: 4 },
  dashSub: { color: "#CBD5E1", fontSize: 13, fontFamily: FONTS.bold, marginTop: 4 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: COLORS.white, borderRadius: RADIUS, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold, marginBottom: 14, ...BRUTAL_BORDER },
  calcCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  calcHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  calcTitle: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold },
  calcAmount: { color: COLORS.success, fontSize: 22, fontFamily: FONTS.bold },
  lockBtn: { height: 46, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  lockNavy: { backgroundColor: COLORS.navy },
  lockMustard: { backgroundColor: COLORS.mustard },
  lockBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  customName: { backgroundColor: COLORS.background, borderRadius: RADIUS, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12, ...BRUTAL_BORDER },
  pctRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pctBox: { flexDirection: "row", alignItems: "center" },
  pctInput: { width: 56, backgroundColor: COLORS.background, borderRadius: 8, paddingVertical: 8, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  pctSign: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.bold, marginStart: 4 },
  lockedRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 8, ...BRUTAL_BORDER },
  unlockBtn: { paddingHorizontal: 12, height: 36, borderRadius: 8, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  unlockText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold },
  lockedAmount: { color: COLORS.navy, fontSize: 16, fontFamily: FONTS.bold, marginHorizontal: 10 },
  lockedName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
});
