import { Text } from "react-native";
import { defaultLetterSpacing, defaultLineHeight, familyForWeight, flattenStyleProp } from "../theme/typography";
import { useSettings } from "../settings/SettingsContext";

// Drop-in replacement for RN's <Text>. Resolves the app's custom offline
// font (Rubik) from whatever `fontWeight` the caller's style already
// specifies, and fills in a comfortable default letter-spacing/line-height
// when the caller hasn't set one — so the whole app gets consistent,
// elegant typography without every call site needing to know the font's
// family names or retune spacing by hand.
//
// If the caller already picked an explicit `fontFamily` (e.g. monospace for
// code), that's respected completely and none of the size-based tuning
// applies — code wants its own rhythm, not prose spacing.
export default function AppText({ style, ...props }) {
  const { fontScale } = useSettings();
  const explicitFamily = flattenStyleProp(style, "fontFamily");
  if (explicitFamily) {
    return <Text {...props} style={style} />;
  }

  const weight = flattenStyleProp(style, "fontWeight");
  const fontSize = (flattenStyleProp(style, "fontSize") ?? 15) * fontScale;
  const hasLineHeight = flattenStyleProp(style, "lineHeight") != null;
  const hasLetterSpacing = flattenStyleProp(style, "letterSpacing") != null;

  const base = {
    fontFamily: familyForWeight(weight),
    ...(hasLetterSpacing ? null : { letterSpacing: defaultLetterSpacing(fontSize) }),
    ...(hasLineHeight ? null : { lineHeight: defaultLineHeight(fontSize) }),
  };

  // The scaled fontSize always wins, last in the array -- otherwise the
  // caller's own (unscaled) fontSize in `style` would override `base` and
  // silently cancel the setting out.
  return <Text {...props} style={[base, style, { fontSize }]} />;
}
