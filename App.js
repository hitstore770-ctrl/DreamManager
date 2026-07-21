import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/context/AuthContext";
import { DreamProvider } from "./src/context/DreamContext";
import AppNavigator from "./src/navigation/AppNavigator";

// The app is Hebrew-only for now, so force RTL layout app-wide.
// On native builds this takes full effect after the next app reload.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DreamProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </DreamProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
