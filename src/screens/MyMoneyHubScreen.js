import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import Banknote from "../components/money/Banknote";
import Bounce from "../components/Bounce";
import Coin from "../components/money/Coin";
import Icon from "../components/Icon";
import { Canvas, Card, GradCard } from "../components/Paper";
import { useMoney } from "../context/MoneyContext";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { BEVEL, GRAD, TYPE, UI, tint } from "../utils/ui";

// הכסף שלי — the rightmost zone. Two doors: counting the till, and the savings
// area. Everything money-shaped in the app is reachable from here.

const SHORTCUTS = [
  { key: "Business", label: "העסק שלי", icon: "briefcase", hint: "קופה, מחסן, דוח Z" },
  { key: "Settings", label: "הגדרות", icon: "settings", hint: "העדפות ומערכת" },
];

export default function MyMoneyHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { netWorth, piggy, wallet, liquid, totalDeposited } = useMoney();

  const go = (route, params) => {
    hapticLight();
    navigation?.navigate(route, params);
  };

  return (
    <Canvas testID="money-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
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

        {/* Net worth. The note and the coin are not decoration — they say at a
            glance which screen you are on, the way a wallet's contents do. */}
        <Animated.View entering={FadeInDown.springify().damping(14)}>
          <GradCard colors={GRAD.violet} halo={UI.violet} radius={28} style={s.heroWrap}>
            <View style={s.hero}>
              <View style={s.heroProps} pointerEvents="none">
                <Banknote value={200} width={112} height={62} style={s.heroNote} />
                <View style={s.heroCoin}>
                  <Coin agorot={1000} size={54} />
                </View>
              </View>

              <Text style={s.heroLabel}>סה״כ ברשותי</Text>
              <Text testID="money-networth" style={s.heroValue}>{shekel(netWorth)}</Text>
              <View style={s.heroRow}>
                <Slice label="קופה" value={piggy} />
                <Slice label="ארנק" value={wallet} />
                <Slice label="נזיל" value={liquid} />
                <Slice label="קרנות" value={totalDeposited} />
              </View>
            </View>
          </GradCard>
        </Animated.View>

        {/* The two doors */}
        <Door
          testID="go-register"
          delay={90}
          grad={GRAD.cyan}
          halo={UI.cyan}
          icon="cash-outline"
          title="הקופה"
          hint="ספירת מזומן בסוף משמרת מול דוח Z"
          onPress={() => go("CashRegister")}
        />
        <Door
          testID="go-savings"
          delay={160}
          grad={GRAD.green}
          halo={UI.green}
          icon="archive"
          title="אזור החיסכון"
          hint="קופה · ארנק · החשבון שלי"
          onPress={() => go("SavingsHub")}
        />

        <Text style={s.sectionHead}>עוד מהעסק</Text>
        <View style={s.shortcuts}>
          {SHORTCUTS.map((sc, i) => (
            <Animated.View key={sc.key} entering={FadeInDown.delay(220 + i * 50).springify().damping(14)}>
              <Bounce testID={`shortcut-${sc.key}`} scaleTo={0.96} onPress={() => go(sc.key)}>
                <Card style={s.shortcut} radius={UI.radiusSm}>
                  <View style={s.shortcutInner}>
                    <View style={s.shortcutBadge}>
                      <Icon name={sc.icon} size={19} color={UI.violet} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.shortcutLabel}>{sc.label}</Text>
                      <Text style={s.shortcutHint}>{sc.hint}</Text>
                    </View>
                    <Icon name={I18nManager.isRTL ? "chevron-left" : "chevron-right"} size={17} color={UI.inkMuted} />
                  </View>
                </Card>
              </Bounce>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Canvas>
  );
}

function Door({ testID, delay, grad, halo, icon, title, hint, onPress }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(14)}>
      <Bounce testID={testID} scaleTo={0.97} onPress={onPress}>
        <GradCard colors={grad} halo={halo} style={s.doorWrap}>
          <View style={s.door}>
            <Icon name="chevron-left" size={20} color="rgba(255,255,255,0.85)" />
            <View style={{ flex: 1 }}>
              <Text style={s.doorTitle}>{title}</Text>
              <Text style={s.doorHint}>{hint}</Text>
            </View>
            <View style={s.doorBadge}>
              <Icon name={icon} size={26} color="#FFFFFF" />
            </View>
          </View>
        </GradCard>
      </Bounce>
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
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH, paddingBottom: 14 },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: tint(UI.violet, 0.2),
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },

  heroWrap: { marginHorizontal: UI.cardMarginH, marginBottom: 16 },
  hero: { paddingVertical: 24, paddingHorizontal: 20, alignItems: "center", overflow: "hidden" },
  heroProps: { ...StyleSheet.absoluteFillObject },
  // Tucked into the corners at an angle and partly clipped, the way objects
  // sit in a pocket. Squared up and fully visible they would read as icons.
  heroNote: { position: "absolute", top: -14, left: -22, transform: [{ rotate: "-16deg" }], opacity: 0.5 },
  heroCoin: { position: "absolute", bottom: -12, right: -8, transform: [{ rotate: "12deg" }], opacity: 0.55 },

  heroLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: "rgba(255,255,255,0.78)" },
  heroValue: {
    fontFamily: FONTS.bold,
    fontSize: 40,
    color: "#FFFFFF",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroRow: { flexDirection: "row", gap: 14, marginTop: 16 },
  slice: { alignItems: "center" },
  sliceValue: { fontFamily: FONTS.bold, fontSize: 13, color: "rgba(255,255,255,0.96)" },
  sliceLabel: { fontFamily: FONTS.regular, fontSize: 10, color: "rgba(255,255,255,0.68)", marginTop: 2 },

  doorWrap: { marginHorizontal: UI.cardMarginH, marginBottom: 12 },
  door: { flexDirection: ROW, alignItems: "center", gap: 14, padding: 20, minHeight: 110 },
  doorTitle: { fontFamily: FONTS.bold, fontSize: 21, color: "#FFFFFF", textAlign: "right" },
  doorHint: { fontFamily: FONTS.regular, fontSize: 12.5, color: "rgba(255,255,255,0.88)", textAlign: "right", marginTop: 3 },
  doorBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 16,
    marginBottom: 10,
  },
  shortcuts: { paddingHorizontal: UI.cardMarginH, gap: 10 },
  shortcut: {},
  shortcutInner: { flexDirection: ROW, alignItems: "center", gap: 12, padding: 14 },
  shortcutBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: tint(UI.violet, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { fontFamily: FONTS.bold, fontSize: 15, color: UI.ink, textAlign: "right" },
  shortcutHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
});
