import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { withTimeout } from "../../utils/network";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const OCR_URL = "https://api.ocr.space/parse/image";
// Israeli phone numbers (mobile & landline), with optional +972 / dashes.
const PHONE_RE = /(?:\+972[-\s]?|0)(?:5\d|[2-489])[-\s]?\d{3}[-\s]?\d{4}/g;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function ocrImage(base64) {
  const body = new FormData();
  body.append("base64Image", `data:image/jpeg;base64,${base64}`);
  body.append("apikey", "helloworld"); // ocr.space public demo key
  body.append("language", "eng");
  body.append("OCREngine", "2");
  const response = await withTimeout(fetch(OCR_URL, { method: "POST", body }), 20000);
  const json = await response.json();
  return json?.ParsedResults?.[0]?.ParsedText?.trim() || "";
}

export default function OCRTool() {
  const [pages, setPages] = useState([]); // [{id, uri, text}]
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [bw, setBw] = useState(false);
  const [sticker, setSticker] = useState(false);

  const combined = useMemo(() => pages.map((p) => p.text).filter(Boolean).join("\n———\n"), [pages]);
  const phones = useMemo(() => {
    const found = combined.match(PHONE_RE) || [];
    return [...new Set(found.map((p) => p.replace(/[-\s]/g, "")))];
  }, [combined]);

  const addPage = async (fromCamera) => {
    try {
      let permission;
      if (fromCamera) {
        permission = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!permission.granted) {
        Alert.alert("אין הרשאה", fromCamera ? "נדרשת הרשאת מצלמה" : "נדרשת הרשאת גלריה");
        return;
      }
      const opts = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.6,
        allowsEditing: true,
        aspect: [148, 210], // A5 proportions to frame documents
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled) return;
      const asset = result.assets[0];
      const pageId = uid();
      setPages((prev) => [...prev, { id: pageId, uri: asset.uri, text: "" }]);
      setStatus("loading");
      try {
        const text = await ocrImage(asset.base64);
        setPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, text: text || "לא זוהה טקסט" } : p))
        );
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const removePage = (id) => setPages((prev) => prev.filter((p) => p.id !== id));
  const editPage = (id, text) => setPages((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));

  const copyAll = async () => {
    if (!combined) return;
    await Clipboard.setStringAsync(combined);
    Alert.alert("הועתק ✓", "כל הטקסט הועתק");
  };

  const translate = () => {
    if (!combined) return;
    const url = `https://translate.google.com/?sl=auto&tl=iw&text=${encodeURIComponent(combined)}&op=translate`;
    Linking.openURL(url).catch(() => Alert.alert("שגיאה", "לא ניתן לפתוח תרגום"));
  };

  const callPhone = (phone) =>
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("שגיאה", "לא ניתן לחייג"));
  const waPhone = (phone) => {
    const intl = phone.replace(/^0/, "972");
    Linking.openURL(`https://wa.me/${intl}`).catch(() => Alert.alert("שגיאה", "לא ניתן לפתוח וואטסאפ"));
  };

  const exportToInventory = async () => {
    const name = (combined.split("\n").find((l) => l.trim()) || "").trim();
    if (!name) {
      Alert.alert("אין טקסט", "סרוק קודם פריט");
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.warehouse);
      const items = raw ? JSON.parse(raw) : [];
      const newItem = {
        id: uid(),
        name: name.slice(0, 40),
        category: "other",
        qty: 1,
        minQty: 1,
        cost: 0,
        price: 0,
        supplierName: "",
        supplierPhone: phones[0] || "",
        expiry: "",
        barcode: "",
      };
      await AsyncStorage.setItem(STORAGE_KEYS.warehouse, JSON.stringify([newItem, ...items]));
      Alert.alert("יוצא ✓", `"${newItem.name}" נוסף למחסן`);
    } catch {
      Alert.alert("שגיאה", "הייצוא נכשל");
    }
  };

  return (
    <View>
      <Text style={styles.hint}>צלם מסמך בתוך המסגרת (A5) או בחר מהגלריה — נשאב הטקסט אוטומטית.</Text>

      {/* Capture buttons */}
      <View style={styles.captureRow}>
        <TouchableOpacity style={[styles.capBtn, styles.capCam]} onPress={() => addPage(true)} activeOpacity={0.85}>
          <Text style={styles.capText}>📷 צלם עמוד</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.capBtn, styles.capGallery]} onPress={() => addPage(false)} activeOpacity={0.85}>
          <Text style={styles.capText}>🖼️ מהגלריה</Text>
        </TouchableOpacity>
      </View>

      {/* A5 frame guide + filters */}
      <View style={styles.a5Frame}>
        <View style={styles.a5Corner} />
        <View style={[styles.a5Corner, styles.a5TR]} />
        <View style={[styles.a5Corner, styles.a5BL]} />
        <View style={[styles.a5Corner, styles.a5BR]} />
        <Text style={styles.a5Label}>מסגרת A5</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, bw && styles.filterOn]}
          onPress={() => setBw((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterText, bw && styles.filterTextOn]}>◐ שחור-לבן חד</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, sticker && styles.filterOn]}
          onPress={() => setSticker((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterText, sticker && styles.filterTextOn]}>🏷️ פורמט מדבקה</Text>
        </TouchableOpacity>
      </View>

      {status === "loading" && <Text style={styles.loading}>שואב טקסט...</Text>}
      {status === "error" && (
        <Text style={styles.errorText}>שגיאה בשאיבת הטקסט — בדוק חיבור אינטרנט ונסה שוב.</Text>
      )}

      {/* Pages */}
      {pages.map((p, i) => (
        <View key={p.id} style={styles.pageCard}>
          <View style={styles.pageHead}>
            <TouchableOpacity style={styles.pageDelete} onPress={() => removePage(p.id)}>
              <Text style={styles.pageDeleteText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.pageNum}>עמוד {i + 1}</Text>
          </View>
          <Image
            source={{ uri: p.uri }}
            style={[
              styles.preview,
              // grayscale/contrast is a real effect on web; ignored on native
              bw && Platform.OS === "web" ? { filter: "grayscale(1) contrast(1.5)" } : null,
            ]}
            resizeMode="cover"
          />
          {sticker ? (
            <View style={styles.stickerCard}>
              <Text style={styles.stickerText} numberOfLines={2}>
                {(p.text || "").split("\n")[0] || "—"}
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.pageText}
              value={p.text}
              onChangeText={(t) => editPage(p.id, t)}
              multiline
              textAlign="right"
              placeholder="הטקסט שנשאב..."
              placeholderTextColor={COLORS.textMuted}
            />
          )}
        </View>
      ))}

      {/* Phone hunter */}
      {phones.length > 0 && (
        <View style={styles.phoneBox}>
          <Text style={styles.phoneTitle}>📞 מספרי טלפון שזוהו</Text>
          {phones.map((ph) => (
            <View key={ph} style={styles.phoneRow}>
              <TouchableOpacity style={[styles.phoneAct, styles.phoneWa]} onPress={() => waPhone(ph)}>
                <Text style={styles.phoneActText}>💬</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.phoneAct, styles.phoneCall]} onPress={() => callPhone(ph)}>
                <Text style={styles.phoneActText}>📞</Text>
              </TouchableOpacity>
              <Text style={styles.phoneNum}>{ph}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Global actions */}
      {pages.length > 0 && (
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actBtn, styles.actCopy]} onPress={copyAll} activeOpacity={0.85}>
            <Text style={styles.actText}>📋 העתק הכל</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actBtn, styles.actTranslate]} onPress={translate} activeOpacity={0.85}>
            <Text style={styles.actText}>🌐 תרגם</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actBtn, styles.actInv]} onPress={exportToInventory} activeOpacity={0.85}>
            <Text style={[styles.actText, { color: COLORS.textPrimary }]}>📦 למחסן</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.regular, textAlign: "right", marginBottom: 14 },
  captureRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  capBtn: { flex: 1, height: 54, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  capCam: { backgroundColor: COLORS.navy },
  capGallery: { backgroundColor: COLORS.mustard },
  capText: { color: "#FFFFFF", fontSize: 15, fontFamily: FONTS.bold },
  a5Frame: {
    height: 90,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  a5Corner: { position: "absolute", top: 6, left: 6, width: 16, height: 16, borderTopWidth: 3, borderLeftWidth: 3, borderColor: COLORS.navy },
  a5TR: { left: undefined, right: 6, borderLeftWidth: 0, borderRightWidth: 3 },
  a5BL: { top: undefined, bottom: 6, borderTopWidth: 0, borderBottomWidth: 3 },
  a5BR: { top: undefined, left: undefined, right: 6, bottom: 6, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 3, borderBottomWidth: 3 },
  a5Label: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.bold },
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  filterBtn: { flex: 1, height: 44, borderRadius: RADIUS, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  filterOn: { backgroundColor: COLORS.navy },
  filterText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  filterTextOn: { color: "#FFFFFF" },
  loading: { color: COLORS.navy, fontSize: 14, fontFamily: FONTS.bold, textAlign: "center", paddingVertical: 10 },
  errorText: { color: COLORS.danger, fontSize: 14, fontFamily: FONTS.bold, textAlign: "center", paddingVertical: 10 },
  pageCard: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 12, ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pageNum: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold },
  pageDelete: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER },
  pageDeleteText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  preview: { width: "100%", height: 150, borderRadius: RADIUS, marginBottom: 10, backgroundColor: "#EEE", ...BRUTAL_BORDER },
  pageText: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    padding: 10,
    minHeight: 70,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlignVertical: "top",
    ...BRUTAL_BORDER,
  },
  stickerCard: {
    backgroundColor: COLORS.mustard,
    borderRadius: RADIUS,
    padding: 16,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  stickerText: { color: COLORS.textPrimary, fontSize: 20, fontFamily: FONTS.bold, textAlign: "center" },
  phoneBox: { backgroundColor: COLORS.white, borderRadius: RADIUS, padding: 12, marginBottom: 12, ...BRUTAL_BORDER },
  phoneTitle: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 10 },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  phoneAct: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", marginEnd: 8, ...BRUTAL_BORDER },
  phoneWa: { backgroundColor: COLORS.success },
  phoneCall: { backgroundColor: COLORS.navy },
  phoneActText: { fontSize: 16 },
  phoneNum: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold, textAlign: "right" },
  actionsGrid: { flexDirection: "row", gap: 8 },
  actBtn: { flex: 1, height: 50, borderRadius: RADIUS, alignItems: "center", justifyContent: "center", ...BRUTAL_BORDER, ...BRUTAL_SHADOW_SM },
  actCopy: { backgroundColor: COLORS.navy },
  actTranslate: { backgroundColor: COLORS.success },
  actInv: { backgroundColor: COLORS.mustard },
  actText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
});
