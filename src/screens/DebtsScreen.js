import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

import Icon from "../components/Icon";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { shekel, uid } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// הקפות — fast credit-tab ledger for regulars. Legacy data shape kept
// ({id, name, owed, paid}; balance = owed − paid) so tabs recorded by the old
// tool suite show up here untouched.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const RED = "#EF4444";
const GREEN_DARK = "#10B981";

const balanceOf = (d) => Math.max(0, (Number(d.owed) || 0) - (Number(d.paid) || 0));

export default function DebtsScreen() {
  const { debts, setDebts } = useBusiness();

  // Fast-action modal for an existing customer + create modal for a new one.
  const [selectedId, setSelectedId] = useState(null);
  const [amount, setAmount] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDebt, setNewDebt] = useState("");

  const selected = debts.find((d) => d.id === selectedId);
  const totalOutstanding = useMemo(() => debts.reduce((s, d) => s + balanceOf(d), 0), [debts]);

  // Owing customers first (largest debt on top), settled ones below.
  const sorted = useMemo(
    () => [...debts].sort((a, b) => balanceOf(b) - balanceOf(a)),
    [debts]
  );

  const openCustomer = (d) => {
    hapticLight();
    setAmount("");
    setSelectedId(d.id);
  };

  const addDebt = () => {
    const v = parseFloat(amount);
    if (!selected || !(v > 0)) return;
    hapticWarning();
    setDebts((prev) => prev.map((d) => (d.id === selected.id ? { ...d, owed: (Number(d.owed) || 0) + v } : d)));
    setSelectedId(null);
  };

  // Empty amount → settle in full (zero the balance); an amount → partial payment.
  const settle = () => {
    if (!selected) return;
    const v = parseFloat(amount);
    hapticSuccess();
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== selected.id) return d;
        const paid = v > 0 ? Math.min(Number(d.owed) || 0, (Number(d.paid) || 0) + v) : Number(d.owed) || 0;
        return { ...d, paid };
      })
    );
    setSelectedId(null);
  };

  const removeCustomer = () => {
    if (!selected) return;
    hapticWarning();
    setDebts((prev) => prev.filter((d) => d.id !== selected.id));
    setSelectedId(null);
  };

  const createCustomer = () => {
    const name = newName.trim();
    if (!name) return;
    hapticSuccess();
    const initial = parseFloat(newDebt);
    setDebts((prev) => [...prev, { id: uid(), name, owed: initial > 0 ? initial : 0, paid: 0 }]);
    setNewName("");
    setNewDebt("");
    setCreateOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {/* Outstanding total */}
      <View style={s.summary}>
        <CustomText style={[s.summaryValue, { color: totalOutstanding > 0 ? RED : GREEN_DARK }]}>
          {shekel(totalOutstanding)}
        </CustomText>
        <CustomText style={s.summaryLabel}>סה״כ חובות פתוחים</CustomText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
        {sorted.length === 0 ? (
          <View style={s.empty}>
            <Icon name="book-open" size={34} color="#9CA3AF" />
            <CustomText style={s.emptyText}>אין לקוחות בהקפה — הוסף עם ה-＋ למטה</CustomText>
          </View>
        ) : (
          sorted.map((d) => {
            const bal = balanceOf(d);
            return (
              <TouchableOpacity key={d.id} style={s.row} onPress={() => openCustomer(d)} activeOpacity={0.7}>
                <View style={{ alignItems: "flex-start" }}>
                  <CustomText style={[s.balance, { color: bal > 0 ? RED : GREEN_DARK }]}>
                    {bal > 0 ? shekel(bal) : "מאופס"}
                  </CustomText>
                  {bal > 0 && <CustomText style={s.balanceCap}>חוב פתוח</CustomText>}
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <CustomText style={s.name}>{d.name}</CustomText>
                  <CustomText style={s.nameSub}>סה״כ נרשם {shekel(d.owed || 0)} · שולם {shekel(d.paid || 0)}</CustomText>
                </View>
                <View style={[s.avatar, { backgroundColor: bal > 0 ? RED + "14" : GREEN_DARK + "14" }]}>
                  <Icon name={bal > 0 ? "alert-circle" : "check-circle"} size={19} color={bal > 0 ? RED : GREEN} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Floating add — pinned low for thumb reach on tall screens */}
      <TouchableOpacity style={s.fab} onPress={() => { hapticLight(); setCreateOpen(true); }} activeOpacity={0.85}>
        <CustomText style={s.fabPlus}>＋</CustomText>
      </TouchableOpacity>

      {/* Fast-action modal: add debt / settle */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelectedId(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedId(null)}>
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.card}>
                <CustomText style={s.cardTitle}>{selected?.name}</CustomText>
                <View style={s.cardBalRow}>
                  <CustomText style={[s.cardBalValue, { color: balanceOf(selected || {}) > 0 ? RED : GREEN_DARK }]}>
                    {shekel(balanceOf(selected || {}))}
                  </CustomText>
                  <CustomText style={s.cardBalLabel}>יתרת חוב</CustomText>
                </View>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="סכום (₪)"
                  placeholderTextColor={INK_MUTED}
                  textAlign="center"
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: GREEN_DARK }]}
                    onPress={settle}
                    activeOpacity={0.8}
                  >
                    <Icon name="check" size={17} color={WHITE} />
              <CustomText style={s.actionBtnText}>תשלום חוב</CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: BLUE }, !(parseFloat(amount) > 0) && { opacity: 0.35 }]}
                    onPress={addDebt}
                    activeOpacity={0.8}
                  >
                    <Icon name="plus" size={17} color={WHITE} />
              <CustomText style={s.actionBtnText}>הוסף חוב</CustomText>
                  </TouchableOpacity>
                </View>
                <CustomText style={s.hint}>תשלום ללא סכום מאפס את כל החוב · עם סכום — תשלום חלקי</CustomText>
                {balanceOf(selected || {}) === 0 && (
                  <TouchableOpacity style={s.removeBtn} onPress={removeCustomer} activeOpacity={0.7}>
                    <Icon name="trash-2" size={15} color={RED} />
            <CustomText style={s.removeBtnText}>מחק לקוח</CustomText>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* New customer modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setCreateOpen(false)}>
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.card}>
                <CustomText style={s.cardTitle}>לקוח חדש בהקפה</CustomText>
                <TextInput
                  style={[s.amountInput, { fontSize: 16 }]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="שם הלקוח"
                  placeholderTextColor={INK_MUTED}
                  textAlign="right"
                />
                <TextInput
                  style={s.amountInput}
                  value={newDebt}
                  onChangeText={setNewDebt}
                  keyboardType="numeric"
                  placeholder="חוב פתיחה (לא חובה)"
                  placeholderTextColor={INK_MUTED}
                  textAlign="center"
                />
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: BLUE }, !newName.trim() && { opacity: 0.35 }]}
                  onPress={createCustomer}
                  activeOpacity={0.8}
                >
                  <CustomText style={s.actionBtnText}>שמור לקוח</CustomText>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const SHADOW = {
  // The one card shadow for the whole app — see utils/ui.js.
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 4,
};

const s = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 56,
    ...SHADOW,
  },
  summaryLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: INK_SOFT },
  summaryValue: { fontFamily: FONTS.bold, fontSize: 20 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: INK_MUTED, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    minHeight: 64,
    ...SHADOW,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONTS.semibold, fontSize: 15, color: INK },
  nameSub: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  balance: { fontFamily: FONTS.bold, fontSize: 16 },
  balanceCap: { fontFamily: FONTS.regular, fontSize: 10, color: RED, marginTop: 1 },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPlus: { fontFamily: FONTS.bold, fontSize: 30, color: WHITE, lineHeight: 34 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,20,26,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: { width: "100%", backgroundColor: WHITE, borderRadius: 24, padding: 20, ...SHADOW },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 18, color: INK, textAlign: "right", marginBottom: 12 },
  cardBalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 10,
  },
  cardBalLabel: { fontFamily: FONTS.medium, fontSize: 14, color: INK_SOFT },
  cardBalValue: { fontFamily: FONTS.bold, fontSize: 20 },
  amountInput: {
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: INK,
    marginBottom: 10,
  },
  actionBtn: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE },
  hint: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "center", marginTop: 10 },
  removeBtn: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 6 },
  removeBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: RED },
});
