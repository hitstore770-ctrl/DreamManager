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

// Default daily commission target when an agent is created without picking
// one — enough for the Live Commission Bar in the agent's own POS to have
// something to fill toward from the first shift.
const DEFAULT_COMMISSION_GOAL = 100;

function commissionLabel(agent) {
  return agent.commissionType === "flat"
    ? `${shekel(agent.commissionValue)} לכל יחידה נמכרת`
    : `${agent.commissionValue}% מהרווח על כל מכירה`;
}

// The agent's *this-shift* commission is never stored on its own — it's the
// gap between the lifetime running total and the snapshot taken the last
// time a shift closed, so it can never drift from the number completeSale
// actually accrues.
function shiftCommissionOf(agent) {
  return Math.max(0, (Number(agent?.commissionEarned) || 0) - (Number(agent?.commissionAtLastHandover) || 0));
}

export default function AgentsScreen() {
  const { inventory, setInventory, sales } = useBusiness();
  const {
    agents,
    setAgents,
    agentInventory,
    setAgentInventory,
    auditLog,
    setAuditLog,
    agentOrders,
    setAgentOrders,
  } = useAgents();

  const [createOpen, setCreateOpen] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState(null);
  const [closeShiftAgentId, setCloseShiftAgentId] = useState(null);
  const [assignOrderAgentId, setAssignOrderAgentId] = useState(null);
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

  const createAgent = ({ name, commissionType, commissionValue, commissionGoal }) => {
    hapticSuccess();
    setAgents((prev) => [
      ...(prev || []),
      {
        id: uid(),
        name,
        commissionType,
        commissionValue,
        commissionEarned: 0,
        // Snapshot of commissionEarned at the last handover — the baseline
        // shiftCommissionOf subtracts from, so a brand-new agent's first
        // shift starts counting from zero.
        commissionAtLastHandover: 0,
        commissionGoal: commissionGoal > 0 ? commissionGoal : DEFAULT_COMMISSION_GOAL,
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
    // Snapshotting commissionEarned here — not resetting it — is what lets
    // shiftCommissionOf keep reading a single authoritative running total
    // instead of a second counter that could drift from it.
    setAgents((prev) =>
      (prev || []).map((a) =>
        a.id === agent.id ? { ...a, lastHandoverAt: now, commissionAtLastHandover: a.commissionEarned || 0 } : a
      )
    );
    const returnedUnits = backpack.reduce((n, b) => n + (Number(b.qty) || 0), 0);
    const cash = Number(payload.cashExpected) || 0;
    const commissionKept = Number(payload.commissionKept) || 0;
    const netCash = payload.netCashOwed != null ? Number(payload.netCashOwed) : Math.max(0, cash - commissionKept);
    logAudit(
      agent,
      "סגירת משמרת והתאמה",
      `מזומן שהתקבל ${shekel(cash)} · עמלת סוכן ${shekel(commissionKept)} · נטו למנהל ${shekel(netCash)} · ${returnedUnits} יח' הוחזרו למלאי הראשי`
    );
    hapticSuccess();
    setReconcileResult({ ok: true, agentName: agent.name, cash, commissionKept, netCash, returnedUnits });
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
  const assignOrderAgent = (agents || []).find((a) => a.id === assignOrderAgentId) || null;

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
              ? `משמרת של ${reconcileResult.agentName} נסגרה: ${shekel(reconcileResult.cash)} מזומן · עמלת סוכן ${shekel(reconcileResult.commissionKept || 0)} · נטו למנהל ${shekel(reconcileResult.netCash ?? reconcileResult.cash)} · ${reconcileResult.returnedUnits} יח' חזרו למלאי.`
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
                    testID={`agent-assign-order-${agent.id}`}
                    style={s.iconBtn}
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticLight();
                      setAssignOrderAgentId(agent.id);
                    }}
                  >
                    <Icon name="map-pin" size={16} color={BLUE} />
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

      <AssignOrderModal
        visible={!!assignOrderAgent}
        agent={assignOrderAgent}
        agentOrders={agentOrders}
        onClose={() => setAssignOrderAgentId(null)}
        onAssign={(agent, order) => {
          setAgentOrders((prev) => [
            ...(prev || []),
            { id: uid(), agentId: agent.id, ...order, status: "pending", createdAt: Date.now() },
          ]);
        }}
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
  const [goal, setGoal] = useState("");

  const close = () => {
    setName("");
    setCommissionType("pct");
    setValue("");
    setGoal("");
    onClose();
  };

  const valid = name.trim().length > 0 && parseFloat(value) >= 0;

  const submit = () => {
    if (!valid) {
      hapticWarning();
      return;
    }
    onCreate({
      name: name.trim(),
      commissionType,
      commissionValue: parseFloat(value) || 0,
      commissionGoal: parseFloat(goal) || 0,
    });
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

              <TextInput
                testID="agent-commission-goal"
                style={s.amountInput}
                value={goal}
                onChangeText={setGoal}
                keyboardType="decimal-pad"
                placeholder={`יעד עמלה יומי (₪, ברירת מחדל ${DEFAULT_COMMISSION_GOAL})`}
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
  const commissionKept = shiftCommissionOf(agent);
  const netCashOwed = Math.max(0, cashExpected - commissionKept);
  const payload = {
    type: HANDOVER_TYPE,
    agentId: agent.id,
    agentName: agent.name,
    ts: Date.now(),
    cashExpected,
    commissionKept,
    netCashOwed,
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

              {/* The math, in the open, before the QR — cash collected minus
                  what the agent keeps as commission is what actually changes
                  hands at handover. */}
              <View style={s.mathBox}>
                <View style={s.mathRow}>
                  <CustomText testID="shift-cash-received" style={s.mathValue}>{shekel(cashExpected)}</CustomText>
                  <CustomText style={s.mathLabel}>סה״כ מזומן שנגבה</CustomText>
                </View>
                <View style={s.mathRow}>
                  <CustomText testID="shift-commission-kept" style={[s.mathValue, { color: BLUE }]}>
                    − {shekel(commissionKept)}
                  </CustomText>
                  <CustomText style={s.mathLabel}>עמלת הסוכן (נשארת אצלו)</CustomText>
                </View>
                <View style={s.mathDivider} />
                <View style={s.mathRow}>
                  <CustomText testID="shift-net-owed" style={[s.mathValue, s.mathTotal, { color: GREEN_DARK }]}>
                    {shekel(netCashOwed)}
                  </CustomText>
                  <CustomText style={[s.mathLabel, s.mathTotalLabel]}>נטו למסירה למנהל</CustomText>
                </View>
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

// ---------------------------------------------------------------------------
// Assign a remote delivery task to an agent — Building/Floor/Room chips
// rather than a free-text address, and the modal stays open after each add
// so the Admin can hand over several stops from one sitting.

const QUICK_FLOORS = ["0", "1", "2", "3", "4", "5"];

function AssignOrderModal({ visible, agent, agentOrders, onClose, onAssign }) {
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);

  const knownBuildings = useMemo(() => {
    const set = new Set((agentOrders || []).map((o) => o.building).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "he", { numeric: true }));
  }, [agentOrders]);

  const close = () => {
    setBuilding("");
    setFloor("");
    setRoom("");
    setQueuedCount(0);
    onClose();
  };

  const valid = building.trim().length > 0;

  const addOne = () => {
    if (!valid || !agent) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    onAssign(agent, { building: building.trim(), floor: floor.trim(), room: room.trim() });
    setQueuedCount((n) => n + 1);
    setFloor("");
    setRoom("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.card}>
              <CustomText style={s.cardTitle}>משימת הפצה ל{agent?.name || ""}</CustomText>

              <CustomText style={s.fieldLabel}>בניין</CustomText>
              {knownBuildings.length > 0 && (
                <View style={s.chipRow}>
                  {knownBuildings.map((b) => (
                    <TouchableOpacity
                      key={b}
                      testID={`assign-building-${b}`}
                      style={[s.chip, building === b && s.chipOn]}
                      onPress={() => {
                        hapticLight();
                        setBuilding(b);
                      }}
                    >
                      <CustomText style={[s.chipText, building === b && s.chipTextOn]}>{b}</CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TextInput
                testID="assign-building-input"
                style={s.amountInput}
                value={building}
                onChangeText={setBuilding}
                placeholder="מספר/שם בניין"
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />

              <CustomText style={s.fieldLabel}>קומה</CustomText>
              <View style={s.chipRow}>
                {QUICK_FLOORS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    testID={`assign-floor-${f}`}
                    style={[s.chip, floor === f && s.chipOn]}
                    onPress={() => {
                      hapticLight();
                      setFloor(f);
                    }}
                  >
                    <CustomText style={[s.chipText, floor === f && s.chipTextOn]}>{f}</CustomText>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                testID="assign-floor-input"
                style={s.amountInput}
                value={floor}
                onChangeText={setFloor}
                keyboardType="number-pad"
                placeholder="קומה אחרת"
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />

              <CustomText style={s.fieldLabel}>חדר</CustomText>
              <TextInput
                testID="assign-room-input"
                style={s.amountInput}
                value={room}
                onChangeText={setRoom}
                keyboardType="number-pad"
                placeholder="מספר חדר"
                placeholderTextColor={INK_MUTED}
                textAlign="center"
              />

              <TouchableOpacity
                testID="assign-order-add"
                style={[s.actionBtnWide, { backgroundColor: BLUE }, !valid && { opacity: 0.35 }]}
                disabled={!valid}
                onPress={addOne}
                activeOpacity={0.8}
              >
                <CustomText style={s.actionBtnText}>
                  {queuedCount > 0 ? `הוסף עוד (${queuedCount} שויכו)` : "שייך משימה"}
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity testID="assign-order-done" style={s.secondaryBtn} onPress={close} activeOpacity={0.8}>
                <CustomText style={s.secondaryBtnText}>סיום</CustomText>
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
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: BLUE + "14",
    alignItems: "center",
    justifyContent: "center",
  },

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

  mathBox: { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 10, gap: 6 },
  mathRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mathLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT },
  mathValue: { fontFamily: FONTS.bold, fontSize: 15, color: INK },
  mathDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 2 },
  mathTotal: { fontSize: 20 },
  mathTotalLabel: { fontFamily: FONTS.bold, fontSize: 13, color: INK },

  chipRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: BLUE },
  chipText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },
  chipTextOn: { color: WHITE },
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
