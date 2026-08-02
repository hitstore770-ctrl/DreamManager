// Dark/Light engine. Primary signal is the device's system appearance;
// when that's unavailable (some web contexts report null until the OS is
// asked directly) it falls back to the device's local clock — dark from
// 19:00 to 07:00 — so the app is never stuck in the wrong mode.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";

// A small, shared corner-radius scale so cards/sheets/controls read as one
// consistent system instead of every screen picking its own number.
export const RADIUS = { sm: 10, md: 14, lg: 18 };

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
  bg: "#121212",
  surface: "#1B1B1A",
  surfaceAlt: "#242423",
  border: "#2E2E2C",
  text: "#EDEBE6",
  textMuted: "#8E8B85",
  accent: "#5FA98E",
  onAccent: "#0B0B0A",
  danger: "#E5695A",
  success: "#57C285",
  codeBg: "#1F211F",
  quoteBorder: "#3A3A38",
  overlay: "rgba(0, 0, 0, 0.55)",
  // Shadows barely read against a dark background, so dark mode gets its
  // depth from flat surface-tone contrast (surface vs. surfaceAlt vs. bg)
  // instead -- a no-op shadow here, deliberately.
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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

  const theme = useMemo(() => (scheme === "dark" ? DARK : LIGHT), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
