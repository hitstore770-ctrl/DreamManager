import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Vibration } from "react-native";

import { setHapticsEnabled, setHapticsLevel } from "../utils/haptics";
import { setCurrencySymbol } from "../utils/posStore";
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

export const DEFAULT_SETTINGS = {
  scheme: "light", // 'light' | 'dark'
  accentKey: "blue",
  fontScaleKey: "medium", // 'small' | 'medium' | 'large'
  stealth: false, // censor all financial numbers into ***
  sounds: true, // mechanical POS sounds vs silent
  haptics: "light", // 'off' | 'light' | 'heavy'
  workspace: "default",
  pin: null, // 4-digit string or null (no lock)
  automation: [], // [{ id, metric, op, threshold, label }]
  userName: "", // shown in the Settings profile group
  devMode: false, // unlocked by tapping the version line seven times

  // --- Business / POS ---
  vatRate: "17", // default VAT rate used by the pricing tools
  autoClearCart: true, // empty the POS cart automatically after a charge
  receiptFooter: "תודה שקניתם!", // appended to shared receipts and Z-reports
  currency: "₪", // symbol used by every money value in the app
  hapticsLevel: "light", // remembered level, re-applied when haptics turn on

  // --- Data & privacy ---
  cloudBackup: false, // mirror a snapshot to Firestore on change

  // --- Notifications ---
  lowStockAlerts: true, // warn when an inventory item drops below its floor
  dailyZReminder: false, // nightly nudge to close the register

  // --- Account & security ---
  // Whether the biometric gate runs on launch. Off by default: a lock the
  // user did not ask for, on a device that may have no enrolled biometric,
  // is a wall in front of their own register.
  biometricLock: false,

  // --- App preferences ---
  startupScreen: "Assistant", // which tab the app opens on
  animations: true, // entrance/spring animations; off saves battery and helps motion sensitivity

  // --- POS configuration ---
  maaserRate: "10", // % of profit set aside, shown alongside the VAT figure
  droneAllocPct: "15", // % of each sale's net profit auto-swept to the savings goal
  allowManualItems: true, // the "פריט ידני" button on the fast-food deck

  // --- Appearance ---
  themeMode: "light", // 'light' | 'dark' | 'system' — stored, not yet painted
  compactMode: false, // tighter list padding for tall/narrow screens
  imageCacheToken: 0, // bumped by "clear image cache" to force a re-fetch
  layoutBounds: false, // dev-only: outline the settings layout
};

const SettingsContext = createContext(undefined);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // Whether the PIN gate is currently satisfied for this app session.
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let alive = true;

    // AsyncStorage normally settles in milliseconds, but a wedged native
    // bridge can leave getItem() pending forever — never resolving and never
    // throwing, so the finally below never runs. `loaded` gates the entire app
    // in App.js, which turns that into a permanent spinner on launch. Defaults
    // are a perfectly good place to start; nothing in here is worth a dead app.
    const watchdog = setTimeout(() => {
      if (!alive) return;
      console.warn("[settings] hydration timed out — starting on defaults");
      setLoaded(true);
    }, 3000);

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        // Applied even if the watchdog already fired: arriving late just means
        // the real preferences replace the defaults a moment after launch,
        // which is strictly better than not launching.
        if (alive && raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        // ignore — fall back to defaults
      } finally {
        if (alive) {
          clearTimeout(watchdog);
          setLoaded(true);
        }
      }
    })();

    return () => {
      alive = false;
      clearTimeout(watchdog);
    };
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

  // Mirror the haptics preference into the haptics module so every call site
  // across the app (which imports the plain functions) honours the switch.
  useEffect(() => {
    setHapticsEnabled(settings.haptics !== "off");
    if (settings.haptics !== "off") setHapticsLevel(settings.haptics);
  }, [settings.haptics]);

  // Same pattern for the currency symbol: shekel() is a plain function used
  // across every screen, so the preference is mirrored into its module.
  useEffect(() => {
    setCurrencySymbol(settings.currency);
  }, [settings.currency]);

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
      const heavy = settings.haptics === "heavy" || settings.haptics === "medium";
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
