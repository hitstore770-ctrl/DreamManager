import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { UI } from "../../utils/ui";

// The vault behind the headline number.
//
// RIVE
// ----
// This is the component structured for it. Point one of the two constants
// below at an artboard and the Rive path takes over; nothing else changes.
//
//   RIVE_RESOURCE  a .riv bundled with the app (android res/raw + iOS bundle)
//   RIVE_URL       a hosted .riv fetched at runtime
//
// Both are null, because this project has no artboard and there is no
// "default placeholder Rive file URL" worth hardcoding: a Rive component
// pointed at a URL that 404s renders an empty box, so shipping a guessed link
// would replace a working visual with a blank one and call it integration.
// What is below is a real vault — drawn, animated, and honest about being
// SVG until an artboard exists.
//
// A vault is also a better fit for Rive than the drawing is: the interesting
// version has a state machine (locked → spinning → open) driven by whether
// the month is up. That is exactly the case Rive beats a tween at, which is
// why the swap point is kept to this one file.
const RIVE_RESOURCE = null;
const RIVE_URL = null;

let RiveModule = null;
try {
  // eslint-disable-next-line global-require
  RiveModule = require("rive-react-native");
} catch {
  RiveModule = null;
}

const hasArtboard = !!(RIVE_RESOURCE || RIVE_URL);

export default function RiveVault({ size = 148, tone = UI.violet, open = true }) {
  const Rive = RiveModule?.default;

  if (Rive && hasArtboard) {
    return (
      <Rive
        style={{ width: size, height: size }}
        {...(RIVE_URL ? { url: RIVE_URL } : { resourceName: RIVE_RESOURCE })}
        stateMachineName="Vault"
        autoplay
      />
    );
  }

  return <DrawnVault size={size} tone={tone} open={open} />;
}

// A minimalist vault door: one ring, one dial, eight bolts.
//
// The dial turns slowly and never completes a revolution in a time anyone
// watches — the point is that the thing reads as *alive* at a glance, not
// that anyone sees it move. A fast spin on a financial screen looks like a
// loading state, which is the one thing this must not be mistaken for.
function DrawnVault({ size, tone, open }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false);
  }, [spin]);

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const r = size / 2;
  const ringR = r - 6;
  const innerR = r * 0.62;
  const boltR = r * 0.82;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="vaultBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.55" stopColor="#F1F3F8" />
            <Stop offset="1" stopColor="#E3E7EF" />
          </LinearGradient>
          <LinearGradient id="vaultInner" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.14" />
            <Stop offset="1" stopColor={tone} stopOpacity="0.04" />
          </LinearGradient>
        </Defs>

        {/* The door */}
        <Circle cx={r} cy={r} r={ringR} fill="url(#vaultBody)" stroke="#DCE1EA" strokeWidth="1.5" />
        {/* A light catch along the top-left, so it reads as metal rather than
            as a flat grey disc. */}
        <Circle cx={r} cy={r} r={ringR - 3} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.9" />

        {/* Bolts around the rim */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          return (
            <Circle
              key={i}
              cx={r + Math.cos(a) * boltR}
              cy={r + Math.sin(a) * boltR}
              r={2.6}
              fill="#C7CEDA"
            />
          );
        })}

        {/* The recessed centre */}
        <Circle cx={r} cy={r} r={innerR} fill="url(#vaultInner)" stroke="#D8DDE7" strokeWidth="1" />
        {open && <Circle cx={r} cy={r} r={innerR * 0.42} fill={tone} fillOpacity="0.12" />}
      </Svg>

      {/* The dial, spinning on its own layer so no SVG prop has to animate. */}
      <Animated.View style={[StyleSheet.absoluteFill, st.center, dialStyle]} pointerEvents="none">
        <Svg width={size} height={size}>
          <G>
            {Array.from({ length: 4 }).map((_, i) => {
              const a = (i / 4) * Math.PI;
              const x = Math.cos(a) * innerR * 0.72;
              const y = Math.sin(a) * innerR * 0.72;
              return (
                <Rect
                  key={i}
                  x={r - 2}
                  y={r - Math.hypot(x, y)}
                  width={4}
                  height={Math.hypot(x, y) * 2}
                  rx={2}
                  fill="#B9C1CF"
                  origin={`${r}, ${r}`}
                  rotation={(i / 4) * 180}
                />
              );
            })}
            <Circle cx={r} cy={r} r={7} fill="#FFFFFF" stroke="#C7CEDA" strokeWidth="1.5" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

// True when a real artboard is wired, so a screen can say which one is on
// rather than guessing.
export const VAULT_IS_RIVE = !!(RiveModule?.default && hasArtboard);

const st = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
