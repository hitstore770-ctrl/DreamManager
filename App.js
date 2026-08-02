import "react-native-gesture-handler";

import { useCallback, useEffect, useState } from "react";
import { I18nManager, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// Per-weight entry points, not the package barrel: the barrel registers
// every Rubik weight (incl. italics/black/extra-bold) as an asset even
// though the app only ever loads five of them.
import { Rubik_300Light } from "@expo-google-fonts/rubik/300Light";
import { Rubik_400Regular } from "@expo-google-fonts/rubik/400Regular";
import { Rubik_500Medium } from "@expo-google-fonts/rubik/500Medium";
import { Rubik_600SemiBold } from "@expo-google-fonts/rubik/600SemiBold";
import { Rubik_700Bold } from "@expo-google-fonts/rubik/700Bold";

import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { SettingsProvider } from "./src/settings/SettingsContext";
import { VaultProvider } from "./src/vault/VaultContext";
import { DATABASE_NAME, migrate } from "./src/db/schema";
import RootNavigator from "./src/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or no splash on this platform (web). Not a failure.
});

// Hebrew is RTL. On native, RN's I18nManager.forceRTL genuinely mirrors
// every flex layout in the app (marginStart/End, flexDirection, etc.) --
// but only from the *next* full app launch, which is exactly why this call
// sits here at module scope, before anything renders, rather than behind a
// runtime toggle: there's no in-app moment where flipping it would
// visually apply anyway.
//
// react-native-web's I18nManager is a permanent no-op stub (isRTL always
// reads false, forceRTL does nothing) -- RN-web was never wired for RTL by
// its maintainers, so on web this sets `dir="rtl"` on the document
// directly instead, which is the mechanism RN-web's own layout primitives
// actually key off of for logical properties.
if (Platform.OS === "web") {
  if (typeof document !== "undefined") document.documentElement.dir = "rtl";
} else if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Inner shell: needs ThemeContext to color the nav container and status
// bar. ThemeContext now layers Settings' DB-backed overrides (theme mode,
// accent color) on top of the system signal, so it -- and everything else
// here -- has to sit *inside* SQLiteProvider rather than above it as
// before; the native splash screen (still up until onReady fires) covers
// the brief window where SQLiteProvider itself renders nothing while the
// database opens, so there's no blank-screen gap in practice.
function Shell() {
  const theme = useTheme();

  const navTheme = {
    ...(theme.scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.scheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  // Fires once the navigator has actually laid out a screen — by then the
  // database is open and migrated too, since RootNavigator only mounts
  // after SQLiteProvider finishes. That's the one moment safe to drop the
  // splash without a gap where the screen is blank.
  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <NavigationContainer theme={navTheme} onReady={onReady}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
    </View>
  );
}

export default function App() {
  // Rubik, app-wide — one custom typeface across every weight the app uses,
  // bundled locally so it works fully offline, no system-font fallback.
  const [fontsLoaded, fontError] = useFonts({
    Rubik_300Light,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  // Nothing renders until the five weights are in. Not "mostly in," and not
  // after a timer: a first frame painted in the system font and then
  // reflowed to Rubik is the exact symptom that reads as "the font failed to
  // load" — the metrics differ enough that every line jumps.
  //
  // `fontError` is the one escape, and it's a real one rather than a
  // timeout: a font that genuinely cannot load must not brick the app
  // forever, so a reported failure lets the tree render in whatever face the
  // platform has.
  const [gaveUp, setGaveUp] = useState(false);
  const ready = fontsLoaded || !!fontError || gaveUp;

  // The backstop. Eight seconds, not three: on a cold connection the five
  // files can regularly take longer than three, and cutting them off early
  // guarantees the unstyled flash this whole gate exists to prevent.
  useEffect(() => {
    if (fontsLoaded || fontError) return undefined;
    const t = setTimeout(() => setGaveUp(true), 8000);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
          <SettingsProvider>
            <ThemeProvider>
              <VaultProvider>
                <Shell />
              </VaultProvider>
            </ThemeProvider>
          </SettingsProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
