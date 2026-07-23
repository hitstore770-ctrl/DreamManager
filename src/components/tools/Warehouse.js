import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { formatShekel } from "../../utils/format";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const CATEGORIES = [
  { key: "electronics", label: "אלקטרוניקה", color: "#1B3A6B" },
  { key: "food", label: "מזון", color: "#1E9E58" },
  { key: "office", label: "משרד", color: "#F4B400" },
  { key: "clothing", label: "ביגוד", color: "#B14FCB" },
  { key: "other", label: "אחר", color: "#8A8A8A" },
];

const BARCODE_TYPES = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"];
const SOON_DAYS = 14;

function catOf(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[4];
}

function daysUntil(expiry) {
  if (!expiry) return Infinity;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function margin(cost, price) {
  const c = Number(cost) || 0;
  const p = Number(price) || 0;
  if (c <= 0) return null;
  return Math.round(((p - c) / c) * 100);
}

const EMPTY_FORM = {
  name: "",
  category: "other",
  qty: "1",
  minQty: "1",
  cost: "",
  price: "",
  supplierName: "",
  supplierPhone: "",
  expiry: "",
  barcode: "",
};

export default function Warehouse() {
  const [items, setItems] = usePersistentState(STORAGE_KEYS.warehouse, []);
  const [permission, requestPermission] = useCameraPermissions();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanning, setScanning] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState({}); // id -> true

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ---- Derived / sorted list --------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((it) => {
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.barcode || "").toLowerCase().includes(q) ||
        catOf(it.category).label.includes(q)
      );
    });
    const rank = (it) => {
      const d = daysUntil(it.expiry);
      if (d <= SOON_DAYS) return 0; // expiring soon / expired → top
      if (it.qty <= it.minQty) return 1; // low stock next
      return 2;
    };
    return [...list].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return daysUntil(a.expiry) - daysUntil(b.expiry);
      return a.name.localeCompare(b.name, "he");
    });
  }, [items, search]);

  const totals = useMemo(() => {
    let stockValue = 0;
    let potential = 0;
    let lowCount = 0;
    items.forEach((it) => {
      stockValue += (Number(it.cost) || 0) * it.qty;
      potential += (Number(it.price) || 0) * it.qty;
      if (it.qty <= it.minQty) lowCount += 1;
    });
    return { stockValue, potential, profit: potential - stockValue, lowCount };
  }, [items]);

  // ---- CRUD --------------------------------------------------------------
  const saveItem = () => {
    if (!form.name.trim()) {
      Alert.alert("שם חסר", "נא להזין שם פריט");
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      name: form.name.trim(),
      category: form.category,
      qty: Math.max(0, parseInt(form.qty, 10) || 0),
      minQty: Math.max(0, parseInt(form.minQty, 10) || 0),
      cost: Number(form.cost) || 0,
      price: Number(form.price) || 0,
      supplierName: form.supplierName.trim(),
      supplierPhone: form.supplierPhone.trim(),
      expiry: form.expiry.trim(),
      barcode: form.barcode.trim(),
    };
    setItems((prev) => [newItem, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const changeQty = (id, delta) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(0, it.qty + delta) } : it))
    );

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelected((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  };

  // ---- Barcode scanning --------------------------------------------------
  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("אין הרשאה", "נדרשת הרשאת מצלמה כדי לסרוק ברקוד");
        return;
      }
    }
    setScanning(true);
  };

  const handleScan = ({ data }) => {
    setScanning(false);
    const existing = items.find((it) => it.barcode && it.barcode === data);
    if (existing) {
      changeQty(existing.id, 1);
      setSearch(existing.name);
      Alert.alert("נמצא במלאי", `${existing.name}\nהכמות עודכנה ל-${existing.qty + 1}`);
    } else {
      setForm({ ...EMPTY_FORM, barcode: data });
      setShowForm(true);
      Alert.alert("ברקוד חדש", "מלא את פרטי הפריט החדש");
    }
  };

  // ---- Batch update ------------------------------------------------------
  const toggleSelect = (id) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const batchDelta = (delta) => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    setItems((prev) =>
      prev.map((it) =>
        ids.includes(it.id) ? { ...it, qty: Math.max(0, it.qty + delta) } : it
      )
    );
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // ---- Supplier call & share --------------------------------------------
  const callSupplier = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert("שגיאה", "לא ניתן לחייג")
    );
  };

  const shareCatalog = () => {
    if (items.length === 0) {
      Alert.alert("אין מלאי", "אין פריטים לשיתוף");
      return;
    }
    const lines = items.map(
      (it) =>
        `• ${it.name} — ${it.qty} יח׳${
          it.price ? ` (${formatShekel(it.price)})` : ""
        }${it.qty <= it.minQty ? " ⚠️" : ""}`
    );
    const text = `📦 קטלוג מלאי — המחסן\n\n${lines.join("\n")}\n\nסה״כ ערך מלאי: ${formatShekel(
      totals.stockValue
    )}`;
    const wa = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(wa).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() =>
        Alert.alert("קטלוג", text)
      )
    );
  };

  // ---- Render ------------------------------------------------------------
  return (
    <View>
      {/* Dashboard */}
      <View style={styles.dashRow}>
        <View style={[styles.dashCell, { backgroundColor: COLORS.navy }]}>
          <Text style={styles.dashLabelLight}>ערך מלאי</Text>
          <Text style={styles.dashValueLight}>{formatShekel(totals.stockValue)}</Text>
        </View>
        <View style={[styles.dashCell, { backgroundColor: COLORS.success }]}>
          <Text style={styles.dashLabelLight}>רווח פוטנציאלי</Text>
          <Text style={styles.dashValueLight}>{formatShekel(totals.profit)}</Text>
        </View>
      </View>
      {totals.lowCount > 0 && (
        <View style={styles.lowBanner}>
          <Text style={styles.lowBannerText}>⚠️ {totals.lowCount} פריטים במלאי נמוך</Text>
        </View>
      )}

      {/* Search + actions */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 חיפוש מהיר..."
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
        <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.85}>
          <Text style={styles.scanBtnText}>📷</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topActions}>
        <TouchableOpacity
          style={[styles.topAction, styles.topAdd]}
          onPress={() => {
            setForm(EMPTY_FORM);
            setShowForm((v) => !v);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.topActionText}>{showForm ? "✕ סגור" : "＋ פריט חדש"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topAction, batchMode ? styles.topBatchOn : styles.topBatch]}
          onPress={() => {
            setBatchMode((v) => !v);
            setSelected({});
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.topActionText}>
            {batchMode ? "✓ סיום עדכון" : "☑ עדכון מרובה"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topAction, styles.topShare]}
          onPress={shareCatalog}
          activeOpacity={0.85}
        >
          <Text style={styles.topActionText}>↗ קטלוג</Text>
        </TouchableOpacity>
      </View>

      {/* Add form */}
      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="שם הפריט"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
          <Text style={styles.label}>קטגוריה</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.chip,
                  { backgroundColor: form.category === c.key ? c.color : COLORS.white },
                ]}
                onPress={() => setField("category", c.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.category === c.key && { color: "#FFFFFF" },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>כמות</Text>
              <TextInput
                style={styles.input}
                value={form.qty}
                onChangeText={(v) => setField("qty", v)}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>מינימום (התראה)</Text>
              <TextInput
                style={styles.input}
                value={form.minQty}
                onChangeText={(v) => setField("minQty", v)}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>מחיר עלות ₪</Text>
              <TextInput
                style={styles.input}
                value={form.cost}
                onChangeText={(v) => setField("cost", v)}
                keyboardType="numeric"
                textAlign="center"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>מחיר מכירה ₪</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(v) => setField("price", v)}
                keyboardType="numeric"
                textAlign="center"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
          {margin(form.cost, form.price) != null && (
            <View style={styles.marginPreview}>
              <Text style={styles.marginPreviewText}>
                רווחיות (ROI): {margin(form.cost, form.price)}%
              </Text>
            </View>
          )}

          <Text style={styles.label}>ספק</Text>
          <TextInput
            style={styles.input}
            value={form.supplierName}
            onChangeText={(v) => setField("supplierName", v)}
            placeholder="שם הספק"
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
          <TextInput
            style={styles.input}
            value={form.supplierPhone}
            onChangeText={(v) => setField("supplierPhone", v)}
            placeholder="טלפון ספק"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            textAlign="right"
          />

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>תפוגה (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={form.expiry}
                onChangeText={(v) => setField("expiry", v)}
                placeholder="2026-12-31"
                placeholderTextColor={COLORS.textMuted}
                textAlign="center"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>ברקוד</Text>
              <TextInput
                style={styles.input}
                value={form.barcode}
                onChangeText={(v) => setField("barcode", v)}
                placeholder="—"
                placeholderTextColor={COLORS.textMuted}
                textAlign="center"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveItem} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>💾 שמור פריט</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Item list */}
      {filtered.length === 0 ? (
        <Text style={styles.empty}>
          {items.length === 0 ? "המחסן ריק. הוסף פריט ראשון." : "אין תוצאות לחיפוש"}
        </Text>
      ) : (
        filtered.map((it) => {
          const cat = catOf(it.category);
          const low = it.qty <= it.minQty;
          const roi = margin(it.cost, it.price);
          const days = daysUntil(it.expiry);
          const soon = days <= SOON_DAYS;
          const isSelected = !!selected[it.id];
          return (
            <View key={it.id} style={[styles.itemCard, low && styles.itemCardLow]}>
              <View style={styles.itemTop}>
                {batchMode && (
                  <TouchableOpacity
                    style={[styles.selectBox, isSelected && styles.selectBoxOn]}
                    onPress={() => toggleSelect(it.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.selectMark}>{isSelected ? "✓" : ""}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.itemDelete}
                  onPress={() => removeItem(it.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.itemDeleteText}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.itemName, low && styles.itemNameLow]} numberOfLines={1}>
                  {it.name}
                </Text>
                <View style={[styles.catTag, { backgroundColor: cat.color }]}>
                  <Text style={styles.catTagText}>{cat.label}</Text>
                </View>
              </View>

              <View style={styles.itemMetaRow}>
                {roi != null && (
                  <Text style={[styles.metaBadge, styles.metaRoi]}>ROI {roi}%</Text>
                )}
                {it.price > 0 && (
                  <Text style={styles.metaBadge}>מכירה {formatShekel(it.price)}</Text>
                )}
                {soon && (
                  <Text style={[styles.metaBadge, styles.metaExpiry]}>
                    {days < 0 ? "פג תוקף!" : `תפוגה בעוד ${days} ימים`}
                  </Text>
                )}
                {low && <Text style={[styles.metaBadge, styles.metaLow]}>מלאי נמוך</Text>}
              </View>

              {it.supplierName ? (
                <View style={styles.supplierRow}>
                  <Text style={styles.supplierText}>🏭 {it.supplierName}</Text>
                  {it.supplierPhone ? (
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callSupplier(it.supplierPhone)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.callBtnText}>📞 חייג</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, styles.qtyMinus]}
                  onPress={() => changeQty(it.id, -1)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyValue, low && styles.qtyValueLow]}>{it.qty}</Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, styles.qtyPlus]}
                  onPress={() => changeQty(it.id, 1)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.qtyBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Batch action bar */}
      {batchMode && (
        <View style={styles.batchBar}>
          <Text style={styles.batchInfo}>{selectedCount} נבחרו</Text>
          <TouchableOpacity
            style={[styles.batchBtn, styles.qtyMinus]}
            onPress={() => batchDelta(-1)}
            activeOpacity={0.85}
          >
            <Text style={styles.batchBtnText}>−1 לכולם</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.batchBtn, styles.qtyPlus]}
            onPress={() => batchDelta(1)}
            activeOpacity={0.85}
          >
            <Text style={styles.batchBtnText}>＋1 לכולם</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barcode scanner modal */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scannerWrap}>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <View style={styles.camDenied}>
              <Text style={styles.camDeniedText}>נדרשת הרשאת מצלמה</Text>
            </View>
          )}
          <Text style={styles.scannerHint}>כוונו את המצלמה אל הברקוד</Text>
          <TouchableOpacity
            style={styles.scannerClose}
            onPress={() => setScanning(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.scannerCloseText}>סגור</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dashRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dashCell: {
    flex: 1,
    padding: 14,
    borderRadius: RADIUS,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  dashLabelLight: { color: "#FFFFFF", fontSize: 12, fontFamily: FONTS.medium },
  dashValueLight: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold, marginTop: 4 },
  lowBanner: {
    backgroundColor: COLORS.mustard,
    padding: 10,
    borderRadius: RADIUS,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  lowBannerText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  searchInput: { flex: 1, marginBottom: 0 },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  scanBtnText: { fontSize: 22 },
  topActions: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 6 },
  topAction: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  topAdd: { backgroundColor: COLORS.success },
  topBatch: { backgroundColor: COLORS.white },
  topBatchOn: { backgroundColor: COLORS.mustard },
  topShare: { backgroundColor: COLORS.navy },
  topActionText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  formCard: {
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.background,
    marginTop: 8,
    marginBottom: 14,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 6,
    textAlign: "right",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS,
    marginStart: 8,
    marginBottom: 8,
    ...BRUTAL_BORDER,
  },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  marginPreview: {
    backgroundColor: COLORS.success,
    padding: 8,
    borderRadius: RADIUS,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  marginPreviewText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold, textAlign: "center" },
  saveBtn: {
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 18,
  },
  itemCard: {
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 10,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  itemCardLow: { backgroundColor: "#FBE3E3", borderColor: COLORS.danger },
  itemTop: { flexDirection: "row", alignItems: "center" },
  selectBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 8,
    ...BRUTAL_BORDER,
  },
  selectBoxOn: { backgroundColor: COLORS.navy },
  selectMark: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  itemDelete: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  itemDeleteText: { color: COLORS.textPrimary, fontSize: 12, fontFamily: FONTS.bold },
  itemName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginHorizontal: 10,
  },
  itemNameLow: { color: COLORS.danger },
  catTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, ...BRUTAL_BORDER },
  catTagText: { color: "#FFFFFF", fontSize: 11, fontFamily: FONTS.bold },
  itemMetaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  metaBadge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONTS.bold,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginStart: 6,
    marginBottom: 6,
    ...BRUTAL_BORDER,
  },
  metaRoi: { backgroundColor: COLORS.success, color: "#FFFFFF" },
  metaExpiry: { backgroundColor: COLORS.mustard, color: COLORS.textPrimary },
  metaLow: { backgroundColor: COLORS.danger, color: "#FFFFFF" },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  supplierText: { color: COLORS.textSecondary, fontSize: 13, fontFamily: FONTS.medium, textAlign: "right" },
  callBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...BRUTAL_BORDER,
  },
  callBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: FONTS.bold },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 18,
  },
  qtyBtn: {
    width: 52,
    height: 44,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  qtyMinus: { backgroundColor: COLORS.danger },
  qtyPlus: { backgroundColor: COLORS.success },
  qtyBtnText: { color: "#FFFFFF", fontSize: 26, fontFamily: FONTS.bold },
  qtyValue: {
    minWidth: 56,
    textAlign: "center",
    color: COLORS.textPrimary,
    fontSize: 26,
    fontFamily: FONTS.bold,
  },
  qtyValueLow: { color: COLORS.danger },
  batchBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.navy,
    padding: 12,
    borderRadius: RADIUS,
    marginTop: 6,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  batchInfo: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  batchBtn: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  batchBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  scannerWrap: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  camera: { width: "100%", height: "70%" },
  camDenied: { width: "100%", height: "70%", alignItems: "center", justifyContent: "center" },
  camDeniedText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  scannerHint: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.medium, marginTop: 20 },
  scannerClose: {
    marginTop: 20,
    backgroundColor: COLORS.mustard,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
  },
  scannerCloseText: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold },
});
