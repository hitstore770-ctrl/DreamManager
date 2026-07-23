import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { CATEGORIES, applySale, isLocked, shekel, uid } from "../../utils/posStore";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const BARCODE_TYPES = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"];

export default function BarcodeCart() {
  const [permission, requestPermission] = useCameraPermissions();
  const [inventory, setInventory] = usePersistentState(STORAGE_KEYS.posInventory, []);
  const [sales, setSales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [lockedDays] = usePersistentState(STORAGE_KEYS.posLockedDays, []);
  const locked = isLocked(lockedDays);

  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState([]);
  const [assign, setAssign] = useState(null); // {barcode, name, price, qty, category}
  const [flash, setFlash] = useState("");
  const cooldown = useRef({ code: "", at: 0 });

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("אין הרשאה", "נדרשת הרשאת מצלמה כדי לסרוק");
        return;
      }
    }
    setScanning(true);
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const onScan = ({ data }) => {
    const now = Date.now();
    if (assign) return;
    if (cooldown.current.code === data && now - cooldown.current.at < 2000) return;
    cooldown.current = { code: data, at: now };

    const item = inventory.find((i) => i.barcode && i.barcode === data);
    if (item) {
      Vibration.vibrate(60); // haptic feedback on successful scan
      addToCart(item);
      setFlash(`✓ ${item.name}`);
      setTimeout(() => setFlash(""), 1200);
    } else {
      Vibration.vibrate([0, 40, 40, 40]);
      setScanning(false);
      setAssign({ barcode: data, name: "", price: "", qty: "1", category: "electronics" });
    }
  };

  const saveAssigned = () => {
    if (!assign.name.trim()) {
      Alert.alert("שם חסר", "נא להזין שם פריט");
      return;
    }
    const item = {
      id: uid(),
      name: assign.name.trim(),
      category: assign.category,
      qty: parseInt(assign.qty, 10) || 0,
      cost: 0,
      price: Number(assign.price) || 0,
      barcode: assign.barcode,
      sold: 0,
      damaged: 0,
    };
    setInventory((prev) => [item, ...prev]);
    addToCart(item);
    setAssign(null);
    setScanning(true);
  };

  const removeLine = (id) => setCart((prev) => prev.filter((l) => l.id !== id));
  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const checkout = () => {
    if (locked) {
      Alert.alert("היום נעול", "הופק דו״ח Z — לא ניתן לבצע מכירות היום");
      return;
    }
    if (cart.length === 0) return;
    let inv = inventory;
    const newSales = [];
    cart.forEach((line) => {
      const res = applySale(inv, line.id, line.qty, line.price);
      inv = res.inventory;
      if (res.sale) newSales.push(res.sale);
    });
    setInventory(inv);
    setSales((prev) => [...newSales, ...prev]);
    Alert.alert("מכירה הושלמה", `סה״כ ${shekel(total)}`);
    setCart([]);
  };

  // ---- Assign unknown barcode form ----
  if (assign) {
    return (
      <View>
        <View style={styles.assignBanner}>
          <Text style={styles.assignBannerText}>ברקוד חדש: {assign.barcode}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={assign.name}
          onChangeText={(v) => setAssign((a) => ({ ...a, name: v }))}
          placeholder="שם הפריט"
          placeholderTextColor={COLORS.textMuted}
          textAlign="right"
        />
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, { backgroundColor: assign.category === c.key ? c.color : COLORS.white }]}
              onPress={() => setAssign((a) => ({ ...a, category: c.key }))}
            >
              <Text style={[styles.chipText, assign.category === c.key && { color: "#FFFFFF" }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.miniLabel}>כמות</Text>
            <TextInput style={styles.input} value={assign.qty} onChangeText={(v) => setAssign((a) => ({ ...a, qty: v }))} keyboardType="numeric" textAlign="center" />
          </View>
          <View style={styles.col}>
            <Text style={styles.miniLabel}>מחיר ₪</Text>
            <TextInput style={styles.input} value={assign.price} onChangeText={(v) => setAssign((a) => ({ ...a, price: v }))} keyboardType="numeric" textAlign="center" placeholder="0" placeholderTextColor={COLORS.textMuted} />
          </View>
        </View>
        <View style={styles.assignActions}>
          <TouchableOpacity style={[styles.assignBtn, styles.assignCancel]} onPress={() => { setAssign(null); setScanning(true); }}>
            <Text style={[styles.assignBtnText, { color: COLORS.textPrimary }]}>ביטול</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.assignBtn, styles.assignSave]} onPress={saveAssigned}>
            <Text style={styles.assignBtnText}>שמור והוסף לעגלה</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      {locked && (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>🔒 היום נעול (דו״ח Z הופק)</Text>
        </View>
      )}

      {scanning ? (
        <View style={styles.cameraWrap}>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={onScan}
            />
          ) : (
            <View style={styles.camDenied}><Text style={styles.camDeniedText}>נדרשת הרשאת מצלמה</Text></View>
          )}
          {flash ? <Text style={styles.flash}>{flash}</Text> : <Text style={styles.scanHint}>כוונו את המצלמה אל הברקוד</Text>}
          <TouchableOpacity style={styles.stopBtn} onPress={() => setScanning(false)} activeOpacity={0.85}>
            <Text style={styles.stopText}>⏹ עצור סריקה</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startBtn} onPress={startScan} activeOpacity={0.9}>
          <Text style={styles.startText}>📷 התחל סריקה לעגלה</Text>
        </TouchableOpacity>
      )}

      {/* Cart */}
      {cart.length > 0 ? (
        <View style={styles.cart}>
          {cart.map((l) => (
            <View key={l.id} style={styles.cartRow}>
              <TouchableOpacity style={styles.del} onPress={() => removeLine(l.id)}>
                <Text style={styles.delText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.cartTotal}>{shekel(l.price * l.qty)}</Text>
              <Text style={styles.cartName}>{l.name} × {l.qty}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{shekel(total)}</Text>
            <Text style={styles.totalLabel}>סה״כ</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={checkout} activeOpacity={0.9}>
            <Text style={styles.checkoutText}>סיים מכירה · {shekel(total)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.empty}>העגלה ריקה — סרקו פריט כדי להוסיף</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lockBanner: { backgroundColor: COLORS.danger, borderRadius: RADIUS, padding: 10, marginBottom: 12, ...BRUTAL_BORDER },
  lockText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  cameraWrap: { alignItems: "center", marginBottom: 14 },
  camera: { width: "100%", height: 260, borderRadius: RADIUS, overflow: "hidden", backgroundColor: "#000", ...BRUTAL_BORDER },
  camDenied: { width: "100%", height: 260, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", backgroundColor: "#000", ...BRUTAL_BORDER },
  camDeniedText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  flash: { color: COLORS.success, fontSize: 18, fontFamily: FONTS.bold, marginTop: 12 },
  scanHint: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.regular, marginTop: 12 },
  stopBtn: { marginTop: 12, backgroundColor: COLORS.danger, borderRadius: RADIUS, paddingHorizontal: 24, paddingVertical: 12, ...BRUTAL_BORDER },
  stopText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  startBtn: { height: 64, borderRadius: RADIUS, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", marginBottom: 14, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  startText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  empty: { color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 12 },
  cart: { backgroundColor: COLORS.background, borderRadius: RADIUS, padding: 12, ...BRUTAL_BORDER },
  cartRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  del: { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  delText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  cartTotal: { color: COLORS.success, fontSize: 15, fontFamily: FONTS.bold, marginHorizontal: 10 },
  cartName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 2, borderColor: COLORS.border, marginTop: 8, paddingTop: 10 },
  totalValue: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold },
  checkoutBtn: { height: 60, borderRadius: RADIUS, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center", marginTop: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW },
  checkoutText: { color: "#FFFFFF", fontSize: 18, fontFamily: FONTS.bold },
  assignBanner: { backgroundColor: COLORS.mustard, borderRadius: RADIUS, padding: 12, marginBottom: 12, ...BRUTAL_BORDER },
  assignBannerText: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "center" },
  input: { backgroundColor: COLORS.white, borderRadius: RADIUS, paddingHorizontal: 14, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.regular, marginBottom: 12, ...BRUTAL_BORDER },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS, marginStart: 8, marginBottom: 8, ...BRUTAL_BORDER },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  row2: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  miniLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 },
  assignActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  assignBtn: { flex: 1, height: 52, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  assignCancel: { backgroundColor: COLORS.white },
  assignSave: { backgroundColor: COLORS.success },
  assignBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
});
