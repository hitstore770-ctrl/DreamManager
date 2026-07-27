import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { BEVEL, CARD_SHADOW, GRAD, UI, glow } from "../utils/ui";

// The three surfaces the premium screens are built from.
//
// Every one of them layers the same three things in the same order: a base
// (gradient or blur), a top-light bevel, and a shadow beneath. That ordering
// is the whole trick — a bevel under a gradient reads as a stroke, a bevel
// over one reads as an edge catching light.

// Full-screen canvas. The two aurora blobs are what stop a #0F172A screen
// from looking like an unstyled dark div: they give the background a light
// source, so surfaces on top of it have something to be lit by.
export function Canvas({ children, style, aurora = true, tone = UI.violet, testID }) {
  // The aurora needs the canvas's pixel size: an Svg sized only by a style of
  // absoluteFill falls back to its intrinsic viewport and clips the glow into
  // a visible rectangle. Measuring first costs one extra frame and is the only
  // way to be sure the circles are not cropped.
  const [size, setSize] = useState(null);

  return (
    <View
      testID={testID}
      style={[st.canvas, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
    >
      <LinearGradient colors={GRAD.canvas} style={StyleSheet.absoluteFill} />
      {aurora && size && <Aurora tone={tone} {...size} />}
      {children}
    </View>
  );
}

// The aurora has to fall off radially. A flat View at 13% opacity still has a
// hard circular edge, and on a dark canvas that edge is clearly visible as a
// drawn circle rather than as light — which is worse than no glow at all.
function Aurora({ tone, width, height }) {
  const r = Math.max(width, height) * 0.55;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="auroraA" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={tone} stopOpacity="0.28" />
          <Stop offset="0.5" stopColor={tone} stopOpacity="0.09" />
          <Stop offset="1" stopColor={tone} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="auroraB" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={UI.cyan} stopOpacity="0.18" />
          <Stop offset="0.5" stopColor={UI.cyan} stopOpacity="0.06" />
          <Stop offset="1" stopColor={UI.cyan} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={width * 0.9} cy={height * 0.02} r={r} fill="url(#auroraA)" />
      <Circle cx={width * 0.08} cy={height * 0.98} r={r} fill="url(#auroraB)" />
    </Svg>
  );
}

// Frosted glass. Real blur where the platform supports it, with a translucent
// gradient over the top so it still reads as glass if blur is unavailable —
// on a dark canvas an unsupported BlurView degrades to nothing at all, and a
// transparent card is worse than a flat one.
export function Glass({ children, style, intensity = 28, radius = UI.radius, bevel = true }) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={GRAD.glass}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {bevel && <View style={[StyleSheet.absoluteFill, { borderRadius: radius, ...BEVEL }]} pointerEvents="none" />}
      {children}
    </View>
  );
}

// A solid slab. `colors` accepts any GRAD ramp; `halo` puts the slab in a
// coloured pool of its own light.
export function GradCard({ children, style, colors = GRAD.surface, halo, radius = UI.radius, angle = 1 }) {
  return (
    <View style={[{ borderRadius: radius }, halo ? glow(halo, 0.35) : CARD_SHADOW, style]}>
      <View style={{ borderRadius: radius, overflow: "hidden" }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: angle, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular band across the top third. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {children}
      </View>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, ...BEVEL }]} pointerEvents="none" />
    </View>
  );
}

const st = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: UI.bg },
});
