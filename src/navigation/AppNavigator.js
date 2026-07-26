import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import LoginScreen from "../screens/LoginScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import NotesHubScreen from "../screens/NotesHubScreen";
import BusinessScreen from "../screens/BusinessScreen";
import DreamsScreen from "../screens/DreamsScreen";
import { SettingsPlaceholder, ToolsPlaceholder } from "../screens/TabPlaceholders";
import { FONTS } from "../utils/theme";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// iOS-style bottom tab bar. Five tabs, Notes (פתקים) is the center/default.
// Declared left→right as Tools/Dreams/Notes/Business/Settings so the natural
// RTL reading (rightmost first) is: הגדרות · העסק שלי · פתקים · חלומות · כלים.
const TAB_ICON = {
  Notes: "🗒️",
  Dreams: "✨",
  Tools: "🧰",
  Business: "💼",
  Settings: "⚙️",
};
const TAB_LABEL = {
  Notes: "פתקים",
  Dreams: "חלומות",
  Tools: "כלים",
  Business: "העסק שלי",
  Settings: "הגדרות",
};

function MainTabs() {
  const { theme } = useSettings();

  return (
    <Tab.Navigator
      initialRouteName="Notes"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.hairline,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 11 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{TAB_ICON[route.name]}</Text>
        ),
        tabBarLabel: TAB_LABEL[route.name],
      })}
    >
      <Tab.Screen name="Tools" component={ToolsPlaceholder} />
      <Tab.Screen name="Dreams" component={DreamsScreen} />
      <Tab.Screen name="Notes" component={NotesHubScreen} />
      <Tab.Screen name="Business" component={BusinessScreen} />
      <Tab.Screen name="Settings" component={SettingsPlaceholder} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          {/* The note editor opens full-screen over the tab bar. */}
          <RootStack.Screen name="NoteEditor" component={NoteEditorScreen} />
        </>
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}
