import "react-native-gesture-handler";

import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect } from "react";
// Per-weight entry points, not the package barrel: the barrel registers all
// nine Heebo weights as assets even though the app loads four.
import { Heebo_300Light } from "@expo-google-fonts/heebo/300Light";
import { Heebo_400Regular } from "@expo-google-fonts/heebo/400Regular";
import { Heebo_500Medium } from "@expo-google-fonts/heebo/500Medium";
import { Heebo_700Bold } from "@expo-google-fonts/heebo/700Bold";

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

// Hold the native splash until the fonts are in. Without this the first frame
// paints in the system Hebrew face and then reflows to Heebo — the metrics
// differ, so every line jumps. preventAutoHideAsync is called at module scope,
// before the first render, which is the only point early enough to matter.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or no splash on this platform (web). Not a failure.
});

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
  // Heebo, app-wide — one family, four weights, no system fallback.
  const [fontsLoaded, fontError] = useFonts({
    Heebo_300Light,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
  });

  const ready = fontsLoaded || !!fontError;

  // Drop the splash on the frame the first real content is laid out, not on a
  // timer — onLayout fires after that layout pass, so there is no window where
  // the splash is gone and the tree is still blank.
  const onReady = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // A font that never resolves must not strand the user on a splash forever —
  // on web the files come over the network and can simply fail. After three
  // seconds the app renders regardless; Heebo swaps in if it arrives later.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onReady}>
        <SafeAreaProvider>
          {/* Bottom sheets are portalled to this provider, which is why it has
              to sit above the navigators rather than inside a screen. */}
          <BottomSheetModalProvider>
            <SettingsProvider>
              <AuthProvider>
                <DreamProvider>
                  <NotesProvider>
                    <Shell />
                  </NotesProvider>
                </DreamProvider>
              </AuthProvider>
            </SettingsProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
