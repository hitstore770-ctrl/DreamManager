import { ActivityIndicator, I18nManager, Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Icon from "../components/Icon";
import { withBack } from "../components/BackFab";
import { useAuth } from "../context/AuthContext";
import { MoneyProvider } from "../context/MoneyContext";
import BusinessScreen from "../screens/BusinessScreen";
import CashRegisterScreen from "../screens/CashRegisterScreen";
import ContextualAiChatScreen from "../screens/ContextualAiChatScreen";
import DreamsNotesHubScreen from "../screens/DreamsNotesHubScreen";
import DreamsScreen from "../screens/DreamsScreen";
import LiveAiScreen from "../screens/LiveAiScreen";
import BiometricGate from "../components/BiometricGate";
import CashFlowScreen from "../screens/CashFlowScreen";
import MoneyDashboardScreen from "../screens/MoneyDashboardScreen";
import MyMoneyHubScreen from "../screens/MyMoneyHubScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import SavingsHubScreen from "../screens/money/SavingsHubScreen";
import SavingsScreen from "../screens/SavingsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ToolsWorkshopScreen from "../screens/ToolsWorkshopScreen";
import TransitAssistantScreen from "../screens/TransitAssistantScreen";
import VisionCameraScreen from "../screens/VisionCameraScreen";
import { FONTS } from "../utils/theme";
import { BEVEL, CARD_SHADOW, UI, tint } from "../utils/ui";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Five tabs, and Noa is the middle one.
//
// "Exact centre" is only expressible with an odd count, which is why the tab
// list stays at five after the Core was removed: four tabs have no middle
// slot, and a floating button parked over the seam between slots 2 and 3 is
// centred by eyeball rather than by layout. Cash Flow takes the freed slot, so
// Noa sits in position 3 of 5 — genuinely central, on any screen width.
//
// Declaration order is the RTL reading order: first declared sits rightmost,
// because the app forces RTL and the bar is a flex row.
const ZONES = [
  { name: "Money", component: MyMoneyHubScreen, icon: "trending-up", label: "הכסף שלי" },
  { name: "Library", component: DreamsNotesHubScreen, icon: "star", label: "חלומות" },
  { name: "Assistant", component: LiveAiScreen, icon: "message-circle", label: "נועה", center: true },
  { name: "CashFlow", component: MoneyDashboardScreen, icon: "bar-chart-2", label: "תזרים" },
  { name: "Workshop", component: ToolsWorkshopScreen, icon: "tool", label: "כלים" },
];

// Under real RTL a flex row lays itself out right to left, so declaring in RTL
// order is all it takes. react-native-web reports isRTL === false — forceRTL
// does not apply there — so the row runs left to right and the bar would come
// out mirrored in the web preview. Reversing the declaration in that case is
// the same compensation the rest of this codebase makes with its
// `isRTL ? "row" : "row-reverse"` idiom.
//
// It has to be the mount order rather than a style: React Navigation builds
// the bar's row from these children, and `tabBarStyle` lands on the outer
// container, so a flexDirection override there does nothing.
const ORDERED_ZONES = I18nManager.isRTL ? ZONES : [...ZONES].reverse();

const ICONS = Object.fromEntries(ZONES.map((z) => [z.name, z.icon]));
const LABELS = Object.fromEntries(ZONES.map((z) => [z.name, z.label]));

// The bar is a slip of frosted white paper: light blur so whatever scrolls
// under it stays faintly visible, and a near-opaque white wash on top so the
// labels never have to fight the content. With five items it also has to stay
// narrow, so the active state is a tinted pill rather than anything that adds
// height.
function TabBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(255,255,255,0.94)", "rgba(255,255,255,0.86)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const ACTIVE_CHIP = {
  minWidth: 44,
  height: 30,
  borderRadius: 15,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: tint(UI.violet, 0.12),
};
const INACTIVE_CHIP = { minWidth: 44, height: 30, alignItems: "center", justifyContent: "center" };

const CENTERS = new Set(ZONES.filter((z) => z.center).map((z) => z.name));

// Noa's tab is a raised disc rather than an icon in a row. It lifts above the
// bar's top edge, which is what makes it read as the primary action instead of
// as one of five equals — and the negative margin is why the bar itself has
// `overflow: visible` below.
function CenterTabIcon({ focused }) {
  return (
    <View style={st.centerWrap}>
      <LinearGradient
        colors={focused ? ["#8B5CF6", "#6D28D9"] : ["#A78BFA", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.centerDisc}
      >
        <Icon name="message-circle" size={24} color="#FFFFFF" />
      </LinearGradient>
      {focused && <View style={st.centerDot} />}
    </View>
  );
}

const screenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: UI.violet,
  tabBarInactiveTintColor: UI.inkMuted,
  tabBarBackground: TabBackground,
  tabBarStyle: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    height: 78,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: UI.radiusLg,
    backgroundColor: UI.glass,
    borderTopWidth: 0,
    // Noa's disc lifts above the bar, so the bar must not clip it.
    overflow: "visible",
    ...BEVEL,
    ...CARD_SHADOW,
  },
  tabBarItemStyle: { borderRadius: UI.radiusSm },
  tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10, lineHeight: 15, marginTop: 2 },
  tabBarIcon: ({ focused }) =>
    CENTERS.has(route.name) ? (
      <CenterTabIcon focused={focused} />
    ) : (
      <View style={focused ? ACTIVE_CHIP : INACTIVE_CHIP}>
        <Icon name={ICONS[route.name]} size={20} color={focused ? UI.violet : UI.inkMuted} />
      </View>
    ),
  tabBarLabel: LABELS[route.name],
});

function ZoneTabs() {
  // Noa is the landing tab as well as the centre one: she is the thing the app
  // is for, and the Core screen this used to open no longer exists.
  return (
    <Tab.Navigator initialRouteName="Assistant" screenOptions={screenOptions}>
      {ORDERED_ZONES.map((z) => (
        <Tab.Screen key={z.name} name={z.name} component={z.component} />
      ))}
    </Tab.Navigator>
  );
}

const st = StyleSheet.create({
  // Lifted above the bar's top edge. The bar sets overflow: visible for this.
  centerWrap: { alignItems: "center", justifyContent: "center", marginTop: -22 },
  centerDisc: {
    width: 56,
    height: 56,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  centerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: UI.violet, marginTop: 5 },
});

function ConnectingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={UI.violet} />
    </View>
  );
}

export default function AppNavigator() {
  const { user, authLoading } = useAuth();

  // Hold a plain splash until Firebase reports whether a session exists —
  // otherwise a returning user sees the login screen flash before the app.
  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={UI.violet} />
      </View>
    );
  }

  return (
    <MoneyProvider>
      {/* Everything behind the gate. Wrapping the navigator rather than each
          screen means there is no route that can be reached around it. */}
      <BiometricGate>
      {/* Every push slides in horizontally. Under forced RTL the platform
          mirrors the direction on its own, so a screen enters from the side
          the back gesture will send it out of. */}
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 260,
          gestureEnabled: true,
        }}
      >
        {user ? (
          <>
            <RootStack.Screen name="Main" component={ZoneTabs} />

            {/* Money. CashRegister is the eight-zone micro-operations hub —
                the register, the floor tools around it, and the modules that
                used to be reachable only through the "העסק שלי" tab. It slides
                up rather than across because it is a mode you drop into and
                leave, not a place in the tab hierarchy. */}
            <RootStack.Screen
              name="CashRegister"
              component={CashRegisterScreen}
              options={{ animation: "slide_from_right" }}
            />
            {/* The dashboard is the tab; logging a movement is a push from
                it, so the entry form stays reachable without occupying a tab
                of its own. */}
            <RootStack.Screen name="CashFlowDetail" component={withBack(CashFlowScreen)} />
            <RootStack.Screen name="SavingsHub" component={SavingsHubScreen} />
            <RootStack.Screen
              name="Savings"
              component={SavingsScreen}
              options={{ animation: "slide_from_right" }}
            />

            {/* Pushed from the Library zone: the full dream board, and the
                note editor, which opens over the tab bar. */}
            <RootStack.Screen name="DreamsFull" component={withBack(DreamsScreen)} />
            <RootStack.Screen
              name="NoteEditor"
              component={NoteEditorScreen}
              options={{ animation: "slide_from_right" }}
            />

            {/* Per-item AI thread. Opened with { threadId, title, itemData }
                from any details screen — see the usage block in the file. */}
            <RootStack.Screen
              name="ContextualAiChat"
              component={ContextualAiChatScreen}
              options={{ animation: "slide_from_right" }}
            />
            <RootStack.Screen
              name="TransitAssistant"
              component={TransitAssistantScreen}
              options={{ animation: "slide_from_right" }}
            />

            {/* Reached from the money hub and the Core. Kept as stack screens
                rather than tabs: the blueprint calls for exactly five zones,
                and deleting a working POS and settings screen to honour that
                would be a much larger change than it asked for. */}
            <RootStack.Screen name="Business" component={withBack(BusinessScreen)} />
            <RootStack.Screen name="Settings" component={withBack(SettingsScreen)} />

            {/* Full screen, and with no animation of its own: a viewfinder
                that slides in reads as a panel rather than as the camera
                taking over. */}
            <RootStack.Screen
              name="VisionCamera"
              component={VisionCameraScreen}
              options={{ animation: "fade", presentation: "fullScreenModal" }}
            />
          </>
        ) : (
          // Anonymous sign-in happens on its own in AuthContext, so this is a
          // brief connecting state rather than a wall the user has to act on.
          <RootStack.Screen name="Connecting" component={ConnectingScreen} />
        )}
      </RootStack.Navigator>
      </BiometricGate>
    </MoneyProvider>
  );
}
