import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { FLUID, SCREEN_IN } from "../utils/motion";
import { BusinessProvider } from "../context/BusinessContext";
import BizDashboardScreen from "./BizDashboardScreen";
import DebtsScreen from "./DebtsScreen";
import POSScreen from "./POSScreen";
import PricingScreen from "./PricingScreen";
import PromosScreen from "./PromosScreen";
import WarehouseScreen from "./WarehouseScreen";
import ZReportScreen from "./ZReportScreen";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// "העסק שלי" shell: a pill sub-navigation over 8 business modules — all live:
// POS, Warehouse, customer tabs, Z-report, promos, pricing and the dashboard
// (ספקים remains the one scaffold).

const INK_SOFT_PILL = "#4B5563";
const BLUE_ACCENT = "#7C3AED";
const WHITE = "#FFFFFF";
const CARD = "#F9FAFC";
const INK = "#111827";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";

const MODULES = [
  { key: "pos", label: "קופה", icon: "shopping-cart" },
  { key: "inventory", label: "מחסן", icon: "package" },
  { key: "tabs", label: "הקפות", icon: "book-open" },
  { key: "suppliers", label: "ספקים", icon: "truck" },
  { key: "zreport", label: "דוח Z", icon: "file-text" },
  { key: "deals", label: "מבצעים", icon: "target" },
  { key: "pricing", label: "תמחור", icon: "tag" },
  { key: "dash", label: "דשבורד", icon: "bar-chart-2" },
];

function ModuleScaffold({ icon, title }) {
  return (
    <View style={s.scaffold}>
      <View style={s.scaffoldBadge}>
        <Icon name={icon} size={34} color={BLUE_ACCENT} />
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
      case "deals":
        return <PromosScreen />;
      case "pricing":
        return <PricingScreen />;
      case "dash":
        return <BizDashboardScreen />;
      default: {
        const m = MODULES.find((x) => x.key === module);
        return <ModuleScaffold icon={m.icon} title={m.label} />;
      }
    }
  };

  return (
    <Animated.View entering={SCREEN_IN} style={{ flex: 1, backgroundColor: WHITE, paddingTop: insets.top + 6 }}>
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
            <Bounce
              key={m.key}
              style={[s.pill, active && s.pillActive]}
              onPress={() => switchTo(m.key)}
            >
              <Icon name={m.icon} size={15} color={active ? WHITE : INK_SOFT_PILL} />
              <Text style={[s.pillText, active && { color: WHITE }]}>{m.label}</Text>
            </Bounce>
          );
        })}
      </ScrollView>

      {/* Active module with a subtle entrance animation on switch */}
      <Animated.View key={module} entering={FadeInDown.duration(220)} style={{ flex: 1 }}>
        {renderModule()}
      </Animated.View>
    </Animated.View>
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
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 7,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
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
  scaffoldPill: { backgroundColor: BLUE + "12", borderRadius: 28, paddingHorizontal: 16, paddingVertical: 8 },
  scaffoldPillText: { fontFamily: FONTS.bold, fontSize: 13, color: BLUE },
});
