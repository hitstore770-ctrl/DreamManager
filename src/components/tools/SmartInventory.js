import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  CATEGORIES,
  LOW_STOCK,
  applyDamage,
  applySale,
  catOf,
  isLocked,
  shekel,
  uid,
} from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const EMPTY = { name: "", category: "electronics", qty: "1", cost: "", price: "", barcode: "" };

export default function SmartInventory() {
  const [inventory, setInventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [sales, setSales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [lockedDays] = usePersistentState(STORAGE_KEYS.posLockedDays, []);
  const locked = isLocked(lockedDays);

  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState({});
  const [sellItem, setSellItem] = useState(null); // item pending custom-price sale
  const [sellPrice, setSellPrice] = useState("");

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const list = useMemo(
    () => inventory.filter((i) => filter === "all" || i.category === filter),
    [inventory, filter]
  );

  const addItem = () => {
    if (!form.name.trim()) {
      Alert.alert("שם חסר", "נא להזין שם פריט");
      return;
    }
    setInventory((prev) => [
      {
        id: uid(),
        name: form.name.trim(),
        category: form.category,
        qty: parseInt(form.qty, 10) || 0,
        cost: Number(form.cost) || 0,
        price: Number(form.price) || 0,
        barcode: form.barcode.trim(),
        sold: 0,
        damaged: 0,
      },
      ...prev,
    ]);
    setForm(EMPTY);
    setShowForm(false);
  };

  const changeQty = (id, delta) =>
    setInventory((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
    );

  const removeItem = (id) => setInventory((prev) => prev.filter((i) => i.id !== id));

  const confirmSell = () => {
    const price = Number(sellPrice);
    if (!price || price <= 0) {
      Alert.alert("מחיר לא תקין", "הזן מחיר מכירה");
      return;
    }
    const { inventory: inv, sale } = applySale(inventory, sellItem.id, 1, price);
    setInventory(inv);
    if (sale) setSales((prev) => [sale, ...prev]);
    setSellItem(null);
    setSellPrice("");
  };

  const markDamaged = (item) => {
    if (locked) {
      Alert.alert("היום נעול", "הופק דו״ח Z — לא ניתן לרשום תנועות חדשות היום");
      return;
    }
    const { inventory: inv, sale } = applyDamage(inventory, item.id, 1);
    setInventory(inv);
    if (sale) setSales((prev) => [sale, ...prev]);
  };

  const openSell = (item) => {
    if (locked) {
      Alert.alert("היום נעול", "הופק דו״ח Z — לא ניתן לרשום מכירות חדשות היום");
      return;
    }
    setSellItem(item);
    setSellPrice(String(item.price || ""));
  };

  const toggleSelect = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const batchDelta = (delta) => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    setInventory((prev) =>
      prev.map((i) => (ids.includes(i.id) ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
    );
  };
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <View>
      {locked && (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>🔒 היום נעול (דו״ח Z הופק) — מכירות חסומות</Text>
        </View>
      )}

      {/* Filters */}
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, filter === "all" && styles.chipActive]}
          onPress={() => setFilter("all")}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, filter === "all" && styles.chipTextLight]}>הכל</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, filter === c.key && { backgroundColor: c.color }]}
            onPress={() => setFilter(c.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, filter === c.key && styles.chipTextLight]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.topActions}>
        <TouchableOpacity
          style={[styles.topBtn, styles.topAdd]}
          onPress={() => {
            setForm(EMPTY);
            setShowForm((v) => !v);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.topBtnText}>{showForm ? "✕ סגור" : "＋ פריט חדש"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topBtn, batch ? styles.topBatchOn : styles.topBatch]}
          onPress={() => {
            setBatch((v) => !v);
            setSelected({});
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.topBtnText, !batch && { color: COLORS.textPrimary }]}>
            {batch ? "✓ סיום" : "☑ עדכון מרובה"}
          </Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="שם הפריט"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, { backgroundColor: form.category === c.key ? c.color : COLORS.white }]}
                onPress={() => setField("category", c.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, form.category === c.key && styles.chipTextLight]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row3}>
            <MiniField label="כמות" value={form.qty} onChange={(v) => setField("qty", v)} />
            <MiniField label="עלות ₪" value={form.cost} onChange={(v) => setField("cost", v)} />
            <MiniField label="מחיר ₪" value={form.price} onChange={(v) => setField("price", v)} />
          </View>
          <TextInput
            style={styles.input}
            value={form.barcode}
            onChangeText={(v) => setField("barcode", v)}
            placeholder="ברקוד (לא חובה)"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={addItem} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>💾 שמור פריט</Text>
          </TouchableOpacity>
        </View>
      )}

      {list.length === 0 ? (
        <Text style={styles.empty}>אין פריטים. הוסף פריט ראשון.</Text>
      ) : (
        list.map((item) => {
          const low = item.qty <= LOW_STOCK;
          const cat = catOf(item.category);
          return (
            <View key={item.id} style={[styles.card, low && styles.cardLow]}>
              <View style={styles.cardHead}>
                {batch && (
                  <TouchableOpacity
                    style={[styles.selBox, selected[item.id] && styles.selBoxOn]}
                    onPress={() => toggleSelect(item.id)}
                  >
                    <Text style={styles.selMark}>{selected[item.id] ? "✓" : ""}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.del} onPress={() => removeItem(item.id)}>
                  <Text style={styles.delText}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.name, low && { color: COLORS.danger }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.catTag, { backgroundColor: cat.color }]}>
                  <Text style={styles.catTagText}>{cat.label}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>מחיר {shekel(item.price)}</Text>
                {item.sold > 0 && <Text style={styles.metaText}>נמכרו {item.sold}</Text>}
                {item.damaged > 0 && <Text style={styles.metaLoss}>נזק {item.damaged}</Text>}
                {low && <Text style={styles.metaLow}>מלאי נמוך</Text>}
              </View>

              <View style={styles.qtyRow}>
                <TouchableOpacity style={[styles.qtyBtn, styles.minus]} onPress={() => changeQty(item.id, -1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.qty, low && { color: COLORS.danger }]}>{item.qty}</Text>
                <TouchableOpacity style={[styles.qtyBtn, styles.plus]} onPress={() => changeQty(item.id, 1)}>
                  <Text style={styles.qtyBtnText}>＋</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actRow}>
                <TouchableOpacity style={[styles.actBtn, styles.sell]} onPress={() => openSell(item)} activeOpacity={0.85}>
                  <Text style={styles.actText}>💵 מכירה במחיר מיוחד</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actBtn, styles.damage]} onPress={() => markDamaged(item)} activeOpacity={0.85}>
                  <Text style={styles.actText}>⚠️ נזק/אובדן</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {batch && (
        <View style={styles.batchBar}>
          <Text style={styles.batchInfo}>{selectedCount} נבחרו</Text>
          <TouchableOpacity style={[styles.batchBtn, styles.minus]} onPress={() => batchDelta(-1)}>
            <Text style={styles.batchBtnText}>−1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, styles.plus]} onPress={() => batchDelta(1)}>
            <Text style={styles.batchBtnText}>＋1</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom-price sale modal */}
      <Modal visible={!!sellItem} transparent animationType="fade" onRequestClose={() => setSellItem(null)}>
        <TouchableWithoutFeedback onPress={() => setSellItem(null)}>
        <View style={styles.modalWrap}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>מכירת "{sellItem?.name}"</Text>
            <Text style={styles.modalLabel}>מחיר מכירה בפועל</Text>
            <TextInput
              style={styles.input}
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="numeric"
              textAlign="center"
              placeholder="₪"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setSellItem(null)}>
                <Text style={[styles.modalBtnText, { color: COLORS.textPrimary }]}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={confirmSell}>
                <Text style={styles.modalBtnText}>מכור יחידה</Text>
              </TouchableOpacity>
            </View>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function MiniField({ label, value, onChange }) {
  return (
    <View style={styles.miniCol}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        textAlign="center"
        placeholder="0"
        placeholderTextColor={COLORS.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  lockBanner: { backgroundColor: COLORS.danger, borderRadius: RADIUS, padding: 10, marginBottom: 12, ...BRUTAL_BORDER },
  lockText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS, backgroundColor: COLORS.white, marginStart: 8, marginBottom: 8, ...BRUTAL_BORDER },
  chipActive: { backgroundColor: COLORS.navy },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  chipTextLight: { color: "#FFFFFF" },
  topActions: { flexDirection: "row", gap: 8, marginBottom: 10 },
  topBtn: { flex: 1, height: 46, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  topAdd: { backgroundColor: COLORS.success },
  topBatch: { backgroundColor: COLORS.white },
  topBatchOn: { backgroundColor: COLORS.mustard },
  topBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  form: { backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 12, marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  row3: { flexDirection: "row", gap: 8 },
  miniCol: { flex: 1 },
  miniLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 },
  saveBtn: { height: 50, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 18 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 10, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  cardLow: { backgroundColor: "#FBE3E3", borderColor: COLORS.danger, borderWidth: 3 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  selBox: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginEnd: 8, ...BRUTAL_BORDER },
  selBoxOn: { backgroundColor: COLORS.navy },
  selMark: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  del: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  delText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  name: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right", marginHorizontal: 10 },
  catTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, ...BRUTAL_BORDER },
  catTagText: { color: "#FFFFFF", fontSize: 11, fontFamily: FONTS.bold },
  metaRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 8, gap: 6 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONTS.bold },
  metaLoss: { color: COLORS.danger, fontSize: 12, fontFamily: FONTS.bold },
  metaLow: { color: "#FFFFFF", backgroundColor: COLORS.danger, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontFamily: FONTS.bold, overflow: "hidden" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 10 },
  qtyBtn: { width: 50, height: 42, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  minus: { backgroundColor: COLORS.danger },
  plus: { backgroundColor: COLORS.success },
  qtyBtnText: { color: "#FFFFFF", fontSize: 24, fontFamily: FONTS.bold },
  qty: { minWidth: 50, textAlign: "center", color: COLORS.textPrimary, fontSize: 24, fontFamily: FONTS.bold },
  actRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  actBtn: { flex: 1, height: 42, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  sell: { backgroundColor: COLORS.navy },
  damage: { backgroundColor: COLORS.mustard },
  actText: { color: "#FFFFFF", fontSize: 12, fontFamily: FONTS.bold },
  batchBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.navy, padding: 12, borderRadius: RADIUS, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  batchInfo: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  batchBtn: { paddingHorizontal: 18, height: 42, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  batchBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  modalWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(17,24,39,0.45)" },
  modalCard: { width: "100%", backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 18, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 12 },
  modalLabel: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 6 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  modalCancel: { backgroundColor: COLORS.white },
  modalOk: { backgroundColor: COLORS.success },
  modalBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
});
