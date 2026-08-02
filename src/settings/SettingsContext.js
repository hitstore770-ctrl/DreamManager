import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { getAllSettings, setSetting } from "../db/settingsRepo";

const DEFAULTS = {
  themeMode: "system", // "system" | "light" | "dark"
  accentColor: null, // null = theme's own default accent
  fontScale: 1,
};

const SettingsContext = createContext(null);

// Small, DB-backed preferences (theme override, accent color, font scale)
// -- kept separate from ThemeContext (which stays pure light/dark logic)
// so ThemeContext can layer these overrides on top without owning
// persistence itself.
export function SettingsProvider({ children }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    let alive = true;
    getAllSettings(db).then((row) => {
      if (!alive) return;
      setSettings({
        themeMode: row.themeMode || DEFAULTS.themeMode,
        accentColor: row.accentColor || DEFAULTS.accentColor,
        fontScale: row.fontScale ? Number(row.fontScale) : DEFAULTS.fontScale,
      });
    });
    return () => {
      alive = false;
    };
  }, [db]);

  const update = useCallback(
    (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSetting(db, key, value ?? "").catch(() => {});
    },
    [db]
  );

  const value = {
    ...settings,
    setThemeMode: (v) => update("themeMode", v),
    setAccentColor: (v) => update("accentColor", v),
    setFontScale: (v) => update("fontScale", v),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
