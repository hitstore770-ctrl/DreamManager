import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Card from "../components/Card";
import Icon from "../components/Icon";
import { BusinessProvider } from "../context/BusinessContext";
import { hapticLight } from "../utils/haptics";
import { FLUID, SCREEN_IN } from "../utils/motion";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";
import BizDashboardScreen from "./BizDashboardScreen";
import DebtsScreen from "./DebtsScreen";
import POSScreen from "./POSScreen";
import PricingScreen from "./PricingScreen";
import PromosScreen from "./PromosScreen";
import WarehouseScreen from "./WarehouseScreen";
import ZReportScreen from "./ZReportScreen";

// "העסק שלי" — a pill sub-navigation over eight business modules. All are
// live except ספקים, which is still a scaffold.

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
      <Card style={s.scaffoldCard}>
        <View style={s.scaffoldBadge}>
          <Icon name={icon} size={34} color={UI.violet} />
        </View>
        <Text style={s.scaffoldTitle}>{title}</Text>
        <View style={s.scaffoldPill}>
          <Text style={s.scaffoldPillText}>בבנייה · בקרוב</Text>
        </View>
      </Card>
    </View>
  );
}

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
      case "dash":
        return <BizDashboardScreen />;
      default: {
        const m = MODULES.find((x) => x.key === module);
        return <ModuleScaffold icon={m.icon} title={m.label} />;
      }
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
              <Text style={[s.pillText, active && { color: "#FFFFFF" }]}>{m.label}</Text>
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

  scaffold: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  scaffoldCard: { alignItems: "center", paddingVertical: 34, width: "80%" },
  scaffoldBadge: {
    width: 84,
    height: 84,
    borderRadius: 30,
    backgroundColor: UI.violet + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  scaffoldTitle: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, marginBottom: 12 },
  scaffoldPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: UI.cyan + "16",
  },
  scaffoldPillText: { fontFamily: FONTS.semibold, fontSize: TYPE.caption, color: "#0E7490" },
});
