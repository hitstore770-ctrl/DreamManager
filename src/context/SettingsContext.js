import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Vibration } from "react-native";

import { FONT_SCALES, makeTheme } from "../utils/theme";

// Global, persisted app preferences — the single source of truth for the new
// premium shell: appearance (dark/light, accent, font scale), security
// (PIN, stealth mode), the audio/haptics engine, the active workspace mode,
// and the automation-rule scaffold.

const SETTINGS_KEY = "@dreammanager/settings";

export const WORKSPACES = [
  { key: "default", label: "רגיל", hint: "סדר ברירת מחדל" },
  { key: "pos", label: "מצב קופה", hint: "מכירות ומלאי קודם" },
  { key: "production", label: "מצב הפקה", hint: "עבודות והדפסה קודם" },
];

const DEFAULT_SETTINGS = {
  scheme: "light", // 'light' | 'dark'
  accentKey: "blue",
  fontScaleKey: "medium", // 'small' | 'medium' | 'large'
  stealth: false, // censor all financial numbers into ***
  sounds: true, // mechanical POS sounds vs silent
  haptics: "light", // 'off' | 'light' | 'heavy'
  workspace: "default",
  pin: null, // 4-digit string or null (no lock)
  automation: [], // [{ id, metric, op, threshold, label }]
};

const SettingsContext = createContext(undefined);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // Whether the PIN gate is currently satisfied for this app session.
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        // ignore — fall back to defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const update = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  // --- Derived theme + typography ------------------------------------------
  const theme = useMemo(
    () => makeTheme(settings.scheme, settings.accentKey),
    [settings.scheme, settings.accentKey]
  );
  const fontScale = FONT_SCALES[settings.fontScaleKey] ?? 1;

  // --- Helpers -------------------------------------------------------------

  // Censor a financial value to bullets when Stealth Mode is on.
  const censor = useCallback(
    (value) => (settings.stealth ? "•••••" : value),
    [settings.stealth]
  );

  // Haptic feedback, gated by the haptics setting.
  const haptic = useCallback(
    (kind = "light") => {
      if (settings.haptics === "off") return;
      const heavy = settings.haptics === "heavy";
      try {
        if (kind === "success") Vibration.vibrate(heavy ? [0, 40, 60, 40] : [0, 20, 40, 20]);
        else if (kind === "error") Vibration.vibrate(heavy ? 120 : 60);
        else Vibration.vibrate(heavy ? 35 : 12);
      } catch {
        // web / unsupported — no-op
      }
    },
    [settings.haptics]
  );

  // Mechanical "click" for POS actions. Sound assets aren't bundled yet, so
  // this rides on a very short haptic tick when sounds are enabled — a real
  // audio sample can be dropped in here later without changing callers.
  const playSound = useCallback(() => {
    if (!settings.sounds) return;
    haptic("light");
  }, [settings.sounds, haptic]);

  // --- Automation scaffold -------------------------------------------------
  const addRule = useCallback(
    (rule) => {
      update({
        automation: [
          ...settings.automation,
          { id: `${Date.now()}`, ...rule },
        ],
      });
    },
    [settings.automation, update]
  );
  const removeRule = useCallback(
    (id) => update({ automation: settings.automation.filter((r) => r.id !== id) }),
    [settings.automation, update]
  );

  const value = useMemo(
    () => ({
      ...settings,
      loaded,
      theme,
      fontScale,
      unlocked,
      setUnlocked,
      // whether a PIN gate should be shown on launch
      pinRequired: Boolean(settings.pin) && !unlocked,
      update,
      persist,
      censor,
      haptic,
      playSound,
      addRule,
      removeRule,
    }),
    [settings, loaded, theme, fontScale, unlocked, update, persist, censor, haptic, playSound, addRule, removeRule]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
