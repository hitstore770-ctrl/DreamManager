import { I18nManager, StyleSheet, Text, View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { Canvas } from "../../components/Glass";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { BEVEL, CARD_SHADOW, TYPE, UI, tint } from "../../utils/ui";
import AccountScreen from "./AccountScreen";
import PiggyBankScreen from "./PiggyBankScreen";
import WalletScreen from "./WalletScreen";

// אזור החיסכון — three swipeable pages following the money: coins go into the
// piggy bank, the piggy bank empties into the wallet, the wallet deposits into
// the account.
//
// Declared piggy -> wallet -> account. Under forced RTL the pager lays these
// out right to left on its own, so the first page sits on the right and a
// leftward swipe advances — which is the direction the money travels.

const Tab = createMaterialTopTabNavigator();

export default function SavingsHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { netWorth } = useMoney();

  return (
    <Canvas style={{ paddingTop: insets.top + 8 }}>
      <View style={s.header}>
        <Bounce style={s.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>אזור החיסכון</Text>
          <Text style={s.subtitle}>סה״כ ברשותי {shekel(netWorth)}</Text>
        </View>
      </View>

      <Tab.Navigator
        initialRouteName="Piggy"
        style={{ backgroundColor: "transparent" }}
        sceneContainerStyle={{ backgroundColor: "transparent" }}
        screenOptions={{
          tabBarStyle: s.bar,
          tabBarIndicatorStyle: s.indicator,
          tabBarActiveTintColor: UI.violetLo,
          tabBarInactiveTintColor: UI.inkMuted,
          tabBarLabelStyle: { fontFamily: FONTS.bold, fontSize: 13.5, textTransform: "none" },
          tabBarPressColor: "transparent",
          // The pager owns the swipe; a press should feel the same as a swipe.
          tabBarItemStyle: { paddingVertical: 4 },
          swipeEnabled: true,
        }}
        screenListeners={{ swipeEnd: () => hapticLight() }}
      >
        <Tab.Screen name="Piggy" component={PiggyBankScreen} options={{ title: "קופה" }} />
        <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: "ארנק" }} />
        <Tab.Screen name="Account" component={AccountScreen} options={{ title: "החשבון שלי" }} />
      </Tab.Navigator>
    </Canvas>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
    ...CARD_SHADOW,
  },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },

  bar: {
    backgroundColor: UI.surfaceAlt,
    marginHorizontal: UI.cardMarginH,
    borderRadius: UI.radius,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
    overflow: "hidden",
    ...BEVEL,
  },
  indicator: {
    height: "100%",
    borderRadius: UI.radius,
    backgroundColor: tint(UI.violet, 0.26),
  },
});
