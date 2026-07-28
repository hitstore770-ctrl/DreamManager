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
import CashRegisterScreen from "../screens/money/CashRegisterScreen";
import ContextualAiChatScreen from "../screens/ContextualAiChatScreen";
import DreamsNotesHubScreen from "../screens/DreamsNotesHubScreen";
import DreamsScreen from "../screens/DreamsScreen";
import LiveAiScreen from "../screens/LiveAiScreen";
import LoginScreen from "../screens/LoginScreen";
import MainDashboardScreen from "../screens/MainDashboardScreen";
import MyMoneyHubScreen from "../screens/MyMoneyHubScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import SavingsHubScreen from "../screens/money/SavingsHubScreen";
import SavingsScreen from "../screens/SavingsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ToolsWorkshopScreen from "../screens/ToolsWorkshopScreen";
import TransitAssistantScreen from "../screens/TransitAssistantScreen";
import { FONTS } from "../utils/theme";
import { BEVEL, CARD_SHADOW, UI, tint } from "../utils/ui";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Five zones.
//
// Declaration order is the RTL reading order — first declared sits rightmost,
// because the app forces RTL and the bar is a flex row. So the money hub is
// under the right thumb, the assistant next to it, the Core in the middle,
// and the two libraries out to the left.
const ZONES = [
  { name: "Money", component: MyMoneyHubScreen, icon: "trending-up", label: "הכסף שלי" },
  { name: "Assistant", component: LiveAiScreen, icon: "message-circle", label: "נועה" },
  { name: "Core", component: MainDashboardScreen, icon: "hexagon", label: "הליבה" },
  { name: "Library", component: DreamsNotesHubScreen, icon: "star", label: "חלומות" },
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
    overflow: "hidden",
    ...BEVEL,
    ...CARD_SHADOW,
  },
  tabBarItemStyle: { borderRadius: UI.radiusSm },
  tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10, lineHeight: 15, marginTop: 2 },
  tabBarIcon: ({ focused }) => (
    <View style={focused ? ACTIVE_CHIP : INACTIVE_CHIP}>
      <Icon name={ICONS[route.name]} size={20} color={focused ? UI.violet : UI.inkMuted} />
    </View>
  ),
  tabBarLabel: LABELS[route.name],
});

function ZoneTabs() {
  return (
    <Tab.Navigator initialRouteName="Core" screenOptions={screenOptions}>
      {ORDERED_ZONES.map((z) => (
        <Tab.Screen key={z.name} name={z.name} component={z.component} />
      ))}
    </Tab.Navigator>
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
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={ZoneTabs} />

            {/* Money */}
            <RootStack.Screen
              name="CashRegister"
              component={CashRegisterScreen}
              options={{ animation: "slide_from_bottom" }}
            />
            <RootStack.Screen name="SavingsHub" component={SavingsHubScreen} />
            <RootStack.Screen
              name="Savings"
              component={SavingsScreen}
              options={{ animation: "slide_from_bottom" }}
            />

            {/* Pushed from the Library zone: the full dream board, and the
                note editor, which opens over the tab bar. */}
            <RootStack.Screen name="DreamsFull" component={withBack(DreamsScreen)} />
            <RootStack.Screen
              name="NoteEditor"
              component={NoteEditorScreen}
              options={{ animation: "slide_from_bottom" }}
            />

            {/* Per-item AI thread. Opened with { threadId, title, itemData }
                from any details screen — see the usage block in the file. */}
            <RootStack.Screen
              name="ContextualAiChat"
              component={ContextualAiChatScreen}
              options={{ animation: "slide_from_bottom" }}
            />
            <RootStack.Screen
              name="TransitAssistant"
              component={TransitAssistantScreen}
              options={{ animation: "slide_from_bottom" }}
            />

            {/* Reached from the money hub and the Core. Kept as stack screens
                rather than tabs: the blueprint calls for exactly five zones,
                and deleting a working POS and settings screen to honour that
                would be a much larger change than it asked for. */}
            <RootStack.Screen name="Business" component={withBack(BusinessScreen)} />
            <RootStack.Screen name="Settings" component={withBack(SettingsScreen)} />
          </>
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </MoneyProvider>
  );
}
