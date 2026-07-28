import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import Coin from "./money/Coin";

// The motion behind the cash-flow headline: money rising when the month is
// positive, sinking when it is not.
//
// RIVE
// ----
// rive-react-native is installed and this is where a .riv state machine
// belongs — one artboard with a "positive"/"negative" input, which is exactly
// the interactive, state-driven case Rive is better at than any tween.
//
// There is no .riv file in this project, so nothing is wired to it yet. A
// Rive component pointed at a missing asset renders an empty box, and
// inventing a placeholder animation to make the dependency look used would be
// worse than leaving it honest: it would ship a fake as if it were the
// deliverable. So this draws the real coins the app already owns, and the
// moment an artboard exists the swap is confined to this file.
//
// Drop `cashflow.riv` into assets/, then:
//
//   import Rive from "rive-react-native";
//   <Rive
//     resourceName="cashflow"
//     stateMachineName="Flow"
//     autoplay
//     // set the boolean input from `state`
//   />

const COINS = [
  { agorot: 1000, size: 30, x: 0.12, delay: 0, ms: 4200 },
  { agorot: 500, size: 24, x: 0.3, delay: 900, ms: 5200 },
  { agorot: 100, size: 20, x: 0.72, delay: 1800, ms: 4600 },
  { agorot: 200, size: 26, x: 0.88, delay: 500, ms: 5800 },
];

function Drifter({ coin, rising }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      coin.delay,
      withRepeat(withTiming(1, { duration: coin.ms, easing: Easing.inOut(Easing.quad) }), -1, false)
    );
  }, [coin.delay, coin.ms]);

  const style = useAnimatedStyle(() => {
    // One pass = a full traverse of the card. Rising money travels up and
    // fades at the top; a negative month runs the same arc downward.
    const p = t.value;
    const travel = rising ? 1 - p : p;
    return {
      transform: [{ translateY: -20 + travel * 130 }],
      // Fade in and out at the ends so a coin never pops into existence.
      opacity: Math.sin(p * Math.PI) * 0.5,
    };
  });

  return (
    <Animated.View style={[st.coin, { left: `${coin.x * 100}%` }, style]} pointerEvents="none">
      <Coin agorot={coin.agorot} size={coin.size} />
    </Animated.View>
  );
}

export default function FlowAnimation({ state = "positive", style }) {
  const rising = state === "positive";
  return (
    <View style={[st.wrap, style]} pointerEvents="none">
      {COINS.map((c) => (
        <Drifter key={c.agorot} coin={c} rising={rising} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { overflow: "hidden" },
  coin: { position: "absolute", top: 0 },
});
