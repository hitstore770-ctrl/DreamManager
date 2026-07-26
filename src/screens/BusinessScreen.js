import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BusinessProvider } from "../context/BusinessContext";
import DebtsScreen from "./DebtsScreen";
import POSScreen from "./POSScreen";
import WarehouseScreen from "./WarehouseScreen";
import ZReportScreen from "./ZReportScreen";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// "העסק שלי" shell: a pill sub-navigation over 8 business modules. POS,
// Warehouse, customer tabs (הקפות) and the Z-report are fully built; the
// remaining four are scaffolded for a later phase.

const WHITE = "#FFFFFF";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";

const MODULES = [
  { key: "pos", label: "קופה", emoji: "🛒" },
  { key: "inventory", label: "מחסן", emoji: "📦" },
  { key: "tabs", label: "הקפות", emoji: "📒" },
  { key: "suppliers", label: "ספקים", emoji: "🚚" },
  { key: "zreport", label: "דוח Z", emoji: "🧾" },
  { key: "deals", label: "מבצעים", emoji: "🎯" },
  { key: "pricing", label: "תמחור", emoji: "🏷️" },
  { key: "dash", label: "דשבורד", emoji: "📊" },
];

function ModuleScaffold({ emoji, title }) {
  return (
    <View style={s.scaffold}>
      <View style={s.scaffoldBadge}>
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
      </View>
      <Text style={s.scaffoldTitle}>{title}</Text>
      <View style={s.scaffoldPill}>
        <Text style={s.scaffoldPillText}>בבנייה · Phase 3</Text>
      </View>
    </View>
  );
}

function BusinessShell() {
  const insets = useSafeAreaInsets();
  const [module, setModule] = useState("pos");

  const switchTo = (key) => {
    if (key === module) return;
    hapticLight();
    setModule(key);
  };

  const renderModule = () => {
    switch (module) {
      case "pos":
        return <POSScreen />;
      case "inventory":
        return <WarehouseScreen onGoToPos={() => setModule("pos")} />;
      case "tabs":
        return <DebtsScreen />;
      case "zreport":
        return <ZReportScreen />;
      default: {
        const m = MODULES.find((x) => x.key === module);
        return <ModuleScaffold emoji={m.emoji} title={m.label} />;
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE, paddingTop: insets.top + 6 }}>
      {/* Sub-navigation pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.pillRow}
      >
        {MODULES.map((m) => {
          const active = module === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[s.pill, active && s.pillActive]}
              onPress={() => switchTo(m.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, active && { color: WHITE }]}>
                {m.emoji} {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active module with a subtle entrance animation on switch */}
      <Animated.View key={module} entering={FadeInDown.duration(220)} style={{ flex: 1 }}>
        {renderModule()}
      </Animated.View>
    </View>
  );
}

export default function BusinessScreen() {
  return (
    <BusinessProvider>
      <BusinessShell />
    </BusinessProvider>
  );
}

const s = StyleSheet.create({
  pillRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, alignItems: "center" },
  pill: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: BLUE,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pillText: { fontFamily: FONTS.semibold, fontSize: 13, color: INK },

  scaffold: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  scaffoldBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  scaffoldTitle: { fontFamily: FONTS.bold, fontSize: 20, color: INK, marginBottom: 10 },
  scaffoldPill: { backgroundColor: BLUE + "12", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  scaffoldPillText: { fontFamily: FONTS.bold, fontSize: 13, color: BLUE },
});
