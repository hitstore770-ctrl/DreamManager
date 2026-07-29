import { ActivityIndicator, I18nManager, View } from "react-native";
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
import { UI } from "../utils/ui";

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
  { name: "Assistant", component: LiveAiScreen, icon: "message-circle", label: "נועה" },
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

// The bar is a bar.
//
// It was a floating, blurred, rounded card with a raised violet disc lifted
// out of it for the assistant — the shape every AI app shipped. This is the
// platform convention instead: attached to the bottom edge, opaque white, one
// hairline rule along the top, and five equal items. The active state is ink
// against grey, which is all a tab bar has ever needed to say.

// No tinted pill behind the active icon. Colour carries meaning in this
// system, and "which tab am I on" is already carried by the icon and label
// going from grey to ink.
const CHIP = { minWidth: 44, height: 24, alignItems: "center", justifyContent: "center" };

// The assistant is one of five, not a floating action button.
//
// A raised, glowing, gradient-filled disc in the middle of a tab bar is the
// single loudest "this is an AI app" signal in the whole interface. Noa keeps
// the centre slot — she is still the thing you reach for most — but she gets
// there by being in the middle of five, not by being physically larger.

const screenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: UI.ink,
  tabBarInactiveTintColor: UI.inkMuted,
  tabBarStyle: {
    // Attached, not floating. No blur, no radius, no shadow — a hairline is
    // what separates the bar from the content above it.
    backgroundColor: UI.surface,
    borderTopWidth: 1,
    borderTopColor: UI.hairline,
    // The bar has to be taller than icon + label, with slack.
    //
    // At 64 with 8pt padding the tab was exactly as tall as its contents, and
    // the label flex-shrank to a 4px sliver — present in the DOM, invisible on
    // screen, and easy to mistake for a font problem. Hebrew ascenders and
    // descenders need the full 14pt line, so the bar is sized to give the
    // label its line height with room left over rather than exactly enough.
    height: 70,
    paddingTop: 7,
    paddingBottom: 9,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItemStyle: { paddingVertical: 2 },
  tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  tabBarIcon: ({ focused }) => (
    <View style={CHIP}>
      <Icon name={ICONS[route.name]} size={21} color={focused ? UI.ink : UI.inkMuted} />
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
