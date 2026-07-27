import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import ContextualAiChatScreen from "../screens/ContextualAiChatScreen";
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

// Five tabs, Notes (פתקים) centre and default. Declared left→right as
// Tools/Dreams/Notes/Business/Settings so the natural RTL reading — rightmost
// first — is: הגדרות · העסק שלי · פתקים · חלומות · כלים.
//
// Feather line icons only; the bar carries no emoji.
const TAB_ICON = {
  Notes: "edit-3",
  Dreams: "star",
  Tools: "grid",
  Business: "briefcase",
  Settings: "settings",
};
const TAB_LABEL = {
  Notes: "פתקים",
  Dreams: "חלומות",
  Tools: "כלים",
  Business: "העסק שלי",
  Settings: "הגדרות",
};

// The active tab's icon sits in a tinted violet chip.
const ACTIVE_CHIP = {
  minWidth: 46,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: UI.violet + "16",
};
const INACTIVE_CHIP = { minWidth: 46, height: 28, alignItems: "center", justifyContent: "center" };

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Notes"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: UI.violet,
        tabBarInactiveTintColor: UI.inkMuted,
        // Floating glass bar: detached from the edges, translucent, lit by a
        // violet halo instead of a hairline.
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 14,
          // Tall enough that Hebrew descenders in the labels clear the edge.
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
            <Icon name={TAB_ICON[route.name]} size={21} color={focused ? UI.violet : UI.inkMuted} />
          </View>
        ),
        tabBarLabel: TAB_LABEL[route.name],
      })}
    >
      <Tab.Screen name="Tools" component={ToolsScreen} />
      <Tab.Screen name="Dreams" component={DreamsScreen} />
      <Tab.Screen name="Notes" component={NotesHubScreen} />
      <Tab.Screen name="Business" component={BusinessScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
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
    <RootStack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {user ? (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
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
        </>
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}
