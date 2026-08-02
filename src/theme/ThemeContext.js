// Dark/Light engine. Primary signal is the device's system appearance;
// when that's unavailable (some web contexts report null until the OS is
// asked directly) it falls back to the device's local clock — dark from
// 19:00 to 07:00 — so the app is never stuck in the wrong mode.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { useSettings } from "../settings/SettingsContext";

// A small, shared corner-radius scale so cards/sheets/controls read as one
// consistent system instead of every screen picking its own number.
export const RADIUS = { sm: 10, md: 14, lg: 16 };

const LIGHT = {
  scheme: "light",
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F1EE",
  border: "#E7E5E1",
  text: "#1A1A19",
  textMuted: "#8A8781",
  accent: "#2F6F62",
  onAccent: "#FFFFFF",
  danger: "#C0392B",
  success: "#2F8F4E",
  codeBg: "#F0EEE8",
  quoteBorder: "#D8D5CD",
  overlay: "rgba(20, 20, 18, 0.35)",
  // Cards read as soft, floating surfaces in light mode -- a shadow instead
  // of a hard 1px border reads as "premium" rather than "outlined form."
  cardShadow: {
    shadowColor: "#1A1A19",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
};

const DARK = {
  scheme: "dark",
  // A sophisticated deep slate, not pure black -- #000 crushes shadows and
  // reads as "screen off," not "premium." Surface/surfaceAlt step up in
  // lightness from there so cards still have real tonal separation.
  bg: "#1E1E24",
  surface: "#27272F",
  surfaceAlt: "#2E2E38",
  border: "#38384380",
  text: "#F1F0F4",
  textMuted: "#9E9DAA",
  accent: "#6BBBA0",
  onAccent: "#0B0B0A",
  danger: "#E5695A",
  success: "#57C285",
  codeBg: "#26262F",
  quoteBorder: "#43434F",
  overlay: "rgba(0, 0, 0, 0.6)",
  // Cards get real depth here too now, not just flat tone contrast --
  // still subtle (low opacity, tight radius) so it reads as a soft lift
  // rather than a harsh drop shadow against the dark surface.
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
};

function timeBasedScheme() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 19 ? "dark" : "light";
}

function currentScheme() {
  return Appearance.getColorScheme() || timeBasedScheme();
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { themeMode, accentColor } = useSettings();
  const [scheme, setScheme] = useState(currentScheme);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme || timeBasedScheme());
    });
    // Catches the day/night boundary on platforms where Appearance never
    // fires a change event of its own (no OS-level dark mode to toggle).
    const poll = setInterval(() => {
      if (!Appearance.getColorScheme()) setScheme(timeBasedScheme());
    }, 5 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, []);

  // Settings' explicit Light/Dark override wins over the system signal;
  // "system" (the default) falls back to the existing Appearance/clock logic.
  const effectiveScheme = themeMode === "light" || themeMode === "dark" ? themeMode : scheme;

  const theme = useMemo(() => {
    const base = effectiveScheme === "dark" ? DARK : LIGHT;
    return accentColor ? { ...base, accent: accentColor } : base;
  }, [effectiveScheme, accentColor]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
