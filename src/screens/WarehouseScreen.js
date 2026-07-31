import { useState } from "react";
import { Linking, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../components/Icon";
import ToolsSheet, { SheetRow, ToolsFab } from "../components/business/ToolsSheet";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { CATEGORIES, LOW_STOCK, applyDamage, buildCatalogText, catOf, shekel, suggestRetailPrice, uid } from "../utils/posStore";
import { buildZReportText, lastCloseTs } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// המחסן — the master inventory. Rows are dense but every touch target is a
// full-size button: +10 restock, low-stock red flag under LOW_STOCK units,
// category color tag, cost/sell prices. The tools FAB opens the Pro Tools sheet.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const RED = "#EF4444";
const GREEN = "#10B981";

const EMPTY_FORM = { name: "", cost: "", shipping: "", price: "", qty: "", category: CATEGORIES[0].key };

export default function WarehouseScreen({ onGoToPos }) {
  const { inventory, setInventory, setSales, sales, closes } = useBusiness();

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
    const shipping = parseFloat(form.shipping) || 0;
    setInventory((prev) => [
      ...prev,
      {
        id: uid(),
        name,
        category: form.category,
        qty: parseInt(form.qty, 10) || 0,
        // The stored cost is the full landed cost (product + shipping) — every
        // other reader of this field (profit, damage write-offs, margin tags)
        // already treats "cost" as one number, and a shipping charge that
        // never made it into that number would quietly overstate profit.
        cost: (parseFloat(form.cost) || 0) + shipping,
        shipping,
        price,
        sold: 0,
      },
    ]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const costBasis = (parseFloat(form.cost) || 0) + (parseFloat(form.shipping) || 0);
  const applySuggestion = (pct) => {
    hapticLight();
    setForm((f) => ({ ...f, price: String(suggestRetailPrice(costBasis, pct)) }));
  };

  const shareCatalog = async () => {
    hapticLight();
    setSheetOpen(false);
    const text = buildCatalogText(inventory);
    if (!text) return;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
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
      await Share.share({ message: buildZReportText(sales, new Date(), lastCloseTs(closes)) });
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
            <Icon name="x" size={17} color={RED} />
          </TouchableOpacity>
          <CustomText style={s.defectText}>מצב פחת פעיל — הקש על מוצר לרישום נזק</CustomText>
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
                testID="wh-cost"
                style={[s.input, { flex: 1 }]}
                value={form.cost}
                onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))}
                placeholder="עלות מוצר ₪"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                textAlign="center"
              />
              <TextInput
                testID="wh-shipping"
                style={[s.input, { flex: 1 }]}
                value={form.shipping}
                onChangeText={(v) => setForm((f) => ({ ...f, shipping: v }))}
                placeholder="משלוח ₪"
                placeholderTextColor={INK_MUTED}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
            {costBasis > 0 && (
              <View style={s.suggestRow}>
                <CustomText style={s.suggestLabel}>מחיר מוצע:</CustomText>
                <TouchableOpacity testID="wh-suggest-40" style={s.suggestChip} onPress={() => applySuggestion(40)} activeOpacity={0.8}>
                  <CustomText style={s.suggestChipText}>{shekel(suggestRetailPrice(costBasis, 40))} · 40%+</CustomText>
                </TouchableOpacity>
                <TouchableOpacity testID="wh-suggest-50" style={s.suggestChip} onPress={() => applySuggestion(50)} activeOpacity={0.8}>
                  <CustomText style={s.suggestChipText}>{shekel(suggestRetailPrice(costBasis, 50))} · 50%+</CustomText>
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              testID="wh-price"
              style={s.input}
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              placeholder="מחיר מכירה ₪"
              placeholderTextColor={INK_MUTED}
              keyboardType="numeric"
              textAlign="center"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.catChip, form.category === c.key && { backgroundColor: c.color }]}
                  onPress={() => { hapticLight(); setForm((f) => ({ ...f, category: c.key })); }}
                  activeOpacity={0.7}
                >
                  <CustomText style={[s.catChipText, form.category === c.key && { color: WHITE }]}>{c.label}</CustomText>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={[s.formBtn, { backgroundColor: CARD }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                <CustomText style={[s.formBtnText, { color: INK_MUTED }]}>ביטול</CustomText>
              </TouchableOpacity>
              <TouchableOpacity style={[s.formBtn, { backgroundColor: BLUE, flex: 2 }]} onPress={addProduct} activeOpacity={0.8}>
                <CustomText style={[s.formBtnText, { color: WHITE }]}>שמור מוצר</CustomText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.addBtn} onPress={() => { hapticLight(); setShowForm(true); }} activeOpacity={0.75}>
            <CustomText style={s.addBtnText}>＋ מוצר חדש</CustomText>
          </TouchableOpacity>
        )}

        {/* Inventory list */}
        {inventory.length === 0 ? (
          <View style={s.empty}>
            <Icon name="package" size={34} color="#9CA3AF" />
            <CustomText style={s.emptyText}>המחסן ריק — הוסף מוצר ראשון</CustomText>
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
                  <CustomText style={s.restockText}>+10</CustomText>
                </TouchableOpacity>

                {/* Stock count */}
                <View style={{ alignItems: "center", minWidth: 52 }}>
                  <CustomText style={[s.stockNum, low && { color: RED }]}>{item.qty || 0}</CustomText>
                  <CustomText style={[s.stockCap, low && { color: RED, fontFamily: FONTS.bold }]}>
                    {low ? "מלאי נמוך!" : "במלאי"}
                  </CustomText>
                </View>

                {/* Name + prices */}
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <CustomText style={[s.itemName, low && { color: RED }]} numberOfLines={1}>{item.name}</CustomText>
                  <CustomText style={s.itemPrices}>
                    עלות {shekel(item.cost || 0)} · מכירה {shekel(item.price || 0)}
                  </CustomText>
                </View>

                {/* Category color tag */}
                <View style={[s.catTag, { backgroundColor: cat.color }]} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <ToolsFab style={{ bottom: 18, right: 16 }} onPress={() => { hapticLight(); setSheetOpen(true); }} />

      <ToolsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="כלים מקצועיים">
        <SheetRow icon="percent" label="הנחה מהירה %" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow icon="scissors" label="פיצול תשלום" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow icon="edit-3" label="הערה להזמנה" sub="פועל בקופה — מעבר לקופה" onPress={goPos} />
        <SheetRow
          icon="alert-triangle"
          label={defectMode ? "כבה מצב פחת" : "סימון פריט פגום / פחת"}
          sub="הקשה על מוצר תרשום נזק ותוריד מלאי"
          danger
          active={defectMode}
          onPress={() => { hapticLight(); setDefectMode((v) => !v); setSheetOpen(false); }}
        />
        <SheetRow icon="file-text" label="ייצוא דוח Z ל-WhatsApp" sub="סיכום פדיון, עסקאות ופחת להיום" onPress={shareZ} />
        <SheetRow icon="share-2" label="שיתוף קטלוג ב-WhatsApp" sub="רשימת כל המוצרים שבמלאי, מוכנה להעתקה" onPress={shareCatalog} />
      </ToolsSheet>
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

  formCard: { backgroundColor: CARD, borderRadius: 24, padding: 12, gap: 8, marginBottom: 10, ...SHADOW },
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
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  suggestLabel: { fontFamily: FONTS.medium, fontSize: 12, color: INK_MUTED },
  suggestChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: GREEN + "1A" },
  suggestChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: GREEN },
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
  restockText: { fontFamily: FONTS.bold, fontSize: 14, color: "#10B981" },
});
