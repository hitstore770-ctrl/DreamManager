// Thin wrapper over expo-haptics. All calls are best-effort and swallow
// errors so web / unsupported platforms are no-ops.
import * as Haptics from "expo-haptics";

// App-wide on/off switch, driven by the Settings screen through
// SettingsProvider. Kept as a module flag rather than context so the dozens of
// call sites across the app stay plain function calls.
let enabled = true;
// 'light' | 'medium' | 'heavy' — scales how hard every tap in the app feels.
let level = "light";

export function setHapticsEnabled(next) {
  enabled = next !== false;
}

export function areHapticsEnabled() {
  return enabled;
}

export function setHapticsLevel(next) {
  level = next === "medium" || next === "heavy" ? next : "light";
}

export function hapticsLevel() {
  return level;
}

// A "light" tap at the heavy setting should still feel lighter than a "heavy"
// one, so the level shifts the whole scale rather than flattening it.
const IMPACT = {
  light: { light: "Light", heavy: "Medium" },
  medium: { light: "Medium", heavy: "Heavy" },
  heavy: { light: "Heavy", heavy: "Heavy" },
};

const impactStyle = (kind) => Haptics.ImpactFeedbackStyle[IMPACT[level][kind]];

// Light tap — used when pinning a note.
export function hapticLight() {
  if (!enabled) return;
  try {
    Haptics.impactAsync(impactStyle("light")).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Success buzz — successful checkout / save.
export function hapticSuccess() {
  if (!enabled) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Heavy thump — big commitments like closing the register for the day.
export function hapticHeavy() {
  if (!enabled) return;
  try {
    Haptics.impactAsync(impactStyle("heavy")).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Warning buzz — destructive actions: removing an item, clearing the cart,
// logging damage.
export function hapticWarning() {
  if (!enabled) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  } catch {
    /* no-op on web */
  }
}
