import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// A gentle, never-ending breath. Used on empty-state art and "add new"
// affordances so a blank screen still has something alive drawing the eye.
//
// The cycle is slow and the amplitude small on purpose — this sits in the
// background of the layout, it should not compete with content.

export default function Pulse({ children, style, min = 1, max = 1.06, duration = 1400, glowTo = 0.55 }) {
  const scale = useSharedValue(min);
  const halo = useSharedValue(0.25);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(max, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(min, { duration, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    halo.value = withRepeat(
      withSequence(
        withTiming(glowTo, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.25, { duration, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [min, max, duration, glowTo]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: halo.value,
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
