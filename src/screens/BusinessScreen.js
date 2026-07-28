import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";

import { BusinessProvider } from "../context/BusinessContext";
import { hapticLight } from "../utils/haptics";
import { FLUID, SCREEN_IN } from "../utils/motion";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { CARD_SHADOW, UI } from "../utils/ui";
import BizDashboardScreen from "./BizDashboardScreen";
import BizToolsScreen from "./BizToolsScreen";
import DebtsScreen from "./DebtsScreen";
import POSScreen from "./POSScreen";
import PricingScreen from "./PricingScreen";
import PromosScreen from "./PromosScreen";
import SuppliersScreen from "./SuppliersScreen";
import WarehouseScreen from "./WarehouseScreen";
import ZReportScreen from "./ZReportScreen";
import CustomText from "../components/CustomText";

// "העסק שלי" — a pill sub-navigation over nine business modules, all live.
// The last of them holds the three tools that moved here out of the Tools hub.

const MODULES = [
  { key: "pos", label: "קופה", icon: "shopping-cart" },
  { key: "inventory", label: "מחסן", icon: "package" },
  { key: "tabs", label: "הקפות", icon: "book-open" },
  { key: "suppliers", label: "ספקים", icon: "truck" },
  { key: "zreport", label: "דוח Z", icon: "file-text" },
  { key: "deals", label: "מבצעים", icon: "target" },
  { key: "pricing", label: "תמחור", icon: "tag" },
  { key: "dash", label: "דשבורד", icon: "bar-chart-2" },
  { key: "biztools", label: "כלים", icon: "sliders" },
];

function BusinessShell() {
  const insets = useSafeAreaInsets();
  const [module, setModule] = useState("pos");

  const renderModule = () => {
    switch (module) {
      case "pos":
        return <POSScreen />;
      case "inventory":
        return <WarehouseScreen />;
      case "tabs":
        return <DebtsScreen />;
      case "zreport":
        return <ZReportScreen />;
      case "deals":
        return <PromosScreen />;
      case "pricing":
        return <PricingScreen />;
      case "suppliers":
        return <SuppliersScreen />;
      case "biztools":
        return <BizToolsScreen />;
      case "dash":
      default:
        return <BizDashboardScreen />;
    }
  };

  return (
    <Animated.View entering={SCREEN_IN} style={[s.screen, { paddingTop: insets.top + 8 }]}>
      {/* Sub-navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillScroll}
        contentContainerStyle={s.pillRow}
      >
        {MODULES.map((m) => {
          const active = m.key === module;
          return (
            <Bounce
              key={m.key}
              style={[s.pill, active && s.pillActive]}
              scaleTo={0.95}
              onPress={() => {
                hapticLight();
                setModule(m.key);
              }}
            >
              <Icon name={m.icon} size={15} color={active ? "#FFFFFF" : UI.inkSoft} />
              <CustomText style={[s.pillText, active && { color: "#FFFFFF" }]}>{m.label}</CustomText>
            </Bounce>
          );
        })}
      </ScrollView>

      {/* Active module */}
      <Animated.View key={module} entering={FadeIn.duration(240)} layout={FLUID} style={{ flex: 1 }}>
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
  screen: { flex: 1, backgroundColor: UI.bg },

  pillScroll: { flexGrow: 0, marginBottom: 10 },
  pillRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  pill: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: UI.surface,
    ...CARD_SHADOW,
  },
  pillActive: {
    backgroundColor: UI.violet,
    shadowColor: UI.violet,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
  pillText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.inkSoft },

});
