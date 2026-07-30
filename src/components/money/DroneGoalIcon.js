import { useCallback, useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { UI } from "../../utils/ui";

// The DJI drone savings goal, drawn rather than measured.
//
// A progress ring answers "how much" in the abstract; this answers it as the
// thing the money is actually for. The mechanism is the classic fill-icon
// trick — two identical airframes stacked, a grey one on top of a vibrant
// one, the top one clipped from the top down by a plain View with
// `overflow: hidden` — rather than an SVG clip path, because a View's height
// is trivial to drive from Reanimated and a clip path is not.
//
// The propeller blades are a separate, single layer on top of both — always
// drawn in the vibrant colour, at rest. That is a deliberate simplification:
// animating a colour transition on four tiny rects in step with the fill
// mask added real complexity for a detail nobody would notice was "wrong" if
// skipped, since a drone's props are plausibly just a different colour from
// its body to begin with. What they do earn is the motion: they only ever
// rotate once, when `takeoffTrigger` changes, which the dashboard bumps the
// instant a swipe pushes the goal to 100%. Nothing about the spin depends on
// `progress`, so a re-render mid-flight cannot restart or glitch it.

const AnimatedG = Animated.createAnimatedComponent(G);

const HUBS = [
  { cx: 13, cy: 13 },
  { cx: 51, cy: 13 },
  { cx: 13, cy: 51 },
  { cx: 51, cy: 51 },
];

// The airframe only — body, arms, hub rings. No blades: those are the
// separate SpinningHub layer, drawn once regardless of fill state.
function Airframe({ tone }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 64 64">
      {HUBS.map((h) => (
        <Line key={`arm-${h.cx}-${h.cy}`} x1={32} y1={32} x2={h.cx} y2={h.cy} stroke={tone} strokeWidth={2.5} />
      ))}
      {HUBS.map((h) => (
        <Circle key={`ring-${h.cx}-${h.cy}`} cx={h.cx} cy={h.cy} r={7} fill="none" stroke={tone} strokeWidth={2} />
      ))}
      <Rect x={22} y={26} width={20} height={13} rx={5} fill={tone} />
      <Circle cx={32} cy={22} r={3.5} fill={tone} />
    </Svg>
  );
}

function SpinningHub({ hub, spin, color }) {
  const animatedProps = useAnimatedProps(() => ({ rotation: spin.value }));
  return (
    <AnimatedG origin={`${hub.cx}, ${hub.cy}`} animatedProps={animatedProps}>
      <Rect x={hub.cx - 5.5} y={hub.cy - 1} width={11} height={2} rx={1} fill={color} />
      <Rect x={hub.cx - 1} y={hub.cy - 5.5} width={2} height={11} rx={1} fill={color} />
    </AnimatedG>
  );
}

export default function DroneGoalIcon({
  progress = 0,
  size = 56,
  color = UI.violet,
  track = "#E7EAF0",
  takeoffTrigger = 0,
  onTakeoffComplete,
  testID,
}) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));

  const scale = useSharedValue(1);
  const flyY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const spinA = useSharedValue(0);
  const spinB = useSharedValue(0);
  const spinC = useSharedValue(0);
  const spinD = useSharedValue(0);
  const spins = [spinA, spinB, spinC, spinD];

  const reset = useCallback(() => {
    scale.value = 1;
    flyY.value = 0;
    opacity.value = 1;
    spinA.value = 0;
    spinB.value = 0;
    spinC.value = 0;
    spinD.value = 0;
  }, [scale, flyY, opacity, spinA, spinB, spinC, spinD]);

  useEffect(() => {
    if (!takeoffTrigger) return undefined;

    // 1. A small confident scale-up — this is the moment the goal was hit.
    scale.value = withSequence(withTiming(1.18, { duration: 220 }), withTiming(1.05, { duration: 160 }));

    // 2. Propellers spin up, each starting a beat apart so the four do not
    //    read as one rigid unit.
    spins.forEach((s, i) => {
      s.value = withDelay(
        i * 60,
        withRepeat(withTiming(1440, { duration: 500, easing: Easing.linear }), 1)
      );
    });

    // 3. Once the propellers have had time to spin up, fly straight off the
    //    top of the screen and fade on the way out.
    flyY.value = withDelay(520, withTiming(-360, { duration: 650, easing: Easing.in(Easing.cubic) }));
    opacity.value = withDelay(
      760,
      withTiming(0, { duration: 380 }, (done) => {
        if (done) runOnJS(reset)();
        if (done && onTakeoffComplete) runOnJS(onTakeoffComplete)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeoffTrigger]);

  const flightStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: flyY.value }, { scale: scale.value }],
  }));

  // The fill mask: a grey airframe on top, its own height driven straight
  // from `progress` (not the takeoff sequence), clipping from the top down
  // to reveal the vibrant one underneath as the goal fills.
  const maskStyle = useAnimatedStyle(() => ({
    height: withTiming(size * (1 - clamped), { duration: 450 }),
  }));

  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, flightStyle]}>
        <View style={{ width: size, height: size, position: "absolute" }}>
          <Airframe tone={color} />
        </View>
        <Animated.View style={[{ width: size, position: "absolute", top: 0, overflow: "hidden" }, maskStyle]}>
          <View style={{ width: size, height: size }}>
            <Airframe tone={track} />
          </View>
        </Animated.View>
        <View style={{ width: size, height: size, position: "absolute" }} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 64 64">
            {HUBS.map((h, i) => (
              <SpinningHub key={`spin-${h.cx}-${h.cy}`} hub={h} spin={spins[i]} color={color} />
            ))}
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}
