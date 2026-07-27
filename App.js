import "react-native-gesture-handler";

import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Per-weight entry points, not the package barrel: the barrel registers all
// seven Assistant weights as assets even though the app loads five.
import { Assistant_300Light } from "@expo-google-fonts/assistant/300Light";
import { Assistant_400Regular } from "@expo-google-fonts/assistant/400Regular";
import { Assistant_500Medium } from "@expo-google-fonts/assistant/500Medium";
import { Assistant_600SemiBold } from "@expo-google-fonts/assistant/600SemiBold";
import { Assistant_700Bold } from "@expo-google-fonts/assistant/700Bold";

import ErrorBoundary from "./src/components/ErrorBoundary";
import PinLock from "./src/components/PinLock";
import { AuthProvider } from "./src/context/AuthContext";
import { DreamProvider } from "./src/context/DreamContext";
import { NotesProvider } from "./src/context/NotesContext";
import { SettingsProvider, useSettings } from "./src/context/SettingsContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { UI } from "./src/utils/ui";

// React Navigation paints every scene container with theme.colors.background,
// and the default is a light grey — which shows through as a white page behind
// any screen whose own background is transparent (the savings pager, the tab
// scenes). Theming the container is the one place that fixes all three
// navigators at once.
const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: UI.bg,
    card: UI.surface,
    text: UI.ink,
    border: UI.hairline,
    primary: UI.violet,
  },
};

// The app is Hebrew-only for now, so force RTL layout app-wide.
// On native builds this takes full effect after the next app reload.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Inner shell: has access to the settings context, so it can theme the status
// bar and gate the whole app behind the PIN lock overlay on launch.
function Shell() {
  const { theme, loaded, pinRequired, pin, setUnlocked } = useSettings();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: UI.bg }}>
      <NavigationContainer theme={NAV_THEME}>
        <AppNavigator />
      </NavigationContainer>
      {pinRequired && (
        <PinLock mode="unlock" expected={pin} onSuccess={() => setUnlocked(true)} />
      )}
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  // Assistant, app-wide — one family, light-to-semibold.
  const [fontsLoaded, fontError] = useFonts({
    Assistant_300Light,
    Assistant_400Regular,
    Assistant_500Medium,
    Assistant_600SemiBold,
    Assistant_700Bold,
  });

  // Only block on the very first load. If a font fails to fetch (e.g. flaky
  // network in a web preview), still render the app with system-font fallbacks
  // rather than hanging forever on a blank screen.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SettingsProvider>
            <AuthProvider>
              <DreamProvider>
                <NotesProvider>
                  <Shell />
                </NotesProvider>
              </DreamProvider>
            </AuthProvider>
          </SettingsProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
