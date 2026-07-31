import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import Icon from "../components/Icon";
import ShiftHandoverScanner from "../components/pos/ShiftHandoverScanner";
import { useAgents } from "../context/AgentsContext";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { shekel, todayKey, uid } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// סוכנים — franchise management: create sub-agents, hand them a slice of the
// warehouse as an isolated "virtual backpack," and reconcile what comes back
// at the end of a shift. Everything here is Main Admin surface; the sub-agent
// side of the same feature (backpack-only selling, live commission, close
// shift) lives inside PosRegisterTab.js, gated by the active-agent selector.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const RED = "#EF4444";
const GREEN_DARK = "#10B981";

const SHADOW = {
  shadowColor: "#7C3AED",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 4,
};

const HANDOVER_TYPE = "dm-shift-handover";

function commissionLabel(agent) {
  return agent.commissionType === "flat"
    ? `${shekel(agent.commissionValue)} לכל יחידה נמכרת`
    : `${agent.commissionValue}% מהרווח על כל מכירה`;
}

export default function AgentsScreen() {
  const { inventory, setInventory, sales } = useBusiness();
  const { agents, setAgents, agentInventory, setAgentInventory, auditLog, setAuditLog } = useAgents();

  const [createOpen, setCreateOpen] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState(null);
  const [closeShiftAgentId, setCloseShiftAgentId] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const logAudit = (agent, action, detail) => {
    setAuditLog((prev) => [
      { id: uid(), ts: Date.now(), agentId: agent.id, agentName: agent.name, action, detail },
      ...(prev || []),
    ]);
  };

  const backpackOf = (agentId) => (agentInventory || []).filter((r) => r.agentId === agentId && r.qty > 0);

  const cashExpectedFor = (agent) =>
    (sales || [])
      .filter((r) => r.agentId === agent.id && r.paymentMethod === "cash" && r.ts > (agent.lastHandoverAt || 0))
      .reduce((sum, r) => sum + (r.total || 0), 0);

  const createAgent = ({ name, commissionType, commissionValue }) => {
    hapticSuccess();
    setAgents((prev) => [
      ...(prev || []),
      {
        id: uid(),
        name,
        commissionType,
        commissionValue,
        commissionEarned: 0,
        lastHandoverAt: 0,
        createdAt: Date.now(),
      },
    ]);
    setCreateOpen(false);
  };

  const removeAgent = (agent) => {
    hapticWarning();
    // The backpack and audit trail stay — deleting a profile shouldn't erase
    // the record of what they sold or still owe back.
    setAgents((prev) => (prev || []).filter((a) => a.id !== agent.id));
  };

  const transferInventory = (agent, item, qty) => {
    hapticSuccess();
    setInventory((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, qty: Math.max(0, i.qty - qty) } : i)));
    setAgentInventory((prev) => {
      const existing = (prev || []).find((r) => r.agentId === agent.id && r.itemId === item.id);
      if (existing) {
        return (prev || []).map((r) => (r.id === existing.id ? { ...r, qty: r.qty + qty } : r));
      }
      return [
        ...(prev || []),
        {
          id: uid(),
          agentId: agent.id,
          itemId: item.id,
          name: item.name,
          category: item.category,
          qty,
          cost: item.cost,
          price: item.price,
          sku: item.id,
          barcode: item.barcode || null,
        },
      ];
    });
    setTransferAgentId(null);
  };

  const reconcileHandover = (payload) => {
    const agent = (agents || []).find((a) => a.id === payload.agentId);
    if (!agent) {
      hapticWarning();
      setReconcileResult({ ok: false, message: "לא נמצא סוכן תואם לקוד שנסרק." });
      setScannerOpen(false);
      return;
    }
    const backpack = Array.isArray(payload.backpack) ? payload.backpack : [];
    setInventory((prev) =>
      (prev || []).map((i) => {
        const line = backpack.find((b) => b.itemId === i.id);
        return line ? { ...i, qty: (Number(i.qty) || 0) + (Number(line.qty) || 0) } : i;
      })
    );
    setAgentInventory((prev) => (prev || []).filter((r) => r.agentId !== agent.id));
    const now = Date.now();
    setAgents((prev) => (prev || []).map((a) => (a.id === agent.id ? { ...a, lastHandoverAt: now } : a)));
    const returnedUnits = backpack.reduce((n, b) => n + (Number(b.qty) || 0), 0);
    const cash = Number(payload.cashExpected) || 0;
    logAudit(agent, "סגירת משמרת והתאמה", `מזומן שהתקבל ${shekel(cash)} · ${returnedUnits} יח' הוחזרו למלאי הראשי`);
    hapticSuccess();
    setReconcileResult({ ok: true, agentName: agent.name, cash, returnedUnits });
    setScannerOpen(false);
  };

  const handleScanned = (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload?.type !== HANDOVER_TYPE) throw new Error("not a handover code");
      reconcileHandover(payload);
    } catch {
      hapticWarning();
      setReconcileResult({ ok: false, message: "הקוד שנסרק אינו קוד החזרת משמרת תקין." });
      setScannerOpen(false);
    }
  };

  const totalCommission = useMemo(
    () => (agents || []).reduce((sum, a) => sum + (Number(a.commissionEarned) || 0), 0),
    [agents]
  );

  const transferAgent = (agents || []).find((a) => a.id === transferAgentId) || null;
  const closeShiftAgent = (agents || []).find((a) => a.id === closeShiftAgentId) || null;

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <View style={s.summary}>
        <CustomText style={s.summaryValue}>{shekel(totalCommission)}</CustomText>
        <CustomText style={s.summaryLabel}>סה״כ עמלות שנצברו לסוכנים</CustomText>
      </View>

      {reconcileResult && (
        <View style={[s.resultBanner, { borderColor: reconcileResult.ok ? GREEN_DARK : RED }]}>
          <Icon name={reconcileResult.ok ? "check-circle" : "alert-triangle"} size={17} color={reconcileResult.ok ? GREEN_DARK : RED} />
          <CustomText style={s.resultText}>
            {reconcileResult.ok
              ? `משמרת של ${reconcileResult.agentName} נסגרה: ${shekel(reconcileResult.cash)} מזומן, ${reconcileResult.returnedUnits} יח' חזרו למלאי.`
              : reconcileResult.message}
          </CustomText>
          <TouchableOpacity onPress={() => setReconcileResult(null)} hitSlop={10}>
            <Icon name="x" size={14} color={INK_MUTED} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
        <TouchableOpacity
          testID="agents-scan-handover"
          style={s.scanRow}
          activeOpacity={0.85}
          onPress={() => {
            hapticLight();
            setScannerOpen(true);
          }}
        >
          <Icon name="maximize" size={18} color={WHITE} />
          <CustomText style={s.scanRowText}>סריקת החזרת משמרת</CustomText>
        </TouchableOpacity>

        {(agents || []).length === 0 ? (
          <View style={s.empty}>
            <Icon name="users" size={34} color="#9CA3AF" />
            <CustomText style={s.emptyText}>אין סוכנים עדיין — הוסיפו עם ה-＋ למטה</CustomText>
          </View>
        ) : (
          (agents || []).map((agent) => {
            const backpack = backpackOf(agent.id);
            const units = backpack.reduce((n, r) => n + r.qty, 0);
            return (
              <View key={agent.id} style={s.agentCard}>
                <View style={s.agentHead}>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <CustomText style={s.agentName}>{agent.name}</CustomText>
                    <CustomText style={s.agentSub}>{commissionLabel(agent)}</CustomText>
                  </View>
                  <View style={s.avatar}>
                    <Icon name="user" size={19} color={BLUE} />
                  </View>
                </View>

                <View style={s.agentStatsRow}>
                  <View style={s.agentStat}>
                    <CustomText style={s.agentStatValue}>{shekel(agent.commissionEarned || 0)}</CustomText>
                    <CustomText style={s.agentStatLabel}>עמלה שנצברה</CustomText>
                  </View>
                  <View style={s.agentStat}>
                    <CustomText style={s.agentStatValue}>{units}</CustomText>
                    <CustomText style={s.agentStatLabel}>יח׳ בתיק</CustomText>
                  </View>
                  <View style={s.agentStat}>
                    <CustomText style={s.agentStatValue}>{shekel(cashExpectedFor(agent))}</CustomText>
                    <CustomText style={s.agentStatLabel}>מזומן ממתין</CustomText>
                  </View>
                </View>

                {backpack.length > 0 && (
                  <View style={s.backpackList}>
                    {backpack.map((row) => (
                      <View key={row.id} style={s.backpackRow}>
                        <CustomText style={s.backpackQty}>{row.qty}×</CustomText>
                        <CustomText style={s.backpackName} numberOfLines={1}>
                          {row.name}
                        </CustomText>
                      </View>
                    ))}
                  </View>
                )}

                <View style={s.agentActions}>
                  <TouchableOpacity
                    testID={`agent-transfer-${agent.id}`}
                    style={[s.actionBtn, { backgroundColor: BLUE }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      hapticLight();
                      setTransferAgentId(agent.id);
                    }}
                  >
                    <Icon name="package" size={15} color={WHITE} />
                    <CustomText style={s.actionBtnText}>העברת מלאי</CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`agent-close-shift-${agent.id}`}
                    style={[s.actionBtn, { backgroundColor: GREEN_DARK }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      hapticLight();
                      setCloseShiftAgentId(agent.id);
                    }}
                  >
                    <Icon name="log-out" size={15} color={WHITE} />
                    <CustomText style={s.actionBtnText}>סגירת משמרת</CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`agent-remove-${agent.id}`}
                    style={s.removeBtn}
                    activeOpacity={0.7}
                    onPress={() => removeAgent(agent)}
                  >
                    <Icon name="trash-2" size={15} color={RED} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {(auditLog || []).length > 0 && (
          <TouchableOpacity style={s.auditToggle} activeOpacity={0.8} onPress={() => setAuditOpen((v) => !v)}>
            <Icon name={auditOpen ? "chevron-down" : "chevron-left"} size={15} color={INK_SOFT} />
            <CustomText style={s.auditToggleText}>יומן ביקורת ({(auditLog || []).length})</CustomText>
          </TouchableOpacity>
        )}
        {auditOpen && (
          <View style={s.auditList}>
            {(auditLog || []).slice(0, 40).map((entry) => (
              <View key={entry.id} style={s.auditRow}>
                <CustomText style={s.auditAction}>{entry.action}</CustomText>
                <CustomText style={s.auditMeta}>
                  {entry.agentName} · {new Date(entry.ts).toLocaleString("he-IL")}
                </CustomText>
                {!!entry.detail && <CustomText style={s.auditDetail}>{entry.detail}</CustomText>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity testID="agent-create-fab" style={s.fab} onPress={() => { hapticLight(); setCreateOpen(true); }} activeOpacity={0.85}>
        <CustomText style={s.fabPlus}>＋</CustomText>
      </TouchableOpacity>

      <CreateAgentModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreate={createAgent} />

      <TransferModal
        visible={!!transferAgent}
        agent={transferAgent}
        inventory={inventory || []}
        onClose={() => setTransferAgentId(null)}
        onTransfer={transferInventory}
      />

      <CloseShiftModal
        visible={!!closeShiftAgent}
        agent={closeShiftAgent}
        backpack={closeShiftAgent ? backpackOf(closeShiftAgent.id) : []}
        cashExpected={closeShiftAgent ? cashExpectedFor(closeShiftAgent) : 0}
        onClose={() => setCloseShiftAgentId(null)}
      />

      <ShiftHandoverScanner visible={scannerOpen} onScanned={handleScanned} onClose={() => setScannerOpen(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------

function CreateAgentModal({ visible, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [commissionType, setCommissionType] = useState("pct");
  const [value, setValue] = useState("");

  const close = () => {
    setName("");
    setCommissionType("pct");
    setValue("");
    onClose();
  };

  const valid = name.trim().length > 0 && parseFloat(value) >= 0;

  const submit = () => {
    if (!valid) {
      hapticWarning();
      return;
    }
    onCreate({ name: name.trim(), commissionType, commissionValue: parseFloat(value) || 0 });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.card}>
              <CustomText style={s.cardTitle}>סוכן חדש</CustomText>
              <TextInput
                testID="agent-name-input"
                style={s.amountInput}
                value={name}
                onChangeText={setName}
                placeholder="שם הסוכן"
                placeholderTextColor={INK_MUTED}
                textAlign="right"
              />

              <View style={s.typeRow}>
                <TouchableOpacity
                  testID="agent-commission-pct"
                  style={[s.typeChip, commissionType === "pct" && s.typeChipOn]}
                  onPress={() => setCommissionType("pct")}
                >
                  <CustomText style={[s.typeChipText, commissionType === "pct" && s.typeChipTextOn]}>אחוז מהרווח</CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="agent-commission-flat"
                  style={[s.typeChip, commissionType === "flat" && s.typeChipOn]}
                  onPress={() => setCommissionType("flat")}
                >
                  <CustomText style={[s.typeChipText, commissionType === "flat" && s.typeChipTextOn]}>סכום קבוע ליחידה</CustomText>
                </TouchableOpacity>
              </View>

              <TextInput
                testID="agent-commission-value"
                style={s.amountInput}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={commissionType === "pct" ? "אחוז, למשל 10" : "₪ ליחידה, למשל 2"}
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />

              <TouchableOpacity
                testID="agent-create-save"
                style={[s.actionBtnWide, { backgroundColor: BLUE }, !valid && { opacity: 0.35 }]}
                disabled={!valid}
                onPress={submit}
                activeOpacity={0.8}
              >
                <CustomText style={s.actionBtnText}>שמור סוכן</CustomText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Move a specific quantity of one item from the main warehouse into an
// agent's isolated backpack. Capped at whatever the warehouse currently has.

function TransferModal({ visible, agent, inventory, onClose, onTransfer }) {
  const [itemId, setItemId] = useState(null);
  const [qtyText, setQtyText] = useState("");

  const inStock = inventory.filter((i) => (i.qty || 0) > 0);
  const item = inStock.find((i) => i.id === itemId) || null;
  const qty = parseInt(qtyText, 10) || 0;
  const valid = !!agent && !!item && qty > 0 && qty <= (item.qty || 0);

  const close = () => {
    setItemId(null);
    setQtyText("");
    onClose();
  };

  const submit = () => {
    if (!valid) {
      hapticWarning();
      return;
    }
    onTransfer(agent, item, qty);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.card}>
              <CustomText style={s.cardTitle}>העברת מלאי ל{agent?.name || ""}</CustomText>

              <ScrollView style={s.pickList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {inStock.map((i) => {
                  const on = i.id === itemId;
                  return (
                    <TouchableOpacity
                      key={i.id}
                      testID={`transfer-item-${i.id}`}
                      style={[s.pickRow, on && s.pickRowOn]}
                      onPress={() => {
                        hapticLight();
                        setItemId(i.id);
                      }}
                    >
                      <CustomText style={s.pickRowQty}>במלאי: {i.qty}</CustomText>
                      <CustomText style={[s.pickRowName, on && { color: BLUE }]} numberOfLines={1}>
                        {i.name}
                      </CustomText>
                    </TouchableOpacity>
                  );
                })}
                {inStock.length === 0 && <CustomText style={s.emptyText}>אין פריטים במלאי הראשי להעברה.</CustomText>}
              </ScrollView>

              <TextInput
                testID="transfer-qty-input"
                style={s.amountInput}
                value={qtyText}
                onChangeText={setQtyText}
                keyboardType="number-pad"
                placeholder={item ? `כמות (עד ${item.qty})` : "בחר פריט קודם"}
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />

              <TouchableOpacity
                testID="transfer-submit"
                style={[s.actionBtnWide, { backgroundColor: BLUE }, !valid && { opacity: 0.35 }]}
                disabled={!valid}
                onPress={submit}
                activeOpacity={0.8}
              >
                <CustomText style={s.actionBtnText}>העבר לתיק</CustomText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// A read-only summary + QR for the Main Admin to scan. Nothing is written to
// storage here — the reconciliation only happens once the QR is actually
// scanned, so showing this screen twice is harmless.

function CloseShiftModal({ visible, agent, backpack, cashExpected, onClose }) {
  if (!agent) return null;
  const payload = {
    type: HANDOVER_TYPE,
    agentId: agent.id,
    agentName: agent.name,
    ts: Date.now(),
    cashExpected,
    backpack: backpack.map((r) => ({ itemId: r.itemId, name: r.name, qty: r.qty })),
  };
  const value = JSON.stringify(payload);
  const units = backpack.reduce((n, r) => n + r.qty, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.card}>
              <CustomText style={s.cardTitle}>סגירת משמרת · {agent.name}</CustomText>

              <View style={s.cardBalRow}>
                <CustomText style={[s.cardBalValue, { color: GREEN_DARK }]}>{shekel(cashExpected)}</CustomText>
                <CustomText style={s.cardBalLabel}>מזומן צפוי למסירה</CustomText>
              </View>

              <CustomText style={s.qrHint}>
                {units > 0
                  ? `${units} יח׳ שלא נמכרו יוחזרו למלאי הראשי עם הסריקה`
                  : "התיק ריק — אין פריטים להחזרה"}
              </CustomText>

              <View style={s.qrWrap}>
                <QRCode value={value} size={200} color={INK} backgroundColor={WHITE} ecl="M" />
              </View>

              <CustomText style={s.qrCaption}>הראו את הקוד הזה למנהל כדי שיסרוק ויאשר את סגירת המשמרת</CustomText>

              <TouchableOpacity testID="close-shift-done" style={s.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
                <CustomText style={s.secondaryBtnText}>סגור</CustomText>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

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
  summaryLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
  summaryValue: { fontFamily: FONTS.bold, fontSize: 20 },

  resultBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: WHITE,
  },
  resultText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: INK, textAlign: "right" },

  scanRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLUE,
    borderRadius: 16,
    minHeight: 50,
    marginBottom: 12,
  },
  scanRowText: { fontFamily: FONTS.bold, fontSize: 14, color: WHITE },

  empty: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: INK_MUTED, textAlign: "center" },

  agentCard: { backgroundColor: CARD, borderRadius: 22, padding: 14, marginBottom: 10, ...SHADOW },
  agentHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  agentName: { fontFamily: FONTS.bold, fontSize: 16, color: INK },
  agentSub: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  agentStatsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  agentStat: { flex: 1, alignItems: "center", backgroundColor: WHITE, borderRadius: 12, paddingVertical: 8 },
  agentStatValue: { fontFamily: FONTS.bold, fontSize: 13, color: INK },
  agentStatLabel: { fontFamily: FONTS.regular, fontSize: 9.5, color: INK_MUTED, marginTop: 2 },

  backpackList: { marginTop: 10, gap: 4 },
  backpackRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  backpackQty: { fontFamily: FONTS.semibold, fontSize: 11, color: BLUE, minWidth: 26, textAlign: "right" },
  backpackName: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: INK_SOFT, textAlign: "right" },

  agentActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12, alignItems: "center" },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42,
    borderRadius: 12,
  },
  actionBtnWide: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontFamily: FONTS.bold, fontSize: 12.5, color: WHITE },
  removeBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },

  auditToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 8,
  },
  auditToggleText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
  auditList: { gap: 8 },
  auditRow: { backgroundColor: CARD, borderRadius: 14, padding: 10 },
  auditAction: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK, textAlign: "right" },
  auditMeta: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  auditDetail: { fontFamily: FONTS.regular, fontSize: 11, color: INK_SOFT, textAlign: "right", marginTop: 3 },

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

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxHeight: "86%", backgroundColor: WHITE, borderRadius: 24, padding: 20, ...SHADOW },
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
  cardBalLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  cardBalValue: { fontFamily: FONTS.bold, fontSize: 19 },
  amountInput: {
    minHeight: 50,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: INK,
    marginBottom: 10,
  },

  typeRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  typeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  typeChipOn: { backgroundColor: BLUE },
  typeChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_SOFT, textAlign: "center" },
  typeChipTextOn: { color: WHITE },

  pickList: { maxHeight: 200, marginBottom: 10 },
  pickRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 6,
  },
  pickRowOn: { borderWidth: 1.5, borderColor: BLUE },
  pickRowName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: INK, textAlign: "right", marginRight: 8 },
  pickRowQty: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED },

  qrHint: { fontFamily: FONTS.regular, fontSize: 12, color: INK_SOFT, textAlign: "center", marginBottom: 10 },
  qrWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  qrCaption: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "center", marginTop: 8, marginBottom: 14 },

  secondaryBtn: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: CARD },
  secondaryBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
});
