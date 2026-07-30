import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import Bounce from "../Bounce";
import CustomText from "../CustomText";
import Icon from "../Icon";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { BEVEL, UI, tint } from "../../utils/ui";

// Today's unallocated profit, as a card you throw rather than a number you
// read. A swipe is the right verb for a decision that is really just "which
// pile does this go on" — three destinations, three directions, no menu.
//
// Direction reads as an RTL layout would expect it, not as a phone's compass:
// right is where "the next thing" lives on a right-to-left screen (the
// register, the deck the AliExpress budget refills), left is where a value
// leaves toward the person (the pocket), up is the one that is not about
// today at all — it leaves the day's spending entirely and goes toward the
// goal above everything else.
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const SWIPE_DISTANCE = 90;

export default function ProfitAllocationCard({ amount, onAllocate, testID }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const gone = useSharedValue(0); // 0 = on screen, 1 = flung away and settled

  const settle = (destination) => {
    "worklet";
    runOnJS(onAllocate)(destination);
  };

  const flingTo = (dx, dy, destination) => {
    tx.value = withTiming(dx, { duration: 260 });
    ty.value = withTiming(dy, { duration: 260 }, (done) => {
      if (done) {
        gone.value = 1;
        settle(destination);
      }
    });
  };

  const snapBack = () => {
    tx.value = withTiming(0, { duration: 200 });
    ty.value = withTiming(0, { duration: 200 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const dy = e.translationY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Up wins outright when it is the dominant axis — a diagonal fling
      // toward the top-right should not silently register as "restock".
      if (absY > SWIPE_DISTANCE && absY > absX) {
        if (dy < 0) {
          flingTo(dx, -SCREEN_H, "goal");
        } else {
          snapBack();
        }
        return;
      }
      if (absX > SWIPE_DISTANCE) {
        if (dx > 0) {
          flingTo(SCREEN_W, dy, "buying");
        } else {
          flingTo(-SCREEN_W, dy, "withdraw");
        }
        return;
      }
      snapBack();
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-200, 0, 200], [-10, 0, 10])}deg` },
    ],
    opacity: gone.value === 1 ? 0 : 1,
  }));

  // Each destination hint brightens as the card is dragged toward it, so the
  // card says what a swipe will do before the swipe commits to it.
  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, SWIPE_DISTANCE], [0.35, 1], "clamp"),
  }));
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-SWIPE_DISTANCE, 0], [1, 0.35], "clamp"),
  }));
  const upHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-SWIPE_DISTANCE, 0], [1, 0.35], "clamp"),
  }));

  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.hintRow}>
        <Animated.View style={[s.hint, leftHintStyle]}>
          <Icon name="pocket" size={14} color={UI.green} />
          <CustomText style={[s.hintText, { color: UI.green }]}>לכיס</CustomText>
        </Animated.View>
        <Animated.View style={[s.hint, upHintStyle]}>
          <Icon name="wind" size={14} color={UI.violet} />
          <CustomText style={[s.hintText, { color: UI.violet }]}>לרחפן</CustomText>
        </Animated.View>
        <Animated.View style={[s.hint, rightHintStyle]}>
          <Icon name="package" size={14} color={UI.cyan} />
          <CustomText style={[s.hintText, { color: UI.cyan }]}>לרכש</CustomText>
        </Animated.View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View testID={`${testID}-card`} style={[s.card, cardStyle]}>
          <View style={s.badge}>
            <Icon name="trending-up" size={17} color={UI.green} />
          </View>
          <CustomText style={s.label}>רווח היום — לא הוקצה</CustomText>
          <CustomText testID={`${testID}-amount`} weight="bold" style={s.amount}>
            {shekel(amount)}
          </CustomText>
          <CustomText style={s.swipeHint}>גררו למעלה, ימינה או שמאלה</CustomText>
        </Animated.View>
      </GestureDetector>

      {/* Tap fallback — a gesture-only action is unreachable with a switch
          control or a screen reader. */}
      <View style={s.buttonRow}>
        <MiniButton testID={`${testID}-btn-withdraw`} label="לכיס" tone={UI.green} onPress={() => onAllocate("withdraw")} />
        <MiniButton testID={`${testID}-btn-goal`} label="לרחפן" tone={UI.violet} onPress={() => onAllocate("goal")} />
        <MiniButton testID={`${testID}-btn-buying`} label="לרכש" tone={UI.cyan} onPress={() => onAllocate("buying")} />
      </View>
    </View>
  );
}

function MiniButton({ testID, label, tone, onPress }) {
  return (
    <Bounce
      testID={testID}
      onPress={onPress}
      style={[s.miniBtn, { borderColor: tint(tone, 0.35), backgroundColor: tint(tone, 0.08) }]}
    >
      <CustomText style={[s.miniBtnText, { color: tone }]}>{label}</CustomText>
    </Bounce>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: UI.cardMarginH, marginBottom: 22 },
  hintRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 6, marginBottom: 8 },
  hint: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  hintText: { fontFamily: FONTS.semibold, fontSize: 11.5 },

  card: {
    borderRadius: UI.radius,
    padding: 20,
    alignItems: "center",
    backgroundColor: UI.surface,
    ...BEVEL,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: tint(UI.green, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  label: { fontFamily: FONTS.regular, fontSize: 12, color: UI.inkMuted },
  amount: { fontSize: 30, color: UI.ink, marginTop: 2 },
  swipeHint: { fontFamily: FONTS.regular, fontSize: 10.5, color: UI.inkMuted, marginTop: 6 },

  buttonRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  miniBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  miniBtnText: { fontFamily: FONTS.semibold, fontSize: 12.5 },
});
