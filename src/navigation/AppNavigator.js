import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import LoginScreen from "../screens/LoginScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import NotesHubScreen from "../screens/NotesHubScreen";
import {
  BusinessPlaceholder,
  DreamsPlaceholder,
  SettingsPlaceholder,
  TasksPlaceholder,
} from "../screens/TabPlaceholders";
import { FONTS } from "../utils/theme";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// iOS-style bottom tab bar. Five tabs, Notes (פתקים) is the default. Emoji
// icons + Heebo labels, accent tint when active, hairline top border — themed
// from the global settings so it follows light/dark + accent.
const TAB_ICON = {
  Notes: "🗒️",
  Dreams: "✨",
  Tasks: "✅",
  Business: "💼",
  Settings: "⚙️",
};
const TAB_LABEL = {
  Notes: "פתקים",
  Dreams: "חלומות",
  Tasks: "משימות",
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
      <Tab.Screen name="Notes" component={NotesHubScreen} />
      <Tab.Screen name="Dreams" component={DreamsPlaceholder} />
      <Tab.Screen name="Tasks" component={TasksPlaceholder} />
      <Tab.Screen name="Business" component={BusinessPlaceholder} />
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
