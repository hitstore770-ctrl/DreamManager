import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// A press target that dips to 0.95 and springs back. Wraps Pressable rather
// than TouchableOpacity so the scale is the whole feedback — no opacity flash
// competing with it.
//
// Usage is a drop-in for TouchableOpacity: <Bounce style={...} onPress={...}>.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IN = { damping: 18, stiffness: 420, mass: 0.5 };
const OUT = { damping: 12, stiffness: 260, mass: 0.6 };

export default function Bounce({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  scaleTo = 0.95,
  hitSlop,
  testID,
  ...rest
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      testID={testID}
      style={[style, animated]}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(scaleTo, IN);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, OUT);
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
