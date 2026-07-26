// Thin wrapper over expo-haptics for the Notes sprint. All calls are
// best-effort and swallow errors so web / unsupported platforms are no-ops.
import * as Haptics from "expo-haptics";

// Light tap — used when pinning a note.
export function hapticLight() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Success buzz — successful checkout / save.
export function hapticSuccess() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Heavy thump — big commitments like closing the register for the day.
export function hapticHeavy() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  } catch {
    /* no-op on web */
  }
}

// Warning buzz — destructive actions: removing an item, clearing the cart,
// logging damage.
export function hapticWarning() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  } catch {
    /* no-op on web */
  }
}
