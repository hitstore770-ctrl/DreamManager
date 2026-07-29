import { useMemo, useState } from "react";
import { Share, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../Icon";
import CustomText from "../CustomText";
import { useBusiness } from "../../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { LOW_STOCK, todayKey, uid } from "../../utils/posStore";
import { usePersistentState } from "../../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { BLUE, CARD, GREEN, INK, INK_MUTED, INK_SOFT, RED, WHITE, s as kit } from "../tools/kit";
import { Empty } from "./ops";

// Automations and logistics.
//
// A word on what "automation" means here, because it is easy to oversell:
// none of this runs while the app is closed. There is no server, no push
// scheduler and no background task — so these are *rules evaluated when you
// look*, not alarms that chase you. That is a real limitation and the UI says
// so rather than implying a watchdog that does not exist.

const AMBER = "#D97706";

// ---------------------------------------------------------------------------
// Shipment tracking — what is on the water.

const STATUSES = [
  { key: "ordered", label: "הוזמן", color: INK_MUTED },
  { key: "shipped", label: "נשלח", color: BLUE },
  { key: "customs", label: "במכס", color: AMBER },
  { key: "arrived", label: "הגיע", color: GREEN },
];

const statusOf = (key) => STATUSES.find((x) => x.key === key) || STATUSES[0];

export function ShipmentTracker() {
  const [shipments, setShipments] = usePersistentState("@dreammanager/pos-shipments", []);
  const [name, setName] = useState("");
  const [etaDays, setEtaDays] = useState("");

  const list = shipments || [];
  const open = list.filter((sh) => sh.status !== "arrived");

  const add = () => {
    const label = name.trim();
    const eta = parseInt(etaDays, 10);
    if (!label || !Number.isFinite(eta) || eta <= 0) return;
    hapticLight();
    setShipments((prev) => [
      ...(prev || []),
      { id: uid(), label, orderedAt: Date.now(), etaDays: eta, status: "ordered" },
    ]);
    setName("");
    setEtaDays("");
  };

  const advance = (id) => {
    hapticLight();
    setShipments((prev) =>
      prev.map((sh) => {
        if (sh.id !== id) return sh;
        const i = STATUSES.findIndex((x) => x.key === sh.status);
        return { ...sh, status: STATUSES[Math.min(i + 1, STATUSES.length - 1)].key };
      })
    );
  };

  return (
    <View style={st.wrap}>
      <View style={kit.row}>
        <View style={{ flex: 2 }}>
          <CustomText style={kit.fieldLabel}>מה הוזמן</CustomText>
          <View style={kit.fieldRow}>
            <TextInput
              testID="ship-name"
              style={[kit.fieldInput, { fontSize: 14, textAlign: "right" }]}
              value={name}
              onChangeText={setName}
              placeholder="למשל: 50 כבלי USB-C"
              placeholderTextColor={INK_MUTED}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <CustomText style={kit.fieldLabel}>ימים לאספקה</CustomText>
          <View style={kit.fieldRow}>
            <TextInput
              testID="ship-eta"
              style={kit.fieldInput}
              value={etaDays}
              onChangeText={setEtaDays}
              keyboardType="number-pad"
              placeholder="21"
              placeholderTextColor={INK_MUTED}
              textAlign="center"
            />
          </View>
        </View>
      </View>

      <TouchableOpacity testID="ship-add" style={[kit.actionBtn, { backgroundColor: BLUE }]} onPress={add}>
        <CustomText style={kit.actionText}>הוסף משלוח למעקב</CustomText>
      </TouchableOpacity>

      {open.length === 0 ? (
        <Empty icon="navigation" title="אין משלוחים בדרך" sub="הוסף הזמנה כדי לעקוב אחרי הסטטוס והאיחור שלה." />
      ) : (
        open.map((sh) => {
          const elapsed = Math.floor((Date.now() - sh.orderedAt) / 86400000);
          const left = sh.etaDays - elapsed;
          const late = left < 0;
          const status = statusOf(sh.status);
          return (
            <View key={sh.id} style={[st.card, late && { borderColor: RED }]}>
              <View style={st.cardHead}>
                <View style={[st.pill, { backgroundColor: status.color + "18" }]}>
                  <CustomText style={[st.pillText, { color: status.color }]}>{status.label}</CustomText>
                </View>
                <CustomText style={st.cardTitle}>{sh.label}</CustomText>
              </View>
              <CustomText style={[st.cardSub, late && { color: RED }]}>
                {late ? `מאחר ב-${Math.abs(left)} ימים` : `עוד ${left} ימים · הוזמן לפני ${elapsed} ימים`}
              </CustomText>
              <View style={kit.row}>
                <TouchableOpacity style={[st.smallBtn, { backgroundColor: BLUE }]} onPress={() => advance(sh.id)}>
                  <CustomText style={st.smallBtnText}>קדם סטטוס</CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.smallBtn, { backgroundColor: CARD }]}
                  onPress={() => {
                    hapticWarning();
                    setShipments((prev) => prev.filter((x) => x.id !== sh.id));
                  }}
                >
                  <CustomText style={[st.smallBtnText, { color: INK_SOFT }]}>הסר</CustomText>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {list.some((sh) => sh.status === "arrived") && (
        <TouchableOpacity
          style={[kit.actionBtn, { backgroundColor: CARD }]}
          onPress={() => {
            hapticLight();
            setShipments((prev) => prev.filter((sh) => sh.status !== "arrived"));
          }}
        >
          <CustomText style={[kit.actionText, { color: INK_SOFT }]}>נקה משלוחים שהגיעו</CustomText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Low-stock rules → a restock order that builds itself.

export function LowStockRules() {
  const { inventory } = useBusiness();
  const [thresholds, setThresholds] = usePersistentState("@dreammanager/pos-stock-thresholds", {});
  const [globalMin, setGlobalMin] = usePersistentState("@dreammanager/pos-stock-global-min", LOW_STOCK);

  const items = inventory || [];
  const minFor = (item) => {
    const custom = thresholds?.[item.id];
    return Number.isFinite(custom) ? custom : Number(globalMin) || LOW_STOCK;
  };

  const flagged = useMemo(
    () => items.filter((i) => i.qty <= minFor(i)).sort((a, b) => a.qty - b.qty),
    [items, thresholds, globalMin]
  );

  // Order enough to reach twice the threshold, so a restock is not immediately
  // low again the next morning.
  const orderList = flagged.map((i) => ({ name: i.name, need: Math.max(1, minFor(i) * 2 - i.qty) }));
  const orderText = orderList.length
    ? `הזמנת חידוש · ${todayKey()}\n${orderList.map((o) => `• ${o.name} × ${o.need}`).join("\n")}`
    : "";

  return (
    <View style={st.wrap}>
      <View style={[st.notice, { backgroundColor: AMBER + "12" }]}>
        <CustomText style={[kit.bannerText, { color: AMBER }]}>הכללים נבדקים כשנכנסים למסך</CustomText>
        <CustomText style={[kit.bannerSub, { color: INK_SOFT }]}>
          אין כאן שרת שרץ ברקע ואין התראות דחיפה — זו רשימה שמחושבת עכשיו מהמלאי בפועל, לא שומר שרודף אחריך.
        </CustomText>
      </View>

      <CustomText style={kit.fieldLabel}>סף ברירת מחדל לכל פריט</CustomText>
      <View style={kit.fieldRow}>
        <TextInput
          testID="rules-global"
          style={kit.fieldInput}
          value={String(globalMin)}
          onChangeText={(v) => setGlobalMin(parseInt(v, 10) || 0)}
          keyboardType="number-pad"
          textAlign="center"
        />
      </View>

      {!items.length ? (
        <Empty icon="package" title="אין פריטים במלאי" sub="הכללים פועלים על פריטי המחסן." />
      ) : flagged.length === 0 ? (
        <View style={[st.notice, { backgroundColor: GREEN + "12" }]}>
          <CustomText style={[kit.bannerText, { color: GREEN }]}>שום פריט לא מתחת לסף</CustomText>
          <CustomText style={[kit.bannerSub, { color: INK_SOFT }]}>{items.length} פריטים נבדקו.</CustomText>
        </View>
      ) : (
        <>
          <CustomText style={kit.sectionLabel}>מתחת לסף ({flagged.length})</CustomText>
          {flagged.map((i) => (
            <View key={i.id} testID={`rule-row-${i.id}`} style={st.ruleRow}>
              <View style={st.ruleQty}>
                <CustomText style={[st.ruleQtyText, { color: i.qty === 0 ? RED : AMBER }]}>{i.qty}</CustomText>
              </View>
              <View style={{ flex: 1 }}>
                <CustomText style={st.cardTitle}>{i.name}</CustomText>
                <CustomText style={st.cardSub}>סף {minFor(i)} · להזמין {Math.max(1, minFor(i) * 2 - i.qty)}</CustomText>
              </View>
              <View style={st.stepRow}>
                <TouchableOpacity
                  style={st.step}
                  onPress={() => {
                    hapticLight();
                    setThresholds((p) => ({ ...p, [i.id]: Math.max(0, minFor(i) - 1) }));
                  }}
                >
                  <Icon name="minus" size={15} color={INK_SOFT} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.step}
                  onPress={() => {
                    hapticLight();
                    setThresholds((p) => ({ ...p, [i.id]: minFor(i) + 1 }));
                  }}
                >
                  <Icon name="plus" size={15} color={INK_SOFT} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            testID="rules-share"
            style={[kit.actionBtn, { backgroundColor: BLUE }]}
            onPress={() => {
              hapticSuccess();
              Share.share({ message: orderText }).catch(() => {});
            }}
          >
            <CustomText style={kit.actionText}>שלח רשימת הזמנה לספק</CustomText>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Opening / closing routine — a checklist that resets itself each day.
//
// The reset is keyed on the stored date rather than a timer: a checklist that
// clears "24 hours after you ticked it" drifts a little every day until it is
// resetting mid-shift.

const OPEN_STEPS = ["ספירת קופה פותחת", "בדיקת מלאי חטיפים ושתייה", "הדלקת מקרר וויטרינה", "ניקיון משטח עבודה"];
const CLOSE_STEPS = ["ספירת קופה סוגרת", "דוח Z ליום", "פינוי אשפה", "כיבוי ציוד", "רישום הקפות פתוחות"];

export function ShiftRoutine() {
  const [state, setState] = usePersistentState("@dreammanager/pos-shift-routine", { day: null, open: {}, close: {} });

  const today = todayKey();
  const fresh = state?.day === today ? state : { day: today, open: {}, close: {} };

  const toggle = (phase, i) => {
    hapticLight();
    setState({ ...fresh, [phase]: { ...fresh[phase], [i]: !fresh[phase][i] } });
  };

  const section = (title, steps, phase) => {
    const done = steps.filter((_, i) => fresh[phase][i]).length;
    return (
      <View style={st.card}>
        <View style={st.cardHead}>
          <View style={[st.pill, { backgroundColor: done === steps.length ? GREEN + "18" : CARD }]}>
            <CustomText style={[st.pillText, { color: done === steps.length ? GREEN : INK_SOFT }]}>
              {done}/{steps.length}
            </CustomText>
          </View>
          <CustomText style={st.cardTitle}>{title}</CustomText>
        </View>
        {steps.map((step, i) => (
          <TouchableOpacity
            key={step}
            testID={`routine-${phase}-${i}`}
            style={kit.checkRow}
            onPress={() => toggle(phase, i)}
          >
            <View style={[kit.checkbox, fresh[phase][i] && { backgroundColor: GREEN, borderColor: GREEN }]}>
              {fresh[phase][i] && <CustomText style={kit.checkMark}>✓</CustomText>}
            </View>
            <CustomText style={[kit.checkLabel, fresh[phase][i] && { color: INK_MUTED, textDecorationLine: "line-through" }]}>
              {step}
            </CustomText>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={st.wrap}>
      <CustomText style={kit.hint}>הרשימה מתאפסת לבד כשמשתנה התאריך — {today}.</CustomText>
      {section("פתיחת יום", OPEN_STEPS, "open")}
      {section("סגירת יום", CLOSE_STEPS, "close")}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 12 },

  card: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 14.5, color: INK, textAlign: "right" },
  cardSub: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "right" },
  tplBody: { fontFamily: FONTS.regular, fontSize: 13, color: INK_SOFT, textAlign: "right", lineHeight: 21 },

  pill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontFamily: FONTS.bold, fontSize: 11 },

  smallBtn: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: WHITE },

  notice: { borderRadius: 14, padding: 12 },

  ruleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 13,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  ruleQty: { width: 38, height: 38, borderRadius: 12, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
  ruleQtyText: { fontFamily: FONTS.bold, fontSize: 15 },
  stepRow: { flexDirection: "row-reverse", gap: 6 },
  step: { width: 32, height: 32, borderRadius: 10, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
});
