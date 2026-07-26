import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import Bounce from "./Bounce";
import { hapticLight } from "../utils/haptics";
import { listEntry } from "../utils/motion";
import { CARD_SHADOW, UI } from "../utils/ui";

// The card. Every list item, tool and layout block in the app is one of these,
// so the radius/padding/margin/shadow live in exactly one place.
//
//   <Card>                      static block
//   <Card onPress={…}>          bouncy + haptic press target
//   <Card index={i}>            staggered entrance in a list
//   <Card flush>                no outer margins (for cards inside a card)

export default function Card({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  index = null,
  flush = false,
  padded = true,
  testID,
  haptic = true,
}) {
  const base = [s.card, padded && s.padded, !flush && s.spaced, style];

  const inner = onPress ? (
    <Bounce
      testID={testID}
      style={base}
      scaleTo={0.95}
      onPress={() => {
        if (haptic) hapticLight();
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
    >
      {children}
    </Bounce>
  ) : (
    <View testID={testID} style={base}>
      {children}
    </View>
  );

  // A staggered card animates its own wrapper so the shadow is not clipped.
  if (index !== null) {
    return <Animated.View entering={listEntry(index)}>{inner}</Animated.View>;
  }
  return inner;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    ...CARD_SHADOW,
  },
  padded: { padding: UI.cardPadding },
  spaced: { marginHorizontal: UI.cardMarginH, marginBottom: UI.cardMarginB },
});
