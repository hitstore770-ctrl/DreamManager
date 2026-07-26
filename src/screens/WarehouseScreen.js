import { useState } from "react";
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import ToolsSheet, { SheetRow, ToolsFab } from "../components/business/ToolsSheet";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { CATEGORIES, LOW_STOCK, applyDamage, catOf, shekel, uid } from "../utils/posStore";
import { buildZReportText } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// המחסן — the master inventory. Rows are dense but every touch target is a
// full-size button: +10 restock, low-stock red flag under LOW_STOCK units,
// category color tag, cost/sell prices. The ⚙️ FAB opens the Pro Tools sheet.

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const RED = "#E14848";
const GREEN = "#34C759";

const EMPTY_FORM = { name: "", cost: "", price: "", qty: "", category: CATEGORIES[0].key };

export default function WarehouseScreen({ onGoToPos }) {
  const { inventory, setInventory, setSales, sales } = useBusiness();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [defectMode, setDefectMode] = useState(false);

  const restock = (id) => {
    hapticSuccess();
    setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, qty: (i.qty || 0) + 10 } : i)));
  };

  const addProduct = () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name || !(price >= 0)) return;
    hapticSuccess();
    setInventory((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        category: form.category,
        qty: parseInt(form.qty, 10) || 0,
        cost: parseFloat(form.cost) || 0,
        price,
        sold: 0,
      },
    ]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  // Defect mode: tapping a row logs one damaged unit (stock −1 + loss record).
  const rowTap = (item) => {
    if (!defectMode) return;
    hapticWarning();
    const { inventory: updated, sale } = applyDamage(inventory, item.id, 1);
    setInventory(updated);
    if (sale) setSales((prev) => [...prev, sale]);
  };

  const shareZ = async () => {
    hapticLight();
    setSheetOpen(false);
    try {
      await Share.share({ message: buildZReportText(sales) });
    } catch {
      /* user cancelled */
    }
  };

  const goPos = (label) => {
    hapticLight();
    setSheetOpen(false);
    onGoToPos?.();
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {defectMode && (
        <View style={s.defectBanner}>
          <TouchableOpacity style={s.defectClose} onPress={() => { hapticLight(); setDefectMode(false); }} activeOpacity={0.7}>
            <Text style={{ fontFamily: FONTS.bold, color: RED, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
          <Text style={s.defectText}>מצב פחת פעיל — הקש על מוצר לרישום נזק ⚠️</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}>
        {/* Add product */}
        {showForm ? (
          <View style={s.formCard}>
            <TextInput
              style={s.input}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="שם המוצר"
              placeholderTextColor={INK_MUTED}
              textAlign="right"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={form.qty}
                onChangeText={(v) => setForm((f) => ({ ...f, qty: v }))}
                placeholder="כמות"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                textAlign="center"
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="מכירה ₪"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                textAlign="center"
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={form.cost}
                onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))}
                placeholder="עלות ₪"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.catChip, form.category === c.key && { backgroundColor: c.color }]}
                  onPress={() => { hapticLight(); setForm((f) => ({ ...f, category: c.key })); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.catChipText, form.category === c.key && { color: WHITE }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={[s.formBtn, { backgroundColor: CARD }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                <Text style={[s.formBtnText, { color: INK_MUTED }]}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.formBtn, { backgroundColor: BLUE, flex: 2 }]} onPress={addProduct} activeOpacity={0.8}>
                <Text style={[s.formBtnText, { color: WHITE }]}>שמור מוצר</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.addBtn} onPress={() => { hapticLight(); setShowForm(true); }} activeOpacity={0.75}>
            <Text style={s.addBtnText}>＋ מוצר חדש</Text>
          </TouchableOpacity>
        )}

        {/* Inventory list */}
        {inventory.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 34 }}>📦</Text>
            <Text style={s.emptyText}>המחסן ריק — הוסף מוצר ראשון</Text>
          </View>
        ) : (
          inventory.map((item) => {
            const low = (item.qty || 0) < LOW_STOCK;
            const cat = catOf(item.category);
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.itemRow, defectMode && { borderWidth: 1, borderColor: RED + "55" }]}
                onPress={() => rowTap(item)}
                activeOpacity={defectMode ? 0.6 : 1}
              >
                {/* +10 quick restock */}
                <TouchableOpacity style={s.restockBtn} onPress={() => restock(item.id)} activeOpacity={0.7}>
                  <Text style={s.restockText}>+10</Text>
                </TouchableOpacity>

                {/* Stock count */}
                <View style={{ alignItems: "center", minWidth: 52 }}>
                  <Text style={[s.stockNum, low && { color: RED }]}>{item.qty || 0}</Text>
                  <Text style={[s.stockCap, low && { color: RED, fontFamily: FONTS.bold }]}>
                    {low ? "מלאי נמוך!" : "במלאי"}
                  </Text>
                </View>

                {/* Name + prices */}
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[s.itemName, low && { color: RED }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.itemPrices}>
                    עלות {shekel(item.cost || 0)} · מכירה {shekel(item.price || 0)}
                  </Text>
                </View>

                {/* Category color tag */}
                <View style={[s.catTag, { backgroundColor: cat.color }]} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <ToolsFab style={{ bottom: 18 }} onPress={() => { hapticLight(); setSheetOpen(true); }} />

      <ToolsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="⚙️ כלים מקצועיים">
        <SheetRow emoji="🏷️" label="הנחה מהירה %" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow emoji="✂️" label="פיצול תשלום" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow emoji="📝" label="הערה להזמנה" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow
          emoji="⚠️"
          label={defectMode ? "כבה מצב פחת" : "סימון פריט פגום / פחת"}
          sub="הקשה על מוצר תרשום נזק ותוריד מלאי"
          danger
          active={defectMode}
          onPress={() => { hapticLight(); setDefectMode((v) => !v); setSheetOpen(false); }}
        />
        <SheetRow emoji="🧾" label="ייצוא דוח Z ל-WhatsApp" sub="סיכום פדיון, עסקאות ופחת להיום" onPress={shareZ} />
      </ToolsSheet>
    </View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
};

const s = StyleSheet.create({
  defectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: RED + "14",
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  defectText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: RED, textAlign: "right" },
  defectClose: { width: 48, height: 32, alignItems: "center", justifyContent: "center" },

  addBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BLUE + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  addBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },

  formCard: { backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 8, marginBottom: 10, ...SHADOW },
  input: {
    minHeight: 48,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
  },
  catChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  catChipText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK },
  formBtn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  formBtnText: { fontFamily: FONTS.bold, fontSize: 14 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: INK_MUTED },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    minHeight: 64,
    ...SHADOW,
  },
  catTag: { width: 5, alignSelf: "stretch", borderRadius: 3 },
  itemName: { fontFamily: FONTS.semibold, fontSize: 14, color: INK },
  itemPrices: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  stockNum: { fontFamily: FONTS.bold, fontSize: 18, color: INK },
  stockCap: { fontFamily: FONTS.regular, fontSize: 10, color: INK_MUTED },
  restockBtn: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: GREEN + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  restockText: { fontFamily: FONTS.bold, fontSize: 14, color: "#1E9E58" },
});
