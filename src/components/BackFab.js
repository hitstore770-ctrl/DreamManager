import { I18nManager, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Bounce from "./Bounce";
import Icon from "./Icon";
import { Card } from "./Paper";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { UI, glow } from "../utils/ui";
import CustomText from "../components/CustomText";

// A floating "back" for screens that used to be tabs and are now pushed.
//
// Those screens draw their own headers, so there is nowhere to put a back
// arrow without rebuilding each one. Floating it bottom-left keeps it clear of
// the Dreams FAB (bottom-right) and of every header, and puts it under the
// thumb — which for a back control is better than the top corner anyway.
//
// Android's hardware back and the iOS edge swipe still work; this exists
// because the web preview has neither.

export function BackFab({ navigation, label = "חזרה" }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <Bounce
        testID="back-fab"
        scaleTo={0.92}
        onPress={() => {
          hapticLight();
          navigation?.goBack();
        }}
      >
        <Card style={st.glow} radius={22}>
          <View style={st.inner}>
            <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={17} color={UI.ink} />
            <CustomText style={st.label}>{label}</CustomText>
          </View>
        </Card>
      </Bounce>
    </View>
  );
}

// Wraps a screen component so it gains the back control without editing it.
export function withBack(Component, label) {
  function Wrapped(props) {
    return (
      <View style={{ flex: 1 }}>
        <Component {...props} />
        <BackFab navigation={props.navigation} label={label} />
      </View>
    );
  }
  Wrapped.displayName = `withBack(${Component.displayName || Component.name || "Screen"})`;
  return Wrapped;
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 18 },
  glow: { ...glow("#000000", 0.5) },
  inner: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    height: 46,
  },
  label: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.ink },
});

export default BackFab;
