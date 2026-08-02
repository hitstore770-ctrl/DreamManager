import { I18nManager, Platform } from "react-native";

// react-native-web's I18nManager is a permanent stub (isRTL always false),
// so on web this checks the `dir` attribute App.js sets on the document
// directly instead. On native, I18nManager.isRTL is the real signal.
export function isRTL() {
  if (Platform.OS === "web") {
    return typeof document !== "undefined" && document.documentElement.dir === "rtl";
  }
  return I18nManager.isRTL;
}
