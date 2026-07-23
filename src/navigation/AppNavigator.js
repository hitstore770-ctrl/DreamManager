import { I18nManager } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import AddDreamScreen from "../screens/AddDreamScreen";
import ArcadeScreen from "../screens/ArcadeScreen";
import DashboardScreen from "../screens/DashboardScreen";
import DreamDetailScreen from "../screens/DreamDetailScreen";
import LoginScreen from "../screens/LoginScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ToolScreen from "../screens/ToolScreen";
import DrawerContent from "./DrawerContent";
import { TOOLS } from "./toolsRegistry";

const RootStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// The main authed experience: a side drawer holding the Dashboard, all nine
// tools (grouped in DrawerContent), Arcade and Settings.
function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerPosition: I18nManager.isRTL ? "right" : "left",
        drawerStyle: { width: 300 },
        swipeEdgeWidth: 60,
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      {TOOLS.map((tool) => (
        <Drawer.Screen
          key={tool.key}
          name={tool.key}
          component={ToolScreen}
          initialParams={{ toolKey: tool.key }}
        />
      ))}
      <Drawer.Screen name="Arcade" component={ArcadeScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <RootStack.Screen name="Main" component={MainDrawer} />
          <RootStack.Screen name="DreamDetail" component={DreamDetailScreen} />
          <RootStack.Screen
            name="AddDream"
            component={AddDreamScreen}
            options={{ presentation: "modal" }}
          />
        </>
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}
