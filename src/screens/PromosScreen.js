import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../components/Icon";
import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import { shekel, uid } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import CustomText from "../components/CustomText";

// מבצעים ומארזים — smart bundles pushed straight to the POS: every active
// promo shows up as a gold quick-add chip at the front of the POS product
// rail. The two starter bundles are seeded by BusinessProvider.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const GOLD = "#06B6D4";

export default function PromosScreen() {
  const { promos, setPromos } = useBusiness();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const list = promos || [];
  const activeCount = useMemo(() => list.filter((p) => p.active).length, [list]);

  const toggle = (id, value) => {
    hapticLight();
    setPromos((prev) => (prev || []).map((p) => (p.id === id ? { ...p, active: value } : p)));
  };

  const addPromo = () => {
    const n = name.trim();
    const v = parseFloat(price);
    if (!n || !(v > 0)) return;
    hapticSuccess();
    setPromos((prev) => [...(prev || []), { id: uid(), name: n, price: v, icon: "gift-outline", active: true }]);
    setName("");
    setPrice("");
    setShowForm(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: WHITE }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      <View style={s.banner}>
        <CustomText style={s.bannerText}>
          מבצעים פעילים מופיעים כצ׳יפ זהב בקופה · פעילים כעת: {activeCount}
        </CustomText>
      </View>

      {list.map((p) => (
        <View key={p.id} style={s.row}>
          <Switch
            value={!!p.active}
            onValueChange={(v) => toggle(p.id, v)}
            trackColor={{ false: "#D6DBE1", true: BLUE }}
            thumbColor={WHITE}
          />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <CustomText style={[s.name, !p.active && { color: INK_MUTED }]} numberOfLines={2}>
              {p.name}
            </CustomText>
            <CustomText style={[s.price, !p.active && { color: INK_MUTED }]}>{shekel(p.price)}</CustomText>
          </View>
          <View style={[s.badge, { backgroundColor: p.active ? GOLD + "26" : CARD }]}>
            <CustomText style={{ fontSize: 20 }}>{p.emoji}</CustomText>
          </View>
        </View>
      ))}

      {/* Add bundle */}
      {showForm ? (
        <View style={s.formCard}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="שם המבצע / המארז"
            placeholderTextColor={INK_MUTED}
            textAlign="right"
          />
          <TextInput
            style={s.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="מחיר המבצע ₪"
            placeholderTextColor={INK_MUTED}
            textAlign="center"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.formBtn, { backgroundColor: CARD }]} onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <CustomText style={[s.formBtnText, { color: INK_MUTED }]}>ביטול</CustomText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.formBtn, { backgroundColor: BLUE, flex: 2 }, !(name.trim() && parseFloat(price) > 0) && { opacity: 0.35 }]}
              onPress={addPromo}
              activeOpacity={0.8}
            >
              <CustomText style={[s.formBtnText, { color: WHITE }]}>שמור מבצע</CustomText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => { hapticLight(); setShowForm(true); }} activeOpacity={0.75}>
          <CustomText style={s.addBtnText}>＋ מבצע חדש</CustomText>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  banner: { backgroundColor: BLUE + "0D", borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerText: { fontFamily: FONTS.semibold, fontSize: 12, color: BLUE, textAlign: "right", lineHeight: 18 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 64,
    ...SHADOW,
  },
  badge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONTS.semibold, fontSize: 14, color: INK, textAlign: "right" },
  price: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD, marginTop: 2 },

  addBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BLUE + "10",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  addBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },

  formCard: { backgroundColor: CARD, borderRadius: 24, padding: 12, gap: 8, marginTop: 4, ...SHADOW },
  input: {
    minHeight: 48,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
  },
  formBtn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  formBtnText: { fontFamily: FONTS.bold, fontSize: 14 },
});
