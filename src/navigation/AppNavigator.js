import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { MoneyProvider } from "../context/MoneyContext";
import CashRegisterScreen from "../screens/money/CashRegisterScreen";
import ContextualAiChatScreen from "../screens/ContextualAiChatScreen";
import LiveAiScreen from "../screens/LiveAiScreen";
import MyMoneyDashboard from "../screens/MyMoneyDashboard";
import SavingsHubScreen from "../screens/money/SavingsHubScreen";
import SavingsScreen from "../screens/SavingsScreen";
import TransitAssistantScreen from "../screens/TransitAssistantScreen";
import LoginScreen from "../screens/LoginScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import NotesHubScreen from "../screens/NotesHubScreen";
import BusinessScreen from "../screens/BusinessScreen";
import DreamsScreen from "../screens/DreamsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ToolsScreen from "../screens/ToolsScreen";
import { FONTS } from "../utils/theme";
import { UI, glow } from "../utils/ui";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ClassicTab = createBottomTabNavigator();

// Two zones, per the blueprint: the live assistant and the money hub.
//
// The five original screens are not gone — they live in ClassicTabs, reachable
// from the money hub's "שאר האפליקציה" list. Deleting a working POS, 43 tools
// and the notes system to honour a two-tab layout would have been a much
// larger change than the blueprint asked for.
const ZONE_ICON = { Assistant: "message-circle", Money: "trending-up" };
const ZONE_LABEL = { Assistant: "עוזר חכם", Money: "הכסף שלי" };

const CLASSIC_ICON = {
  Notes: "edit-3",
  Dreams: "star",
  Tools: "grid",
  Business: "briefcase",
  Settings: "settings",
};
const CLASSIC_LABEL = {
  Notes: "פתקים",
  Dreams: "חלומות",
  Tools: "כלים",
  Business: "העסק שלי",
  Settings: "הגדרות",
};

const ACTIVE_CHIP = {
  minWidth: 46,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: UI.violet + "16",
};
const INACTIVE_CHIP = { minWidth: 46, height: 28, alignItems: "center", justifyContent: "center" };

// Floating glass bar, shared by both tab navigators.
const barOptions = (iconMap, labelMap) => ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: UI.violet,
  tabBarInactiveTintColor: UI.inkMuted,
  tabBarStyle: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    height: 78,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: UI.radius,
    backgroundColor: UI.glass,
    borderTopWidth: 0,
    ...glow(UI.violet, 0.18),
  },
  tabBarItemStyle: { borderRadius: UI.radiusSm },
  tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  tabBarIcon: ({ focused }) => (
    <View style={focused ? ACTIVE_CHIP : INACTIVE_CHIP}>
      <Icon name={iconMap[route.name]} size={21} color={focused ? UI.violet : UI.inkMuted} />
    </View>
  ),
  tabBarLabel: labelMap[route.name],
});

function ZoneTabs() {
  return (
    <Tab.Navigator initialRouteName="Money" screenOptions={barOptions(ZONE_ICON, ZONE_LABEL)}>
      <Tab.Screen name="Assistant" component={LiveAiScreen} />
      <Tab.Screen name="Money" component={MyMoneyDashboard} />
    </Tab.Navigator>
  );
}

function ClassicTabs() {
  return (
    <ClassicTab.Navigator
      initialRouteName="Notes"
      screenOptions={barOptions(CLASSIC_ICON, CLASSIC_LABEL)}
    >
      <ClassicTab.Screen name="Tools" component={ToolsScreen} />
      <ClassicTab.Screen name="Dreams" component={DreamsScreen} />
      <ClassicTab.Screen name="Notes" component={NotesHubScreen} />
      <ClassicTab.Screen name="Business" component={BusinessScreen} />
      <ClassicTab.Screen name="Settings" component={SettingsScreen} />
    </ClassicTab.Navigator>
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
          <RootStack.Screen name="Classic" component={ClassicTabs} />
          <RootStack.Screen
            name="CashRegister"
            component={CashRegisterScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <RootStack.Screen name="SavingsHub" component={SavingsHubScreen} />
          {/* The note editor opens full-screen over the tab bar. */}
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
          {/* אזור החיסכון — reached from the header of the Dreams tab. */}
          <RootStack.Screen
            name="Savings"
            component={SavingsScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          {/* עוזר תחב"ץ — reached from the Tools hub header. */}
          <RootStack.Screen
            name="TransitAssistant"
            component={TransitAssistantScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </>
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
      </RootStack.Navigator>
    </MoneyProvider>
  );
}
