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

// Success buzz — used when a note is deleted.
export function hapticSuccess() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    /* no-op on web */
  }
}
