import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";

import { AuthProvider } from "./src/context/AuthContext";
import { DreamProvider } from "./src/context/DreamContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { COLORS } from "./src/utils/theme";

// The app is Hebrew-only for now, so force RTL layout app-wide.
// On native builds this takes full effect after the next app reload.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

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
