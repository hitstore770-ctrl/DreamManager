import "react-native-gesture-handler";

import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, I18nManager, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
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
import { CloudSyncProvider } from "./src/context/CloudSyncContext";
import { NotesProvider } from "./src/context/NotesContext";
import { SettingsProvider, useSettings } from "./src/context/SettingsContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { loadApiKeys } from "./src/config/apiKeys";
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
  const { theme, loaded, pinRequired, pin, setUnlocked, animations } = useSettings();

  // The "animations" switch in Settings, applied at the one place that
  // reaches every animation in the app.
  //
  // Reanimated already has a global reduce-motion flag, and honouring it is
  // what every `entering=`, `layout=` and `withTiming` in this codebase does
  // for free — so the switch flips that flag rather than threading a prop
  // through forty-odd call sites (which would miss the ones inside worklets
  // entirely). Off means animations resolve instantly to their end state:
  // nothing disappears, it just stops moving.
  //
  // "Never" is not the on-state. With the switch on we defer to the OS
  // accessibility setting, so a user who has asked their phone for reduced
  // motion is not overridden by an app default.
  const reduceMotion = animations === false ? ReduceMotion.Always : ReduceMotion.System;

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: UI.bg }}>
      <ReducedMotionConfig mode={reduceMotion} />
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

  // Nothing renders until the four weights are in. Not "mostly in", and not
  // after a timer: a first frame painted in the system Hebrew face and then
  // reflowed to Heebo is the exact symptom that reads as "the font failed to
  // load", because the metrics differ enough that every line jumps.
  //
  // `fontError` is the one escape, and it is a real one rather than a timeout:
  // a font that genuinely cannot load must not brick the app forever, so a
  // reported failure lets the tree render in whatever face the platform has.
  const [gaveUp, setGaveUp] = useState(false);
  const ready = fontsLoaded || !!fontError || gaveUp;

  // Drop the splash on the frame the first real content is laid out, not on a
  // timer — onLayout fires after that layout pass, so there is no window where
  // the splash is gone and the tree is still blank.
  const onReady = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // The backstop, and the bug it replaces.
  //
  // This used to hide the splash on a 3s timer while the tree below still
  // returned null — so a slow font left the user looking at a blank white
  // screen with the splash already gone, which is worse than either state on
  // its own. The timeout now flips a flag that lets the app *render*; the
  // splash is only ever hidden once something is actually behind it.
  //
  // Eight seconds, not three: on a cold cellular connection the four files
  // regularly take longer than three, and cutting them off early guarantees
  // the unstyled flash this whole gate exists to prevent.
  // Pull any keys saved in Settings out of the keystore before the first
  // request can fire. Failing is fine — the .env values still apply.
  useEffect(() => {
    loadApiKeys().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) return undefined;
    const t = setTimeout(() => {
      console.warn("[fonts] load timed out — rendering in the platform face");
      setGaveUp(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  // Returning null here used to mean a genuinely blank screen for up to the
  // full eight seconds above — indistinguishable from a crash, and the exact
  // thing people report as "it hangs on a white screen". The gate still holds
  // the tree back for the reason described above; it just says so now.
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={UI.violet} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onReady}>
        <SafeAreaProvider>
          {/* Bottom sheets are portalled to this provider, which is why it has
              to sit above the navigators rather than inside a screen. */}
          <BottomSheetModalProvider>
            <SettingsProvider>
              <AuthProvider>
                {/* Inside AuthProvider because it needs the uid, and above
                    everything else because its listeners must be mounted
                    exactly once for the whole app. */}
                <CloudSyncProvider>
                  <DreamProvider>
                    <NotesProvider>
                      <Shell />
                    </NotesProvider>
                  </DreamProvider>
                </CloudSyncProvider>
              </AuthProvider>
            </SettingsProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
