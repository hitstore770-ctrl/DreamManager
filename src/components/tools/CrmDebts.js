import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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

export default function CrmDebts() {
  const [debtors, setDebtors] = usePersistentState(STORAGE_KEYS.posDebts, []);
  const [name, setName] = useState("");
  const [owed, setOwed] = useState("");

  const totalOutstanding = useMemo(
    () => debtors.reduce((s, d) => s + Math.max(0, d.owed - d.paid), 0),
    [debtors]
  );

  const addDebtor = () => {
    if (!name.trim() || !(Number(owed) > 0)) {
      Alert.alert("פרטים חסרים", "נא להזין שם וסכום חוב");
      return;
    }
    setDebtors((prev) => [
      { id: uid(), name: name.trim(), owed: Number(owed), paid: 0 },
      ...prev,
    ]);
    setName("");
    setOwed("");
  };

  const pay = (id, amount) =>
    setDebtors((prev) =>
      prev.map((d) => (d.id === id ? { ...d, paid: Math.min(d.owed, d.paid + amount) } : d))
    );

  const remove = (id) => setDebtors((prev) => prev.filter((d) => d.id !== id));

  return (
    <View>
      {/* Global dashboard */}
      <View style={styles.dashboard}>
        <Text style={styles.dashLabel}>סה״כ חובות פתוחים</Text>
        <Text style={styles.dashValue}>{shekel(totalOutstanding)}</Text>
      </View>

      {/* Add debtor */}
      <View style={styles.form}>
        <TextInput
          style={[styles.input, styles.nameInput]}
          value={name}
          onChangeText={setName}
          placeholder="שם החייב"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
        <TextInput
          style={[styles.input, styles.owedInput]}
          value={owed}
          onChangeText={setOwed}
          placeholder="₪ חוב"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          textAlign="center"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addDebtor} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {debtors.length === 0 ? (
        <Text style={styles.empty}>אין חייבים רשומים</Text>
      ) : (
        debtors.map((d) => (
          <DebtorRow key={d.id} debtor={d} onPay={(amt) => pay(d.id, amt)} onRemove={() => remove(d.id)} />
        ))
      )}
    </View>
  );
}

function DebtorRow({ debtor, onPay, onRemove }) {
  const remaining = Math.max(0, debtor.owed - debtor.paid);
  const settled = remaining <= 0;
  const [amt, setAmt] = useState("");
  const anim = useRef(new Animated.Value(settled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: settled ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [settled, anim]);

  const strikeW = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const submitPayment = () => {
    const v = Number(amt);
    if (!v || v <= 0) return;
    onPay(v);
    setAmt("");
  };

  return (
    <View style={[styles.card, settled && styles.cardPaid]}>
      <View style={styles.cardHead}>
        <TouchableOpacity style={styles.del} onPress={onRemove}>
          <Text style={styles.delText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.nameWrap}>
          <Text style={[styles.debtorName, settled && styles.debtorNamePaid]}>{debtor.name}</Text>
          <Animated.View style={[styles.strike, { width: strikeW }]} pointerEvents="none" />
        </View>
        <Text style={[styles.remaining, settled && { color: COLORS.success }]}>
          {settled ? "✓" : shekel(remaining)}
        </Text>
      </View>

      {settled ? (
        <View style={styles.paidBanner}>
          <Text style={styles.paidText}>שולם במלואו</Text>
        </View>
      ) : (
        <>
          <Text style={styles.subLine}>
            שולם {shekel(debtor.paid)} מתוך {shekel(debtor.owed)}
          </Text>
          <View style={styles.payRow}>
            <TextInput
              style={styles.payInput}
              value={amt}
              onChangeText={setAmt}
              keyboardType="numeric"
              textAlign="center"
              placeholder="₪ תשלום"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.payBtn} onPress={submitPayment} activeOpacity={0.85}>
              <Text style={styles.payBtnText}>הפחת תשלום</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { backgroundColor: COLORS.navy, borderRadius: RADIUS, padding: 18, alignItems: "center", marginBottom: 16, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  dashLabel: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.medium },
  dashValue: { color: "#FFFFFF", fontSize: 30, fontFamily: FONTS.bold, marginTop: 4 },
  form: { flexDirection: "row", gap: 8, marginBottom: 16, alignItems: "center" },
  input: { backgroundColor: COLORS.white, borderRadius: RADIUS, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.regular, ...BRUTAL_BORDER },
  nameInput: { flex: 1 },
  owedInput: { width: 90 },
  addBtn: { width: 48, height: 46, borderRadius: RADIUS, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  addBtnText: { color: "#FFFFFF", fontSize: 24, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 14, marginBottom: 10, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  cardPaid: { backgroundColor: "#EEF6EF" },
  cardHead: { flexDirection: "row", alignItems: "center" },
  del: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  delText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  nameWrap: { flex: 1, justifyContent: "center", marginHorizontal: 10 },
  debtorName: { color: COLORS.textPrimary, fontSize: 17, fontFamily: FONTS.bold, textAlign: "right" },
  debtorNamePaid: { color: COLORS.textMuted },
  strike: { position: "absolute", right: 0, height: 4, backgroundColor: "#000" },
  remaining: { color: COLORS.danger, fontSize: 18, fontFamily: FONTS.bold },
  paidBanner: { backgroundColor: COLORS.success, borderRadius: RADIUS, paddingVertical: 8, alignItems: "center", marginTop: 10, ...BRUTAL_BORDER },
  paidText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold, letterSpacing: 1 },
  subLine: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.medium, textAlign: "right", marginTop: 8 },
  payRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  payInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, ...BRUTAL_BORDER },
  payBtn: { paddingHorizontal: 18, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  payBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
});
