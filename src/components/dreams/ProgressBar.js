import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

// A progress bar whose fill animates to the new percentage — used so adding
// funds visibly *fills* the bar rather than snapping to the new value.
export default function ProgressBar({
  pct,
  height = 8,
  track = "rgba(255,255,255,0.26)",
  fill = "#D4AF37",
  duration = 650,
  style,
}) {
  const w = useSharedValue(0);
  const target = Math.max(0, Math.min(100, pct || 0));

  useEffect(() => {
    w.value = withTiming(target, { duration });
  }, [target, duration]);

  const animated = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }, style]}
    >
      <Animated.View
        style={[{ height: "100%", borderRadius: height / 2, backgroundColor: fill }, animated]}
      />
    </View>
  );
}
