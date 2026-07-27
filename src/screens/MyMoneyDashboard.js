import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { useMoney } from "../context/MoneyContext";
import { hapticLight } from "../utils/haptics";
import { SCREEN_IN } from "../utils/motion";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";

// הכסף שלי — the second zone. Two doors: counting the till, and the savings
// area. Everything money-shaped in the app is reachable from here.

const SHORTCUTS = [
  { key: "Business", label: "העסק שלי", icon: "briefcase", hint: "קופה, מחסן, דוח Z" },
  { key: "Tools", label: "כלים", icon: "grid", hint: "43 מחשבונים" },
  { key: "Dreams", label: "חלומות", icon: "star", hint: "יעדים ואבני דרך" },
  { key: "Notes", label: "פתקים", icon: "edit-3", hint: "רשימות ומסמכים" },
  { key: "Settings", label: "הגדרות", icon: "settings", hint: "העדפות ומערכת" },
];

export default function MyMoneyDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { netWorth, piggy, wallet, liquid, totalDeposited } = useMoney();

  const go = (route, params) => {
    hapticLight();
    navigation?.navigate(route, params);
  };

  return (
    <Animated.View entering={SCREEN_IN} style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>הכסף שלי</Text>
            <Text style={s.subtitle}>הכול במקום אחד</Text>
          </View>
          <View style={s.headerBadge}>
            <Icon name="trending-up" size={20} color={UI.violet} />
          </View>
        </View>

        {/* Net worth */}
        <Animated.View entering={FadeInDown.springify().damping(14)} style={s.hero}>
          <Text style={s.heroLabel}>סה״כ ברשותי</Text>
          <Text testID="money-networth" style={s.heroValue}>{shekel(netWorth)}</Text>
          <View style={s.heroRow}>
            <Slice label="קופה" value={piggy} />
            <Slice label="ארנק" value={wallet} />
            <Slice label="נזיל" value={liquid} />
            <Slice label="קרנות" value={totalDeposited} />
          </View>
        </Animated.View>

        {/* The two doors */}
        <Animated.View entering={FadeInDown.delay(90).springify().damping(14)}>
          <Bounce testID="go-register" style={[s.door, s.doorRegister]} scaleTo={0.97} onPress={() => go("CashRegister")}>
            <Icon name="chevron-left" size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={s.doorTitle}>הקופה</Text>
              <Text style={s.doorHint}>ספירת מזומן בסוף משמרת מול דוח Z</Text>
            </View>
            <View style={s.doorBadge}>
              <Icon name="cash-outline" size={26} color="#FFFFFF" />
            </View>
          </Bounce>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify().damping(14)}>
          <Bounce testID="go-savings" style={[s.door, s.doorSavings]} scaleTo={0.97} onPress={() => go("SavingsHub")}>
            <Icon name="chevron-left" size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={s.doorTitle}>אזור החיסכון</Text>
              <Text style={s.doorHint}>קופה · ארנק · החשבון שלי</Text>
            </View>
            <View style={s.doorBadge}>
              <Icon name="archive" size={26} color="#FFFFFF" />
            </View>
          </Bounce>
        </Animated.View>

        {/* The rest of the app stays reachable from here. */}
        <Text style={s.sectionHead}>שאר האפליקציה</Text>
        <View style={s.shortcuts}>
          {SHORTCUTS.map((sc, i) => (
            <Animated.View key={sc.key} entering={FadeInDown.delay(220 + i * 50).springify().damping(14)}>
              <Bounce
                testID={`shortcut-${sc.key}`}
                style={s.shortcut}
                scaleTo={0.95}
                onPress={() => go("Classic", { screen: sc.key })}
              >
                <View style={s.shortcutBadge}>
                  <Icon name={sc.icon} size={19} color={UI.violet} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.shortcutLabel}>{sc.label}</Text>
                  <Text style={s.shortcutHint}>{sc.hint}</Text>
                </View>
              </Bounce>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function Slice({ label, value }) {
  return (
    <View style={s.slice}>
      <Text style={s.sliceValue}>{shekel(value)}</Text>
      <Text style={s.sliceLabel}>{label}</Text>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },

  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH, paddingBottom: 14 },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    backgroundColor: UI.ink,
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginHorizontal: UI.cardMarginH,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 7,
  },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: "rgba(255,255,255,0.7)" },
  heroValue: { fontFamily: FONTS.bold, fontSize: 38, color: "#FFFFFF", marginTop: 2 },
  heroRow: { flexDirection: "row", gap: 14, marginTop: 14 },
  slice: { alignItems: "center" },
  sliceValue: { fontFamily: FONTS.bold, fontSize: 13, color: "rgba(255,255,255,0.95)" },
  sliceLabel: { fontFamily: FONTS.regular, fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  door: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 14,
    borderRadius: UI.radius,
    padding: 20,
    marginHorizontal: UI.cardMarginH,
    marginBottom: 12,
    minHeight: 108,
  },
  doorRegister: {
    backgroundColor: UI.violet,
    shadowColor: UI.violet,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 7,
  },
  doorSavings: {
    backgroundColor: UI.cyan,
    shadowColor: UI.cyan,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 7,
  },
  doorTitle: { fontFamily: FONTS.bold, fontSize: 21, color: "#FFFFFF", textAlign: "right" },
  doorHint: { fontFamily: FONTS.regular, fontSize: 12.5, color: "rgba(255,255,255,0.85)", textAlign: "right", marginTop: 3 },
  doorBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 14,
    marginBottom: 10,
  },
  shortcuts: { paddingHorizontal: UI.cardMarginH, gap: 10 },
  shortcut: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 12,
    backgroundColor: UI.surface,
    borderRadius: UI.radiusSm,
    padding: 14,
    ...CARD_SHADOW,
  },
  shortcutBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: UI.violet + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { fontFamily: FONTS.bold, fontSize: 15, color: UI.ink, textAlign: "right" },
  shortcutHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
});
