import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// A press target that dips to 0.92 and springs back. Wraps Pressable rather
// than TouchableOpacity so the scale is the whole feedback — no opacity flash
// competing with it.
//
// Usage is a drop-in for TouchableOpacity: <Bounce style={...} onPress={...}>.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IN = { damping: 16, stiffness: 400, mass: 0.5 };
// Low damping on release so it overshoots slightly — that is the "bounce".
const OUT = { damping: 9, stiffness: 240, mass: 0.6 };

export default function Bounce({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  scaleTo = 0.92,
  hitSlop,
  testID,
  onPressIn,
  onPressOut,
  ...rest
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      testID={testID}
      style={[style, animated]}
      // Compose rather than replace: a caller's own press handlers still run.
      onPressIn={(e) => {
        if (!disabled) scale.value = withSpring(scaleTo, IN);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, OUT);
        onPressOut?.(e);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
