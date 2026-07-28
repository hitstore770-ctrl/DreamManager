import { Text as RNText, StyleSheet } from "react-native";

import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { UI } from "../utils/ui";

// The only text primitive in the app.
//
// Every <Text> in the codebase routes through this, which is what makes the
// typography a guarantee rather than a convention. A bare <Text> renders in
// whatever the platform's default Hebrew face happens to be — on Android that
// is Roboto falling back to Noto, which is visibly not Heebo and lands in the
// middle of an otherwise consistent screen.
//
// Heebo is applied *under* the caller's style, so an existing
// `fontFamily: FONTS.bold` in a StyleSheet still wins. That matters: the
// migration flipped 853 call sites, and any of them that already named a
// weight must keep it. The floor only catches the ones that named none.
//
// `weight` is the ergonomic path for new code — <CustomText weight="bold"> —
// and it maps onto the same four Heebo files the rest of the app loads.

const WEIGHTS = {
  light: FONTS.light,
  regular: FONTS.regular,
  medium: FONTS.medium,
  semibold: FONTS.semibold,
  bold: FONTS.bold,
};

export default function CustomText({ weight, style, children, ...rest }) {
  return (
    <RNText
      {...rest}
      // Order is the whole design: base first, then the weight prop, then the
      // caller's own style last so nothing here can override an explicit
      // decision made at the call site.
      style={[s.base, weight && { fontFamily: WEIGHTS[weight] || FONTS.regular }, style]}
    >
      {children}
    </RNText>
  );
}

const s = StyleSheet.create({
  base: {
    fontFamily: FONTS.regular,
    color: UI.ink,
    // Hebrew ascenders and descenders clip at the default line height on
    // Android when a font is swapped in; a small positive leading is cheaper
    // than discovering it screen by screen.
    includeFontPadding: false,
  },
});
