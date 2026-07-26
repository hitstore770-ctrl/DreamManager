import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useBusiness } from "../context/BusinessContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import { shekel, uid } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// מבצעים ומארזים — smart bundles pushed straight to the POS: every active
// promo shows up as a gold quick-add chip at the front of the POS product
// rail. The two starter bundles are seeded by BusinessProvider.

const WHITE = "#FFFFFF";
const CARD = "#F0F2F5";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";

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
    setPromos((prev) => [...(prev || []), { id: uid(), name: n, price: v, emoji: "🎁", active: true }]);
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
        <Text style={s.bannerText}>
          🎯 מבצעים פעילים מופיעים כצ׳יפ זהב בקופה · פעילים כעת: {activeCount}
        </Text>
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
            <Text style={[s.name, !p.active && { color: INK_MUTED }]} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={[s.price, !p.active && { color: INK_MUTED }]}>{shekel(p.price)}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: p.active ? GOLD + "26" : CARD }]}>
            <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
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
              <Text style={[s.formBtnText, { color: INK_MUTED }]}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.formBtn, { backgroundColor: BLUE, flex: 2 }, !(name.trim() && parseFloat(price) > 0) && { opacity: 0.35 }]}
              onPress={addPromo}
              activeOpacity={0.8}
            >
              <Text style={[s.formBtnText, { color: WHITE }]}>שמור מבצע</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => { hapticLight(); setShowForm(true); }} activeOpacity={0.75}>
          <Text style={s.addBtnText}>＋ מבצע חדש</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 2,
};

const s = StyleSheet.create({
  banner: { backgroundColor: BLUE + "0D", borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerText: { fontFamily: FONTS.semibold, fontSize: 12, color: BLUE, textAlign: "right", lineHeight: 18 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
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

  formCard: { backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 8, marginTop: 4, ...SHADOW },
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
