import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Coin from "./Coin";
import { dropPlan, squashFor } from "../../utils/physics";

// A struck coin, dropped under gravity, bounced, and settled into the pile.
//
// Split out of the piggy bank screen so the physics is reusable and testable on
// its own: the screen decides *when* a coin drops, this decides *how* it falls.
// Every timing comes from dropPlan rather than from a literal, so changing the
// jar's height or the gravity constant reflows the whole animation instead of
// leaving a hand-tuned stack of delays subtly out of step.
//
// Reanimated drives all of it on the UI thread, so the drop does not stutter
// while React re-renders the balance underneath it.

export default function FallingCoin({
  agorot,
  size = 42,
  startX = 0,
  distance = 180,
  onLand,
  onDone,
}) {
  const plan = useMemo(() => dropPlan(distance), [distance]);

  const y = useSharedValue(-size);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const spin = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    const floor = distance - size;
    const { impactMs, bounces, totalMs } = plan;

    // --- the fall: ease-in, because gravity accelerates ---------------------
    // A linear drop reads as a sticker being slid down rather than a coin
    // being let go.
    const fall = [withTiming(floor, { duration: impactMs, easing: Easing.in(Easing.quad) })];

    // --- the bounces: up decelerating, down accelerating --------------------
    bounces.forEach((b) => {
      fall.push(
        withTiming(floor - b.height, { duration: b.ms / 2, easing: Easing.out(Easing.quad) }),
        withTiming(floor, { duration: b.ms / 2, easing: Easing.in(Easing.quad) })
      );
    });

    y.value = withSequence(...fall);

    // Spin proportional to airtime, so a longer fall turns further.
    spin.value = withTiming(220 + Math.random() * 260, { duration: plan.totalMs });

    // --- squash on each impact, weaker every time ---------------------------
    const squashAt = (delay, strength) => {
      const amount = 0.34 * strength;
      return [
        withDelay(delay, withTiming(1 - amount, { duration: 55 })),
        withSpring(1, { damping: 7, stiffness: 340 }),
      ];
    };

    // First landing is the hard one; later ones scale with impact velocity.
    let t = impactMs;
    const squashSeqY = squashAt(t, 1);
    const squashSeqX = [
      withDelay(t, withTiming(1 + 0.3, { duration: 55 })),
      withSpring(1, { damping: 7, stiffness: 340 }),
    ];

    bounces.forEach((b) => {
      t += b.ms;
      const strength = squashFor(b.height, distance);
      squashSeqY.push(...squashAt(0, strength).map((s, i) => (i === 0 ? withDelay(b.ms, s) : s)));
      squashSeqX.push(
        withDelay(b.ms, withTiming(1 + 0.3 * strength, { duration: 55 })),
        withSpring(1, { damping: 7, stiffness: 340 })
      );
    });

    scaleY.value = withSequence(...squashSeqY);
    scaleX.value = withSequence(...squashSeqX);

    // --- settle: sink into the pile ----------------------------------------
    fade.value = withDelay(
      totalMs + 120,
      withTiming(0, { duration: 240 }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      })
    );

    // The balance is credited on the *first* impact, not when the coin
    // disappears: the number and the sound should land with the coin, and the
    // bounces afterwards are decoration.
    if (onLand) {
      const timer = setTimeout(onLand, plan.impactMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
      { rotate: `${spin.value}deg` },
    ],
    opacity: fade.value,
  }));

  return (
    <Animated.View testID="falling-coin" pointerEvents="none" style={[st.wrap, { left: startX }, style]}>
      <Coin agorot={agorot} size={size} />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", top: 0, zIndex: 4 },
});
