import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import NoteEditorScreen from "../screens/NoteEditorScreen";
import NotesHubScreen from "../screens/NotesHubScreen";
import BusinessScreen from "../screens/BusinessScreen";
import DreamsScreen from "../screens/DreamsScreen";
import ToolsScreen from "../screens/ToolsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { FONTS } from "../utils/theme";
import { UI } from "../utils/ui";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// iOS-style bottom tab bar. Five tabs, Notes (פתקים) is the center/default.
// Declared left→right as Tools/Dreams/Notes/Business/Settings so the natural
// RTL reading (rightmost first) is: הגדרות · העסק שלי · פתקים · חלומות · כלים.
// Feather line icons — one thin stroke weight across the whole bar.
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

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Notes"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: UI.blue,
        tabBarInactiveTintColor: UI.inkMuted,
        tabBarStyle: {
          backgroundColor: UI.surface,
          borderTopColor: UI.hairline,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 11, marginTop: 2 },
        tabBarIcon: ({ focused }) => (
          <Icon name={TAB_ICON[route.name]} size={22} color={focused ? UI.blue : UI.inkMuted} />
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
