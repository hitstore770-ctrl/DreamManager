import "react-native-gesture-handler";

import { useCallback } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { DATABASE_NAME, migrate } from "./src/db/schema";
import RootNavigator from "./src/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or no splash on this platform (web). Not a failure.
});

// Inner shell: needs ThemeContext to color the nav container and status bar,
// and sits above the SQLiteProvider only so its background paints instantly
// (SQLiteProvider itself renders nothing while the database opens).
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
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <NavigationContainer theme={navTheme} onReady={onReady}>
          <RootNavigator />
        </NavigationContainer>
      </SQLiteProvider>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
